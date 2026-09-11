import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Dimensions, StyleSheet, TouchableOpacity, Pressable,
  Platform, Modal, Alert, Image, ActivityIndicator, type ViewToken, type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import type { Reel } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useSparkInteractionsStore } from '../../stores/sparkInteractionsStore';
import { useFeedMediaStore } from '../../stores/feedMediaStore';
import { createBuyerEnquiry, softDeleteMoment } from '../../lib/api';
import { hapticLight } from '../../lib/haptics';
import { FeedVideo } from './FeedVideo';
import { SparkCommentsModal } from './SparkCommentsModal';
import {
  IconComment, IconFollowPlus, IconHeart, IconMore, IconMute, IconMusic,
  IconRepost, IconShare, IconVolume,
} from './FeedIcons';
import { resolveFeedMediaUrl, shopFeedHandle, isVideoMedia } from './feedUtils';
import { DoubleTapLikeArea } from './DoubleTapLikeArea';
import { useMuteBadgeFlash } from '../sparks/MuteTapOverlay';
import { ShareRepostSheet } from '../common/ShareRepostSheet';
import { GlassSurface } from '../ui/modernSurfaces';

const { width: SCREEN_W, height: WINDOW_H } = Dimensions.get('window');
const CAPTION_LIMIT = 90;

export type SparkItem = Reel & {
  total_reposts?: number;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_following?: boolean;
  quote_caption?: string | null;
};

type SparksFeedProps = {
  sparks: SparkItem[];
  preloadRadius?: number;
  /** Force full-window page height (Instagram Reels immersive mode). */
  immersive?: boolean;
  /** Optional fixed page height; defaults to window height when immersive. */
  pageHeightOverride?: number;
  /** Called when user taps the immersive back control (immersive only). */
  onRequestClose?: () => void;
  /** Hide the built-in immersive back button when a parent overlays one. */
  hideBackButton?: boolean;
  /** Seller/pro create entry inside immersive Sparks (FAB). */
  canCreate?: boolean;
  onCreateSpark?: () => void;
  /** Called after the current user soft-deletes their own Moment. */
  onDeleted?: (sparkId: string) => void;
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
  immersive,
  bottomInset,
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
  quoteCaption,
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
  immersive?: boolean;
  bottomInset?: number;
  quoteCaption?: string | null;
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
  const uri = resolveFeedMediaUrl(spark?.media_url);
  const logo = resolveFeedMediaUrl(spark?.shop_logo);
  const musicTrackUrl =
    ((spark as SparkItem & { music_track_url?: string | null })?.music_track_url)
    ?? spark?.audio_url
    ?? null;
  const hasLatchedMusic = !!musicTrackUrl;
  const videoVolumePct = hasLatchedMusic
    ? (spark?.audio_volume_balance?.video ?? 0)
    : 100;
  const musicVolumePct = hasLatchedMusic
    ? (spark?.audio_volume_balance?.music ?? 100)
    : 0;
  const handle = shopFeedHandle(spark?.shop_name);
  const metaBottom = bottomInset ?? 28;
  const { flash: flashMuteBadge, Badge: MuteBadge } = useMuteBadgeFlash();

  const onSingleTapMute = () => {
    flashMuteBadge(!muted);
    onToggleMute();
  };

  const audioLabel = spark.audio_title
    ? `${spark.audio_title}${spark.audio_artist ? ` • ${spark.audio_artist}` : ''}`
    : spark.tags?.length
      ? spark.tags.map(t => `#${t}`).join(' ')
      : `${spark.shop_name ?? 'Shop'} · Original audio`;

  const locationFromCaption = spark.caption?.match(/📍\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const locationCity = locationFromCaption
    ? (locationFromCaption.split(',')[0]?.trim() || locationFromCaption)
    : null;

  return (
    <View style={[s.page, { height: pageHeight, width: SCREEN_W }]}>
      {uri ? (
        isVideoMedia(uri) ? (
          <FeedVideo
            uri={uri}
            active={active}
            muted={muted}
            loop
            preload={preload}
            backgroundAudioUrl={musicTrackUrl}
            audioStartTime={spark?.audio_start_time ?? 0}
            videoVolumePct={videoVolumePct}
            musicVolumePct={musicVolumePct}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            pointerEvents="none"
          />
        )
      ) : (
        <View style={[s.fallback, StyleSheet.absoluteFillObject]} pointerEvents="none">
          <ActivityIndicator color={Colors.orange} />
        </View>
      )}

      {/* Center-region mute / double-tap like — avoids sidebar & bottom chrome */}
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFillObject,
          { top: 96, right: 72, bottom: metaBottom + 120, left: 0 },
        ]}
      >
        <DoubleTapLikeArea
          overlay
          onDoubleTapLike={onDoubleTapLike}
          onSingleTap={onSingleTapMute}
        />
        {MuteBadge}
      </View>

      <View style={s.gradTop} pointerEvents="none" />
      <View style={s.gradBottom} pointerEvents="none" />

      {!immersive && active ? (
        <View style={s.muteChipWrap} pointerEvents="none">
          <View style={s.muteChip}>
            {muted ? <IconMute size={16} /> : <IconVolume size={16} />}
            <Text style={s.muteChipText}>
              {muted ? 'Muted' : spark.audio_title ? `♪ ${spark.audio_title}` : 'Sound on'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[s.sideColumn, immersive ? { bottom: metaBottom + 72 } : null]}>
        <TouchableOpacity style={s.sideBtn} onPress={onLike} activeOpacity={0.85} accessibilityLabel="Like">
          <IconHeart filled={liked} color={liked ? Colors.red : Colors.white} size={30} />
          <Text style={s.sideCount}>{likes > 0 ? formatCount(likes) : 'Like'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onComment} activeOpacity={0.85} accessibilityLabel="Comment">
          <IconComment color={Colors.white} size={28} />
          <Text style={s.sideCount}>{comments > 0 ? formatCount(comments) : 'Comment'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onShare} activeOpacity={0.85} accessibilityLabel="Share">
          <IconShare color={Colors.white} size={26} />
          <Text style={s.sideCount}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => {
            flashMuteBadge(!muted);
            onToggleMute();
          }}
          activeOpacity={0.85}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <IconMute size={26} /> : <IconVolume size={26} />}
          <Text style={s.sideCount}>{muted ? 'Muted' : 'Sound'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onRepost} activeOpacity={0.85} accessibilityLabel="Repost">
          <IconRepost filled={reposted} color={reposted ? Colors.orange : Colors.white} size={26} />
          <Text style={[s.sideCount, reposted && { color: Colors.orange }]}>
            {reposts > 0 ? formatCount(reposts) : 'Repost'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={onMore} activeOpacity={0.85} accessibilityLabel="More options">
          <IconMore color={Colors.white} size={24} />
        </TouchableOpacity>
      </View>

      <View style={[s.bottomMeta, { bottom: metaBottom }]}>
        {quoteCaption?.trim() ? (
          <GlassSurface style={s.quoteBadge} radius={16} intensity={24}>
            <Text style={s.quoteBadgeLabel}>Quote repost</Text>
            <Text style={s.quoteBadgeText} numberOfLines={3}>{quoteCaption.trim()}</Text>
          </GlassSurface>
        ) : null}
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
            {locationCity ? (
              <Text style={s.locationTag} numberOfLines={1}>📍 {locationCity}</Text>
            ) : following ? (
              <Text style={s.followingLabel}>Following</Text>
            ) : null}
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
  immersive,
  bottomInset,
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
  immersive?: boolean;
  bottomInset?: number;
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
    quoteCaption: spark.quote_caption ?? null,
  }), [
    spark.id, spark.is_liked, spark.is_reposted, spark.total_likes,
    spark.total_comments, spark.total_reposts, spark.is_following, spark.quote_caption, isShopFollowed,
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
      immersive={immersive}
      bottomInset={bottomInset}
      quoteCaption={interaction.quoteCaption || spark.quote_caption}
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

export function SparksFeed({
  sparks,
  preloadRadius = 1,
  immersive = false,
  pageHeightOverride,
  onRequestClose,
  hideBackButton = false,
  canCreate = false,
  onCreateSpark,
  onDeleted,
}: SparksFeedProps) {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore(s => s.profile);
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const toggleFollowedShop = useAuthStore(s => s.toggleFollowedShop);
  const addItem = useCartStore(s => s.addItem);
  const hydrateFromSparks = useSparkInteractionsStore(s => s.hydrateFromSparks);
  const toggleLike = useSparkInteractionsStore(s => s.toggleLike);
  const toggleRepost = useSparkInteractionsStore(s => s.toggleRepost);
  const quoteRepost = useSparkInteractionsStore(s => s.quoteRepost);
  const unrepost = useSparkInteractionsStore(s => s.unrepost);
  const setFollowing = useSparkInteractionsStore(s => s.setFollowing);
  const cacheVersion = useSparkInteractionsStore(s => s.version);

  const defaultHeight = immersive
    ? Math.round(pageHeightOverride ?? WINDOW_H)
    : Math.max(WINDOW_H - 160, 480);
  const [pageHeight, setPageHeight] = useState(defaultHeight);
  const [activeIndex, setActiveIndex] = useState(0);
  const globalMuted = useFeedMediaStore(s => s.globalMuted);
  const toggleGlobalMute = useFeedMediaStore(s => s.toggleGlobalMute);
  /** Immersive Moments start with sound on (Reels-like); home carousel stays globally muted. */
  const [immersiveMuted, setImmersiveMuted] = useState(false);
  const muted = immersive ? immersiveMuted : globalMuted;
  const onToggleMute = useCallback(() => {
    if (immersive) {
      setImmersiveMuted(m => !m);
      return;
    }
    toggleGlobalMute();
  }, [immersive, toggleGlobalMute]);

  useEffect(() => {
    if (immersive) setImmersiveMuted(false);
  }, [immersive]);
  const [menuSpark, setMenuSpark] = useState<SparkItem | null>(null);
  const [commentSpark, setCommentSpark] = useState<SparkItem | null>(null);
  const [shareSparkTarget, setShareSparkTarget] = useState<SparkItem | null>(null);
  const [repostBusy, setRepostBusy] = useState(false);
  const [deletingMoment, setDeletingMoment] = useState(false);

  const isOwnMoment = !!(
    menuSpark?.author_id
    && profile?.id
    && menuSpark.author_id === profile.id
  );

  const handleDeleteMoment = useCallback(() => {
    if (!menuSpark || !isOwnMoment || deletingMoment) return;
    const target = menuSpark;
    Alert.alert(
      'Delete Moment?',
      'This Moment will be removed from your feed. You can’t undo this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingMoment(true);
              try {
                await softDeleteMoment(target.id);
                setMenuSpark(null);
                onDeleted?.(target.id);
              } catch (e: any) {
                Alert.alert('Could not delete', e?.message || 'Please try again.');
              } finally {
                setDeletingMoment(false);
              }
            })();
          },
        },
      ],
    );
  }, [menuSpark, isOwnMoment, deletingMoment, onDeleted]);

  useEffect(() => {
    if (immersive) {
      const next = Math.round(pageHeightOverride ?? WINDOW_H);
      setPageHeight(next);
    }
  }, [immersive, pageHeightOverride]);

  const sparksKey = useMemo(
    () => sparks.map(row => `${row.id}:${row.total_likes}:${row.total_comments}:${row.total_reposts}`).join('|'),
    [sparks],
  );

  useEffect(() => {
    hydrateFromSparks(sparks);
  }, [sparksKey, hydrateFromSparks, sparks]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (immersive) return;
    const h = Math.floor(e.nativeEvent.layout.height);
    if (h > 200 && Math.abs(h - pageHeight) > 2) setPageHeight(h);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = (viewableItems ?? []).filter(v => v.isViewable && v.index != null && v.index >= 0);
    if (!visible.length) return;
    // During a page snap, multiple rows can briefly qualify — prefer the highest coverage if present.
    const top = [...visible].sort((a, b) => {
      const ap = typeof (a as any).percentVisible === 'number' ? (a as any).percentVisible : 0;
      const bp = typeof (b as any).percentVisible === 'number' ? (b as any).percentVisible : 0;
      if (bp !== ap) return bp - ap;
      return (a.index ?? 0) - (b.index ?? 0);
    })[0];
    const next = top?.index;
    if (next == null || next < 0) return;
    setActiveIndex(prev => (prev === next ? prev : next));
  }).current;

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 1,
    waitForInteraction: false,
  }), []);

  /** Snap settle backup — FlashList viewability can lag a frame behind paging. */
  const onScrollSettle = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (pageHeight <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.y / pageHeight);
    if (next < 0 || next >= sparks.length) return;
    setActiveIndex(prev => (prev === next ? prev : next));
  }, [pageHeight, sparks.length]);

  const handleLike = useCallback((spark: SparkItem) => {
    void toggleLike(spark.id, profile?.id);
  }, [profile?.id, toggleLike]);

  const handleDoubleTapLike = useCallback((spark: SparkItem) => {
    const current = useSparkInteractionsStore.getState().getInteraction(spark.id, spark);
    if (current.isLiked) return;
    hapticLight();
    void toggleLike(spark.id, profile?.id);
  }, [profile?.id, toggleLike]);

  const openShareSheet = useCallback((spark: SparkItem) => {
    // Defer so the opening tap does not dismiss the transparent Modal backdrop.
    setTimeout(() => setShareSparkTarget(spark), 40);
  }, []);

  const handleRepost = useCallback((spark: SparkItem) => {
    openShareSheet(spark);
  }, [openShareSheet]);

  const shareInteraction = useSparkInteractionsStore(state =>
    shareSparkTarget ? state.getInteraction(shareSparkTarget.id, shareSparkTarget) : null,
  );

  const handleFollow = useCallback((spark: SparkItem) => {
    if (!spark.shop_id) return;
    const nextFollowing = !followedShopIds.includes(spark.shop_id);
    setFollowing(spark.id, nextFollowing);
    void toggleFollowedShop(spark.shop_id, spark.shop_name);
  }, [followedShopIds, setFollowing, toggleFollowedShop]);

  const handleBuy = useCallback((spark: SparkItem) => {
    if (!profile || !spark.product_id || !spark.shop_id) return;
    void addItem(profile.id, spark.product_id, spark.shop_id, 1);
    Alert.alert('Added to cart', `${spark.product?.title ?? 'Product'} was added to your cart.`);
  }, [profile, addItem]);

  const handleChat = useCallback(async (spark: SparkItem) => {
    if (!profile) {
      Alert.alert('Sign in required', 'Please sign in to message this shop.');
      return;
    }
    if (!spark.shop_id) return;
    try {
      await createBuyerEnquiry({
        shopId: spark.shop_id,
        buyerId: profile.id,
        productId: spark.product_id ?? null,
        type: 'chat',
        message: `Hi, I saw your Moment and would like to know more${spark.product?.title ? ` about ${spark.product.title}` : ''}.`,
      });
      Alert.alert('Message sent', 'The shop will see your enquiry in their inbox.');
    } catch (e: any) {
      Alert.alert('Could not send message', e?.message || 'Please try again.');
    }
  }, [profile]);

  if (!sparks.length) {
    return (
      <View style={[s.empty, immersive && { height: pageHeight, backgroundColor: Colors.black }]} onLayout={onLayout}>
        {immersive && onRequestClose && !hideBackButton ? (
          <TouchableOpacity
            style={[s.backBtn, { top: insets.top + 12 }]}
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel="Close Moments"
          >
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={s.emptyEmoji}>✨</Text>
        <Text style={s.emptyTitle}>No Moments yet</Text>
        <Text style={s.emptyText}>
          Short videos from local shops will appear here. Follow shops or create a Moment from your seller menu.
        </Text>
        {immersive && canCreate && onCreateSpark ? (
          <TouchableOpacity
            style={s.emptyCreateBtn}
            onPress={onCreateSpark}
            accessibilityRole="button"
            accessibilityLabel="Create Moment"
          >
            <Text style={s.emptyCreateBtnText}>Create Moment</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[s.root, immersive && { height: pageHeight }]} onLayout={onLayout}>
      {immersive && onRequestClose && !hideBackButton ? (
        <TouchableOpacity
          style={[s.backBtn, { top: insets.top + 12 }]}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Close Moments"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
      ) : null}

      {immersive && canCreate && onCreateSpark ? (
        <TouchableOpacity
          style={[s.createFab, { top: insets.top + 12 }]}
          onPress={onCreateSpark}
          accessibilityRole="button"
          accessibilityLabel="Create Moment"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.createFabText}>+</Text>
        </TouchableOpacity>
      ) : null}

      <FlashList
        data={sparks}
        keyExtractor={(item, index) => item?.id || `spark-${index}`}
        extraData={`${cacheVersion}-${followedShopIds.join(',')}-${muted}-${activeIndex}-${pageHeight}`}
        estimatedItemSize={pageHeight}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        drawDistance={pageHeight * 2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={onScrollSettle}
        onScrollEndDrag={onScrollSettle}
        renderItem={({ item, index }) => (
          <SparkListRow
            spark={item}
            index={index}
            activeIndex={activeIndex}
            preloadRadius={preloadRadius}
            pageHeight={pageHeight}
            muted={muted}
            isShopFollowed={item.shop_id ? followedShopIds.includes(item.shop_id) : false}
            immersive={immersive}
            bottomInset={immersive ? Math.max(insets.bottom, 12) : 28}
            onToggleMute={onToggleMute}
            onLike={handleLike}
            onDoubleTapLike={handleDoubleTapLike}
            onComment={setCommentSpark}
            onShare={openShareSheet}
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

      <ShareRepostSheet
        visible={!!shareSparkTarget}
        onClose={() => setShareSparkTarget(null)}
        contentKind="spark"
        contentId={shareSparkTarget?.id ?? ''}
        shopId={shareSparkTarget?.shop_id ?? ''}
        shopName={shareSparkTarget?.shop_name}
        shareTitle={`${shareSparkTarget?.shop_name ?? 'Shop'} on Moments`}
        shareMessage={`${shareSparkTarget?.shop_name}: ${shareSparkTarget?.caption ?? ''}\nhttps://cityconnect.app/sparks/${shareSparkTarget?.id ?? ''}`}
        shareUrl={`https://cityconnect.app/sparks/${shareSparkTarget?.id ?? ''}`}
        isReposted={!!shareInteraction?.isReposted}
        busy={repostBusy}
        onQuickRepost={async () => {
          if (!shareSparkTarget?.shop_id) return;
          setRepostBusy(true);
          try {
            await toggleRepost(shareSparkTarget.id, profile?.id, shareSparkTarget.shop_id);
          } finally {
            setRepostBusy(false);
          }
        }}
        onUndoRepost={async () => {
          if (!shareSparkTarget) return;
          setRepostBusy(true);
          try {
            await unrepost(shareSparkTarget.id, profile?.id);
          } finally {
            setRepostBusy(false);
          }
        }}
        onQuoteRepost={async (quote) => {
          if (!shareSparkTarget?.shop_id) return;
          setRepostBusy(true);
          try {
            await quoteRepost(shareSparkTarget.id, profile?.id, shareSparkTarget.shop_id, quote);
          } finally {
            setRepostBusy(false);
          }
        }}
      />

      <Modal transparent visible={!!menuSpark} animationType="fade" onRequestClose={() => setMenuSpark(null)}>
        <Pressable style={s.menuBackdrop} onPress={() => setMenuSpark(null)}>
          <View style={s.menuSheet}>
            <View style={s.menuHandle} />
            <Text style={s.menuTitle}>Moment options</Text>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                if (menuSpark) openShareSheet(menuSpark);
                setMenuSpark(null);
              }}
            >
              <Text style={s.menuItemText}>Share / Repost</Text>
            </TouchableOpacity>
            {isOwnMoment ? (
              <TouchableOpacity
                style={s.menuItem}
                disabled={deletingMoment}
                onPress={handleDeleteMoment}
              >
                <Text style={[s.menuItemText, { color: Colors.red }]}>
                  {deletingMoment ? 'Deleting…' : 'Delete Moment'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.menuItem}
                onPress={() => {
                  Alert.alert('Reported', 'Thanks — we will review this Moment.');
                  setMenuSpark(null);
                }}
              >
                <Text style={[s.menuItemText, { color: Colors.red }]}>Report</Text>
              </TouchableOpacity>
            )}
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

const s = createDynamicStyles((Colors) => ({
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
  quoteBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  quoteBadgeLabel: {
    color: Colors.orange,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: Fonts.bodySemiBold,
  },
  quoteBadgeText: {
    color: Colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.bodyMedium,
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
  locationTag: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginTop: -1,
  },
  createFab: {
    position: 'absolute',
    right: 14,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFabText: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  emptyCreateBtn: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.orange,
  },
  emptyCreateBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
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
}));
