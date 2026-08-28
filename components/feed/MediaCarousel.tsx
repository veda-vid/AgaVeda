import { useRef, useState } from 'react';
import {
  View, ScrollView, Image, StyleSheet, NativeSyntheticEvent, NativeScrollEvent,
  Dimensions, Platform, ActivityIndicator, Pressable, Animated,
} from 'react-native';
import { Colors } from '../../constants/theme';
import { FeedVideo } from './FeedVideo';
import { isVideoMedia, resolveFeedMediaUrl } from './feedUtils';

const W = Dimensions.get('window').width;
const DEFAULT_W = W;

type MediaCarouselProps = {
  urls: string[];
  mediaType?: string;
  height: number;
  isActive?: boolean;
  contentWidth?: number;
  muted?: boolean;
  onToggleMute?: () => void;
  onDoubleTapLike?: () => void;
};

export function MediaCarousel({
  urls,
  mediaType,
  height,
  isActive = true,
  contentWidth = DEFAULT_W,
  muted = true,
  onToggleMute,
  onDoubleTapLike,
}: MediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(0);
  const [heartVisible, setHeartVisible] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / contentWidth);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const flashHeart = () => {
    setHeartVisible(true);
    heartScale.setValue(0.4);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heartScale, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setHeartVisible(false));
  };

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      flashHeart();
      onDoubleTapLike?.();
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current && Date.now() - lastTap.current >= 280) {
        onToggleMute?.();
        lastTap.current = 0;
      }
    }, 290);
  };

  if (!urls.length) {
    return (
      <View style={[s.fallback, { height, width: contentWidth }]}>
        <ActivityIndicator color={Colors.orange} />
      </View>
    );
  }

  const showIndicators = urls.length > 1;
  const slideActive = isActive && activeIndex === 0;

  return (
    <View style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={urls.length > 1}
      >
        {urls.map((raw, index) => {
          const uri = resolveFeedMediaUrl(raw);
          const isVideo = isVideoMedia(raw, mediaType);
          const slideInView = isActive && index === activeIndex;
          const preloadNeighbor = isActive && Math.abs(index - activeIndex) <= 1;

          return (
            <Pressable
              key={`${raw}-${index}`}
              style={{ width: contentWidth, height }}
              onPress={onMediaPress}
            >
              {isVideo && uri ? (
                <FeedVideo
                  uri={uri}
                  active={slideInView}
                  preload={preloadNeighbor && !slideInView}
                  muted={muted}
                  style={{ width: contentWidth, height }}
                />
              ) : uri ? (
                <>
                  {loadingIndex === index && (
                    <View style={s.loader}>
                      <ActivityIndicator color={Colors.orange} />
                    </View>
                  )}
                  {slideActive || preloadNeighbor ? (
                    <Image
                      source={{ uri }}
                      style={{ width: contentWidth, height }}
                      resizeMode="cover"
                      onLoadStart={() => setLoadingIndex(index)}
                      onLoadEnd={() => setLoadingIndex(prev => (prev === index ? null : prev))}
                    />
                  ) : (
                    <View style={[s.fallback, { width: contentWidth, height }]} />
                  )}
                </>
              ) : (
                <View style={s.fallback} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {heartVisible ? (
        <Animated.View pointerEvents="none" style={[s.heartOverlay, { transform: [{ scale: heartScale }] }]}>
          <View style={s.heartBubble}>
            <Animated.Text style={s.heartEmoji}>❤️</Animated.Text>
          </View>
        </Animated.View>
      ) : null}

      {showIndicators && (
        <View style={s.indicatorRow} pointerEvents="none">
          {urls.length <= 8 ? (
            urls.map((_, i) => (
              <View
                key={i}
                style={[s.dot, i === activeIndex ? s.dotActive : s.dotInactive]}
              />
            ))
          ) : (
            <View style={s.pillTrack}>
              <View
                style={[
                  s.pillThumb,
                  { width: `${100 / urls.length}%`, left: `${(activeIndex / urls.length) * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    zIndex: 1,
  },
  indicatorRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 7,
    backgroundColor: Colors.orange,
    ...Platform.select({
      web: { boxShadow: '0 0 6px rgba(255,87,34,0.6)' } as object,
      default: {
        shadowColor: Colors.orange,
        shadowOpacity: 0.6,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  pillTrack: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  pillThumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  heartBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: {
    fontSize: 42,
  },
});
