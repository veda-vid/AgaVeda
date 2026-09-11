// components/feed/FeedVideo.tsx — Feed / Sparks video with synced background music

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View, StyleSheet, Platform, type ViewStyle,
} from 'react-native';
import {
  SafeVideoPlayer,
  type SafeVideoPlayerHandle,
} from '../media/SafeVideoPlayer';
import { Colors, createDynamicStyles } from '../../constants/theme';
import { useSparkBackgroundAudio } from '../../hooks/useSparkBackgroundAudio';
import { volumePctToGain } from '../../lib/sparkAudioSync';

export type FeedVideoHandle = {
  play: () => void;
  pause: () => void;
  setMuted: (muted: boolean) => void;
};

type FeedVideoProps = {
  uri: string;
  posterUri?: string | null;
  active?: boolean;
  style?: ViewStyle | ViewStyle[];
  loop?: boolean;
  muted?: boolean;
  preload?: boolean;
  backgroundAudioUrl?: string | null;
  audioStartTime?: number;
  /** 0–100 */
  videoVolumePct?: number;
  /** 0–100 */
  musicVolumePct?: number;
  onReady?: () => void;
  onError?: () => void;
  onAudioFallback?: () => void;
  /** Fired when non-looping video finishes. */
  onEnded?: () => void;
};

export const FeedVideo = forwardRef<FeedVideoHandle, FeedVideoProps>(function FeedVideo(
  {
    uri,
    posterUri,
    active = false,
    style,
    loop = true,
    muted = true,
    preload = false,
    backgroundAudioUrl,
    audioStartTime = 0,
    videoVolumePct = 100,
    musicVolumePct = 100,
    onReady,
    onError,
    onAudioFallback,
    onEnded,
  },
  ref,
) {
  const playerRef = useRef<SafeVideoPlayerHandle | null>(null);
  const webBgAudioRef = useRef<HTMLAudioElement | null>(null);
  const webLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webBgReadyRef = useRef(false);
  const lastWebVideoTimeRef = useRef(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  // Only flip to true when background music fails — never stick true after a new track attaches
  const [bgAudioFailed, setBgAudioFailed] = useState(false);
  const safeUri = typeof uri === 'string' ? uri.trim() : '';
  // Accept http(s) and native file/content URIs; empty/null never mounts a player.
  const uriValid = !!safeUri && (
    /^https?:\/\//i.test(safeUri)
    || safeUri.startsWith('file:')
    || safeUri.startsWith('content:')
  );
  const shouldMount = (active || preload) && uriValid;
  const trackUrl = typeof backgroundAudioUrl === 'string' ? (backgroundAudioUrl.trim() || null) : null;
  const hasBgTrack = !!trackUrl && !bgAudioFailed && uriValid;

  // Reset failure latch whenever the attached track changes
  useEffect(() => {
    setBgAudioFailed(false);
  }, [trackUrl]);

  const handleAudioFallback = useCallback(() => {
    setBgAudioFailed(true);
    onAudioFallback?.();
  }, [onAudioFallback]);

  // Only mount latched music on the *active* Moment — never preload neighbors.
  // Preloading multiple expo-av Sound instances leaves previous tracks audible while scrolling.
  const { bgReady, resetToStart, pauseAll } = useSparkBackgroundAudio({
    audioUrl: trackUrl,
    audioStartTime,
    musicVolumePct,
    active: active && hasBgTrack && Platform.OS !== 'web',
    muted,
    shouldMount: active && hasBgTrack && Platform.OS !== 'web',
    onFallbackToNativeVideo: handleAudioFallback,
  });

  // Hard-stop music the instant this card leaves focus (covers async unload races).
  useEffect(() => {
    if (active) return;
    void pauseAll();
  }, [active, pauseAll]);

  const triggerWebFallback = useCallback(() => {
    handleAudioFallback();
    const bg = webBgAudioRef.current;
    if (bg) {
      bg.pause();
      bg.src = '';
      webBgAudioRef.current = null;
    }
  }, [handleAudioFallback]);

  const resetWebBgAudio = useCallback(() => {
    const bg = webBgAudioRef.current;
    if (!bg) return;
    try {
      bg.currentTime = Math.max(0, audioStartTime);
    } catch { /* noop */ }
    if (active && !muted) void bg.play().catch(() => {});
  }, [audioStartTime, active, muted]);

  const syncWebBgAudio = useCallback((playing: boolean) => {
    const bg = webBgAudioRef.current;
    if (!bg || !webBgReadyRef.current || !hasBgTrack) return;
    bg.volume = volumePctToGain(musicVolumePct, muted);
    if (playing && !muted) {
      try {
        if (Math.abs(bg.currentTime - audioStartTime) > 0.35) {
          bg.currentTime = Math.max(0, audioStartTime);
        }
      } catch { /* noop */ }
      void bg.play().catch(() => {});
      return;
    }
    bg.pause();
  }, [audioStartTime, hasBgTrack, musicVolumePct, muted]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (Platform.OS === 'web') {
        void webVideoRef.current?.play().catch(() => {});
        syncWebBgAudio(true);
        return;
      }
      playerRef.current?.play();
      void resetToStart();
    },
    pause: () => {
      if (Platform.OS === 'web') {
        webVideoRef.current?.pause();
        syncWebBgAudio(false);
        return;
      }
      playerRef.current?.pause();
    },
    setMuted: (next: boolean) => {
      if (Platform.OS === 'web') {
        const el = webVideoRef.current;
        if (el) {
          if (hasBgTrack) {
            el.muted = next || volumePctToGain(videoVolumePct, false) === 0;
            el.volume = volumePctToGain(videoVolumePct, next);
          } else {
            el.muted = next;
            el.volume = volumePctToGain(videoVolumePct, next);
          }
        }
        syncWebBgAudio(active && !next);
        return;
      }
      playerRef.current?.setMuted(
        hasBgTrack ? (next || volumePctToGain(videoVolumePct, false) === 0) : next,
      );
    },
  }), [active, hasBgTrack, syncWebBgAudio, videoVolumePct, resetToStart]);

  // Web background music track (iTunes previews — do NOT set crossOrigin)
  useEffect(() => {
    if (Platform.OS !== 'web' || !hasBgTrack || !active || !trackUrl) {
      webBgReadyRef.current = false;
      if (webBgAudioRef.current) {
        webBgAudioRef.current.pause();
        try { webBgAudioRef.current.currentTime = 0; } catch { /* noop */ }
        webBgAudioRef.current.src = '';
        webBgAudioRef.current = null;
      }
      if (webLoadTimerRef.current) clearTimeout(webLoadTimerRef.current);
      return undefined;
    }

    let cancelled = false;
    webBgReadyRef.current = false;
    const bg = new Audio(trackUrl);
    bg.preload = 'auto';
    bg.loop = false;
    webBgAudioRef.current = bg;

    if (webLoadTimerRef.current) clearTimeout(webLoadTimerRef.current);
    webLoadTimerRef.current = setTimeout(() => {
      if (!cancelled && !webBgReadyRef.current) triggerWebFallback();
    }, 8000);

    const markReady = () => {
      if (cancelled) return;
      webBgReadyRef.current = true;
      if (webLoadTimerRef.current) clearTimeout(webLoadTimerRef.current);
      try {
        bg.currentTime = Math.max(0, audioStartTime);
      } catch { /* noop */ }
      syncWebBgAudio(true);
    };

    const onErr = () => {
      if (!cancelled) triggerWebFallback();
    };

    bg.addEventListener('canplaythrough', markReady, { once: true });
    bg.addEventListener('loadeddata', markReady, { once: true });
    bg.addEventListener('error', onErr);
    bg.load();

    return () => {
      cancelled = true;
      if (webLoadTimerRef.current) clearTimeout(webLoadTimerRef.current);
      bg.removeEventListener('canplaythrough', markReady);
      bg.removeEventListener('loadeddata', markReady);
      bg.removeEventListener('error', onErr);
      bg.pause();
      bg.src = '';
      webBgAudioRef.current = null;
      webBgReadyRef.current = false;
    };
  }, [trackUrl, hasBgTrack, active, syncWebBgAudio, triggerWebFallback, audioStartTime]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    syncWebBgAudio(active);
  }, [active, muted, musicVolumePct, syncWebBgAudio]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = webVideoRef.current;
    if (!el) return;

    if (hasBgTrack) {
      el.muted = muted || volumePctToGain(videoVolumePct, false) === 0;
      el.volume = volumePctToGain(videoVolumePct, muted);
    } else {
      el.muted = muted;
      el.volume = volumePctToGain(videoVolumePct, muted);
    }

    if (active) {
      void el.play().catch(() => {});
      syncWebBgAudio(true);
    } else if (preload) {
      el.pause();
      syncWebBgAudio(false);
    } else {
      el.pause();
      el.currentTime = 0;
      syncWebBgAudio(false);
    }
  }, [active, muted, preload, uri, hasBgTrack, videoVolumePct, syncWebBgAudio]);

  // When spark becomes active / music ready, snap music to the trim start
  useEffect(() => {
    if (Platform.OS === 'web' || !hasBgTrack || !bgReady || !active) return undefined;
    void resetToStart();
    return undefined;
  }, [active, hasBgTrack, bgReady, resetToStart, audioStartTime]);

  const onVideoLoop = useCallback(() => {
    if (!hasBgTrack) return;
    if (Platform.OS === 'web') {
      resetWebBgAudio();
      return;
    }
    void resetToStart();
  }, [hasBgTrack, resetWebBgAudio, resetToStart]);

  if (!uriValid) {
    return <View style={[s.wrap, style, s.nativeFallback]} />;
  }

  if (Platform.OS === 'web') {
    if (!shouldMount) {
      return <View style={[s.wrap, style, s.nativeFallback]} />;
    }
    return (
      <View style={[s.wrap, style]}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={webVideoRef}
          src={safeUri}
          autoPlay={active}
          loop={loop}
          muted={hasBgTrack
            ? (muted || volumePctToGain(videoVolumePct, false) === 0)
            : muted}
          playsInline
          poster={posterUri ?? undefined}
          preload={preload || active ? 'auto' : 'metadata'}
          onLoadedData={() => onReady?.()}
          onTimeUpdate={e => {
            const el = e.currentTarget;
            if (el.currentTime < lastWebVideoTimeRef.current - 0.4 && hasBgTrack) {
              resetWebBgAudio();
            }
            lastWebVideoTimeRef.current = el.currentTime;
          }}
          onEnded={() => {
            if (hasBgTrack) resetWebBgAudio();
            if (!loop) onEnded?.();
          }}
          onError={() => onError?.()}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: Colors.black,
          }}
        />
      </View>
    );
  }

  // When a background track is latched, keep the camera track silent so music is clear
  // (especially with WebView HTML5 video fallback on Android).
  const videoMuted = hasBgTrack
    ? (muted || volumePctToGain(videoVolumePct, false) === 0)
    : muted;
  const videoGain = hasBgTrack
    ? volumePctToGain(videoVolumePct, muted)
    : volumePctToGain(videoVolumePct, muted);

  return (
    <SafeVideoPlayer
      ref={playerRef}
      uri={safeUri}
      posterUri={posterUri}
      active={active}
      loop={loop}
      muted={videoMuted}
      volume={videoGain}
      preload={preload}
      style={style}
      contentFit="cover"
      onReady={onReady}
      onError={onError}
      onLoop={onVideoLoop}
      onEnded={onEnded}
    />
  );
});

const s = createDynamicStyles((Colors) => ({
  wrap: { overflow: 'hidden', backgroundColor: Colors.black },
  nativeFallback: { backgroundColor: Colors.black },
}));
