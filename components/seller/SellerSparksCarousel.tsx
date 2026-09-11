// components/seller/SellerSparksCarousel.tsx — Animated Your Story + Moments previews

import { useEffect } from 'react';
import {
  View, Text, Image, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { resolveFeedMediaUrl, shopFeedHandle, isVideoMedia } from '../feed/feedUtils';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import type { SparkItem } from '../feed/SparksFeed';
import type { Story } from '../../types';
import { getSupabaseConfig } from '../../lib/config';
import { groupStories, ownStoryGroup, type StoryGroup } from '../../lib/storyGroups';

const { url: SUPABASE_URL } = getSupabaseConfig();

function resolveMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const resolved = resolveFeedMediaUrl(value);
  if (resolved) return resolved;
  if (!SUPABASE_URL) return value;
  const base = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\//, '')}`;
}

type Props = {
  stories: Story[];
  sparks: SparkItem[];
  storiesHydrating?: boolean;
  avatarUrl?: string | null;
  shopName?: string | null;
  currentUserId?: string | null;
  currentShopId?: string | null;
  onAddStory: () => void;
  /** Open a multi-page Instagram-style story ring. */
  onOpenStoryGroup: (items: Story[], startIndex?: number) => void;
  onOpenSparks: (startIndex?: number) => void;
};

function YourStoryRing({
  avatarUrl,
  hasStories,
  pageCount = 0,
  onPress,
  onAddPress,
}: {
  avatarUrl?: string | null;
  hasStories?: boolean;
  pageCount?: number;
  onPress: () => void;
  onAddPress: () => void;
}) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(spin.value, [0, 1], [0, 360])}deg` }],
  }));

  const thumb = resolveMediaUrl(avatarUrl);

  return (
    <SpringPressable style={s.story} pressedScale={0.96} onPress={onPress} accessibilityRole="button">
      <View style={s.yourWrap}>
        <Animated.View pointerEvents="none" style={[s.dashedSpin, ringStyle]}>
          <LinearGradient
            colors={[Colors.orange, Colors.amber, '#FF8A65', Colors.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.dashedGrad}
          >
            <View style={s.dashedHole} />
          </LinearGradient>
        </Animated.View>
        <View pointerEvents="none" style={s.yourAvatar}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.storyImg} />
          ) : (
            <Text style={s.storyEmoji}>🏪</Text>
          )}
        </View>
        {pageCount > 1 ? (
          <View style={s.yourCountBadge} pointerEvents="none">
            <Text style={s.countBadgeText}>{pageCount}</Text>
          </View>
        ) : null}
        <SpringPressable
          style={s.plusBadge}
          pressedScale={0.9}
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="Add to your story"
        >
          <Text style={s.plusText}>+</Text>
        </SpringPressable>
      </View>
      <Text style={s.storyName}>{hasStories ? 'Your Story' : 'Add Story'}</Text>
    </SpringPressable>
  );
}

function StoryGroupRing({
  group,
  onPress,
}: {
  group: StoryGroup;
  onPress: () => void;
}) {
  // Cover = newest page; pages play oldest → newest in the viewer.
  const cover = group.items[group.items.length - 1] ?? group.items[0];
  const media = resolveMediaUrl(cover?.media_url);
  const video = isVideoMedia(media, cover?.media_type);
  const logo = resolveMediaUrl(group.shop_logo);
  const thumb = video ? logo : (media || logo);
  const pageCount = group.items.length;
  return (
    <SpringPressable style={s.story} pressedScale={0.96} onPress={onPress}>
      <LinearGradient
        colors={[Colors.orange, Colors.amber, '#FF8A65']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ringGradient}
      >
        <View style={s.storyAvatar}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.storyImg} />
          ) : (
            <LinearGradient
              colors={[Colors.orange + '66', Colors.amber + '44']}
              style={[s.storyImg, s.storyVideoFallback]}
            >
              <Text style={s.storyEmoji}>{video ? '▶' : '✨'}</Text>
            </LinearGradient>
          )}
        </View>
        {pageCount > 1 ? (
          <View style={s.countBadge} pointerEvents="none">
            <Text style={s.countBadgeText}>{pageCount}</Text>
          </View>
        ) : video ? (
          <View style={s.videoBadge} pointerEvents="none">
            <Text style={s.videoBadgeText}>▶</Text>
          </View>
        ) : null}
      </LinearGradient>
      <Text style={s.storyName} numberOfLines={1}>{group.shop_name}</Text>
    </SpringPressable>
  );
}

export function SellerSparksCarousel({
  stories,
  sparks,
  storiesHydrating,
  avatarUrl,
  currentUserId,
  currentShopId,
  onAddStory,
  onOpenStoryGroup,
  onOpenSparks,
}: Props) {
  const groups = groupStories(stories);
  const mine = ownStoryGroup(stories, currentUserId, currentShopId);
  const others = mine ? groups.filter(g => g.key !== mine.key) : groups;

  return (
    <View style={s.root}>
      <GlassSurface style={s.storiesBlock} radius={18} intensity={22}>
        <Text style={s.eyebrow}>STORIES</Text>
        {storiesHydrating ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={s.skeletonRing} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            <YourStoryRing
              avatarUrl={avatarUrl}
              hasStories={!!mine?.items.length}
              pageCount={mine?.items.length ?? 0}
              onPress={() => {
                if (mine?.items.length) onOpenStoryGroup(mine.items, 0);
                else onAddStory();
              }}
              onAddPress={onAddStory}
            />
            {others.map(group => (
              <StoryGroupRing
                key={group.key}
                group={group}
                onPress={() => onOpenStoryGroup(group.items, 0)}
              />
            ))}
          </ScrollView>
        )}
      </GlassSurface>

      <View style={s.momentsBlock}>
        <View style={s.momentsHeader}>
          <Text style={s.sectionTitle}>Candid moments</Text>
        </View>

        {sparks.length === 0 ? (
          <GlassSurface style={s.emptyMoments} radius={16} intensity={20}>
            <Text style={s.emptyEmoji}>🎬</Text>
            <Text style={s.emptyTitle}>No Moments yet</Text>
            <Text style={s.emptyBody}>
              Create a Moment to show it here. Followers’ Moments stay in the Moments tab.
            </Text>
            <SpringPressable style={s.emptyCta} pressedScale={0.96} onPress={() => onOpenSparks(0)}>
              <Text style={s.emptyCtaText}>Open Moments</Text>
            </SpringPressable>
          </GlassSurface>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.momentsRail}>
            {sparks.slice(0, 12).map((spark, index) => {
              const media = resolveMediaUrl(spark.media_url);
              const isVideo = !!media && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(media);
              const productThumb = Array.isArray(spark.product?.images)
                ? resolveMediaUrl(spark.product.images[0])
                : null;
              const thumb = (!isVideo && media)
                || resolveMediaUrl(spark.shop_logo)
                || productThumb
                || media;
              const views = Number((spark as any).total_views ?? spark.total_likes ?? 0);
              return (
                <SpringPressable
                  key={spark.id}
                  style={s.sparkCard}
                  pressedScale={0.96}
                  onPress={() => onOpenSparks(index)}
                >
                  <LinearGradient
                    colors={[Colors.orange, Colors.amber, '#FF8A65']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.sparkBorder}
                  >
                    <View style={s.sparkInner}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={s.sparkImg} resizeMode="cover" />
                      ) : (
                        <LinearGradient
                          colors={[Colors.orange + '55', Colors.amber + '44']}
                          style={s.sparkFallback}
                        >
                          <Text style={s.sparkFallbackEmoji}>✨</Text>
                        </LinearGradient>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.78)']}
                        style={s.sparkScrim}
                      />
                      <View style={s.playBadge}>
                        <Text style={s.playText}>▶</Text>
                      </View>
                      <Text style={s.sparkHandle} numberOfLines={1}>
                        {shopFeedHandle(spark.shop_name) || spark.shop_name || `Moment ${index + 1}`}
                      </Text>
                      <View style={s.viewsBadge}>
                        <Text style={s.sparkViews}>
                          {views > 0 ? `${views} views` : 'New'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </SpringPressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { marginBottom: 4 },
  storiesBlock: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eyebrow: {
    marginLeft: 14,
    marginBottom: 8,
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.dim,
  },
  rail: {
    paddingHorizontal: 12,
    gap: 12,
    alignItems: 'center',
  },
  story: { width: 72, alignItems: 'center' },
  yourWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedSpin: {
    ...({ position: 'absolute' } as const),
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  dashedGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: Platform.OS === 'ios' ? 'dashed' : 'solid',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dashedHole: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.bg,
  },
  yourAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  plusBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  yourCountBadge: {
    position: 'absolute',
    left: 0,
    top: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
    zIndex: 2,
  },
  plusText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
    marginTop: -1,
  },
  ringGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImg: { width: '100%', height: '100%' },
  storyVideoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyEmoji: { fontSize: 22 },
  videoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
    marginLeft: 1,
  },
  countBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  storyName: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.sub,
    textAlign: 'center',
    width: 72,
  },
  skeletonRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.border,
    marginRight: 4,
  },
  momentsBlock: { marginTop: 10, marginBottom: 4 },
  momentsHeader: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  momentsRail: { paddingHorizontal: 12, gap: 10 },
  sparkCard: { width: 118 },
  sparkBorder: {
    borderRadius: 16,
    padding: 2,
  },
  sparkInner: {
    height: 168,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.orange + '18',
  },
  sparkImg: { ...({ width: '100%', height: '100%' } as const) },
  sparkFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkFallbackEmoji: { fontSize: 28 },
  sparkScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  playBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: Colors.white, fontSize: 12, marginLeft: 2 },
  sparkHandle: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 28,
    color: Colors.white,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  viewsBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sparkViews: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  emptyMoments: {
    marginHorizontal: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 6 },
  emptyTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: Colors.sub,
    fontFamily: Fonts.bodySemiBold,
  },
  emptyCta: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '66',
  },
  emptyCtaText: {
    color: Colors.orange,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
}));
