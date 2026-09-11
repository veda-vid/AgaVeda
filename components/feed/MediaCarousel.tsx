import { useState } from 'react';
import {
  View, ScrollView, Image, StyleSheet, NativeSyntheticEvent, NativeScrollEvent,
  Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { Colors, createDynamicStyles } from '../../constants/theme';
import { FeedVideo } from './FeedVideo';
import { DoubleTapLikeArea } from './DoubleTapLikeArea';
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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / contentWidth);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const safeUrls = (urls ?? [])
    .map(u => (typeof u === 'string' ? u.trim() : ''))
    .filter(u => !!u && u !== 'null' && u !== 'undefined');

  if (!safeUrls.length) {
    return (
      <View style={[s.fallback, { height, width: contentWidth }]}>
        <ActivityIndicator color={Colors.orange} />
      </View>
    );
  }

  const showIndicators = safeUrls.length > 1;

  return (
    <View style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={safeUrls.length > 1}
      >
        {safeUrls.map((raw, index) => {
          const uri = resolveFeedMediaUrl(raw);
          const isVideo = isVideoMedia(raw, mediaType);
          const slideInView = isActive && index === activeIndex;
          const preloadNeighbor = isActive && Math.abs(index - activeIndex) <= 1;

          return (
            <View key={`${raw}-${index}`} style={{ width: contentWidth, height }}>
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
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
                    <Image
                      source={{ uri }}
                      style={{ width: contentWidth, height }}
                      resizeMode="cover"
                      onLoadStart={() => setLoadingIndex(index)}
                      onLoadEnd={() => setLoadingIndex(prev => (prev === index ? null : prev))}
                      onError={() => setLoadingIndex(prev => (prev === index ? null : prev))}
                    />
                  </>
                ) : (
                  <View style={[s.fallback, { height, width: contentWidth }]} />
                )}
              </View>
              <DoubleTapLikeArea
                overlay
                onDoubleTapLike={onDoubleTapLike}
                onSingleTap={onToggleMute}
              />
            </View>
          );
        })}
      </ScrollView>

      {showIndicators && (
        <View style={s.indicatorRow} pointerEvents="none">
          {safeUrls.length <= 8 ? (
            safeUrls.map((_, i) => (
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
                  { width: `${100 / safeUrls.length}%`, left: `${(activeIndex / safeUrls.length) * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
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
}));
