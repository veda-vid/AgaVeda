// components/media/SafeVideoPlayer.tsx — Expo Go–safe video with thumbnail fallback
// Uses expo-av (bundled in Expo Go). Never imports expo-video / ExpoVideo.
// Falls back to WebView HTML5 video for WebM / native decode failures (Moments).

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { Colors, createDynamicStyles } from '../../constants/theme';
import {
  WebViewVideoPlayer,
  shouldPreferWebViewVideo,
} from './WebViewVideoPlayer';

export type SafeVideoPlayerHandle = {
  play: () => void;
  pause: () => void;
  setMuted: (muted: boolean) => void;
};

export type SafeVideoPlayerProps = {
  uri: string;
  /** Poster / thumbnail shown while loading or when playback is unavailable. */
  posterUri?: string | null;
  active?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: boolean;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain';
  nativeControls?: boolean;
  onReady?: () => void;
  onError?: () => void;
  /** Fired when the video loops (position jumps backward or didJustFinish with looping). */
  onLoop?: () => void;
  /** Fired when playback finishes (non-looping). */
  onEnded?: () => void;
  /** Volume 0–1 when unmuted. */
  volume?: number;
};

type AvModule = {
  Video: React.ComponentType<any>;
  ResizeMode: { COVER: string; CONTAIN: string; STRETCH: string };
};

let cachedAv: AvModule | null | undefined;

/** Load expo-av once; return null if the native module is missing. */
function getExpoAv(): AvModule | null {
  if (cachedAv !== undefined) return cachedAv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const av = require('expo-av') as AvModule;
    if (!av?.Video) {
      console.warn('[video] expo-av Video component is unavailable in this runtime.');
      cachedAv = null;
      return null;
    }
    cachedAv = av;
    return av;
  } catch (error) {
    console.warn('[video] Failed to load expo-av — showing thumbnail fallback.', error);
    cachedAv = null;
    return null;
  }
}

function VideoFallback({
  posterUri,
  style,
  message = 'Video preview unavailable',
  onRetry,
}: {
  posterUri?: string | null;
  style?: StyleProp<ViewStyle>;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={styles.posterPlaceholder} />
      )}
      <View style={styles.overlay}>
        <View style={styles.playBadge}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
        <Text style={styles.fallbackText}>{message}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Cross-platform video player safe for Expo Go, iOS, Android, and Web.
 * Falls back to WebView HTML5 (WebM-safe) then poster overlay.
 */
export const SafeVideoPlayer = forwardRef<SafeVideoPlayerHandle, SafeVideoPlayerProps>(
  function SafeVideoPlayer(
    {
      uri,
      posterUri,
      active = false,
      loop = true,
      muted = true,
      preload = false,
      style,
      contentFit = 'cover',
      nativeControls = false,
      onReady,
      onError,
      onLoop,
      onEnded,
      volume = 1,
    },
    ref,
  ) {
    const av = useMemo(() => getExpoAv(), []);
    const videoRef = useRef<any>(null);
    const webVideoRef = useRef<HTMLVideoElement | null>(null);
    const loadedRef = useRef(false);
    const lastPosRef = useRef(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [useWebFallback, setUseWebFallback] = useState(() => shouldPreferWebViewVideo(uri));
    const [webFallbackFailed, setWebFallbackFailed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [nativeLoaded, setNativeLoaded] = useState(false);
    const safeUri = typeof uri === 'string' ? uri.trim() : '';
    const uriValid = !!safeUri && (
      /^https?:\/\//i.test(safeUri)
      || safeUri.startsWith('file:')
      || safeUri.startsWith('content:')
    );
    const [sourceEpoch, setSourceEpoch] = useState({ uri: safeUri, retryKey });
    const shouldMount = (active || preload) && uriValid;
    const preferWeb = shouldPreferWebViewVideo(safeUri) || useWebFallback;

    // Reset load gates as soon as the source remounts (before playback sync runs)
    if (uriValid && (sourceEpoch.uri !== safeUri || sourceEpoch.retryKey !== retryKey)) {
      setSourceEpoch({ uri: safeUri, retryKey });
      loadedRef.current = false;
      setNativeLoaded(false);
      setLoading(true);
      setFailed(false);
      setWebFallbackFailed(false);
      setUseWebFallback(shouldPreferWebViewVideo(safeUri));
    }

    const handleError = useCallback(() => {
      // First failure on native → try WebView (WebM / odd codecs). Only hard-fail after that.
      if (!useWebFallback && Platform.OS !== 'web') {
        setUseWebFallback(true);
        setLoading(true);
        setFailed(false);
        loadedRef.current = false;
        setNativeLoaded(false);
        return;
      }
      loadedRef.current = false;
      setNativeLoaded(false);
      setLoading(false);
      setFailed(true);
      onError?.();
    }, [onError, useWebFallback]);

    const handleReady = useCallback(() => {
      loadedRef.current = true;
      setNativeLoaded(true);
      setLoading(false);
      setFailed(false);
      onReady?.();
    }, [onReady]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (preferWeb && Platform.OS !== 'web') return;
        if (Platform.OS === 'web') {
          void webVideoRef.current?.play().catch(() => {});
          return;
        }
        if (!loadedRef.current) return;
        void videoRef.current?.playAsync?.().catch(() => {});
      },
      pause: () => {
        if (preferWeb && Platform.OS !== 'web') return;
        if (Platform.OS === 'web') {
          webVideoRef.current?.pause();
          return;
        }
        if (!loadedRef.current) return;
        void videoRef.current?.pauseAsync?.().catch(() => {});
      },
      setMuted: (next: boolean) => {
        if (preferWeb && Platform.OS !== 'web') return;
        if (Platform.OS === 'web') {
          const el = webVideoRef.current;
          if (el) {
            el.muted = next;
            el.volume = next ? 0 : volume;
          }
          return;
        }
        if (!loadedRef.current) return;
        void videoRef.current?.setIsMutedAsync?.(next).catch(() => {});
        void videoRef.current?.setVolumeAsync?.(next ? 0 : volume).catch(() => {});
      },
    }), [volume, preferWeb]);

    // Native playback sync — only after expo-av reports the video is loaded
    useEffect(() => {
      if (preferWeb || Platform.OS === 'web' || !av || failed || !shouldMount || !nativeLoaded) return;
      const node = videoRef.current;
      if (!node) return;

      let cancelled = false;
      void (async () => {
        try {
          const status = await node.getStatusAsync?.();
          if (cancelled) return;
          if (!status?.isLoaded) return;

          await node.setIsMutedAsync?.(muted);
          if (cancelled) return;
          await node.setVolumeAsync?.(muted ? 0 : volume);
          if (cancelled) return;

          if (active) {
            await node.playAsync?.();
          } else if (!preload) {
            await node.pauseAsync?.();
            await node.setPositionAsync?.(0).catch(() => {});
          } else {
            await node.pauseAsync?.();
          }
        } catch (error: any) {
          const message = String(error?.message ?? error ?? '');
          if (/not yet loaded|not loaded|unloaded/i.test(message)) return;
          if (__DEV__) console.log('[video] Playback control skipped.', message);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [active, muted, volume, preload, shouldMount, av, failed, nativeLoaded, retryKey, uri, preferWeb]);

    // Web playback sync
    useEffect(() => {
      if (Platform.OS !== 'web' || !shouldMount) return;
      const el = webVideoRef.current;
      if (!el) return;
      el.muted = muted;
      el.volume = muted ? 0 : volume;
      if (active) {
        void el.play().catch(() => {});
      } else if (!preload) {
        el.pause();
        el.currentTime = 0;
      } else {
        el.pause();
      }
    }, [active, muted, volume, preload, shouldMount, uri, retryKey]);

    const onRetry = () => {
      setFailed(false);
      setWebFallbackFailed(false);
      setUseWebFallback(shouldPreferWebViewVideo(safeUri));
      setLoading(true);
      loadedRef.current = false;
      setNativeLoaded(false);
      setRetryKey(k => k + 1);
    };

    if (!uriValid) {
      return (
        <VideoFallback
          posterUri={posterUri}
          style={style}
          message="Video unavailable"
        />
      );
    }

    if (!shouldMount) {
      return <View style={[styles.wrap, style, styles.empty]} />;
    }

    if (failed && webFallbackFailed) {
      return (
        <VideoFallback
          posterUri={posterUri}
          style={style}
          message="Video preview unavailable on this device"
          onRetry={onRetry}
        />
      );
    }

    // WebM / native-decode failures → HTML5 in WebView (Instagram-like continuous play on Android)
    if (preferWeb && Platform.OS !== 'web' && !webFallbackFailed) {
      return (
        <View style={[styles.wrap, style]}>
          {posterUri && loading ? (
            <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          <WebViewVideoPlayer
            key={`wv-${safeUri}-${retryKey}`}
            uri={safeUri}
            active={active}
            loop={loop}
            muted={muted}
            volume={muted ? 0 : volume}
            style={StyleSheet.absoluteFillObject}
            onReady={handleReady}
            onError={() => {
              setWebFallbackFailed(true);
              setFailed(true);
              setLoading(false);
              onError?.();
            }}
            onEnded={onEnded}
            onLoop={onLoop}
          />
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={Colors.orange} size="large" />
            </View>
          ) : null}
        </View>
      );
    }

    if (Platform.OS !== 'web' && !av) {
      if (!webFallbackFailed) {
        return (
          <View style={[styles.wrap, style]}>
            <WebViewVideoPlayer
              key={`wv-nav-${safeUri}-${retryKey}`}
              uri={safeUri}
              active={active}
              loop={loop}
              muted={muted}
              volume={muted ? 0 : volume}
              style={StyleSheet.absoluteFillObject}
              onReady={handleReady}
              onError={() => {
                setWebFallbackFailed(true);
                setFailed(true);
                onError?.();
              }}
              onEnded={onEnded}
              onLoop={onLoop}
            />
          </View>
        );
      }
      return (
        <VideoFallback
          posterUri={posterUri}
          style={style}
          message="Video preview unavailable on this device"
          onRetry={onRetry}
        />
      );
    }

    if (Platform.OS === 'web') {
      return (
        <View style={[styles.wrap, style]}>
          {posterUri && loading ? (
            <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={Colors.orange} size="large" />
            </View>
          ) : null}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            key={`${safeUri}-${retryKey}`}
            ref={webVideoRef}
            src={safeUri}
            autoPlay={active}
            loop={loop}
            muted={muted}
            playsInline
            preload={preload || active ? 'auto' : 'metadata'}
            poster={posterUri ?? undefined}
            onLoadedData={handleReady}
            onPlaying={() => setLoading(false)}
            onWaiting={() => setLoading(true)}
            onError={handleError}
            onEnded={() => {
              if (!loop) onEnded?.();
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: contentFit,
              backgroundColor: Colors.black,
            }}
          />
        </View>
      );
    }

    const AvVideo = av!.Video;
    const resizeMode =
      contentFit === 'contain' ? av!.ResizeMode.CONTAIN : av!.ResizeMode.COVER;

    return (
      <View style={[styles.wrap, style]}>
        {posterUri && loading ? (
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
        <AvVideo
          key={`${safeUri}-${retryKey}`}
          ref={videoRef}
          source={{ uri: safeUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={resizeMode}
          shouldPlay={active}
          isLooping={loop}
          isMuted={muted}
          volume={muted ? 0 : volume}
          useNativeControls={nativeControls}
          onLoad={handleReady}
          onError={handleError}
          onPlaybackStatusUpdate={(status: {
            isLoaded?: boolean;
            error?: string;
            positionMillis?: number;
            didJustFinish?: boolean;
          }) => {
            if (status?.isLoaded) {
              loadedRef.current = true;
              setNativeLoaded(true);
              setLoading(false);
              const pos = status.positionMillis ?? 0;
              if (
                (status.didJustFinish && loop)
                || (pos < lastPosRef.current - 400 && lastPosRef.current > 600)
              ) {
                onLoop?.();
              }
              if (status.didJustFinish && !loop) {
                onEnded?.();
              }
              lastPosRef.current = pos;
              return;
            }
            if (status?.error) handleError();
          }}
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.orange} size="large" />
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = createDynamicStyles((Colors) => ({
  wrap: {
    overflow: 'hidden',
    backgroundColor: Colors.black,
  },
  empty: {
    backgroundColor: Colors.black,
  },
  posterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 20,
    gap: 10,
  },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 107, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: Colors.white,
    fontSize: 22,
    marginLeft: 3,
    fontWeight: '700',
  },
  fallbackText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  retryText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
}));
