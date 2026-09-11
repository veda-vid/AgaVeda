// components/media/VideoOptimizeHost.tsx — Expo Go–safe video re-encode via WebView MediaRecorder

import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { normalizeMediaUri } from '../../lib/mediaUpload';

type OptimizeRequest = {
  id: string;
  uri: string;
  resolve: (outUri: string) => void;
  reject: (err: Error) => void;
  onProgress?: (pct: number) => void;
};

type Bridge = {
  enqueue: (
    uri: string,
    onProgress?: (pct: number) => void,
  ) => Promise<string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __vedastyaVideoOptimizeBridge: Bridge | undefined;
}

const TARGET_BITRATE = 1_200_000;
const TARGET_WIDTH = 720;
const MAX_DURATION_SEC = 60;

function buildHtml(videoUri: string) {
  const safe = JSON.stringify(videoUri);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body{margin:0;background:#000}video{width:1px;height:1px;opacity:0}</style>
</head>
<body>
  <video id="v" playsinline muted crossorigin="anonymous"></video>
  <script>
    const src = ${safe};
    const bitrate = ${TARGET_BITRATE};
    const maxW = ${TARGET_WIDTH};
    const maxDur = ${MAX_DURATION_SEC};

    function post(msg) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    }

    function pickMime() {
      // Prefer MP4/H.264 when the WebView supports it — native players play it reliably.
      // WebM is a last resort (Android Moments use WebView HTML5 fallback for playback).
      const types = [
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
      ];
      for (const t of types) {
        try {
          if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
        } catch (e) {}
      }
      return '';
    }

    async function run() {
      try {
        if (!window.MediaRecorder) {
          post({ type: 'error', message: 'MediaRecorder unavailable' });
          return;
        }
        const video = document.getElementById('v');
        video.src = src;
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Video load timeout')), 25000);
          video.onloadeddata = () => { clearTimeout(t); resolve(); };
          video.onerror = () => { clearTimeout(t); reject(new Error('Video failed to load in WebView')); };
          video.load();
        });

        const duration = Math.min(Number(video.duration) || maxDur, maxDur);
        const vw = video.videoWidth || maxW;
        const vh = video.videoHeight || Math.round(maxW * 16 / 9);
        const scale = Math.min(1, maxW / Math.max(vw, 1));
        const w = Math.max(2, Math.round(vw * scale / 2) * 2);
        const h = Math.max(2, Math.round(vh * scale / 2) * 2);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          post({ type: 'error', message: 'Canvas unavailable' });
          return;
        }

        let stream;
        if (typeof video.captureStream === 'function') stream = video.captureStream();
        else if (typeof video.mozCaptureStream === 'function') stream = video.mozCaptureStream();
        else stream = canvas.captureStream(24);

        try {
          const canvasStream = canvas.captureStream(24);
          const videoTrack = canvasStream.getVideoTracks()[0];
          const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          stream = new MediaStream([videoTrack].concat(audioTracks));
        } catch (e) {}

        const mime = pickMime();
        const options = mime
          ? { mimeType: mime, videoBitsPerSecond: bitrate }
          : { videoBitsPerSecond: bitrate };
        const recorder = new MediaRecorder(stream, options);
        const chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };

        const stopped = new Promise((resolve, reject) => {
          recorder.onstop = () => resolve();
          recorder.onerror = () => reject(new Error('MediaRecorder failed'));
        });

        recorder.start(250);
        post({ type: 'progress', pct: 0.05 });
        await video.play().catch(() => {});

        const started = performance.now();
        const draw = () => {
          try { ctx.drawImage(video, 0, 0, w, h); } catch (e) {}
          const elapsed = (performance.now() - started) / 1000;
          const pct = Math.max(0.05, Math.min(0.92, elapsed / Math.max(duration, 0.1)));
          post({ type: 'progress', pct });
          if (!video.paused && !video.ended && elapsed < duration) requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);

        await new Promise((resolve) => {
          video.onended = () => resolve();
          setTimeout(() => resolve(), Math.ceil(duration * 1000) + 500);
        });

        try { video.pause(); } catch (e) {}
        if (recorder.state !== 'inactive') recorder.stop();
        await stopped;

        const blob = new Blob(chunks, { type: mime || 'video/webm' });
        if (!blob.size) {
          post({ type: 'error', message: 'Optimized video was empty' });
          return;
        }

        const reader = new FileReader();
        const b64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const result = String(reader.result || '');
            const idx = result.indexOf(',');
            resolve(idx >= 0 ? result.slice(idx + 1) : result);
          };
          reader.onerror = () => reject(new Error('Could not read optimized video'));
          reader.readAsDataURL(blob);
        });

        const CHUNK = 320000;
        const total = Math.ceil(b64.length / CHUNK);
        post({ type: 'result-start', total, byteSize: blob.size, mime: blob.type || 'video/webm' });
        for (let i = 0; i < total; i++) {
          post({ type: 'result-chunk', index: i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
        }
        post({ type: 'result-end' });
      } catch (e) {
        post({ type: 'error', message: (e && e.message) ? e.message : String(e) });
      }
    }
    run();
  </script>
</body>
</html>`;
}

/**
 * Hidden host that re-encodes oversized Moments videos in Expo Go.
 * Mount once near app root.
 */
export function VideoOptimizeHost() {
  const queueRef = useRef<OptimizeRequest[]>([]);
  const activeRef = useRef<OptimizeRequest | null>(null);
  const chunksRef = useRef<string[]>([]);
  const metaRef = useRef<{ total: number; mime: string; byteSize: number } | null>(null);
  const [activeUri, setActiveUri] = useState<string | null>(null);

  const processNext = () => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setActiveUri(null);
      return;
    }
    activeRef.current = next;
    chunksRef.current = [];
    metaRef.current = null;
    setActiveUri(normalizeMediaUri(next.uri));
  };

  useEffect(() => {
    const bridge: Bridge = {
      enqueue: (uri, onProgress) =>
        new Promise<string>((resolve, reject) => {
          queueRef.current.push({
            id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            uri,
            resolve,
            reject,
            onProgress,
          });
          processNext();
        }),
    };
    globalThis.__vedastyaVideoOptimizeBridge = bridge;
    return () => {
      if (globalThis.__vedastyaVideoOptimizeBridge === bridge) {
        globalThis.__vedastyaVideoOptimizeBridge = undefined;
      }
    };
  }, []);

  const finish = async (ok: boolean, payload?: string, error?: string) => {
    const active = activeRef.current;
    activeRef.current = null;
    setActiveUri(null);
    if (active) {
      if (ok && payload) active.resolve(payload);
      else active.reject(new Error(error || 'Video optimize failed'));
    }
    setTimeout(processNext, 40);
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    const active = activeRef.current;
    if (!active) return;
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (msg.type === 'progress') {
      active.onProgress?.(Math.max(0, Math.min(1, Number(msg.pct) || 0)));
      return;
    }
    if (msg.type === 'error') {
      await finish(false, undefined, msg.message || 'Optimize error');
      return;
    }
    if (msg.type === 'result-start') {
      chunksRef.current = new Array(Number(msg.total) || 0).fill('');
      metaRef.current = {
        total: Number(msg.total) || 0,
        mime: String(msg.mime || 'video/webm'),
        byteSize: Number(msg.byteSize) || 0,
      };
      return;
    }
    if (msg.type === 'result-chunk') {
      const idx = Number(msg.index);
      if (Number.isFinite(idx) && idx >= 0) chunksRef.current[idx] = String(msg.data || '');
      return;
    }
    if (msg.type === 'result-end') {
      try {
        const b64 = chunksRef.current.join('');
        const mime = metaRef.current?.mime || 'video/webm';
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const out = `${FileSystem.cacheDirectory}moment_opt_${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(out, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        active.onProgress?.(1);
        await finish(true, out);
      } catch (e: any) {
        await finish(false, undefined, e?.message || 'Could not save optimized video');
      }
    }
  };

  if (Platform.OS === 'web') return null;
  if (!activeUri) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ html: buildHtml(activeUri), baseUrl: FileSystem.cacheDirectory || undefined }}
        onMessage={onMessage}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
}

/** Public helper used by prepareMediaUpload. */
export function optimizeVideoForUpload(
  uri: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const bridge = globalThis.__vedastyaVideoOptimizeBridge;
  if (!bridge?.enqueue) {
    return Promise.reject(new Error('Video optimizer is not ready'));
  }
  return bridge.enqueue(uri, onProgress);
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
    overflow: 'hidden',
    zIndex: -1,
  },
  webview: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
