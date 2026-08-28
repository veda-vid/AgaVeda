import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ActivityIndicator,
  Modal, Pressable, Alert, Share, StyleSheet, Dimensions, Platform, Animated, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  repostPost, getComments, addComment, deletePost, setProductAvailability, getShopCommerceMeta,
} from '../../lib/api';
import { useProfileMediaStore } from '../../stores/profileMediaStore';
import { usePostInteractionsStore } from '../../stores/postInteractionsStore';
import { useFeedMediaStore } from '../../stores/feedMediaStore';
import { hapticLight } from '../../lib/haptics';
import {
  estimateChatsInitiated, estimatePostImpressions, estimatePostSaves,
} from '../../lib/sellerPostMetrics';
import { Colors, Fonts, Radius, Shadow } from '../../constants/theme';
import { CaptionBlock } from './CaptionBlock';
import { MediaCarousel } from './MediaCarousel';
import { IconBookmark, IconComment, IconHeart, IconMore, IconRepost, IconShare } from './FeedIcons';
import {
  parseTextCardCaption, resolveFeedMediaUrl, shopFeedHandle, timeAgo,
} from './feedUtils';
import { getTextBackground, getTextColor, getTextFontStyle } from './feedTextCard';

const SCREEN_W = Dimensions.get('window').width;

export type FeedPost = {
  id: string;
  shop_id?: string;
  shop_name?: string;
  shop_logo?: string | null;
  shop_category?: string;
  shop_city?: string;
  shop_avg_rating?: number;
  distance_km?: number;
  caption?: string;
  media_urls?: string[];
  media_type?: string;
  product_id?: string;
  product?: { id?: string; title?: string };
  is_liked?: boolean;
  is_saved?: boolean;
  is_reposted?: boolean;
  is_ad?: boolean;
  total_likes?: number;
  total_reposts?: number;
  total_comments?: number;
  created_at: string;
  feed_item_id?: string;
  reposted_by_name?: string | null;
  reposted_by_id?: string | null;
  reposted_at?: string | null;
  quote_caption?: string | null;
  is_repost_entry?: boolean;
};

type PostCardProps = {
  post: FeedPost;
  userId: string;
  isBuyer: boolean;
  isSellerOwner?: boolean;
  layout?: 'feed' | 'masonry';
  isMediaActive?: boolean;
  onAddToCart?: (productId: string, shopId: string) => void;
  onDeleted?: (postId: string) => void;
};

function ScalePress({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: object }) {
  const scale = useState(new Animated.Value(1))[0];
  const pressIn = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function PostCard({
  post,
  userId,
  isBuyer,
  isSellerOwner = false,
  layout = 'feed',
  isMediaActive = true,
  onAddToCart,
  onDeleted,
}: PostCardProps) {
  const router = useRouter();
  const cardW = layout === 'masonry' ? (SCREEN_W - 12 * 2 - 8) / 2 : SCREEN_W - 24;
  const mediaH = layout === 'masonry' ? cardW * 1.28 : SCREEN_W * (5 / 4);

  const cached = usePostInteractionsStore(s => s.getInteraction(post.id, post));
  const postCacheVersion = usePostInteractionsStore(s => s.version);
  const toggleLikeStore = usePostInteractionsStore(s => s.toggleLike);
  const toggleRepostStore = usePostInteractionsStore(s => s.toggleRepost);
  const toggleSaveStore = usePostInteractionsStore(s => s.toggleSave);
  const bumpCommentCount = usePostInteractionsStore(s => s.bumpCommentCount);
  const addCommentOptimistic = usePostInteractionsStore(s => s.addCommentOptimistic);
  const globalMuted = useFeedMediaStore(s => s.globalMuted);
  const toggleGlobalMute = useFeedMediaStore(s => s.toggleGlobalMute);

  const shopLogoUri = resolveFeedMediaUrl(post.shop_logo);
  const handle = shopFeedHandle(post.shop_name);
  const locationLine = [
    post.shop_city || post.shop_category,
    post.distance_km != null ? `${Number(post.distance_km).toFixed(1)} km away` : null,
  ].filter(Boolean).join(' · ');

  const [shopMeta, setShopMeta] = useState<{
    phone?: string;
    whatsapp?: string | null;
    lat?: number;
    lng?: number;
    name?: string;
  } | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showSellerManage, setShowSellerManage] = useState(false);
  const [showRepostSheet, setShowRepostSheet] = useState(false);
  const [quoteMode, setQuoteMode] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [managing, setManaging] = useState(false);

  const liked = cached.isLiked;
  const saved = cached.isSaved;
  const reposted = cached.isReposted;
  const likes = cached.likeCount;
  const reposts = cached.repostCount;
  const commentCount = cached.commentCount;

  const textCard = parseTextCardCaption(post.caption);
  const mediaUrls = post.media_urls?.filter(Boolean) ?? [];
  const productId = post.product_id || post.product?.id;

  useEffect(() => {
    if (!isBuyer || !productId || !post.shop_id) return;
    let cancelled = false;
    getShopCommerceMeta(post.shop_id)
      .then(meta => { if (!cancelled) setShopMeta(meta); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isBuyer, productId, post.shop_id]);

  void postCacheVersion;

  const impressions = estimatePostImpressions(post);
  const saves = estimatePostSaves(post);
  const chats = estimateChatsInitiated(post);

  const handleLike = async () => {
    if (isSellerOwner) return;
    try {
      await toggleLikeStore(post.id, userId);
    } catch { /* noop */ }
  };

  const handleDoubleTapLike = async () => {
    if (isSellerOwner || liked) return;
    hapticLight();
    try {
      await toggleLikeStore(post.id, userId);
    } catch { /* noop */ }
  };

  const handleSave = async () => {
    try {
      await toggleSaveStore(post.id, userId);
    } catch { /* noop */ }
  };

  const handleRepost = async (quote?: string | null) => {
    if (reposting || isSellerOwner) return;
    const shopId = post.shop_id;
    if (!shopId) {
      Alert.alert('Error', 'Could not repost this item.');
      return;
    }
    setReposting(true);
    setShowPostMenu(false);
    setShowRepostSheet(false);
    setQuoteMode(false);
    try {
      if (quote?.trim()) {
        await repostPost(userId, post.id, shopId, quote.trim());
        useProfileMediaStore.getState().invalidateUserReposts();
      } else {
        await toggleRepostStore(post.id, userId, shopId);
      }
      setQuoteText('');
    } catch {
      Alert.alert('Error', 'Could not update repost. Please try again.');
    } finally {
      setReposting(false);
    }
  };

  const openRepostSheet = () => {
    if (reposting) return;
    setQuoteMode(false);
    setQuoteText(post.quote_caption ?? '');
    setShowRepostSheet(true);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this from ${post.shop_name}: ${post.caption || 'Amazing find!'}\n\nhttps://cityconnect.app/post/${post.id}`,
        title: `${post.shop_name} on Vedastya`,
        url: `https://cityconnect.app/post/${post.id}`,
      });
    } catch { /* noop */ }
  };

  const openComments = async () => {
    setShowComments(true);
    if (comments.length) return;
    setLoadingComments(true);
    try {
      setComments(await getComments(post.id));
    } catch { /* noop */ } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const body = commentText.trim();
    setCommentText('');
    addCommentOptimistic(post.id, 1);
    try {
      const c = await addComment(userId, post.id, body);
      setComments(prev => [...prev, c]);
    } catch {
      bumpCommentCount(post.id, -1);
    }
  };

  const handleCommerceAdd = async () => {
    if (!productId || !post.shop_id || !onAddToCart) return;
    setAddingToCart(true);
    try {
      await onAddToCart(productId, post.shop_id);
      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2: post.product?.title ? `${post.product.title} is in your cart.` : 'Item added to your cart.',
        visibilityTime: 2200,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not add to cart.';
      Toast.show({ type: 'error', text1: 'Cart', text2: message });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleCommerceChat = () => {
    if (!post.shop_id) return;
    router.push({
      pathname: '/chat/[shopId]',
      params: {
        shopId: post.shop_id,
        productId: productId ?? '',
        productTitle: post.product?.title ?? '',
        shopName: post.shop_name ?? shopMeta?.name ?? 'Shop',
      },
    } as any);
  };

  const handleCommerceWhatsApp = () => {
    const phone = (shopMeta?.whatsapp || shopMeta?.phone || '').replace(/\D/g, '');
    if (!phone) {
      Alert.alert('WhatsApp unavailable', 'This shop has not shared a WhatsApp number yet.');
      return;
    }
    const productLabel = post.product?.title ? ` about ${post.product.title}` : '';
    const message = encodeURIComponent(
      `Hi ${post.shop_name ?? shopMeta?.name ?? 'there'}, I saw your post${productLabel} on Vedastya.`,
    );
    void Linking.openURL(`https://wa.me/${phone}?text=${message}`);
  };

  const handleCommerceMaps = () => {
    const lat = shopMeta?.lat;
    const lng = shopMeta?.lng;
    if (lat == null || lng == null) {
      Alert.alert('Location unavailable', 'This shop has not shared map coordinates yet.');
      return;
    }
    const label = encodeURIComponent(post.shop_name ?? shopMeta?.name ?? 'Shop');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) void Linking.openURL(url);
  };

  const openSellerManage = () => {
    setShowSellerManage(true);
  };

  const handleEditListing = () => {
    setShowSellerManage(false);
    if (productId) {
      router.push({ pathname: '/seller/upload', params: { productId } } as any);
      return;
    }
    Alert.alert('Edit listing', 'This post is not linked to a product catalog item.');
  };

  const handleToggleAvailability = async () => {
    if (!productId) {
      Alert.alert('Unavailable', 'Link this post to a product to change availability.');
      return;
    }
    setManaging(true);
    try {
      await setProductAvailability(productId, false);
      setShowSellerManage(false);
      Alert.alert('Updated', 'Product marked as unavailable.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update availability.');
    } finally {
      setManaging(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete post',
      'This will remove the post from your shop feed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setManaging(true);
            try {
              await deletePost(post.id);
              setShowSellerManage(false);
              onDeleted?.(post.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete post.');
            } finally {
              setManaging(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[s.card, layout === 'masonry' && s.cardMasonry, { width: cardW }]}>
      {(post.is_repost_entry || post.reposted_by_name) ? (
        <View style={s.repostBanner}>
          <IconRepost size={14} color={Colors.orange} filled />
          <Text style={s.repostBannerText} numberOfLines={1}>
            {post.reposted_by_name ?? 'Someone'} reposted
          </Text>
        </View>
      ) : null}

      <View style={s.header}>
        <View style={s.avatarRing}>
          {shopLogoUri
            ? <Image source={{ uri: shopLogoUri }} style={s.avatar} resizeMode="cover" />
            : <Text style={s.avatarEmoji}>🏪</Text>}
        </View>
        <View style={s.headerCopy}>
          <View style={s.nameRow}>
            <Text style={s.username} numberOfLines={1}>{post.shop_name}</Text>
            {post.is_ad && (
              <View style={s.sponsored}><Text style={s.sponsoredText}>Sponsored</Text></View>
            )}
          </View>
          {locationLine ? <Text style={s.location} numberOfLines={1}>{locationLine}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => (isSellerOwner ? openSellerManage() : setShowPostMenu(true))}
          hitSlop={12}
          style={s.menuBtn}
        >
          <IconMore />
        </TouchableOpacity>
      </View>

      {post.quote_caption ? (
        <View style={s.quoteBlock}>
          <Text style={s.quoteText}>{post.quote_caption}</Text>
        </View>
      ) : null}

      <View style={s.mediaShell}>
        {textCard ? (
          <View style={[s.textCard, { backgroundColor: getTextBackground(textCard.background), height: mediaH }]}>
            <Text
              style={[
                s.textCardText,
                getTextFontStyle(textCard.fontStyle ?? textCard.style),
                { color: getTextColor(textCard.textColor) },
              ]}
            >
              {textCard.text}
            </Text>
          </View>
        ) : mediaUrls.length > 0 ? (
          <MediaCarousel
            urls={mediaUrls}
            mediaType={post.media_type}
            height={mediaH}
            contentWidth={cardW}
            isActive={isMediaActive}
            muted={globalMuted}
            onToggleMute={toggleGlobalMute}
            onDoubleTapLike={() => void handleDoubleTapLike()}
          />
        ) : (
          <View style={[s.mediaFallback, { height: mediaH }]}>
            <Text style={s.fallbackEmoji}>🏪</Text>
            <Text style={s.fallbackLabel}>{post.shop_name ?? 'Shop update'}</Text>
          </View>
        )}
      </View>

      {!post.is_ad && (
        <>
          {isSellerOwner ? (
            <View style={s.sellerMetricsRow}>
              <SellerMetric label="Impressions" emoji="👁️" value={impressions} />
              <SellerMetric label="Saves" emoji="🔖" value={saves} />
              <SellerMetric label="Chats Initiated" emoji="💬" value={chats} />
              <TouchableOpacity style={s.manageBtn} onPress={openSellerManage}>
                <Text style={s.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          <View style={s.actions}>
            <View style={s.actionsLeft}>
              <ScalePress onPress={handleLike}>
                <IconHeart filled={liked} color={liked ? Colors.red : Colors.text} />
              </ScalePress>
              <ScalePress onPress={openComments}>
                <IconComment />
              </ScalePress>
              <ScalePress onPress={openRepostSheet}>
                <View style={s.repostAction}>
                  <IconRepost
                    filled={reposted}
                    color={reposted ? Colors.orange : Colors.text}
                  />
                  {reposts > 0 ? (
                    <Text style={[s.actionCount, reposted && s.actionCountActive]}>
                      {reposts}
                    </Text>
                  ) : null}
                </View>
              </ScalePress>
              <ScalePress onPress={handleShare}>
                <IconShare />
              </ScalePress>
            </View>
            <ScalePress onPress={handleSave}>
              <IconBookmark filled={saved} color={saved ? Colors.text : Colors.text} />
            </ScalePress>
          </View>

          {isBuyer && productId && post.shop_id ? (
            <View style={s.commerceRow}>
              <TouchableOpacity
                style={s.commerceChip}
                onPress={() => void handleCommerceAdd()}
                disabled={addingToCart}
                activeOpacity={0.85}
              >
                <Text style={s.commerceChipText}>{addingToCart ? '…' : '🛍️ Add'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.commerceChip} onPress={handleCommerceChat} activeOpacity={0.85}>
                <Text style={s.commerceChipText}>💬 Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.commerceChip} onPress={handleCommerceWhatsApp} activeOpacity={0.85}>
                <Text style={s.commerceChipText}>💚 WhatsApp</Text>
              </TouchableOpacity>
              {post.distance_km != null ? (
                <TouchableOpacity style={s.commerceChip} onPress={handleCommerceMaps} activeOpacity={0.85}>
                  <Text style={s.commerceChipText}>📍 {Number(post.distance_km).toFixed(1)} km</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          </>
          )}

          <View style={s.meta}>
            <View style={s.statsRow}>
              {!isSellerOwner && likes > 0 && (
                <Text style={s.likesCount}>{likes.toLocaleString()} likes</Text>
              )}
              {!isSellerOwner && reposts > 0 && (
                <Text style={s.repostsMeta}>
                  {likes > 0 ? ' · ' : ''}{reposts.toLocaleString()} reposts
                </Text>
              )}
              {!isSellerOwner && commentCount > 0 && (
                <Text style={s.repostsMeta}>
                  {(likes > 0 || reposts > 0) ? ' · ' : ''}{commentCount.toLocaleString()} comments
                </Text>
              )}
            </View>
            <CaptionBlock
              username={handle}
              caption={textCard ? undefined : post.caption}
              isTextCard={!!textCard}
            />
            {commentCount > 0 && !showComments && (
              <TouchableOpacity onPress={openComments}>
                <Text style={s.viewComments}>View all {commentCount} comments</Text>
              </TouchableOpacity>
            )}
            <Text style={s.timestamp}>{timeAgo(post.created_at)}</Text>
          </View>
        </>
      )}

      {showComments && (
        <View style={s.comments}>
          {loadingComments
            ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 12 }} />
            : comments.map(c => (
              <View key={c.id} style={s.commentRow}>
                <Text style={s.commentUser}>{c.user?.name ?? 'User'}</Text>
                <Text style={s.commentBody}>{c.text}</Text>
              </View>
            ))}
          <View style={s.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={Colors.dim}
              style={s.commentField}
            />
            <TouchableOpacity onPress={submitComment} disabled={!commentText.trim()}>
              <Text style={[s.commentPost, !commentText.trim() && s.commentPostDisabled]}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal transparent visible={showRepostSheet} animationType="fade" onRequestClose={() => setShowRepostSheet(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => { setShowRepostSheet(false); setQuoteMode(false); }}>
          <Pressable style={s.menuSheet} onPress={() => {}}>
            <View style={s.menuHandle} />
            <Text style={s.repostSheetTitle}>Repost</Text>

            {quoteMode ? (
              <View style={s.quoteComposer}>
                <TextInput
                  value={quoteText}
                  onChangeText={setQuoteText}
                  placeholder="Add a comment above the original post…"
                  placeholderTextColor={Colors.dim}
                  style={s.quoteInput}
                  multiline
                  maxLength={280}
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.quoteSubmit, (!quoteText.trim() || reposting) && s.quoteSubmitDisabled]}
                  disabled={!quoteText.trim() || reposting}
                  onPress={() => void handleRepost(quoteText.trim())}
                >
                  {reposting
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={s.quoteSubmitText}>Repost with Quote</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setQuoteMode(false)} style={s.menuItem}>
                  <Text style={[s.menuItemText, s.menuCancel]}>Back</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {reposted ? (
                  <TouchableOpacity
                    style={s.menuItem}
                    disabled={reposting}
                    onPress={() => void handleRepost(null)}
                  >
                    <Text style={[s.menuItemText, { color: Colors.red }]}>
                      {reposting ? 'Updating…' : 'Undo Repost'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.menuItem}
                    disabled={reposting}
                    onPress={() => void handleRepost(null)}
                  >
                    <Text style={s.menuItemText}>
                      {reposting ? 'Reposting…' : 'Quick Repost'}
                    </Text>
                    <Text style={s.menuItemSub}>Instantly share to your profile feed</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() => setQuoteMode(true)}
                >
                  <Text style={s.menuItemText}>Repost with Quote</Text>
                  <Text style={s.menuItemSub}>Add a custom caption above the original</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={() => setShowRepostSheet(false)}>
                  <Text style={[s.menuItemText, s.menuCancel]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={showSellerManage} animationType="fade" onRequestClose={() => setShowSellerManage(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setShowSellerManage(false)}>
          <View style={s.menuSheet}>
            <View style={s.menuHandle} />
            <Text style={s.repostSheetTitle}>Manage listing</Text>
            <TouchableOpacity style={s.menuItem} onPress={handleEditListing} disabled={managing}>
              <Text style={s.menuItemText}>Edit price or details</Text>
              <Text style={s.menuItemSub}>Open product editor</Text>
            </TouchableOpacity>
            {productId ? (
              <TouchableOpacity style={s.menuItem} onPress={() => void handleToggleAvailability()} disabled={managing}>
                <Text style={s.menuItemText}>Mark unavailable</Text>
                <Text style={s.menuItemSub}>Hide from buyers until restocked</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.menuItem} onPress={handleDeletePost} disabled={managing}>
              <Text style={[s.menuItemText, { color: Colors.red }]}>Delete post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => setShowSellerManage(false)}>
              <Text style={[s.menuItemText, s.menuCancel]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={showPostMenu} animationType="fade" onRequestClose={() => setShowPostMenu(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setShowPostMenu(false)}>
          <View style={s.menuSheet}>
            <View style={s.menuHandle} />
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowPostMenu(false); openRepostSheet(); }}>
              <Text style={s.menuItemText}>{reposted ? 'Manage repost' : 'Repost'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowPostMenu(false); void handleShare(); }}>
              <Text style={s.menuItemText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowPostMenu(false); void handleSave(); }}>
              <Text style={s.menuItemText}>{saved ? 'Unsave' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => setShowPostMenu(false)}>
              <Text style={[s.menuItemText, s.menuCancel]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SellerMetric({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <View style={s.sellerMetric}>
      <Text style={s.sellerMetricEmoji}>{emoji}</Text>
      <Text style={s.sellerMetricValue}>{value.toLocaleString()}</Text>
      <Text style={s.sellerMetricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginBottom: 12,
    marginHorizontal: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  cardMasonry: {
    marginHorizontal: 4,
    marginBottom: 8,
  },
  repostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  repostBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.orange,
  },
  quoteBlock: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  quoteText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.text,
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.orange + '88',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 18 },
  headerCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  location: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.sub,
    marginTop: 1,
  },
  sponsored: {
    backgroundColor: Colors.blue + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sponsoredText: { fontSize: 9, color: Colors.blue, fontWeight: '700' },
  menuBtn: { padding: 4 },
  mediaShell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  textCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  textCardText: { textAlign: 'center' },
  mediaFallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    gap: 8,
  },
  fallbackEmoji: { fontSize: 48 },
  fallbackLabel: { color: Colors.sub, fontSize: 13, fontFamily: Fonts.bodyMedium },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  repostAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 12,
  },
  actionCountActive: { color: Colors.orange },
  cartChip: {
    backgroundColor: Colors.orange + '18',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.orange + '44',
  },
  cartChipText: { color: Colors.orange, fontWeight: '700', fontSize: 11 },
  commerceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    marginTop: -2,
  },
  commerceChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  commerceChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: { paddingHorizontal: 14, paddingBottom: 14, gap: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  likesCount: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  repostsMeta: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.sub,
  },
  viewComments: { fontSize: 13, color: Colors.dim, marginTop: 2 },
  timestamp: { fontSize: 11, color: Colors.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  comments: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  commentRow: { gap: 2 },
  commentUser: { fontSize: 13, fontWeight: '700', color: Colors.text },
  commentBody: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  commentField: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  commentPost: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
  commentPostDisabled: { opacity: 0.4 },
  menuBackdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 24,
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
  repostSheetTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  menuItem: { paddingVertical: 14, paddingHorizontal: 24 },
  menuItemText: { fontSize: 16, color: Colors.text, fontWeight: '600', textAlign: 'center' },
  menuItemSub: {
    fontSize: 12,
    color: Colors.dim,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: Fonts.body,
  },
  menuCancel: { color: Colors.dim },
  quoteComposer: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  quoteInput: {
    minHeight: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    color: Colors.text,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  quoteSubmit: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quoteSubmitDisabled: { opacity: 0.45 },
  quoteSubmitText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  sellerMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  sellerMetric: {
    minWidth: 72,
    flexGrow: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sellerMetricEmoji: { fontSize: 12 },
  sellerMetricValue: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  sellerMetricLabel: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.dim,
    marginTop: 1,
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.orange + '18',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  manageBtnText: {
    color: Colors.orange,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
});
