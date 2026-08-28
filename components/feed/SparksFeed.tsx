import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Dimensions, StyleSheet, TouchableOpacity, Pressable,
  Share, Platform, Modal, Alert, Image, ActivityIndicator, type ViewToken, type LayoutChangeEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, Radius } from '../../constants/theme';
import type { Reel } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useSparkInteractionsStore } from '../../stores/sparkInteractionsStore';
import { useFeedMediaStore } from '../../stores/feedMediaStore';
import { createBuyerEnquiry } from '../../lib/api';
import { hapticLight } from '../../lib/haptics';
import { FeedVideo } from './FeedVideo';
import { SparkCommentsModal } from './SparkCommentsModal';
import {
  IconComment, IconFollowPlus, IconHeart, IconMore, IconMute, IconMusic,
  IconRepost, IconShare, IconVolume,
} from './FeedIcons';
import { resolveFeedMediaUrl, shopFeedHandle } from './feedUtils';

const { width: SCREEN_W, height: WINDOW_H } = Dimensions.get('window');
const CAPTION_LIMIT = 90;

export type SparkItem = Reel & {
  total_reposts?: number;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_following?: boolean;
};

type SparksFeedProps = {
  sparks: SparkItem[];
  preloadRadius?: number;
};

function SparkCaption({ text }: { text?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const body = (text || '').trim();
  if (!body) return null;
  const long = body.length > CAPTION_LIMIT;
  const display = expanded || !long ? body : `${body.slice(0, CAPTION_LIMIT).trim()}…`;
  return (
    <Text style={s.caption}>
      {display}
      {long && !expanded ? (
        <Text style={s.more} onPress={() => setExpanded(true)}> more</Text>
      ) : null}
    </Text>
  );
}

function ProductCommerceBanner({
  spark,
  onBuy,
  onChat,
}: {
  spark: SparkItem;
  onBuy: () => void;
  onChat: () => void;
}) {
  const product = spark.product;
  if (!spark.product_id || !product) return null;
  const thumb = resolveFeedMediaUrl(product.images?.[0] ?? null);
  const price = product.discounted_price ?? product.price;

  return (
    <View style={s.productBanner}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={s.productThumb} />
      ) : (
        <View style={[s.productThumb, s.productThumbFallback]}>
          <Text style={s.productThumbEmoji}>📦</Text>
        </View>
      )}
      <View style={s.productCopy}>
        <Text style={s.productTitle} numberOfLines={1}>{product.title}</Text>
        <Text style={s.productPrice}>₹{Number(price).toLocaleString('en-IN')}</Text>
      </View>
      <TouchableOpacity style={s.buyBtn} onPress={onBuy} activeOpacity={0.9}>
        <Text style={s.buyBtnText}>🛍️ Buy Now</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.chatBtn} onPress={onChat} activeOpacity={0.9}>
        <Text style={s.chatBtnText}>💬 Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const SparkCard = memo(function SparkCard({
  spark,
  active,
  preload,
  pageHeight,
  liked,
  likes,
  comments,
  reposts,
  reposted,
  following,
  muted,
  onToggleMute,
  onLike,
  onDoubleTapLike,
  onComment,
  onShare,
  onRepost,
  onFollow,
  onMore,
  onBuy,
  onChat,
}: {
  spark: SparkItem;
  active: boolean;
  preload: boolean;
  pageHeight: number;
  liked: boolean;
  likes: number;
  comments: number;
  reposts: number;
  reposted: boolean;
  following: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onDoubleTapLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onRepost: () => void;
  onFollow: () => void;
  onMore: () => void;
  onBuy: () => void;
  onChat: () => void;
}) {
  const uri = resolveFeedMediaUrl(spark.media_url);
  const logo = resolveFeedMediaUrl(spark.shop_logo);
  const handle = shopFeedHandle(spark.shop_name);
  const lastTap = useRef(0);

  const onTapVideo = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      onDoubleTapLike();
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current && Date.now() - lastTap.current >= 280) {
        onToggleMute();
        lastTap.current = 0;
      }
    }, 290);
  };

  const audioLabel = spark.audio_title
    ? `${spark.audio_title}${spark.audio_artist ? ` • ${spark.audio_artist}` : ''}`
    : spark.tags?.length
      ? spark.tags.map(t => `#${t}`).join(' ')
      : `${spark.shop_name ?? 'Shop'} · Original audio`;

  return (
    <View style={[s.page, { height: pageHeight, width: SCREEN_W }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTapVideo}>
        {uri ? (
          <FeedVideo
            uri={uri}
            active={active}
            muted={muted}
            loop
            preload={preload}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : (
          <View style={s.fallback}>
            <ActivityIndicator color={Colors.orange} />
          </View>
        )}
      </Pressable>

      <View style={s.gradTop} pointerEvents="none" />
      <View style={s.gradBottom} pointerEvents="none" />

      {active && (
        <View style={s.muteChipWrap} pointerEvents="none">
          <View style={s.muteChip}>
            {muted ? <IconMute size={16} /> : <IconVolume size={16} />}
            <Text style={s.muteChipText}>{muted ? 'Muted' : 'Sound on'}</Text>
          </View>
        </View>
      )}

      <View style={s.sideColumn}>
        <TouchableOpacity style={s.sideBtn} onPress={onLike} activeOpacity={0.85}>
          <IconHeart filled={liked} color={liked ? Colors.red : Colors.white} size={30} />
          <Text style={s.sideCount}>{likes > 0 ? formatCount(likes) : 'Like'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onComment} activeOpacity={0.85}>
          <IconComment color={Colors.white} size={28} />
          <Text style={s.sideCount}>{comments > 0 ? formatCount(comments) : 'Comment'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onShare} activeOpacity={0.85}>
          <IconShare color={Colors.white} size={26} />
          <Text style={s.sideCount}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onRepost} activeOpacity={0.85}>
          <IconRepost filled={reposted} color={reposted ? Colors.orange : Colors.white} size={26} />
          <Text style={[s.sideCount, reposted && { color: Colors.orange }]}>
            {reposts > 0 ? formatCount(reposts) : 'Repost'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onMore} activeOpacity={0.85}>
          <IconMore color={Colors.white} size={24} />
        </TouchableOpacity>
      </View>

      <View style={s.bottomMeta}>
        <ProductCommerceBanner spark={spark} onBuy={onBuy} onChat={onChat} />
        <View style={s.creatorRow}>
          <View style={s.avatarWrap}>
            {logo ? (
              <Image source={{ uri: logo }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarEmoji}>🏪</Text>
              </View>
            )}
            {!following ? (
              <TouchableOpacity style={s.followBtn} onPress={onFollow} activeOpacity={0.9}>
                <IconFollowPlus size={12} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.creatorCopy}>
            <Text style={s.handle} numberOfLines={1}>{handle}</Text>
            {following ? <Text style={s.followingLabel}>Following</Text> : null}
          </View>
        </View>
        <SparkCaption text={spark.caption} />
        <View style={s.audioBanner}>
          <View style={s.audioIconWrap}>
            <IconMusic size={12} />
          </View>
          <Text style={s.audioText} numberOfLines={1}>{audioLabel}</Text>
        </View>
      </View>
    </View>
  );
});

function SparkListRow({
  spark,
  index,
  activeIndex,
  preloadRadius,
  pageHeight,
  muted,
  isShopFollowed,
  onToggleMute,
  onLike,
  onDoubleTapLike,
  onComment,
  onShare,
  onRepost,
  onFollow,
  onMore,
  onBuy,
  onChat,
}: {
  spark: SparkItem;
  index: number;
  activeIndex: number;
  preloadRadius: number;
  pageHeight: number;
  muted: boolean;
  isShopFollowed: boolean;
  onToggleMute: () => void;
  onLike: (spark: SparkItem) => void;
  onDoubleTapLike: (spark: SparkItem) => void;
  onComment: (spark: SparkItem) => void;
  onShare: (spark: SparkItem) => void;
  onRepost: (spark: SparkItem) => void;
  onFollow: (spark: SparkItem) => void;
  onMore: (spark: SparkItem) => void;
  onBuy: (spark: SparkItem) => void;
  onChat: (spark: SparkItem) => void;
}) {
  const cached = useSparkInteractionsStore(state => state.byId[spark.id]);
  const fallback = useMemo(() => ({
    isLiked: !!spark.is_liked,
    isReposted: !!spark.is_reposted,
    likeCount: spark.total_likes ?? 0,
    commentCount: spark.total_comments ?? 0,
    repostCount: spark.total_reposts ?? 0,
    isFollowing: isShopFollowed || !!spark.is_following,
  }), [
    spark.id, spark.is_liked, spark.is_reposted, spark.total_likes,
    spark.total_comments, spark.total_reposts, spark.is_following, isShopFollowed,
  ]);
  const interaction = cached ?? fallback;

  return (
    <SparkCard
      spark={spark}
      active={index === activeIndex}
      preload={Math.abs(index - activeIndex) <= preloadRadius}
      pageHeight={pageHeight}
      liked={interaction.isLiked}
      likes={interaction.likeCount}
      comments={interaction.commentCount}
      reposts={interaction.repostCount}
      reposted={interaction.isReposted}
      following={isShopFollowed || interaction.isFollowing}
      muted={muted}
      onToggleMute={onToggleMute}
      onLike={() => onLike(spark)}
      onDoubleTapLike={() => onDoubleTapLike(spark)}
      onComment={() => onComment(spark)}
      onShare={() => onShare(spark)}
      onRepost={() => onRepost(spark)}
      onFollow={() => onFollow(spark)}
      onMore={() => onMore(spark)}
      onBuy={() => onBuy(spark)}
      onChat={() => onChat(spark)}
    />
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function SparksFeed({ sparks, preloadRadius = 1 }: SparksFeedProps) {
  const profile = useAuthStore(s => s.profile);
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const toggleFollowedShop = useAuthStore(s => s.toggleFollowedShop);
  const addItem = useCartStore(s => s.addItem);
  const hydrateFromSparks = useSparkInteractionsStore(s => s.hydrateFromSparks);
  const toggleLike = useSparkInteractionsStore(s => s.toggleLike);
  const toggleRepost = useSparkInteractionsStore(s => s.toggleRepost);
  const setFollowing = useSparkInteractionsStore(s => s.setFollowing);
  const cacheVersion = useSparkInteractionsStore(s => s.version);

  const [pageHeight, setPageHeight] = useState(Math.max(WINDOW_H - 160, 480));
  const [activeIndex, setActiveIndex] = useState(0);
  const globalMuted = useFeedMediaStore(s => s.globalMuted);
  const toggleGlobalMute = useFeedMediaStore(s => s.toggleGlobalMute);
  const [menuSpark, setMenuSpark] = useState<SparkItem | null>(null);
  const [commentSpark, setCommentSpark] = useState<SparkItem | null>(null);

  const sparksKey = useMemo(
    () => sparks.map(row => `${row.id}:${row.total_likes}:${row.total_comments}:${row.total_reposts}`).join('|'),
    [sparks],
  );

  useEffect(() => {
    hydrateFromSparks(sparks);
  }, [sparksKey, hydrateFromSparks, sparks]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.floor(e.nativeEvent.layout.height);
    if (h > 200 && Math.abs(h - pageHeight) > 2) setPageHeight(h);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const top = viewableItems.find(v => v.isViewable);
    if (top?.index != null && top.index >= 0) setActiveIndex(top.index);
  }).current;

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 70 }), []);

  const handleLike = useCallback((spark: SparkItem) => {
    void toggleLike(spark.id, profile?.id);
  }, [profile?.id, toggleLike]);

  const handleDoubleTapLike = useCallback((spark: SparkItem) => {
    const current = useSparkInteractionsStore.getState().getInteraction(spark.id, spark);
    if (current.isLiked) return;
    hapticLight();
    void toggleLike(spark.id, profile?.id);
  }, [profile?.id, toggleLike]);

  const handleRepost = useCallback((spark: SparkItem) => {
    void toggleRepost(spark.id, profile?.id, spark.shop_id);
  }, [profile?.id, toggleRepost]);

  const handleFollow = useCallback((spark: SparkItem) => {
    const nextFollowing = !followedShopIds.includes(spark.shop_id);
    setFollowing(spark.id, nextFollowing);
    void toggleFollowedShop(spark.shop_id, spark.shop_name);
  }, [followedShopIds, setFollowing, toggleFollowedShop]);

  const handleBuy = useCallback((spark: SparkItem) => {
    if (!profile || !spark.product_id) return;
    void addItem(profile.id, spark.product_id, spark.shop_id, 1);
    Alert.alert('Added to cart', `${spark.product?.title ?? 'Product'} was added to your cart.`);
  }, [profile, addItem]);

  const handleChat = useCallback(async (spark: SparkItem) => {
    if (!profile) {
      Alert.alert('Sign in required', 'Please sign in to message this shop.');
      return;
    }
    try {
      await createBuyerEnquiry({
        shopId: spark.shop_id,
        buyerId: profile.id,
        productId: spark.product_id ?? null,
        type: 'chat',
        message: `Hi, I saw your Spark and would like to know more${spark.product?.title ? ` about ${spark.product.title}` : ''}.`,
      });
      Alert.alert('Message sent', 'The shop will see your enquiry in their inbox.');
    } catch (e: any) {
      Alert.alert('Could not send message', e?.message || 'Please try again.');
    }
  }, [profile]);

  const shareSpark = useCallback(async (spark: SparkItem) => {
    try {
      await Share.share({
        message: `${spark.shop_name}: ${spark.caption}\nhttps://cityconnect.app/sparks/${spark.id}`,
        title: `${spark.shop_name} on Sparks`,
      });
    } catch { /* noop */ }
  }, []);

  const menuInteraction = useSparkInteractionsStore(state =>
    menuSpark ? state.getInteraction(menuSpark.id, menuSpark) : null,
  );

  if (!sparks.length) {
    return (
      <View style={s.empty} onLayout={onLayout}>
        <Text style={s.emptyEmoji}>✨</Text>
        <Text style={s.emptyTitle}>No Sparks yet</Text>
        <Text style={s.emptyText}>
          Short videos from local shops will appear here. Follow shops or create a Spark from your seller menu.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.root} onLayout={onLayout}>
      <FlashList
        data={sparks}
        keyExtractor={item => item.id}
        extraData={`${cacheVersion}-${followedShopIds.join(',')}`}
        estimatedItemSize={WINDOW_H}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        drawDistance={pageHeight * 2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <SparkListRow
            spark={item}
            index={index}
            activeIndex={activeIndex}
            preloadRadius={preloadRadius}
            pageHeight={pageHeight}
            muted={globalMuted}
            isShopFollowed={followedShopIds.includes(item.shop_id)}
            onToggleMute={toggleGlobalMute}
            onLike={handleLike}
            onDoubleTapLike={handleDoubleTapLike}
            onComment={setCommentSpark}
            onShare={shareSpark}
            onRepost={handleRepost}
            onFollow={handleFollow}
            onMore={setMenuSpark}
            onBuy={handleBuy}
            onChat={handleChat}
          />
        )}
      />

      <SparkCommentsModal
        visible={!!commentSpark}
        sparkId={commentSpark?.id ?? null}
        userId={profile?.id}
        onClose={() => setCommentSpark(null)}
      />

      <Modal transparent visible={!!menuSpark} animationType="fade" onRequestClose={() => setMenuSpark(null)}>
        <Pressable style={s.menuBackdrop} onPress={() => setMenuSpark(null)}>
          <View style={s.menuSheet}>
            <View style={s.menuHandle} />
            <Text style={s.menuTitle}>Spark options</Text>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                if (menuSpark) void shareSpark(menuSpark);
                setMenuSpark(null);
              }}
            >
              <Text style={s.menuItemText}>Share Spark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                if (menuSpark) handleRepost(menuSpark);
                setMenuSpark(null);
              }}
            >
              <Text style={s.menuItemText}>
                {menuInteraction?.isReposted ? 'Undo repost' : 'Repost Spark'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                Alert.alert('Reported', 'Thanks — we will review this Spark.');
                setMenuSpark(null);
              }}
            >
              <Text style={[s.menuItemText, { color: Colors.red }]}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => setMenuSpark(null)}>
              <Text style={[s.menuItemText, { color: Colors.dim }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** @deprecated Use SparksFeed — kept for existing imports */
export const ReelsFeed = SparksFeed;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.black },
  page: {
    backgroundColor: Colors.black,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    ...Platform.select({
      web: { background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' } as object,
      default: { backgroundColor: 'rgba(0,0,0,0.35)' },
    }),
  },
  gradBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    ...Platform.select({
      web: { background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)' } as object,
      default: { backgroundColor: 'rgba(0,0,0,0.5)' },
    }),
  },
  muteChipWrap: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  muteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  muteChipText: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  sideColumn: {
    position: 'absolute',
    right: 10,
    bottom: 110,
    alignItems: 'center',
    gap: 18,
    zIndex: 4,
  },
  sideBtn: { alignItems: 'center', gap: 4, minWidth: 48 },
  sideCount: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.bodySemiBold,
    textAlign: 'center',
  },
  bottomMeta: {
    position: 'absolute',
    left: 14,
    right: 78,
    bottom: 28,
    gap: 10,
    zIndex: 4,
  },
  productBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,32,0.88)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 8,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productThumbEmoji: { fontSize: 18 },
  productCopy: { flex: 1, minWidth: 0 },
  productTitle: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  productPrice: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  buyBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  buyBtnText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  chatBtn: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chatBtnText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: Colors.card,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 20 },
  followBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.black,
  },
  creatorCopy: { flex: 1, minWidth: 0, gap: 2 },
  handle: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  followingLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
  },
  caption: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  more: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
  },
  audioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  audioIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioText: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    flexShrink: 1,
    maxWidth: SCREEN_W - 160,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
    backgroundColor: Colors.bg,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  emptyText: {
    color: Colors.sub,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
  menuBackdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 28,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  menuTitle: {
    textAlign: 'center',
    color: Colors.text,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 6,
    fontFamily: Fonts.bodySemiBold,
  },
  menuItem: { paddingVertical: 15, paddingHorizontal: 24 },
  menuItemText: {
    textAlign: 'center',
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
