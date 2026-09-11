// components/media/WebViewVideoPlayer.tsx — HTML5 video for formats expo-av can't play (e.g. WebM)
// Used as Moments fallback so optimized uploads still play like Reels on Android.

import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type Props = {
  uri: string;
  active?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
  onError?: () => void;
  onEnded?: () => void;
  onLoop?: () => void;
};

function escapeAttr(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(uri: string, muted: boolean, loop: boolean, active: boolean) {
  const src = escapeAttr(uri);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
    video{width:100%;height:100%;object-fit:cover;background:#000}
  </style>
</head>
<body>
  <video
    id="v"
    playsinline
    webkit-playsinline
    ${muted ? 'muted' : ''}
    ${loop ? 'loop' : ''}
    preload="auto"
    src="${src}"
  ></video>
  <script>
    const v = document.getElementById('v');
    let lastPos = 0;
    function post(msg) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    }
    v.addEventListener('loadeddata', function () { post({ type: 'ready' }); });
    v.addEventListener('canplay', function () { post({ type: 'ready' }); });
    v.addEventListener('error', function () { post({ type: 'error' }); });
    v.addEventListener('ended', function () { post({ type: 'ended' }); });
    v.addEventListener('timeupdate', function () {
      var pos = v.currentTime || 0;
      if (pos + 0.35 < lastPos && lastPos > 0.6) post({ type: 'loop' });
      lastPos = pos;
    });
    window.__vedastyaVideoCmd = function (cmd) {
      try {
        if (cmd.type === 'play') {
          v.muted = !!cmd.muted;
          v.volume = cmd.muted ? 0 : Math.max(0, Math.min(1, Number(cmd.volume) || 1));
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else if (cmd.type === 'pause') {
          v.pause();
          if (cmd.reset) { try { v.currentTime = 0; } catch (e) {} }
        } else if (cmd.type === 'mute') {
          v.muted = !!cmd.muted;
          v.volume = cmd.muted ? 0 : Math.max(0, Math.min(1, Number(cmd.volume) || 1));
        }
      } catch (e) {}
    };
    ${active ? 'window.__vedastyaVideoCmd({ type: "play", muted: ' + (muted ? 'true' : 'false') + ', volume: 1 });' : ''}
  </script>
</body>
</html>`;
}

export function shouldPreferWebViewVideo(uri: string) {
  const u = String(uri || '').toLowerCase();
  return /\.webm(\?|#|$)/i.test(u) || u.includes('video/webm') || u.includes('mime=video%2Fwebm');
}

/**
 * Full-bleed HTML5 video in a WebView — plays WebM/VP8 that expo-av rejects on Android.
 */
export function WebViewVideoPlayer({
  uri,
  active = false,
  loop = true,
  muted = true,
  volume = 1,
  style,
  onReady,
  onError,
  onEnded,
  onLoop,
}: Props) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildHtml(uri, muted, loop, active),
    // Remount when source changes; mute/active synced via inject below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uri, loop],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const cmd = active
      ? { type: 'play', muted, volume }
      : { type: 'pause', reset: true };
    const js = `window.__vedastyaVideoCmd && window.__vedastyaVideoCmd(${JSON.stringify(cmd)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [active, muted, volume, uri]);

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') onReady?.();
    else if (msg.type === 'error') onError?.();
    else if (msg.type === 'ended') {
      if (!loop) onEnded?.();
      else onLoop?.();
    } else if (msg.type === 'loop') onLoop?.();
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrap, style]}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={uri}
          autoPlay={active}
          loop={loop}
          muted={muted}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
          onLoadedData={() => onReady?.()}
          onError={() => onError?.()}
          onEnded={() => {
            if (!loop) onEnded?.();
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.99,
  },
});
