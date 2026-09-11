import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, type ViewStyle,
} from 'react-native';
import { Colors, Radius, createDynamicStyles } from '../../constants/theme';

function ShimmerBlock({ style }: { style: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[s.shimmer, style, { opacity }]} />;
}

export function FeedPostSkeleton() {
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <ShimmerBlock style={s.avatar} />
        <View style={s.headerCopy}>
          <ShimmerBlock style={s.lineMd} />
          <ShimmerBlock style={s.lineSm} />
        </View>
      </View>
      <ShimmerBlock style={s.media} />
      <View style={s.actions}>
        <ShimmerBlock style={s.chip} />
        <ShimmerBlock style={s.chip} />
        <ShimmerBlock style={s.chip} />
      </View>
    </View>
  );
}

export function FeedStoriesSkeleton() {
  return (
    <View style={s.storiesRow}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={s.storyItem}>
          <ShimmerBlock style={s.storyRing} />
          <ShimmerBlock style={s.storyLabel} />
        </View>
      ))}
    </View>
  );
}

export function FeedHydrationSkeleton() {
  return (
    <View style={s.wrap}>
      <FeedStoriesSkeleton />
      <FeedPostSkeleton />
      <FeedPostSkeleton />
    </View>
  );
}

type FeedRegionalBannerProps = {
  onAdjustRadius?: () => void;
};

export function FeedRegionalBanner({ onAdjustRadius }: FeedRegionalBannerProps) {
  return (
    <View style={s.banner}>
      <View style={s.bannerCopy}>
        <Text style={s.bannerTitle}>Showing trending activity near your region</Text>
        <Text style={s.bannerSub}>
          Your exact radius is quiet right now. We expanded results to help you discover local shops.
        </Text>
      </View>
      {onAdjustRadius ? (
        <TouchableOpacity onPress={onAdjustRadius} style={s.bannerBtn} activeOpacity={0.85}>
          <Text style={s.bannerBtnText}>Adjust radius</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { paddingTop: 8, gap: 12 },
  shimmer: {
    backgroundColor: '#334155',
    borderRadius: Radius.md,
  },
  postCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headerCopy: { flex: 1, gap: 6 },
  lineMd: { height: 12, width: '55%', borderRadius: 6 },
  lineSm: { height: 10, width: '35%', borderRadius: 5 },
  media: { width: '100%', height: 280, borderRadius: Radius.md },
  actions: { flexDirection: 'row', gap: 8 },
  chip: { height: 28, width: 64, borderRadius: Radius.full },
  storiesRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storyItem: { alignItems: 'center', gap: 8 },
  storyRing: { width: 62, height: 62, borderRadius: 31 },
  storyLabel: { width: 52, height: 10, borderRadius: 5 },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  bannerCopy: { gap: 4 },
  bannerTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerSub: {
    color: Colors.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bannerBtnText: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
}));
