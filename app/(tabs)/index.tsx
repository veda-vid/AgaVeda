// app/(tabs)/index.tsx — Instagram-style feed (buyer following + seller create)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  Image, ActivityIndicator, StyleSheet, Dimensions, Modal, Pressable, Alert, ScrollView, Platform,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import {
  getFeed, getFollowingFeed,
  getStories, createStory, getUnifiedSparksFeed, createReel,
  getShopByOwner, uploadImage, createPost,
  getSellerDashboardMetrics, getServiceProDashboardStats, setServiceProviderAvailability,
  type ServiceProDashboardStats,
} from '../../lib/api';
import { loadHomeFeed } from '../../lib/feedEngine';
import { getSupabaseConfig } from '../../lib/config';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { Colors, Fonts } from '../../constants/theme';
import { PostCard } from '../../components/feed/PostCard';
import { MarketTicker } from '../../components/feed/MarketTicker';
import { FeedHydrationSkeleton, FeedRegionalBanner, FeedStoriesSkeleton } from '../../components/feed/FeedEngine';
import { SellerHeaderHero } from '../../components/seller/SellerHeaderHero';
import { ServiceProHeaderHero } from '../../components/seller/ServiceProHeaderHero';
import {
  isBuyerRole,
  isMerchantSeller as checkMerchantSeller,
  isServiceProvider as checkServiceProvider,
  isSellerLike as checkSellerLike,
  getRoleBadgeLabel,
} from '../../stores/roleUtils';
import { MediaSourceSheet, type MediaSourceChoice } from '../../components/media/MediaSourceSheet';
import { SparksFeed, type SparkItem } from '../../components/feed/SparksFeed';
import { SparkComposer } from '../../components/feed/SparkComposer';
import { usePostInteractionsStore } from '../../stores/postInteractionsStore';
import type { Story, SellerDashboardMetrics } from '../../types';

const W = Dimensions.get('window').width;
const WINDOW_HEIGHT = Dimensions.get('window').height;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedView, setFeedView] = useState<'posts' | 'sparks'>('posts');
  const [feedMode, setFeedMode] = useState<'nearby' | 'following'>('nearby');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [showSparkComposer, setShowSparkComposer] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTextPostComposer, setShowTextPostComposer] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [storyMedia, setStoryMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [sparks, setSparks] = useState<SparkItem[]>([]);
  const [posting, setPosting] = useState(false);
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [textPostDraft, setTextPostDraft] = useState('');
  const [textFontStyle, setTextFontStyle] = useState<TextFontStyle>('classic');
  const [textBackground, setTextBackground] = useState<TextBackground>('sunset');
  const [textColor, setTextColor] = useState<TextColor>('white');
  const [hasShop, setHasShop] = useState<boolean | null>(null);
  const [sellerShopId, setSellerShopId] = useState<string | null>(null);
  const [sellerMetrics, setSellerMetrics] = useState<SellerDashboardMetrics | null>(null);
  const [sellerMetricsLoading, setSellerMetricsLoading] = useState(false);
  const [showFlashDealSource, setShowFlashDealSource] = useState(false);
  const [isRegionalFallback, setIsRegionalFallback] = useState(false);
  const [storiesHydrating, setStoriesHydrating] = useState(true);
  const [serviceProStats, setServiceProStats] = useState<ServiceProDashboardStats | null>(null);
  const [serviceProStatsLoading, setServiceProStatsLoading] = useState(false);
  const [proAvailable, setProAvailable] = useState(false);
  const [activePostKey, setActivePostKey] = useState<string | null>(null);

  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const feedModeRef = useRef(feedMode);
  const followedRef = useRef(followedShopIds);
  const socialLoadedRef = useRef(false);
  const modeInitializedRef = useRef(false);
  const effectiveRadiusRef = useRef(profile?.radius_km ?? 5);

  const isSeller = checkSellerLike(profile?.role);
  const isMerchantSeller = checkMerchantSeller(profile?.role);
  const isServiceProvider = checkServiceProvider(profile?.role);
  const isBuyer = isBuyerRole(profile?.role);
  const roleBadge = getRoleBadgeLabel(profile?.role);
  const postCacheVersion = usePostInteractionsStore(s => s.version);
  const setInteractionsRefreshing = usePostInteractionsStore(s => s.setRefreshing);

  const postsViewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onPostsViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const primary = viewableItems.find(v => v.isViewable && v.item);
    const item = primary?.item as { id?: string; feed_item_id?: string } | undefined;
    setActivePostKey(item ? (item.feed_item_id ?? item.id ?? null) : null);
  }).current;

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
      let rows: any[] = [];

      if (mode === 'following' && isBuyer) {
        rows = await getFollowingFeed(profile.id, p, followedRef.current);
      } else if (reset) {
        const result = await loadHomeFeed(profile, {
          page: p,
          mode,
          followedShopIds: followedRef.current,
        });
        rows = result.posts;
        setIsRegionalFallback(result.isRegionalFallback);
        effectiveRadiusRef.current = result.effectiveRadiusKm;
      } else if (profile.lat != null && profile.lng != null) {
        rows = await getFeed(
          profile.lat,
          profile.lng,
          effectiveRadiusRef.current,
          p,
          profile.id,
        );
      } else {
        const result = await loadHomeFeed(profile, { page: p, mode });
        rows = result.posts;
      }

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
      setLoadingMore(false);
    }
  }, [profile, isBuyer, hasMore]);

  // Initial + mode change load — do NOT depend on unstable callbacks
  useEffect(() => {
    if (!profile) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, feedMode]);

  const loadSparks = useCallback(async () => {
    if (!profile) return;
    const shopFilter = isBuyer && followedShopIds.length ? followedShopIds : undefined;
    const rows = await getUnifiedSparksFeed(profile.id, 30, 0, shopFilter);
    setSparks(rows as SparkItem[]);
  }, [profile, isBuyer, followedShopIds]);

  // Social extras once (non-blocking)
  useEffect(() => {
    if (!profile || socialLoadedRef.current) return;
    socialLoadedRef.current = true;
    setStoriesHydrating(true);
    let cancelled = false;
    (async () => {
      const [st, sparkRows] = await Promise.all([
        getStories(profile.id),
        getUnifiedSparksFeed(
          profile.id,
          30,
          0,
          isBuyer && followedShopIds.length ? followedShopIds : undefined,
        ),
      ]);
      if (cancelled) return;
      setStories(st);
      setSparks(sparkRows as SparkItem[]);
      setStoriesHydrating(false);
      loadNotifications(profile.id).catch(() => {});
      if (isBuyer) loadCart(profile.id).catch(() => {});
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!posts.length) return;
    usePostInteractionsStore.getState().hydrateFromPosts(posts);
  }, [posts]);

  const loadSellerDashboard = useCallback(async () => {
    if (!profile || !isMerchantSeller) return;
    setSellerMetricsLoading(true);
    try {
      const [shop, metrics] = await Promise.all([
        getShopByOwner(profile.id),
        getSellerDashboardMetrics(profile.id),
      ]);
      setSellerShopId(shop?.id ?? null);
      setSellerMetrics(metrics);
      setHasShop(!!shop);
    } catch {
      setSellerMetrics(null);
    } finally {
      setSellerMetricsLoading(false);
    }
  }, [profile, isMerchantSeller]);

  const loadServiceProDashboard = useCallback(async () => {
    if (!profile || !isServiceProvider) return;
    setServiceProStatsLoading(true);
    try {
      const stats = await getServiceProDashboardStats(profile.id);
      setServiceProStats(stats);
      setProAvailable(stats.is_available);
    } catch {
      setServiceProStats(null);
    } finally {
      setServiceProStatsLoading(false);
    }
  }, [profile, isServiceProvider]);

  const handleToggleProAvailability = useCallback(async (next: boolean) => {
    if (!profile) return;
    setProAvailable(next);
    try {
      await setServiceProviderAvailability(profile.id, next);
      setServiceProStats(prev => (prev ? { ...prev, is_available: next } : prev));
    } catch {
      setProAvailable(!next);
      Alert.alert('Availability', 'Could not update your status. Please try again.');
    }
  }, [profile]);

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
    if (!profile || !isMerchantSeller) return;
    void loadSellerDashboard();
  }, [profile?.id, isMerchantSeller, loadSellerDashboard]);

  useEffect(() => {
    if (!profile || !isServiceProvider) return;
    void loadServiceProDashboard();
  }, [profile?.id, isServiceProvider, loadServiceProDashboard]);

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

  const refreshFeed = useCallback(async () => {
    if (!profile) return;
    socialLoadedRef.current = false;
    setStoriesHydrating(true);
    setInteractionsRefreshing(true);
    try {
      await Promise.all([
        load(true),
        getStories(profile.id).then(setStories),
        loadSparks(),
        loadNotifications(profile.id).catch(() => {}),
        isMerchantSeller ? loadSellerDashboard() : Promise.resolve(),
        isServiceProvider ? loadServiceProDashboard() : Promise.resolve(),
      ]);
    } finally {
      setInteractionsRefreshing(false);
      setStoriesHydrating(false);
    }
  }, [profile, load, loadSparks, loadNotifications, isMerchantSeller, loadSellerDashboard, isServiceProvider, loadServiceProDashboard, setInteractionsRefreshing]);

  const { refreshControl: pullRefreshControl, scrollHandlers, refreshing, onRefresh } = useScreenRefresh(refreshFeed);

  const onEndReached = () => {
    if (loading || loadingMore || !hasMore || loadingRef.current) return;
    load(false);
  };

  const filteredPosts = posts;

  const isOwnShopPost = useCallback((post: { shop_id?: string }) => (
    !!isMerchantSeller && !!sellerShopId && post.shop_id === sellerShopId
  ), [isMerchantSeller, sellerShopId]);

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleFlashDealSource = async (choice: MediaSourceChoice) => {
    setShowFlashDealSource(false);
    if (choice === 'gallery') {
      await pickMedia(true);
      setShowStoryComposer(true);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to capture a Flash Deal.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setStoryMedia({ uri: asset.uri, type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video' });
    setShowStoryComposer(true);
  };

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
  };

  const resolveMyShop = async () => {
    if (!profile) return null;
    const shop = await getShopByOwner(profile.id);
    if (!shop) {
      Alert.alert('Create your shop first', 'You need a shop before posting stories or Sparks.', [
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
    const mime = blob.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');
    const ext = mime.includes('webm')
      ? 'webm'
      : mime.includes('png')
        ? 'png'
        : type === 'video'
          ? 'mp4'
          : 'jpg';
    const path = `${folder}/${profile!.id}/${Date.now()}.${ext}`;
    return uploadImage('cityconnect', path, blob, mime);
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

  const submitSpark = async (payload: {
    media: { uri: string; type: 'image' | 'video' };
    caption: string;
    tags: string[];
    location: string;
    productId?: string | null;
    audio_track_id?: string | null;
    audio_title?: string | null;
    audio_artist?: string | null;
    audio_url?: string | null;
  }) => {
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      const mediaUrl = await uploadMediaUrl(payload.media.uri, payload.media.type, 'reels');
      const captionParts = [payload.caption.trim()];
      if (payload.location.trim()) captionParts.push(`📍 ${payload.location.trim()}`);
      if (payload.audio_title?.trim()) {
        captionParts.push(`🎵 ${payload.audio_title.trim()}${payload.audio_artist ? ` • ${payload.audio_artist.trim()}` : ''}`);
      }
      const created = await createReel({
        shop_id: shop.id,
        author_id: profile!.id,
        media_url: mediaUrl,
        caption: captionParts.filter(Boolean).join('\n'),
        tags: payload.tags,
        product_id: payload.productId ?? null,
        audio_track_id: payload.audio_track_id ?? null,
        audio_title: payload.audio_title ?? null,
        audio_artist: payload.audio_artist ?? null,
        audio_url: payload.audio_url ?? null,
      });
      setSparks(prev => [{ ...created, shop_name: shop.name, shop_logo: shop.logo_url }, ...prev]);
      setShowSparkComposer(false);
      setFeedView('sparks');
      addNotification('Spark published.');
    } catch (e: any) {
      Alert.alert('Could not post Spark', e.message || 'Try again after running the social migration SQL.');
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
            <Text style={ff.location}>
              📍 {profile?.city} · {profile?.radius_km} km · {roleBadge}
            </Text>
          </View>

          <View style={ff.headerRight}>
            <TouchableOpacity onPress={() => setShowNotifications(true)}>
              <Text style={ff.icon}>🔔</Text>
              {notifications.length > 0 && <View style={ff.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {isMerchantSeller ? <MarketTicker city={profile?.city} /> : null}

      {/* Search UI removed */}

      {isBuyer && feedView === 'posts' && (
        <View style={ff.feedModeRow}>
          <TouchableOpacity onPress={() => setFeedMode('nearby')} style={[ff.feedModeChip, feedMode === 'nearby' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'nearby' && ff.feedModeTextActive]}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFeedMode('following')} style={[ff.feedModeChip, feedMode === 'following' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'following' && ff.feedModeTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={ff.contentTabs}>
        <TouchableOpacity
          style={[ff.contentTab, feedView === 'posts' && ff.contentTabActive]}
          onPress={() => setFeedView('posts')}
          activeOpacity={0.85}
        >
          <Text style={[ff.contentTabText, feedView === 'posts' && ff.contentTabTextActive]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ff.contentTab, feedView === 'sparks' && ff.contentTabActive]}
          onPress={() => setFeedView('sparks')}
          activeOpacity={0.85}
        >
          <Text style={[ff.contentTabText, feedView === 'sparks' && ff.contentTabTextActive]}>Sparks</Text>
        </TouchableOpacity>
      </View>

      {feedView === 'sparks' ? (
        <SparksFeed sparks={sparks} />
      ) : loading && posts.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
          {...scrollHandlers}
          refreshControl={pullRefreshControl}
        >
          <FeedHydrationSkeleton />
        </ScrollView>
      ) : (
      <FlashList
        style={{ flex: 1 }}
        data={filteredPosts}
        extraData={`${filteredPosts.length}-${postCacheVersion}-${sellerShopId}-${activePostKey}`}
        keyExtractor={item => item.feed_item_id ?? item.id}
        numColumns={isMerchantSeller ? 2 : 1}
        estimatedItemSize={isMerchantSeller ? 300 : 520}
        drawDistance={WINDOW_HEIGHT * 2}
        onViewableItemsChanged={onPostsViewableItemsChanged}
        viewabilityConfig={postsViewabilityConfig}
        {...scrollHandlers}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            userId={profile!.id}
            isBuyer={!!isBuyer}
            isSellerOwner={isOwnShopPost(item)}
            layout={isMerchantSeller ? 'masonry' : 'feed'}
            isMediaActive={activePostKey === (item.feed_item_id ?? item.id)}
            onAddToCart={handleAddToCart}
            onDeleted={handlePostDeleted}
          />
        )}
        refreshControl={pullRefreshControl}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} /> : null}
        ListHeaderComponent={
          <View>
            {Platform.OS === 'web' && (
              <TouchableOpacity onPress={onRefresh} style={ff.webRefresh} disabled={refreshing}>
                <Text style={ff.webRefreshText}>{refreshing ? 'Refreshing…' : '↓ Tap to refresh feed'}</Text>
              </TouchableOpacity>
            )}

            {isMerchantSeller ? (
              <SellerHeaderHero
                metrics={sellerMetrics}
                loading={sellerMetricsLoading}
                unreadEnquiries={sellerMetrics?.new_leads ?? 0}
                onFlashDeal={() => setShowFlashDealSource(true)}
                onAddProduct={() => router.push('/seller/upload' as any)}
                onPostSpark={() => setShowSparkComposer(true)}
                onViewEnquiries={() => router.push('/seller/enquiries' as any)}
              />
            ) : null}

            {isServiceProvider ? (
              <ServiceProHeaderHero
                stats={serviceProStats}
                loading={serviceProStatsLoading}
                isAvailable={proAvailable}
                onToggleAvailability={value => void handleToggleProAvailability(value)}
                onListService={() => router.push('/(tabs)/services' as any)}
              />
            ) : null}

            {isRegionalFallback ? (
              <FeedRegionalBanner onAdjustRadius={() => router.push('/(tabs)/profile' as any)} />
            ) : null}

            <View style={ff.stories}>
              {storiesHydrating ? (
                <FeedStoriesSkeleton />
              ) : (
                <>
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
                </>
              )}
            </View>

            {sparks.length > 0 && feedView === 'posts' && (
              <TouchableOpacity style={ff.reelsPromo} onPress={() => setFeedView('sparks')} activeOpacity={0.9}>
                <Text style={ff.reelsPromoBadge}>SPARKS</Text>
                <Text style={ff.reelsPromoText}>Watch {sparks.length} short video{sparks.length === 1 ? '' : 's'} →</Text>
              </TouchableOpacity>
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
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
      />
      )}

      <MediaSourceSheet
        visible={showFlashDealSource}
        title="Create Flash Deal"
        cameraLabel="Take Photo or Video"
        galleryLabel="Choose from Gallery"
        onClose={() => setShowFlashDealSource(false)}
        onSelect={choice => void handleFlashDealSource(choice)}
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
                setShowSparkComposer(true);
              }}
            >
              <Text style={ff.createIcon}>🎬</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Spark</Text>
                <Text style={ff.createSub}>Short vertical video for the Sparks tab.</Text>
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

      <SparkComposer
        visible={showSparkComposer}
        posting={posting}
        defaultLocation={profile?.city ?? ''}
        shopId={sellerShopId}
        onClose={() => setShowSparkComposer(false)}
        onPublish={submitSpark}
      />

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
  contentTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  contentTabActive: {
    backgroundColor: Colors.card,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' } as object,
      default: { elevation: 2 },
    }),
  },
  contentTabText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.dim,
    letterSpacing: 0.2,
  },
  contentTabTextActive: { color: Colors.orange },
  stories: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  storyHint: { color: Colors.dim, fontSize: 12, flex: 1 },
  reelsPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  reelsPromoBadge: { color: Colors.orange, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  reelsPromoText: { color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
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
