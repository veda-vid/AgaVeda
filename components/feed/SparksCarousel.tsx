// components/feed/SparksCarousel.tsx — Stories rings + Sparks reel thumbs

import { useEffect } from 'react';
import {
  View, Text, Image, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { resolveFeedMediaUrl, shopFeedHandle, isVideoMedia } from './feedUtils';
import { SpringPressable } from '../ui/modernSurfaces';
import type { SparkItem } from './SparksFeed';
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
  isSeller?: boolean;
  currentUserId?: string | null;
  currentShopId?: string | null;
  onAddStory?: () => void;
  onOpenStoryGroup: (items: Story[], startIndex?: number) => void;
  onOpenSparks: (startIndex?: number) => void;
  onDiscoverShops?: () => void;
};

function StoryGroupRing({
  group,
  onPress,
}: {
  group: StoryGroup;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const press = () => {
    scale.value = withSequence(
      withSpring(1.12, { damping: 12, stiffness: 220 }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    );
    onPress();
  };

  // Cover = newest page; pages play oldest → newest in the viewer.
  const cover = group.items[group.items.length - 1] ?? group.items[0];
  const media = resolveMediaUrl(cover?.media_url);
  const video = isVideoMedia(media, cover?.media_type);
  const logo = resolveMediaUrl(group.shop_logo);
  const thumb = video ? logo : (media || logo);
  const pageCount = group.items.length;

  return (
    <SpringPressable style={s.story} pressedScale={0.96} onPress={press}>
      <Animated.View style={[s.ringOuter, ringStyle]}>
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
      </Animated.View>
      <Text style={s.storyName} numberOfLines={1}>{group.shop_name}</Text>
    </SpringPressable>
  );
}

export function SparksCarousel({
  stories,
  sparks,
  storiesHydrating,
  isSeller,
  currentUserId,
  currentShopId,
  onAddStory,
  onOpenStoryGroup,
  onOpenSparks,
  onDiscoverShops,
}: Props) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withSpring(1.04, { damping: 8, stiffness: 90 });
  }, [pulse]);

  const groups = groupStories(stories);
  const mine = ownStoryGroup(stories, currentUserId, currentShopId);
  const others = mine ? groups.filter(g => g.key !== mine.key) : groups;

  return (
    <View style={s.wrap}>
      <View style={s.storiesBlock}>
        {storiesHydrating ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRail}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={s.skeletonRing} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRail}>
            {isSeller && onAddStory ? (
              <SpringPressable
                style={s.story}
                pressedScale={0.96}
                onPress={() => {
                  if (mine?.items.length) onOpenStoryGroup(mine.items, 0);
                  else onAddStory();
                }}
              >
                <View style={[s.ringOuter, mine?.items.length ? undefined : s.ringDashed]}>
                  {mine?.items.length ? (
                    <LinearGradient
                      colors={[Colors.orange, Colors.amber, '#FF8A65']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.ringGradient}
                    >
                      <View style={s.storyAvatar}>
                        <Text style={s.plus}>+</Text>
                      </View>
                      {(mine?.items.length ?? 0) > 1 ? (
                        <View style={s.countBadge} pointerEvents="none">
                          <Text style={s.countBadgeText}>{mine!.items.length}</Text>
                        </View>
                      ) : null}
                    </LinearGradient>
                  ) : (
                    <View style={s.storyAvatar}>
                      <Text style={s.plus}>+</Text>
                    </View>
                  )}
                </View>
                <Text style={s.storyName}>{mine?.items.length ? 'Your Story' : 'Add Story'}</Text>
              </SpringPressable>
            ) : null}

            {others.map(group => (
              <StoryGroupRing
                key={group.key}
                group={group}
                onPress={() => onOpenStoryGroup(group.items, 0)}
              />
            ))}

            {!isSeller && stories.length === 0 ? (
              <SpringPressable style={s.emptyBanner} pressedScale={0.98} onPress={onDiscoverShops}>
                <Text style={s.emptyEmoji}>🏪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.emptyTitle}>Discover Trending Shops Nearby</Text>
                  <Text style={s.emptyBody}>Follow local shops to unlock their story rings here.</Text>
                </View>
                <Text style={s.emptyCta}>Explore →</Text>
              </SpringPressable>
            ) : null}
          </ScrollView>
        )}
      </View>

      {sparks.length > 0 ? (
        <View style={s.sparksBlock}>
          <View style={s.sparksHeader}>
            <Text style={s.sectionTitle}>Candid moments</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sparksRail}>
            {sparks.slice(0, 12).map((spark, index) => {
              const media = resolveMediaUrl(spark.media_url);
              const isVideo = !!media && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(media);
              const productThumb = Array.isArray(spark.product?.images)
                ? resolveMediaUrl(spark.product.images[0])
                : null;
              // Prefer still images for thumbs — video URIs often render as grey boxes in Image
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
                        colors={['transparent', 'rgba(0,0,0,0.75)']}
                        style={s.sparkScrim}
                      />
                      <View style={s.playBadge}>
                        <Text style={s.playText}>▶</Text>
                      </View>
                      <Text style={s.sparkHandle} numberOfLines={1}>
                        {shopFeedHandle(spark.shop_name) || spark.shop_name || `Moment ${index + 1}`}
                      </Text>
                      <View style={s.viewsBadge}>
                        <Text style={s.sparkViews}>{views > 0 ? `${views} views` : 'New'}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </SpringPressable>
              );
            })}
            <SpringPressable style={s.seeAll} pressedScale={0.96} onPress={() => onOpenSparks(0)}>
              <Text style={s.seeAllText}>See all →</Text>
            </SpringPressable>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { gap: 12, paddingTop: 4 },
  storiesBlock: { minHeight: 92 },
  storiesRail: { paddingHorizontal: 14, gap: 12, alignItems: 'center' },
  story: { width: 72, alignItems: 'center', gap: 6 },
  ringOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDashed: {
    borderWidth: 2,
    borderColor: Colors.orange,
    borderStyle: 'dashed',
  },
  storyAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: Colors.card,
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
    fontSize: 11,
    fontWeight: '600',
    color: Colors.sub,
    textAlign: 'center',
    width: 72,
  },
  plus: { fontSize: 26, color: Colors.orange, fontWeight: '300', marginTop: -2 },
  skeletonRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  emptyBanner: {
    width: Platform.OS === 'web' ? 360 : 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  emptyEmoji: { fontSize: 22 },
  emptyTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  emptyBody: { fontSize: 11, color: Colors.dim, marginTop: 2, lineHeight: 15 },
  emptyCta: { fontSize: 12, fontWeight: '800', color: Colors.orange },
  sparksBlock: { paddingBottom: 4 },
  sparksHeader: { paddingHorizontal: 16, marginBottom: 8 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    marginTop: 2,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  sparksRail: { paddingHorizontal: 14, gap: 10, alignItems: 'center' },
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
  sparkImg: { width: '100%', height: '100%' },
  sparkFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkFallbackEmoji: { fontSize: 28 },
  sparkScrim: {
    ...({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 } as object),
  },
  playBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: Colors.white, fontSize: 11, fontWeight: '800', marginLeft: 1 },
  sparkHandle: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 28,
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '700',
  },
  seeAll: {
    width: 84,
    height: 168,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllText: { color: Colors.orange, fontWeight: '800', fontSize: 12 },
}));
