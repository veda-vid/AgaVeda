import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View, StyleSheet, Platform, ActivityIndicator, type ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors } from '../../constants/theme';

export type FeedVideoHandle = {
  play: () => void;
  pause: () => void;
  setMuted: (muted: boolean) => void;
};

type FeedVideoProps = {
  uri: string;
  active?: boolean;
  style?: ViewStyle | ViewStyle[];
  loop?: boolean;
  muted?: boolean;
  /** Load adjacent clips without audible playback */
  preload?: boolean;
  onReady?: () => void;
  onError?: () => void;
};

function NativeFeedVideo({
  uri,
  active,
  loop,
  muted,
  preload,
  style,
  onReady,
  onError,
  playerRef,
}: FeedVideoProps & { playerRef: React.MutableRefObject<ReturnType<typeof useVideoPlayer> | null> }) {
  const [loading, setLoading] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = loop ?? true;
    p.muted = muted ?? true;
  });

  playerRef.current = player;

  useEffect(() => {
    if (!player) return;
    player.loop = loop ?? true;
    player.muted = muted ?? true;

    if (active) {
      player.play();
      setLoading(false);
      onReady?.();
      return;
    }

    player.pause();
    if (!preload) {
      player.currentTime = 0;
    }
  }, [active, preload, muted, loop, player, onReady]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (status) => {
      if (status === 'readyToPlay') {
        setLoading(false);
        onReady?.();
      }
      if (status === 'error') {
        setLoading(false);
        onError?.();
      }
      if (status === 'loading') setLoading(true);
    });
    return () => sub.remove();
  }, [player, onReady, onError]);

  return (
    <View style={[s.wrap, style]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : null}
    </View>
  );
}

export const FeedVideo = forwardRef<FeedVideoHandle, FeedVideoProps>(function FeedVideo(
  {
    uri,
    active = false,
    style,
    loop = true,
    muted = true,
    preload = false,
    onReady,
    onError,
  },
  ref,
) {
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativePlayerRef = useRef<ReturnType<typeof useVideoPlayer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const shouldMount = active || preload;

  useImperativeHandle(ref, () => ({
    play: () => {
      if (Platform.OS === 'web') {
        void webVideoRef.current?.play().catch(() => {});
        return;
      }
      nativePlayerRef.current?.play();
    },
    pause: () => {
      if (Platform.OS === 'web') {
        webVideoRef.current?.pause();
        return;
      }
      nativePlayerRef.current?.pause();
    },
    setMuted: (next: boolean) => {
      if (Platform.OS === 'web') {
        if (webVideoRef.current) webVideoRef.current.muted = next;
        return;
      }
      if (nativePlayerRef.current) nativePlayerRef.current.muted = next;
    },
  }), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = webVideoRef.current;
    if (!el) return;
    el.muted = muted;
    if (active) {
      el.play().catch(() => {});
    } else if (preload) {
      el.pause();
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active, muted, preload, uri]);

  if (Platform.OS === 'web') {
    if (!shouldMount) {
      return <View style={[s.wrap, style, s.nativeFallback]} />;
    }
    return (
      <View style={[s.wrap, style]}>
        {loading && !failed ? (
          <View style={s.loader}>
            <ActivityIndicator color={Colors.orange} size="large" />
          </View>
        ) : null}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={webVideoRef}
          src={uri}
          autoPlay={active}
          loop={loop}
          muted={muted}
          playsInline
          preload={preload || active ? 'auto' : 'metadata'}
          onLoadedData={() => {
            setLoading(false);
            onReady?.();
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
            onError?.();
          }}
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

  if (!shouldMount) {
    return <View style={[s.wrap, style, s.nativeFallback]} />;
  }

  return (
    <NativeFeedVideo
      uri={uri}
      active={active}
      loop={loop}
      muted={muted}
      preload={preload}
      style={style}
      onReady={onReady}
      onError={onError}
      playerRef={nativePlayerRef}
    />
  );
});

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: Colors.black },
  nativeFallback: { backgroundColor: Colors.black },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
