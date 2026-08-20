// app/(tabs)/index.tsx — Instagram-style feed (buyer following + seller create)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, ActivityIndicator, RefreshControl, StyleSheet, Dimensions, Modal, Pressable, Alert, ScrollView, Share, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import {
  getFeed, getFollowingFeed, likePost, unlikePost, repostPost, unrepostPost, savePost, unsavePost,
  getComments, addComment, getStories, createStory, getReels, createReel,
  getShopByOwner, uploadImage, createPost, feedFromPostsTable,
} from '../../lib/api';
import { getSupabaseConfig } from '../../lib/config';
import { Colors, Fonts } from '../../constants/theme';
import type { Story, Reel } from '../../types';

const W = Dimensions.get('window').width;
const { url: SUPABASE_URL } = getSupabaseConfig();

function resolveMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!SUPABASE_URL) return value;
  const normalizedBase = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${normalizedBase}${value}`;
  return `${normalizedBase}/${value.replace(/^\//, '')}`;
}

const TEXT_CARD_BACKGROUNDS = [
  { id: 'sunset', color: '#E94F37' },
  { id: 'berry', color: '#7B2CBF' },
  { id: 'ocean', color: '#146C94' },
  { id: 'midnight', color: '#172554' },
  { id: 'forest', color: '#146B55' },
  { id: 'rose', color: '#BE185D' },
  { id: 'amber', color: '#C2410C' },
  { id: 'slate', color: '#334155' },
] as const;

const TEXT_CARD_COLORS = [
  { id: 'white', color: '#FFFFFF' },
  { id: 'ink', color: '#111827' },
  { id: 'sun', color: '#FDE047' },
  { id: 'mint', color: '#A7F3D0' },
  { id: 'blush', color: '#FBCFE8' },
] as const;

const TEXT_FONT_STYLES = {
  classic: { fontSize: 24, fontWeight: '600' },
  bold: { fontSize: 28, fontWeight: '900' },
  elegant: { fontSize: 26, fontFamily: 'serif', fontStyle: 'italic' },
  typewriter: { fontSize: 22, fontFamily: 'monospace', fontWeight: '700' },
} as const;

type TextFontStyle = keyof typeof TEXT_FONT_STYLES;
type TextBackground = typeof TEXT_CARD_BACKGROUNDS[number]['id'];
type TextColor = typeof TEXT_CARD_COLORS[number]['id'];

function getTextBackground(id?: string) {
  return TEXT_CARD_BACKGROUNDS.find(option => option.id === id)?.color ?? TEXT_CARD_BACKGROUNDS[0].color;
}

function getTextColor(id?: string) {
  return TEXT_CARD_COLORS.find(option => option.id === id)?.color ?? TEXT_CARD_COLORS[0].color;
}

function getTextFontStyle(id?: string) {
  if (id && id in TEXT_FONT_STYLES) return TEXT_FONT_STYLES[id as TextFontStyle];
  return id === 'headline' ? TEXT_FONT_STYLES.bold : TEXT_FONT_STYLES.classic;
}

function PostCard({
  post, userId, isBuyer, onAddToCart,
}: {
  post: any;
  userId: string;
  isBuyer: boolean;
  onAddToCart?: (productId: string, shopId: string) => void;
}) {
  const shopLogoUri = resolveMediaUrl(post.shop_logo);
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [saved, setSaved] = useState(post.is_saved ?? false);
  const [reposted, setReposted] = useState(post.is_reposted ?? false);
  const [likes, setLikes] = useState(post.total_likes ?? 0);
  const [reposts, setReposts] = useState(post.total_reposts ?? 0);
  const [commentCount, setCommentCount] = useState(post.total_comments ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [reposting, setReposting] = useState(false);

  useEffect(() => {
    setLiked(!!post.is_liked);
    setSaved(!!post.is_saved);
    setReposted(!!post.is_reposted);
    setLikes(post.total_likes ?? 0);
    setReposts(post.total_reposts ?? 0);
    setCommentCount(post.total_comments ?? 0);
  }, [post.id, post.is_liked, post.is_saved, post.is_reposted, post.total_likes, post.total_reposts, post.total_comments]);

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((l: number) => l + (next ? 1 : -1));
    try {
      if (next) await likePost(userId, post.id);
      else await unlikePost(userId, post.id);
    } catch {}
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await savePost(userId, post.id);
      else await unsavePost(userId, post.id);
    } catch {}
  };

  const handleRepost = async () => {
    if (reposting) return;
    const shopId = post.shop_id || post.shop?.id;
    if (!shopId) {
      Alert.alert('Error', 'Could not repost this item.');
      return;
    }

    setReposting(true);
    const next = !reposted;
    setReposted(next);
    setReposts((r: number) => Math.max(0, r + (next ? 1 : -1)));
    setShowPostMenu(false);

    try {
      if (next) await repostPost(userId, post.id, shopId);
      else await unrepostPost(userId, post.id);
    } catch {
      setReposted(!next);
      setReposts((r: number) => Math.max(0, r - (next ? 1 : -1)));
      Alert.alert('Error', 'Could not repost. Please try again.');
    } finally {
      setReposting(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareText = `Check out this from ${post.shop_name}: ${post.caption || 'Amazing product!'}\n\nhttps://cityconnect.app/post/${post.id}`;
      await Share.share({ 
        message: shareText, 
        title: `${post.shop_name} on Vedastya`,
        url: `https://cityconnect.app/post/${post.id}`
      });
    } catch {}
  };

  const handleReport = () => {
    setShowPostMenu(false);
    Alert.alert(
      'Report Post',
      'Why are you reporting this post?',
      [
        { text: 'Spam', onPress: () => Alert.alert('Reported', 'Thank you for reporting. We will review this content.') },
        { text: 'Inappropriate content', onPress: () => Alert.alert('Reported', 'Thank you for reporting. We will review this content.') },
        { text: 'False information', onPress: () => Alert.alert('Reported', 'Thank you for reporting. We will review this content.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCopyLink = async () => {
    setShowPostMenu(false);
    const postLink = `https://cityconnect.app/post/${post.id}`;
    
    // Web clipboard API
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(postLink);
        Alert.alert('Link copied', 'Post link copied to clipboard');
      } catch {
        Alert.alert('Link', postLink);
      }
    } else {
      // For mobile, show the link
      Alert.alert('Post Link', postLink, [
        { text: 'OK', style: 'default' }
      ]);
    }
  };

  const handleShareToStory = () => {
    setShowPostMenu(false);
    Alert.alert('Share to Story', 'This feature will allow you to share this post to your story.');
  };

  const handleSendToFriend = () => {
    setShowPostMenu(false);
    Alert.alert('Send', 'This feature will allow you to send this post to a friend.');
  };

  const openComments = async () => {
    setShowComments(true);
    if (comments.length) return;
    setLoadingComments(true);
    try { setComments(await getComments(post.id)); }
    catch {} finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      const c = await addComment(userId, post.id, commentText.trim());
      setComments(prev => [...prev, c]);
      setCommentCount((n: number) => n + 1);
      setCommentText('');
    } catch {}
  };

  const productId = post.product_id || post.product?.id;

  return (
    <View style={pf.card}>
      <View style={pf.header}>
        <View style={pf.shopIcon}>
          {shopLogoUri
            ? <Image source={{ uri: shopLogoUri }} style={pf.shopIconImage} resizeMode="cover" />
            : <Text style={pf.shopEmoji}>🏪</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={pf.shopName}>{post.shop_name}</Text>
            {post.is_ad && <View style={pf.adBadge}><Text style={pf.adText}>Sponsored</Text></View>}
          </View>
          <Text style={pf.shopMeta}>
            {post.shop_category} · {post.distance_km ? `${Number(post.distance_km).toFixed(1)} km · ` : ''}{timeAgo(post.created_at)}
            {post.shop_avg_rating ? ` · ⭐ ${post.shop_avg_rating}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowPostMenu(true)} style={pf.menuBtn}>
          <Text style={pf.menuIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <View style={pf.media}>
        {(() => {
          let textCard: {
            text: string;
            style?: string;
            fontStyle?: string;
            background?: string;
            textColor?: string;
          } | null = null;
          if (typeof post.caption === 'string' && post.caption.startsWith('__TEXT_CARD__')) {
            try {
              textCard = JSON.parse(post.caption.slice('__TEXT_CARD__'.length));
            } catch {
              textCard = null;
            }
          }
          if (textCard) {
            return (
              <View style={[pf.textCard, { backgroundColor: getTextBackground(textCard.background) }]}>
                <Text
                  style={[
                    pf.textCardText,
                    getTextFontStyle(textCard.fontStyle ?? textCard.style),
                    { color: getTextColor(textCard.textColor) },
                  ]}
                >
                  {textCard.text}
                </Text>
              </View>
            );
          }
          if (post.media_urls?.length > 0) {
            return <Image source={{ uri: post.media_urls[0] }} style={pf.image} resizeMode="cover" />;
          }
          return <View style={pf.imagePlaceholder}><Text style={{ fontSize: 60 }}>🏪</Text></View>;
        })()}
        {post.media_type === 'video' && post.media_urls?.length > 0 && (
          <View style={pf.videoBadge}><Text style={pf.videoBadgeText}>▶</Text></View>
        )}
      </View>

      {!post.is_ad && (
        <View style={pf.actions}>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={handleLike}>
              <Text style={[pf.actionIcon, liked && { color: Colors.red }]}>{liked ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openComments}>
              <Text style={pf.actionIcon}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRepost} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[pf.actionIconBright, reposted && { color: Colors.green }]}>↻</Text>
              {reposts > 0 ? (
                <Text style={[pf.likesText, reposted && { color: Colors.green }]}>{reposts}</Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare}>
              <Text style={pf.actionIconBright}>⤴</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {isBuyer && productId && onAddToCart && (
              <TouchableOpacity
                style={pf.cartChip}
                onPress={() => onAddToCart(productId, post.shop_id)}
              >
                <Text style={pf.cartChipText}>🛒 Add</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowPostMenu(true)}>
              <Text style={pf.menuIconSmall}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!post.is_ad && (
        <View style={pf.caption}>
          <View style={pf.statsRow}>
            <Text style={pf.likesText}>{likes} likes</Text>
            {reposts > 0 && <Text style={pf.repostsText}> · {reposts} reposts</Text>}
          </View>
          {typeof post.caption === 'string' && post.caption.startsWith('__TEXT_CARD__') ? (
            <Text style={pf.captionText}>
              <Text style={pf.shopNameInline}>{post.shop_name}</Text> shared an update
            </Text>
          ) : (
            <Text style={pf.captionText}>
              <Text style={pf.shopNameInline}>{post.shop_name}</Text> {post.caption}
            </Text>
          )}
          {commentCount > 0 && !showComments && (
            <TouchableOpacity onPress={openComments}>
              <Text style={pf.viewComments}>View all {commentCount} comments</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showComments && (
        <View style={pf.commentsSection}>
          {loadingComments
            ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 12 }} />
            : comments.map(c => (
              <View key={c.id} style={pf.commentRow}>
                <View style={pf.commentAvatar}><Text>😊</Text></View>
                <View style={pf.commentBubble}>
                  <Text style={pf.commentUser}>{c.user?.name ?? 'User'}</Text>
                  <Text style={pf.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          <View style={pf.commentInput}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={Colors.dim}
              style={pf.commentField}
            />
            <TouchableOpacity onPress={submitComment}><Text style={pf.commentPost}>Post</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <Modal transparent visible={showPostMenu} animationType="fade" onRequestClose={() => setShowPostMenu(false)}>
        <Pressable style={pf.menuModalBackdrop} onPress={() => setShowPostMenu(false)}>
          <View style={pf.menuModalSheet}>
            <View style={pf.menuModalHandle} />
            <Text style={pf.menuModalTitle}>More options</Text>
            
            <TouchableOpacity style={pf.menuOption} onPress={() => { setShowPostMenu(false); handleRepost(); }}>
              <Text style={pf.menuOptionIcon}>↻</Text>
              <Text style={pf.menuOptionText}>{reposted ? 'Remove repost' : 'Repost to profile'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={() => { setShowPostMenu(false); handleShare(); }}>
              <Text style={pf.menuOptionIcon}>⤴</Text>
              <Text style={pf.menuOptionText}>Share to...</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={handleSendToFriend}>
              <Text style={pf.menuOptionIcon}>💬</Text>
              <Text style={pf.menuOptionText}>Send to friend</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={handleShareToStory}>
              <Text style={pf.menuOptionIcon}>📱</Text>
              <Text style={pf.menuOptionText}>Share to story</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={handleCopyLink}>
              <Text style={pf.menuOptionIcon}>🔗</Text>
              <Text style={pf.menuOptionText}>Copy link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={() => { setShowPostMenu(false); handleSave(); }}>
              <Text style={pf.menuOptionIcon}>{saved ? '⬛' : '▢'}</Text>
              <Text style={pf.menuOptionText}>{saved ? 'Remove from saved' : 'Save post'}</Text>
            </TouchableOpacity>

            <View style={pf.menuDivider} />

            <TouchableOpacity style={[pf.menuOption, pf.menuOptionDanger]} onPress={handleReport}>
              <Text style={pf.menuOptionIcon}>⚠️</Text>
              <Text style={[pf.menuOptionText, pf.menuOptionTextDanger]}>Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={pf.menuOption} onPress={() => setShowPostMenu(false)}>
              <Text style={[pf.menuOptionText, { textAlign: 'center', width: '100%' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ create_menu?: string; refresh_feed?: string }>();
  const profile = useAuthStore(s => s.profile);
  const insets = useSafeAreaInsets();
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const notifications = useAuthStore(s => s.notifications);
  const addNotification = useAuthStore(s => s.addNotification);
  const clearNotifications = useAuthStore(s => s.clearNotifications);
  const loadNotifications = useAuthStore(s => s.loadNotifications);
  const addItem = useCartStore(s => s.addItem);
  const loadCart = useCartStore(s => s.loadCart);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedMode, setFeedMode] = useState<'nearby' | 'following'>('nearby');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [showReelComposer, setShowReelComposer] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTextPostComposer, setShowTextPostComposer] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [reelDraft, setReelDraft] = useState('');
  const [reelTags, setReelTags] = useState('');
  const [storyMedia, setStoryMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [reelMedia, setReelMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [posting, setPosting] = useState(false);
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [textPostDraft, setTextPostDraft] = useState('');
  const [textFontStyle, setTextFontStyle] = useState<TextFontStyle>('classic');
  const [textBackground, setTextBackground] = useState<TextBackground>('sunset');
  const [textColor, setTextColor] = useState<TextColor>('white');
  const [hasShop, setHasShop] = useState<boolean | null>(null);

  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const feedModeRef = useRef(feedMode);
  const followedRef = useRef(followedShopIds);
  const socialLoadedRef = useRef(false);
  const modeInitializedRef = useRef(false);

  const isSeller = profile?.role === 'seller' || profile?.role === 'service_provider';
  const isBuyer = profile?.role === 'buyer';

  feedModeRef.current = feedMode;
  followedRef.current = followedShopIds;

  const load = useCallback(async (reset = false) => {
    if (!profile) return;
    if (loadingRef.current && !reset) return;
    if (!reset && !hasMore) return;

    loadingRef.current = true;
    if (reset) {
      setHasMore(true);
      pageRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const p = reset ? 0 : pageRef.current;
      const mode = feedModeRef.current;
      let data: any[] = [];

      if (mode === 'following' && isBuyer) {
        data = await getFollowingFeed(profile.id, p, followedRef.current);
      } else {
        // If we don't have lat/lng yet, do not query using hardcoded defaults
        // (it will return unrelated/stale posts).
        if (profile.lat == null || profile.lng == null) {
          data = await feedFromPostsTable(p, profile.id);
        } else {
          data = await getFeed(profile.lat, profile.lng, profile.radius_km ?? 5, p, profile.id);
        }
      }
      const rows = Array.isArray(data) ? data : [];

      setPosts(prev => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length >= 10);
      pageRef.current = p + 1;
    } catch (e) {
      console.error(e);
      if (reset) setPosts([]);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [profile, isBuyer, hasMore]);

  // Initial + mode change load — do NOT depend on unstable callbacks
  useEffect(() => {
    if (!profile) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, feedMode]);

  // Social extras once (non-blocking)
  useEffect(() => {
    if (!profile || socialLoadedRef.current) return;
    socialLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      const [st, rl] = await Promise.all([
        getStories(profile.id),
        getReels(isBuyer && followedShopIds.length ? followedShopIds : undefined),
      ]);
      if (cancelled) return;
      setStories(st);
      setReels(rl);
      loadNotifications(profile.id).catch(() => {});
      if (isBuyer) loadCart(profile.id).catch(() => {});
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // When coming from the bottom-center "+" tab, open the seller create menu.
  useEffect(() => {
    const shouldOpen = String(params.create_menu ?? '') === '1';
    if (shouldOpen && isSeller) {
      setShowCreateMenu(true);
      // Clean up the URL so manual hard refresh stays on the plain home feed.
      router.replace('/(tabs)' as any);
    }
  }, [params.create_menu, isSeller, router]);

  // If we were navigated back from a seller action, force a fresh feed load.
  useEffect(() => {
    const shouldRefresh = String(params.refresh_feed ?? '') === '1';
    if (!shouldRefresh) return;
    if (!profile) return;
    load(true).finally(() => {
      // Clean URL so it doesn't keep forcing refresh.
      router.replace('/(tabs)' as any);
    });
  }, [params.refresh_feed, profile, load, router]);

  // For sellers, detect if they already have a shop so we can highlight the "New shop" option once.
  useEffect(() => {
    if (!profile || !isSeller) return;
    let cancelled = false;
    (async () => {
      try {
        const shop = await getShopByOwner(profile.id);
        if (!cancelled) setHasShop(!!shop);
      } catch {
        if (!cancelled) setHasShop(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, isSeller]);

  // Auto-refresh the feed every 60 seconds so the home page stays fresh.
  useEffect(() => {
    if (!profile) return;
    const id = setInterval(() => {
      load(true);
    }, 60000);
    return () => clearInterval(id);
  }, [profile?.id, load]);

  // Set following mode once after follows load — avoid toggling forever
  useEffect(() => {
    if (!profile || isSeller || modeInitializedRef.current) return;
    if (followedShopIds.length > 0) {
      modeInitializedRef.current = true;
      setFeedMode('following');
    }
  }, [followedShopIds.length, isSeller, profile]);

  // Search UI removed — feed posts are always shown as loaded.

  const onRefresh = useCallback(() => {
    if (!profile) return;
    setRefreshing(true);
    socialLoadedRef.current = false;
    Promise.all([
      load(true),
      getStories(profile.id).then(setStories),
      getReels(isBuyer && followedShopIds.length ? followedShopIds : undefined).then(setReels),
      loadNotifications(profile.id).catch(() => {}),
    ]).finally(() => setRefreshing(false));
  }, [profile, load, isBuyer, followedShopIds.length, loadNotifications]);

  const onEndReached = () => {
    if (loading || loadingMore || !hasMore || loadingRef.current) return;
    load(false);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      const top = (document.scrollingElement?.scrollTop ?? window.scrollY) <= 8;
      if (!top || event.deltaY >= -80) return;
      const now = Date.now();
      if (now - last < 1600 || refreshing) return;
      last = now;
      onRefresh();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [onRefresh, refreshing]);

  const filteredPosts = posts;

  const pickMedia = async (forStory: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const media = { uri: asset.uri, type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video' };
    if (forStory) setStoryMedia(media);
    else setReelMedia(media);
  };

  const resolveMyShop = async () => {
    if (!profile) return null;
    const shop = await getShopByOwner(profile.id);
    if (!shop) {
      Alert.alert('Create your shop first', 'You need a shop before posting stories or reels.', [
        { text: 'Create Shop', onPress: () => router.push('/seller/shop' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return null;
    }
    return shop;
  };

  const uploadMediaUrl = async (uri: string, type: 'image' | 'video', folder: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const path = `${folder}/${profile!.id}/${Date.now()}.${ext}`;
    return uploadImage('cityconnect', path, blob, type === 'video' ? 'video/mp4' : 'image/jpeg');
  };

  const submitStory = async () => {
    if (!storyMedia && !storyDraft.trim()) {
      Alert.alert('Add media or caption');
      return;
    }
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      let mediaUrl = storyMedia?.uri ?? '';
      let mediaType: 'image' | 'video' = storyMedia?.type ?? 'image';
      if (storyMedia) {
        mediaUrl = await uploadMediaUrl(storyMedia.uri, storyMedia.type, 'stories');
      } else {
        // Text-only story: use a data placeholder color block via empty and caption
        mediaUrl = 'https://placehold.co/600x900/141420/FF5722/png?text=Story';
        mediaType = 'image';
      }
      const created = await createStory({
        shop_id: shop.id,
        author_id: profile!.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: storyDraft.trim(),
      });
      setStories(prev => [created, ...prev]);
      setStoryDraft('');
      setStoryMedia(null);
      setShowStoryComposer(false);
      addNotification('Story shared — followers will see it for 24 hours.');
    } catch (e: any) {
      Alert.alert('Could not post story', e.message || 'Try again after running the social migration SQL.');
    } finally {
      setPosting(false);
    }
  };

  const submitReel = async () => {
    if (!reelMedia) { Alert.alert('Pick a short video or image for your reel'); return; }
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      const mediaUrl = await uploadMediaUrl(reelMedia.uri, reelMedia.type, 'reels');
      const tags = reelTags.trim().split(/[\s,]+/).filter(Boolean).map(t => t.replace(/^#/, ''));
      const created = await createReel({
        shop_id: shop.id,
        author_id: profile!.id,
        media_url: mediaUrl,
        caption: reelDraft.trim(),
        tags,
      });
      setReels(prev => [{ ...created, shop_name: shop.name }, ...prev]);
      setReelDraft('');
      setReelTags('');
      setReelMedia(null);
      setShowReelComposer(false);
      addNotification('Reel published.');
    } catch (e: any) {
      Alert.alert('Could not post reel', e.message || 'Try again after running the social migration SQL.');
    } finally {
      setPosting(false);
    }
  };

  const submitTextPost = async () => {
    if (!textPostDraft.trim()) {
      Alert.alert('Add a short update', 'Write something about your shop before posting.');
      return;
    }
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      const meta = {
        text: textPostDraft.trim(),
        fontStyle: textFontStyle,
        background: textBackground,
        textColor,
      };
      await createPost({
        shop_id: shop.id,
        caption: `__TEXT_CARD__${JSON.stringify(meta)}`,
        media_urls: [],
        media_type: 'image',
      });
      setTextPostDraft('');
      setTextFontStyle('classic');
      setTextBackground('sunset');
      setTextColor('white');
      setShowTextPostComposer(false);
      addNotification('Update shared from your shop.');
      // Reload nearby feed so the new update appears with proper distance + shop fields.
      load(true);
    } catch (e: any) {
      Alert.alert('Could not share update', e.message || 'Try again after running the social migration SQL.');
    } finally {
      setPosting(false);
    }
  };

  const handleAddToCart = async (productId: string, shopId: string) => {
    if (!profile) return;
    try {
      await addItem(profile.id, productId, shopId, 1);
      addNotification('Added to cart');
      Alert.alert('Added', 'Product added to your cart.');
    } catch (e: any) {
      Alert.alert('Cart', e.message || 'Could not add — ensure cart migration is applied.');
    }
  };

  if (!profile) {
    return (
      <View style={ff.loader}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (loading && posts.length === 0) {
    return (
      <View style={ff.loader}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={ff.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={[ff.header, { paddingTop: (insets.top ?? 0) + 12 }]}>
          <View style={ff.headerLeft}>
            {isSeller && (
              <TouchableOpacity onPress={() => setShowCreateMenu(true)} style={ff.postPlusBtn} accessibilityRole="button">
                <Text style={ff.postPlusIcon}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={ff.headerCenter}>
            <Text style={ff.brand}>Vedastya</Text>
            <Text style={ff.location}>📍 {profile?.city} · {profile?.radius_km} km{isBuyer ? ' · Buyer' : ' · Seller'}</Text>
          </View>

          <View style={ff.headerRight}>
            <TouchableOpacity onPress={() => setShowNotifications(true)}>
              <Text style={ff.icon}>🔔</Text>
              {notifications.length > 0 && <View style={ff.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Search UI removed */}

      {isBuyer && (
        <View style={ff.feedModeRow}>
          <TouchableOpacity onPress={() => setFeedMode('nearby')} style={[ff.feedModeChip, feedMode === 'nearby' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'nearby' && ff.feedModeTextActive]}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFeedMode('following')} style={[ff.feedModeChip, feedMode === 'following' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'following' && ff.feedModeTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredPosts}
        extraData={filteredPosts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            userId={profile!.id}
            isBuyer={!!isBuyer}
            onAddToCart={handleAddToCart}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.orange}
            colors={[Colors.orange]}
            progressBackgroundColor={Colors.card}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} /> : null}
        ListHeaderComponent={
          <View>
            {Platform.OS === 'web' && (
              <TouchableOpacity onPress={onRefresh} style={ff.webRefresh} disabled={refreshing}>
                <Text style={ff.webRefreshText}>{refreshing ? 'Refreshing…' : '↓ Tap to refresh feed'}</Text>
              </TouchableOpacity>
            )}
            <View style={ff.stories}>
              {isSeller && (
                <TouchableOpacity style={sf.story} onPress={() => setShowStoryComposer(true)}>
                  <View style={[sf.storyRing, { borderStyle: 'dashed' }]}>
                    <View style={sf.storyAvatar}><Text style={sf.storyPlusIcon}>+</Text></View>
                  </View>
                  <Text style={sf.storyName}>Your Story</Text>
                </TouchableOpacity>
              )}
              {stories.map(story => (
                <TouchableOpacity key={story.id} style={sf.story} onPress={() => setViewStory(story)}>
                  <View style={sf.storyRing}>
                    <View style={sf.storyAvatar}>
                      {story.media_url
                        ? <Image source={{ uri: story.media_url }} style={sf.storyImg} />
                        : <Text style={sf.storyEmoji}>✨</Text>}
                    </View>
                  </View>
                  <Text style={sf.storyName} numberOfLines={1}>{story.shop_name ?? 'Shop'}</Text>
                </TouchableOpacity>
              ))}
              {!isSeller && stories.length === 0 && (
                <Text style={ff.storyHint}>Follow shops to see their stories here</Text>
              )}
            </View>

            {reels.length > 0 && (
              <View style={ff.reelStrip}>
                {reels.slice(0, 4).map(reel => (
                  <View key={reel.id} style={ff.reelCard}>
                    <Text style={ff.reelBadge}>REEL</Text>
                    <Text style={ff.reelTitle} numberOfLines={1}>{reel.shop_name ?? 'Shop'}</Text>
                    <Text style={ff.reelText} numberOfLines={2}>{reel.caption}</Text>
                  </View>
                ))}
              </View>
            )}

            {notifications.length > 0 && isBuyer && (
              <TouchableOpacity style={ff.noticeBar} onPress={() => setShowNotifications(true)}>
                <Text style={ff.noticeText}>🔔 {notifications[0]}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={ff.emptyState}>
            <Text style={ff.emptyEmoji}>{feedMode === 'following' ? '🫶' : '🛍️'}</Text>
            <Text style={ff.emptyText}>
              {feedMode === 'following'
                ? 'Follow shops to get their posts, stories and updates here — like Instagram.'
                : 'No posts nearby yet. Try a larger radius or follow shops.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <Modal transparent visible={showNotifications} animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={ff.modalBackdrop} onPress={() => setShowNotifications(false)}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <View style={ff.modalHeaderRow}>
              <Text style={ff.modalTitle}>Updates from followed shops</Text>
              <TouchableOpacity onPress={() => clearNotifications()}><Text style={ff.modalClear}>Clear</Text></TouchableOpacity>
            </View>
            {notifications.length === 0
              ? <Text style={ff.modalEmpty}>No updates yet. Follow shops to get notified.</Text>
              : notifications.map((item, index) => (
                <View key={`${item}-${index}`} style={ff.noticeItem}>
                  <Text style={ff.noticeItemText}>{item}</Text>
                </View>
              ))}
          </View>
        </Pressable>
      </Modal>

      {/* Seller create menu */}
      <Modal transparent visible={showCreateMenu} animationType="fade" onRequestClose={() => setShowCreateMenu(false)}>
        <Pressable style={ff.modalBackdrop} onPress={() => setShowCreateMenu(false)}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Share from your shop</Text>
            <TouchableOpacity
              style={[ff.createRow, hasShop === false && ff.createRowHighlight]}
              onPress={() => {
                setShowCreateMenu(false);
                router.push('/seller/shop' as any);
              }}
            >
              <Text style={ff.createIcon}>🏪</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>{hasShop ? 'Your shop profile' : 'Create your shop'}</Text>
                <Text style={ff.createSub}>
                  {hasShop
                    ? 'Update shop details, address and contact.'
                    : 'Start by setting up your shop so buyers can find you.'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={ff.createRow}
              onPress={() => {
                setShowCreateMenu(false);
                router.push('/seller/upload' as any);
              }}
            >
              <Text style={ff.createIcon}>📦</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Product card</Text>
                <Text style={ff.createSub}>Add an item to your catalog and home feed.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={ff.createRow}
              onPress={() => {
                setShowCreateMenu(false);
                setShowStoryComposer(true);
              }}
            >
              <Text style={ff.createIcon}>✨</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Story bubble</Text>
                <Text style={ff.createSub}>A 24‑hour highlight with photo or text.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={ff.createRow}
              onPress={() => {
                setShowCreateMenu(false);
                setShowReelComposer(true);
              }}
            >
              <Text style={ff.createIcon}>🎬</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Quick clip</Text>
                <Text style={ff.createSub}>Short vertical video from your shop.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={ff.createRow}
              onPress={() => {
                setShowCreateMenu(false);
                setShowTextPostComposer(true);
              }}
            >
              <Text style={ff.createIcon}>✏️</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Text update</Text>
                <Text style={ff.createSub}>Share news, offers or reminders without photos.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={!!viewStory} animationType="fade" onRequestClose={() => setViewStory(null)}>
        <Pressable style={ff.storyViewer} onPress={() => setViewStory(null)}>
          {viewStory && (
            <View style={ff.storyViewerInner}>
              <Image source={{ uri: viewStory.media_url }} style={ff.storyFull} resizeMode="cover" />
              <Text style={ff.storyCaption}>{viewStory.shop_name}: {viewStory.caption}</Text>
            </View>
          )}
        </Pressable>
      </Modal>

      <Modal transparent visible={showStoryComposer} animationType="slide" onRequestClose={() => setShowStoryComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Create Story</Text>
            <TouchableOpacity style={ff.mediaPick} onPress={() => pickMedia(true)}>
              <Text style={ff.mediaPickText}>{storyMedia ? '✓ Media selected — tap to change' : '📷 Pick photo or short video'}</Text>
            </TouchableOpacity>
            <TextInput
              value={storyDraft}
              onChangeText={setStoryDraft}
              multiline
              placeholder="Caption (optional)"
              placeholderTextColor={Colors.dim}
              style={ff.modalInput}
            />
            <TouchableOpacity onPress={submitStory} style={ff.primaryBtn} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Share Story</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showReelComposer} animationType="slide" onRequestClose={() => setShowReelComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Create Reel</Text>
            <TouchableOpacity style={ff.mediaPick} onPress={() => pickMedia(false)}>
              <Text style={ff.mediaPickText}>{reelMedia ? '✓ Media selected — tap to change' : '🎬 Pick short video or image'}</Text>
            </TouchableOpacity>
            <TextInput
              value={reelDraft}
              onChangeText={setReelDraft}
              multiline
              placeholder="Caption"
              placeholderTextColor={Colors.dim}
              style={ff.modalInput}
            />
            <TextInput
              value={reelTags}
              onChangeText={setReelTags}
              placeholder="Tags: fashion sale local"
              placeholderTextColor={Colors.dim}
              style={[ff.modalInput, { minHeight: 44 }]}
            />
            <TouchableOpacity onPress={submitReel} style={ff.primaryBtn} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Publish Reel</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Text-only shop update */}
      <Modal transparent visible={showTextPostComposer} animationType="slide" onRequestClose={() => setShowTextPostComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={ff.modalHandle} />
              <Text style={ff.modalTitle}>Share shop update</Text>
              <View style={[ff.textCardPreview, { backgroundColor: getTextBackground(textBackground) }]}>
                <TextInput
                  value={textPostDraft}
                  onChangeText={setTextPostDraft}
                  multiline
                  maxLength={280}
                  placeholder="What’s new?"
                  placeholderTextColor={`${getTextColor(textColor)}99`}
                  style={[
                    ff.textCardInput,
                    getTextFontStyle(textFontStyle),
                    { color: getTextColor(textColor) },
                  ]}
                />
                <Text style={[ff.textCount, { color: getTextColor(textColor) }]}>{textPostDraft.length}/280</Text>
              </View>

              <Text style={ff.textOptionLabel}>BACKGROUND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ff.colorOptionRow}>
                {TEXT_CARD_BACKGROUNDS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityLabel={`${option.id} background`}
                    onPress={() => setTextBackground(option.id)}
                    style={[
                      ff.backgroundSwatch,
                      { backgroundColor: option.color },
                      textBackground === option.id && ff.optionSelected,
                    ]}
                  >
                    {textBackground === option.id && <Text style={ff.swatchCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={ff.textOptionLabel}>FONT STYLE</Text>
              <View style={ff.textStyleRow}>
                {([
                  ['classic', 'Aa', 'Classic'],
                  ['bold', 'B', 'Bold'],
                  ['elegant', 'Ag', 'Elegant'],
                  ['typewriter', 'Tt', 'Type'],
                ] as const).map(([id, sample, label]) => (
                  <TouchableOpacity
                    key={id}
                    style={[ff.textStyleChip, textFontStyle === id && ff.textStyleChipActive]}
                    onPress={() => setTextFontStyle(id)}
                  >
                    <Text style={[ff.fontSample, getTextFontStyle(id)]}>{sample}</Text>
                    <Text style={ff.textStyleChipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={ff.textOptionLabel}>FONT COLOR</Text>
              <View style={ff.colorOptionRow}>
                {TEXT_CARD_COLORS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityLabel={`${option.id} font color`}
                    onPress={() => setTextColor(option.id)}
                    style={[
                      ff.fontColorSwatch,
                      { backgroundColor: option.color },
                      textColor === option.id && ff.optionSelected,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={submitTextPost} style={ff.primaryBtn} disabled={posting}>
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Post update</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ff = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  headerLeft: { width: 48, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 48, alignItems: 'flex-end' },
  brand: { fontSize: 28, fontFamily: Fonts.displayXBold, fontWeight: '900', color: Colors.orange, letterSpacing: -0.5, textAlign: 'center', textShadowColor: '#00000022', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  location: { fontSize: 11, fontFamily: Fonts.bodySemiBold, color: Colors.sub, marginTop: 2, textAlign: 'center' },
  headerIcons: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  icon: { fontSize: 22 },
  postPlusBtn: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 4 },
  postPlusIcon: { fontSize: 28, color: Colors.text, fontWeight: '300' },
  notifDot: { position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 24, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  searchResults: { marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchType: { fontSize: 18 },
  searchTitle: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  searchSub: { color: Colors.sub, fontSize: 11, marginTop: 2 },
  feedModeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  webRefresh: { alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  webRefreshText: { color: Colors.sub, fontSize: 12, fontWeight: '600' },
  feedModeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2 },
  feedModeChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  feedModeText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  feedModeTextActive: { color: Colors.white },
  stories: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  storyHint: { color: Colors.dim, fontSize: 12, flex: 1 },
  reelStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  reelCard: { width: 140, backgroundColor: Colors.card, borderRadius: 14, padding: 12, gap: 4 },
  reelBadge: { color: Colors.orange, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  reelTitle: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  reelText: { color: Colors.sub, fontSize: 11, lineHeight: 16 },
  noticeBar: { marginHorizontal: 16, marginTop: 10, borderRadius: 12, backgroundColor: Colors.orange + '15', paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { color: Colors.orange, fontWeight: '600', fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  modalClear: { color: Colors.orange, fontWeight: '700' },
  modalEmpty: { color: Colors.sub, paddingVertical: 8 },
  noticeItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  noticeItemText: { color: Colors.text, fontSize: 13 },
  createRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  createIcon: { fontSize: 22 },
  createTextWrap: { flex: 1 },
  createTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  createSub: { color: Colors.sub, fontSize: 12, marginTop: 2 },
  createRowHighlight: { backgroundColor: Colors.orange + '20', borderRadius: 12, paddingHorizontal: 4 },
  modalInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.text, minHeight: 80, marginBottom: 12, textAlignVertical: 'top' },
  textStyleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  textStyleChip: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingVertical: 8,
    alignItems: 'center',
  },
  textStyleChipActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '22' },
  textStyleChipText: { color: Colors.sub, fontSize: 11, fontWeight: '700' },
  textCardPreview: {
    minHeight: 220,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textCardInput: {
    minHeight: 140,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 8,
  },
  textCount: { position: 'absolute', right: 12, bottom: 10, fontSize: 11, opacity: 0.7 },
  textOptionLabel: { color: Colors.sub, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  colorOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
  backgroundSwatch: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fontColorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: Colors.border2 },
  optionSelected: { borderColor: Colors.white, transform: [{ scale: 1.08 }] },
  swatchCheck: { color: Colors.white, fontSize: 17, fontWeight: '900' },
  fontSample: { color: Colors.text, fontSize: 18, lineHeight: 23 },
  mediaPick: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2 },
  mediaPickText: { color: Colors.sub, fontWeight: '600' },
  primaryBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontWeight: '700' },
  storyViewer: { flex: 1, backgroundColor: '#000E', justifyContent: 'center' },
  storyViewerInner: { flex: 1 },
  storyFull: { flex: 1, width: '100%' },
  storyCaption: { position: 'absolute', bottom: 48, left: 16, right: 16, color: Colors.white, fontSize: 15, fontWeight: '600' },
});

const sf = StyleSheet.create({
  story: { alignItems: 'center', width: 64, gap: 5 },
  storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: Colors.orange, padding: 2 },
  storyAvatar: { flex: 1, borderRadius: 28, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  storyEmoji: { fontSize: 26 },
  storyPlusIcon: { fontSize: 32, color: Colors.text, fontWeight: '300' },
  storyName: { fontSize: 10, color: Colors.sub, textAlign: 'center' },
});

const pf = StyleSheet.create({
  card: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  shopIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.orange, overflow: 'hidden' },
  shopIconImage: { width: '100%', height: '100%' },
  shopEmoji: { fontSize: 22 },
  shopName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  shopMeta: { fontSize: 11, color: Colors.sub, marginTop: 1 },
  menuBtn: { padding: 4, marginLeft: 4 },
  menuIcon: { fontSize: 20, color: Colors.text, fontWeight: '700' },
  adBadge: { backgroundColor: Colors.blue + '22', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  adText: { fontSize: 9, color: Colors.blue, fontWeight: '700' },
  // Instagram-like portrait feed ratio (approx 4:5)
  media: { width: W, aspectRatio: 4 / 5, backgroundColor: Colors.card, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  videoBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#000C', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  videoBadgeText: { color: Colors.white, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  actionIcon: { fontSize: 26 },
  actionIconBright: { fontSize: 28, color: Colors.text, fontWeight: '600' },
  actionIconActive: { color: Colors.orange },
  menuIconSmall: { fontSize: 24, color: Colors.text, fontWeight: '700' },
  cartChip: { backgroundColor: Colors.orange + '22', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.orange + '55' },
  cartChipText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },
  caption: { paddingHorizontal: 16, paddingBottom: 12, gap: 3 },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  likesText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  repostsText: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  captionText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  shopNameInline: { fontWeight: '700' },
  viewComments: { fontSize: 12, color: Colors.dim, marginTop: 2 },
  commentsSection: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  commentBubble: { flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 8 },
  commentUser: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  commentText: { fontSize: 13, color: Colors.text },
  commentInput: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  commentField: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, color: Colors.text, fontSize: 14 },
  commentPost: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
  textCard: {
    flex: 1,
    width: W,
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  textCardText: { textAlign: 'center' },
  menuModalBackdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  menuModalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20 },
  menuModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  menuModalTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 12, paddingTop: 8 },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  menuOptionIcon: { fontSize: 20 },
  menuOptionText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: Colors.border2, marginVertical: 8 },
  menuOptionDanger: {},
  menuOptionTextDanger: { color: Colors.red },
});
