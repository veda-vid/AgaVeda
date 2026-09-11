// app/(tabs)/index.tsx — Instagram-style feed (buyer following + seller create)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  Image, ActivityIndicator, StyleSheet, Dimensions, Modal, Pressable, Alert, ScrollView, Platform,
  InteractionManager, Linking,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import {
  getFeed, getFollowingFeed,
  getStories, createStory, getUnifiedSparksFeed, createReel,
  getShopByOwner, uploadMediaFromUri, uploadSparkMediaFromUri, createPost,
  getServiceProDashboardStats, setServiceProviderAvailability,
  ensureServiceProviderRecord,
  type ServiceProDashboardStats,
} from '../../lib/api';
import { loadHomeFeed } from '../../lib/feedEngine';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { PostCard } from '../../components/feed/PostCard';
import { FeedHydrationSkeleton, FeedRegionalBanner } from '../../components/feed/FeedEngine';
import { SellerHeaderHero } from '../../components/seller/SellerHeaderHero';
import { SellerHeader } from '../../components/seller/SellerHeader';
import { MerchantRadiusSheet } from '../../components/seller/MerchantRadiusSheet';
import { SellerSparksCarousel } from '../../components/seller/SellerSparksCarousel';
import { ServiceProHeaderHero } from '../../components/seller/ServiceProHeaderHero';
import { AddServiceSkillModal } from '../../components/seller/AddServiceSkillModal';
import { ProLeadsDrawer } from '../../components/seller/ProLeadsDrawer';
import { ProCreateMenuSheet } from '../../components/composer/ProCreateMenuSheet';
import { CreatePostModal, type CreatePostPayload } from '../../components/composer/CreatePostModal';
import { UploadProgressBar } from '../../components/common/UploadProgressBar';
import { Header } from '../../components/common/Header';
import { FeedHeader } from '../../components/feed/FeedHeader';
import { LocationRadiusSheet } from '../../components/feed/LocationRadiusSheet';
import { SparksCarousel } from '../../components/feed/SparksCarousel';
import { SellerMasonryFeed } from '../../components/feed/SellerMasonryFeed';
import { StoryViewerModal } from '../../components/feed/StoryViewerModal';
import { TopRatedShopsCarousel } from '../../components/feed/TopRatedShopsCarousel';
import {
  detectFeedLocation,
  fetchTopRatedLocalShops,
  persistFeedLocation,
} from '../../services/feedApi';
import {
  fetchSellerCommandMetrics,
  persistSellerTargetRadius,
  type SellerCommandMetrics,
  type SellerRadiusKm,
} from '../../services/sellerApi';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  sanitizeFeedPosts,
  sanitizeSparkItems,
  safeFeedItemKey,
} from '../../lib/feedSafe';
import {
  isBuyerRole,
  isMerchantSeller as checkMerchantSeller,
  isSellerLike as checkSellerLike,
} from '../../stores/roleUtils';
import { useUploadProgressStore } from '../../stores/uploadProgressStore';
import { MediaSourceSheet, type MediaSourceChoice } from '../../components/media/MediaSourceSheet';
import { type SparkItem } from '../../components/feed/SparksFeed';
import { SparksReelsViewer } from '../../components/sparks/SparksReelsViewer';
import { UploadSparkModal, type SparkPublishPayload } from '../../components/sparks/UploadSparkModal';
import { GLASS, GlassSurface, SpringPressable } from '../../components/ui/modernSurfaces';
import { hapticLight } from '../../lib/haptics';
import { agentDebugLog } from '../../lib/agentDebugLog';
import Toast from 'react-native-toast-message';
import { usePostInteractionsStore } from '../../stores/postInteractionsStore';
import type { Story, ServiceProvider, Shop } from '../../types';

const W = Dimensions.get('window').width;
const WINDOW_HEIGHT = Dimensions.get('window').height;

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
  const updateLocalProfile = useAuthStore(s => s.updateProfile);
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const notifications = useAuthStore(s => s.notifications);
  const addNotification = useAuthStore(s => s.addNotification);
  const loadNotifications = useAuthStore(s => s.loadNotifications);
  const addItem = useCartStore(s => s.addItem);
  const loadCart = useCartStore(s => s.loadCart);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedView, setFeedView] = useState<'posts' | 'sparks'>('posts');
  const [showSparksViewer, setShowSparksViewer] = useState(false);
  const [feedMode, setFeedMode] = useState<'nearby' | 'following'>('nearby');
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [showSparkComposer, setShowSparkComposer] = useState(false);
  const [sparkComposerKey, setSparkComposerKey] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTextPostComposer, setShowTextPostComposer] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [storyMedia, setStoryMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [sparks, setSparks] = useState<SparkItem[]>([]);
  const [posting, setPosting] = useState(false);
  /** Active story for the viewer — keep this name (`viewStory`); Hermes Fast Refresh
   *  throws `Property 'viewStory' doesn't exist` if old closures still reference it. */
  const [viewStory, setViewStory] = useState<Story | null>(null);
  /** Instagram-style multi-page ring currently open in the viewer. */
  const [viewStoryPages, setViewStoryPages] = useState<Story[]>([]);
  const [viewStoryStartIndex, setViewStoryStartIndex] = useState(0);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [topRatedShops, setTopRatedShops] = useState<Shop[]>([]);
  const [textPostDraft, setTextPostDraft] = useState('');
  const [textFontStyle, setTextFontStyle] = useState<TextFontStyle>('classic');
  const [textBackground, setTextBackground] = useState<TextBackground>('sunset');
  const [textColor, setTextColor] = useState<TextColor>('white');
  const [hasShop, setHasShop] = useState<boolean | null>(null);
  const [sellerShopId, setSellerShopId] = useState<string | null>(null);
  const [sellerMetrics, setSellerMetrics] = useState<SellerCommandMetrics | null>(null);
  const [sellerMetricsLoading, setSellerMetricsLoading] = useState(false);
  const [merchantRadiusOpen, setMerchantRadiusOpen] = useState(false);
  const [showFlashDealSource, setShowFlashDealSource] = useState(false);
  const [isRegionalFallback, setIsRegionalFallback] = useState(false);
  const [storiesHydrating, setStoriesHydrating] = useState(true);
  const [serviceProStats, setServiceProStats] = useState<ServiceProDashboardStats | null>(null);
  const [serviceProStatsLoading, setServiceProStatsLoading] = useState(false);
  const [proAvailable, setProAvailable] = useState(false);
  const [serviceProRecord, setServiceProRecord] = useState<ServiceProvider | null>(null);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [skillFormProvider, setSkillFormProvider] = useState<ServiceProvider | null>(null);
  const [showProLeadsDrawer, setShowProLeadsDrawer] = useState(false);
  const [proLeadsFilter, setProLeadsFilter] = useState<'all' | 'quotes'>('all');
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
  const isServiceProvider = profile?.role === 'service_provider';
  const isBuyer = isBuyerRole(profile?.role);

  // #region agent log
  useEffect(() => {
    agentDebugLog({
      hypothesisId: 'H2',
      location: 'index.tsx:mountRoleGate',
      message: 'Home mount — create+ gate + spark composer state',
      data: {
        role: profile?.role ?? null,
        isServiceProvider,
        isMerchantSeller,
        isBuyer,
        createPlusVisible: !!(isServiceProvider || isMerchantSeller),
        showSparkComposer,
        showCreateMenu,
        showSparksViewer,
        sparkCount: sparks.length,
      },
    });
  }, [profile?.role, isServiceProvider, isMerchantSeller, isBuyer, showSparkComposer, showCreateMenu, showSparksViewer, sparks.length]);
  // #endregion

  const postCacheVersion = usePostInteractionsStore(s => s.version);
  const setInteractionsRefreshing = usePostInteractionsStore(s => s.setRefreshing);

  /** Always remount composer so a stuck blank sheet can be reopened. */
  const openSparkComposer = useCallback((fromCreateMenu = false) => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H6',
      location: 'index.tsx:openSparkComposer',
      message: 'openSparkComposer invoked',
      data: { fromCreateMenu, showSparkComposer, sparkComposerKey },
    });
    // #endregion
    const open = () => {
      setSparkComposerKey(k => k + 1);
      setShowSparkComposer(true);
    };
    if (fromCreateMenu) {
      setShowCreateMenu(false);
      InteractionManager.runAfterInteractions(open);
      return;
    }
    open();
  }, [showSparkComposer, sparkComposerKey]);

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
        if (reset && p === 0 && rows.length === 0) {
          const fallback = await loadHomeFeed(profile, { page: 0, mode: 'nearby' });
          rows = fallback.posts;
          setIsRegionalFallback(fallback.isRegionalFallback);
          effectiveRadiusRef.current = fallback.effectiveRadiusKm;
        }
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

      const safeRows = sanitizeFeedPosts(rows as any[]);
      setPosts(prev => (reset ? safeRows : [...prev, ...safeRows]));
      setHasMore(rows.length >= 10);
      pageRef.current = p + 1;
    } catch (e) {
      console.error(e);
      // Keep existing posts on soft refresh failure — avoid wiping to a blank/black feed.
      if (reset) {
        setPosts(prev => (Array.isArray(prev) ? prev : []));
      }
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile, isBuyer, hasMore]);

  useEffect(() => {
    if (!posts.length) {
      setActivePostKey(null);
      return;
    }
    const firstKey = posts[0].feed_item_id ?? posts[0].id;
    setActivePostKey(prev => {
      if (!prev) return firstKey;
      const stillVisible = posts.some((p: { id: string; feed_item_id?: string }) => (
        (p.feed_item_id ?? p.id) === prev
      ));
      return stillVisible ? prev : firstKey;
    });
  }, [posts]);

  // Initial + mode change load — do NOT depend on unstable callbacks
  useEffect(() => {
    if (!profile) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, feedMode]);

  const loadSparks = useCallback(async () => {
    if (!profile) return;
    try {
      const shopFilter = isBuyer && followedShopIds.length ? followedShopIds : undefined;
      const rows = await getUnifiedSparksFeed(profile.id, 30, 0, shopFilter);
      setSparks(sanitizeSparkItems(rows as any[]) as SparkItem[]);
    } catch (e) {
      console.warn('[home] loadSparks failed', e);
    }
  }, [profile, isBuyer, followedShopIds]);

  /** Background re-fetch after publish — never clears the visible layout on error. */
  const refreshHomeFeedSafely = useCallback(async () => {
    try {
      await load(true);
    } catch (e) {
      console.warn('[home] post-publish feed refresh failed', e);
    }
    try {
      await loadSparks();
    } catch (e) {
      console.warn('[home] post-publish sparks refresh failed', e);
    }
  }, [load, loadSparks]);

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
      setSparks(sanitizeSparkItems(sparkRows as any[]) as SparkItem[]);
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
      const metrics = await fetchSellerCommandMetrics(profile.id);
      setSellerMetrics(metrics);
      setSellerShopId(metrics.shop?.id ?? null);
      setHasShop(!!metrics.shop);
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H10',
        location: 'index.tsx:loadSellerDashboard',
        message: 'Seller shop resolved',
        data: { hasShop: !!metrics.shop, shopId: metrics.shop?.id ?? null },
        runId: 'post-fix',
      });
      // #endregion
    } catch (e: any) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H10',
        location: 'index.tsx:loadSellerDashboard:error',
        message: 'Seller shop load failed',
        data: { errorMessage: e?.message ?? String(e) },
        runId: 'post-fix',
      });
      // #endregion
      setSellerMetrics(null);
      setSellerShopId(null);
      setHasShop(false);
    } finally {
      setSellerMetricsLoading(false);
    }
  }, [profile, isMerchantSeller]);

  const loadServiceProDashboard = useCallback(async () => {
    if (!profile || !isServiceProvider) return;
    setServiceProStatsLoading(true);
    try {
      const seed = {
        name: profile.name,
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
        phone: profile.phone,
      };
      const stats = await getServiceProDashboardStats(profile.id, seed);
      setServiceProStats(stats);
      setProAvailable(stats.is_available);
      const record = await ensureServiceProviderRecord(profile.id, seed);
      setServiceProRecord(record);
      setSkillFormProvider(prev => prev ?? record);
    } catch {
      setServiceProStats({
        active_requests: 0,
        quote_inquiries: 0,
        is_available: false,
      });
    } finally {
      setServiceProStatsLoading(false);
    }
  }, [profile, isServiceProvider]);

  const handleToggleProAvailability = useCallback(async (next: boolean) => {
    if (!profile) return;
    setProAvailable(next);
    try {
      const updated = await setServiceProviderAvailability(profile.id, next, {
        name: profile.name,
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
        phone: profile.phone,
      });
      if (updated) setServiceProRecord(updated);
      setServiceProStats(prev => (prev ? { ...prev, is_available: next } : prev));
    } catch {
      setProAvailable(!next);
      Alert.alert('Availability', 'Could not update your status. Please try again.');
    }
  }, [profile]);

  const provisionServicePro = useCallback(async () => {
    if (!profile || !isServiceProvider) return null;
    try {
      const record = await ensureServiceProviderRecord(profile.id, {
        name: profile.name,
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
        phone: profile.phone,
      });
      setServiceProRecord(record);
      return record;
    } catch {
      return null;
    }
  }, [profile, isServiceProvider]);

  const openListServiceModal = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7579/ingest/9f87a31d-926e-4ca8-ab20-bba1a00c7458',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e7c6d'},body:JSON.stringify({sessionId:'7e7c6d',runId:'skill-modal-debug',hypothesisId:'H1',location:'index.tsx:openListServiceModal:entry',message:'openListServiceModal called',data:{hasProfile:!!profile,role:profile?.role??null,isServiceProvider,hasServiceProRecord:!!serviceProRecord},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!profile || !isServiceProvider) return;
    const seed = {
      name: profile.name ?? '',
      city: profile.city ?? '',
      lat: profile.lat,
      lng: profile.lng,
      phone: profile.phone,
    };
    setShowAddServiceModal(true);
    // #region agent log
    fetch('http://127.0.0.1:7579/ingest/9f87a31d-926e-4ca8-ab20-bba1a00c7458',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e7c6d'},body:JSON.stringify({sessionId:'7e7c6d',runId:'skill-modal-debug',hypothesisId:'H5',location:'index.tsx:openListServiceModal:visibleSet',message:'setShowAddServiceModal(true)',data:{usedCachedRecord:!!serviceProRecord},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const record = serviceProRecord ?? await ensureServiceProviderRecord(profile.id, seed);
      setServiceProRecord(record);
      setSkillFormProvider(record);
      // #region agent log
      fetch('http://127.0.0.1:7579/ingest/9f87a31d-926e-4ca8-ab20-bba1a00c7458',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e7c6d'},body:JSON.stringify({sessionId:'7e7c6d',runId:'skill-modal-debug',hypothesisId:'H3',location:'index.tsx:openListServiceModal:success',message:'provider record ready',data:{recordId:record?.id??null,businessName:record?.business_name??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7579/ingest/9f87a31d-926e-4ca8-ab20-bba1a00c7458',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e7c6d'},body:JSON.stringify({sessionId:'7e7c6d',runId:'skill-modal-debug',hypothesisId:'H2',location:'index.tsx:openListServiceModal:error',message:'ensureServiceProviderRecord failed',data:{errorMessage:e?.message??String(e),errorCode:e?.code??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setShowAddServiceModal(false);
      Alert.alert(
        'Profile setup',
        e?.message || 'Could not load your service provider profile. Please try again.',
      );
    }
  }, [profile, isServiceProvider, serviceProRecord]);

  useEffect(() => {
    if (!profile || !isServiceProvider) return;
    void (async () => {
      await provisionServicePro();
      await loadServiceProDashboard();
    })();
  }, [profile?.id, isServiceProvider, provisionServicePro, loadServiceProDashboard]);

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

  // Replace placeholder "Current Location" with a real place name from GPS / reverse geocode.
  useEffect(() => {
    if (!profile?.id) return;
    const city = (profile.city || '').trim();
    const needsName = !city || /^current location$/i.test(city) || /^your area$/i.test(city);
    if (!needsName) return;
    let cancelled = false;
    (async () => {
      const result = await detectFeedLocation();
      if (cancelled || !result.ok) return;
      const nextCity = result.geo.city?.trim();
      if (!nextCity || /^current location$/i.test(nextCity)) return;
      await persistFeedLocation(profile.id, {
        city: nextCity,
        lat: result.geo.lat,
        lng: result.geo.lng,
      });
      updateLocalProfile({
        city: nextCity,
        lat: result.geo.lat,
        lng: result.geo.lng,
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.id, profile?.city, updateLocalProfile]);

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

  // Inject top-rated shops discovery when Following is empty / low-content
  useEffect(() => {
    if (!profile || !isBuyer || isServiceProvider) {
      setTopRatedShops([]);
      return;
    }
    if (feedMode !== 'following') {
      setTopRatedShops([]);
      return;
    }
    const lowContent = posts.length < 4;
    if (!lowContent || profile.lat == null || profile.lng == null) {
      if (!lowContent) setTopRatedShops([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const shops = await fetchTopRatedLocalShops({
          lat: profile.lat!,
          lng: profile.lng!,
          radiusKm: profile.radius_km ?? 10,
          city: profile.city,
          excludeIds: followedShopIds,
          limit: 10,
        });
        if (!cancelled) setTopRatedShops(shops);
      } catch {
        if (!cancelled) setTopRatedShops([]);
      }
    })();
    return () => { cancelled = true; };
  }, [
    profile?.id, profile?.lat, profile?.lng, profile?.radius_km, profile?.city,
    isBuyer, isServiceProvider, feedMode, posts.length, followedShopIds,
  ]);

  const handleDetectFeedLocation = useCallback(async () => {
    setDetectingLocation(true);
    try {
      const result = await detectFeedLocation();
      if (!result.ok) {
        Toast.show({ type: 'error', text1: 'Location unavailable', text2: result.message });
        return;
      }
      await persistFeedLocation(profile?.id, {
        city: result.geo.city,
        lat: result.geo.lat,
        lng: result.geo.lng,
      });
      updateLocalProfile({
        city: result.geo.city,
        lat: result.geo.lat,
        lng: result.geo.lng,
      });
      Toast.show({
        type: 'success',
        text1: 'Location updated',
        text2: `Showing posts near ${result.geo.city}.`,
      });
      setLocationSheetOpen(false);
      void load(true);
    } finally {
      setDetectingLocation(false);
    }
  }, [profile?.id, updateLocalProfile, load]);

  const handleSaveFeedRadius = useCallback(async (radius_km: number) => {
    if (!profile) return;
    await persistFeedLocation(profile.id, { radius_km });
    updateLocalProfile({ radius_km });
    void hapticLight();
    Toast.show({
      type: 'success',
      text1: 'Coverage updated',
      text2: `Nearby feed now uses ${radius_km} km.`,
      visibilityTime: 1600,
    });
    // profile.radius_km effect will also reload; call load for instant refresh
    void load(true);
  }, [profile, updateLocalProfile, load]);

  const handleSaveMerchantRadius = useCallback(async (radius_km: SellerRadiusKm) => {
    if (!profile) return;
    await persistSellerTargetRadius(profile.id, radius_km);
    updateLocalProfile({ radius_km });
    void hapticLight();
    Toast.show({
      type: 'success',
      text1: 'Broadcast zone updated',
      text2: `Targeting customers within ${radius_km} km.`,
      visibilityTime: 1800,
    });
    void Promise.all([load(true), loadSellerDashboard()]);
  }, [profile, updateLocalProfile, load, loadSellerDashboard]);

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

  /** Seller/pro home "Candid moments" strip — only this user's Moments. Full feed stays on Moments tab. */
  const ownSparks = useMemo(() => {
    if (!profile?.id) return [];
    const shopId = sellerShopId;
    const proId = serviceProRecord?.id ?? null;
    return sparks.filter(s => {
      if (s.author_id && s.author_id === profile.id) return true;
      if (shopId && s.shop_id && s.shop_id === shopId) return true;
      if (proId && (s as any).service_provider_id && (s as any).service_provider_id === proId) return true;
      return false;
    });
  }, [sparks, profile?.id, sellerShopId, serviceProRecord?.id]);

  const isOwnShopPost = useCallback((post: { shop_id?: string }) => (
    !!isMerchantSeller && !!sellerShopId && post.shop_id === sellerShopId
  ), [isMerchantSeller, sellerShopId]);

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSparks(prev => prev.filter(s => {
      if (s.id === postId) return false;
      if (s.id === `post-spark-${postId}`) return false;
      return true;
    }));
  }, []);

  const handleMomentDeleted = useCallback((sparkId: string) => {
    setSparks(prev => prev.filter(s => s.id !== sparkId));
    if (sparkId.startsWith('post-spark-')) {
      const postId = sparkId.slice('post-spark-'.length);
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
  }, []);

  const openStoryGroup = useCallback((items: Story[], startIndex = 0) => {
    const pages = (items ?? []).filter(s => !!s?.id && !!s?.media_url && !s?.deleted_at);
    if (!pages.length) return;
    const idx = Math.min(Math.max(0, startIndex), pages.length - 1);
    setViewStoryPages(pages);
    setViewStoryStartIndex(idx);
    setViewStory(pages[idx] ?? null);
  }, []);

  const handleFlashDealSource = async (choice: MediaSourceChoice) => {
    setShowFlashDealSource(false);
    // Wait for MediaSourceSheet Modal to fully dismiss before camera/gallery (Android).
    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 320 : 80));

    if (choice === 'gallery') {
      const picked = await pickMedia(true);
      if (picked) setShowStoryComposer(true);
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
    const looksVideo = asset.type === 'video'
      || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(asset.uri || '')
      || ((asset as { mimeType?: string }).mimeType ?? '').startsWith('video/');
    setStoryMedia({ uri: asset.uri, type: (looksVideo ? 'video' : 'image') as 'image' | 'video' });
    setShowStoryComposer(true);
  };

  /** Returns true when media was selected into storyMedia. */
  const pickMedia = async (forStory: boolean): Promise<boolean> => {
    try {
      if (Platform.OS !== 'web') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        let status = current.status;
        const canAskAgain = (current as { canAskAgain?: boolean }).canAskAgain !== false;
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H9',
          location: 'index.tsx:pickMedia',
          message: 'Story/flash gallery permission',
          data: { forStory, status, canAskAgain },
          runId: 'post-fix',
        });
        // #endregion
        if (status !== 'granted' && !canAskAgain) {
          Alert.alert(
            'Photo library blocked',
            'Enable Photos / Media permission in Settings to pick media for Stories and Moments.',
            [
              { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
              { text: 'Cancel', style: 'cancel' },
            ],
          );
          return false;
        }
        if (status !== 'granted') {
          const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted') {
          Alert.alert(
            'Photo library access needed',
            'Allow Vedastya to access your photos and videos to continue.',
            [
              { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
              { text: 'OK', style: 'cancel' },
            ],
          );
          return false;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: Platform.OS === 'ios',
      });
      if (result.canceled || !result.assets[0]) return false;
      const asset = result.assets[0];
      const looksVideo = asset.type === 'video'
        || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(asset.uri || '')
        || (asset.mimeType ?? '').startsWith('video/');
      const media = { uri: asset.uri, type: (looksVideo ? 'video' : 'image') as 'image' | 'video' };
      if (forStory) setStoryMedia(media);
      return true;
    } catch (e: any) {
      Alert.alert('Could not open gallery', e?.message || 'Please try again.');
      return false;
    }
  };

  /**
   * ImagePicker must not launch while a Modal is visible (Android often returns
   * canceled / blank). Dismiss the story sheet, pick, then reopen.
   */
  const pickStoryMediaSafely = async () => {
    setShowStoryComposer(false);
    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 350 : 100));
    const picked = await pickMedia(true);
    setShowStoryComposer(true);
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H-story',
      location: 'index.tsx:pickStoryMediaSafely',
      message: 'Story media pick finished',
      data: { picked, platform: Platform.OS },
      runId: 'story-fix',
    });
    // #endregion
  };

  const openStoryComposer = () => {
    setShowCreateMenu(false);
    setShowFlashDealSource(false);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => setShowStoryComposer(true), Platform.OS === 'android' ? 280 : 60);
    });
  };

  const resolveMyShop = async () => {
    if (!profile) return null;
    const shop = await getShopByOwner(profile.id);
    if (!shop) {
      Alert.alert('Create your shop first', 'You need a shop before posting stories or Moments.', [
        { text: 'Create Shop', onPress: () => router.push('/seller/shop' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return null;
    }
    setSellerShopId(shop.id);
    setHasShop(true);
    return shop;
  };

  const resolveMyServiceProvider = async () => {
    if (!profile || !isServiceProvider) return null;
    if (serviceProRecord) return serviceProRecord;
    return provisionServicePro();
  };

  const resolveContentPublisher = async () => {
    if (isServiceProvider) {
      const pro = await resolveMyServiceProvider();
      if (!pro) {
        Alert.alert('Profile setup', 'Could not load your service provider profile. Please try again.');
        return null;
      }
      return { kind: 'service_provider' as const, pro };
    }
    const shop = await resolveMyShop();
    if (!shop) return null;
    return { kind: 'shop' as const, shop };
  };

  const uploadMediaUrl = async (uri: string, type: 'image' | 'video', folder: string) => {
    agentDebugLog({
      hypothesisId: 'H11',
      location: 'index.tsx:uploadMediaUrl:start',
      message: 'Uploading spark/story media',
      data: { type, folder, uriScheme: uri.split(':')[0] ?? null },
      runId: 'post-fix',
    });
    const { prepareMediaForUpload } = await import('../../lib/prepareMediaUpload');
    const prepared = await prepareMediaForUpload(uri, type);
    const mime = type === 'video' ? 'video/mp4' : 'image/jpeg';
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const path = `${folder}/${profile!.id}/${Date.now()}.${ext}`;
    const url = await uploadMediaFromUri(prepared.uri, path, mime);
    agentDebugLog({
      hypothesisId: 'H11',
      location: 'index.tsx:uploadMediaUrl:done',
      message: 'Media upload finished',
      data: {
        type,
        folder,
        hasUrl: !!url,
        mime,
        compressed: prepared.compressed,
        finalBytes: prepared.finalBytes,
      },
      runId: 'post-fix',
    });
    return url;
  };

  /**
   * Instagram-style Spark publish:
   * 1) Dismiss composer immediately
   * 2) Show home upload progress bar
   * 3) Upload + insert in background
   * 4) Refresh feeds on success
   */
  const submitSpark = (payload: SparkPublishPayload) => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H4',
      location: 'index.tsx:submitSpark:entry',
      message: 'submitSpark called',
      data: {
        hasProfile: !!profile?.id,
        role: profile?.role ?? null,
        mediaType: payload?.media?.type ?? null,
        uriScheme: payload?.media?.uri ? String(payload.media.uri).split(':')[0] : null,
      },
      runId: 'publish-debug',
    });
    // #endregion
    if (!profile?.id) {
      Alert.alert('Sign in required', 'Please sign in as a seller or service pro to publish a Moment.');
      return;
    }

    const startJob = useUploadProgressStore.getState().startJob;
    const setProgress = useUploadProgressStore.getState().setProgress;
    const completeJob = useUploadProgressStore.getState().completeJob;
    const failJob = useUploadProgressStore.getState().failJob;

    const jobId = startJob({
      kind: 'spark',
      caption: payload.caption || 'Posting Moment…',
      thumbnailUri: payload.coverUri || payload.media.uri,
    });

    // Instantly return to Home
    setShowSparkComposer(false);
    setFeedView('posts');
    setShowSparksViewer(false);

    void (async () => {
      try {
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H4',
          location: 'index.tsx:submitSpark:start',
          message: 'Moment publish started',
          data: {
            profileId: profile.id,
            role: profile.role ?? null,
            mediaType: payload.media?.type ?? null,
            uriScheme: String(payload.media?.uri || '').split(':')[0] || null,
            hasAudio: !!payload.audio_url,
          },
          runId: 'publish-debug',
        });
        // #endregion
        setProgress(jobId, 8, 'uploading');
        const publisher = await resolveContentPublisher();
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H4',
          location: 'index.tsx:submitSpark:publisher',
          message: 'Publisher resolved',
          data: {
            kind: publisher?.kind ?? null,
            shopId: publisher?.kind === 'shop' ? publisher.shop.id : null,
            proId: publisher?.kind === 'service_provider' ? publisher.pro.id : null,
          },
          runId: 'publish-debug',
        });
        // #endregion
        if (!publisher) {
          throw new Error('Could not resolve your shop or service profile. Please try again.');
        }

        setProgress(jobId, 12, 'uploading');
        const mediaUrl = await uploadSparkMediaFromUri(
          payload.media.uri,
          profile.id,
          payload.media.type === 'video' ? 'video' : 'image',
          (pct) => {
            setProgress(jobId, Math.max(12, Math.min(70, Math.round(pct))), 'uploading');
          },
        );
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H1',
          location: 'index.tsx:submitSpark:uploaded',
          message: 'Moment media uploaded',
          data: {
            hasUrl: !!mediaUrl,
            urlHost: (() => { try { return new URL(mediaUrl).host; } catch { return null; } })(),
          },
          runId: 'publish-debug',
        });
        // #endregion
        setProgress(jobId, 72, 'saving');

        const captionParts = [payload.caption.trim()];
        if (payload.location.trim()) captionParts.push(`📍 ${payload.location.trim()}`);
        if (payload.audio_title?.trim()) {
          captionParts.push(
            `🎵 ${payload.audio_title.trim()}${payload.audio_artist ? ` • ${payload.audio_artist.trim()}` : ''}`,
          );
        }

        setProgress(jobId, 88, 'saving');
        const created = await createReel({
          ...(publisher.kind === 'shop'
            ? { shop_id: publisher.shop.id }
            : { service_provider_id: publisher.pro.id }),
          author_id: profile.id,
          media_url: mediaUrl,
          caption: captionParts.filter(Boolean).join('\n'),
          tags: payload.tags,
          product_id: publisher.kind === 'shop' ? (payload.productId ?? null) : null,
          audio_track_id: payload.audio_track_id ?? null,
          audio_title: payload.audio_title ?? null,
          audio_artist: payload.audio_artist ?? null,
          audio_url: payload.audio_url ?? null,
          audio_start_time: payload.audio_start_time ?? 0,
          audio_volume_balance: payload.audio_volume_balance ?? { video: 0, music: 100 },
        });
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H2',
          location: 'index.tsx:submitSpark:created',
          message: 'Moment reel insert ok',
          data: { reelId: created?.id ?? null, alsoStory: !!payload.also_share_to_story },
          runId: 'publish-debug',
        });
        // #endregion

        let storyShared = false;
        if (payload.also_share_to_story) {
          setProgress(jobId, 92, 'saving');
          try {
            const story = await createStory({
              ...(publisher.kind === 'shop'
                ? { shop_id: publisher.shop.id }
                : { service_provider_id: publisher.pro.id }),
              author_id: profile.id,
              media_url: mediaUrl,
              media_type: payload.media.type === 'video' ? 'video' : 'image',
              caption: payload.caption.trim() || undefined,
              audio_track_id: payload.audio_track_id ?? created.audio_track_id ?? null,
              audio_title: payload.audio_title ?? created.audio_title ?? null,
              audio_artist: payload.audio_artist ?? created.audio_artist ?? null,
              audio_url: payload.audio_url ?? created.audio_url ?? null,
              audio_start_time: payload.audio_start_time ?? created.audio_start_time ?? 0,
              audio_volume_balance: payload.audio_volume_balance
                ?? created.audio_volume_balance
                ?? ((payload.audio_url || created.audio_url) ? { video: 0, music: 100 } : null),
            });
            // #region agent log
            agentDebugLog({
              hypothesisId: 'H-story-audio',
              location: 'index.tsx:submitSpark:storyCreated',
              message: 'Story created from Moment share',
              data: {
                storyId: story?.id ?? null,
                hasAudio: !!(story as any)?.audio_url,
                audioTitle: (story as any)?.audio_title ?? null,
              },
              runId: 'publish-debug',
            });
            // #endregion
            storyShared = true;
            const displayName = publisher.kind === 'shop' ? publisher.shop.name : publisher.pro.business_name;
            const displayLogo = publisher.kind === 'shop' ? publisher.shop.logo_url : null;
            setStories(prev => [
              { ...story, shop_name: displayName, shop_logo: displayLogo },
              ...prev.filter(s => s.id !== story.id),
            ]);
          } catch (storyErr: any) {
            // Moment already published — don't fail the whole job for Story
            console.warn('[submitSpark] Story share failed', storyErr?.message ?? storyErr);
            Toast.show({
              type: 'info',
              text1: 'Moment published',
              text2: 'Could not add to Story — try sharing Story separately.',
            });
          }
        }

        setProgress(jobId, 98, 'saving');
        const displayName = publisher.kind === 'shop' ? publisher.shop.name : publisher.pro.business_name;
        const displayLogo = publisher.kind === 'shop' ? publisher.shop.logo_url : null;
        setSparks(prev => sanitizeSparkItems([
          { ...created, shop_name: displayName, shop_logo: displayLogo },
          ...prev,
        ] as any[]) as SparkItem[]);
        completeJob(jobId);
        Toast.show({
          type: 'success',
          text1: storyShared ? 'Moment + Story shared!' : 'Moment Published Successfully!',
          text2: storyShared
            ? 'Live in Moments and your Story ring.'
            : 'Your Moment is live at the top of Moments.',
        });
        addNotification(storyShared ? 'Moment and Story published.' : 'Moment published.');
        void refreshHomeFeedSafely();
      } catch (e: any) {
        const msg = e?.message || 'Could not publish Moment. Check your connection and try again.';
        failJob(jobId, msg);
        Alert.alert('Could not publish Moment', msg);
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H1',
          location: 'index.tsx:submitSpark:error',
          message: 'Moment publish failed',
          data: {
            errorMessage: msg,
            errorCode: e?.code ?? e?.statusCode ?? null,
            errorName: e?.name ?? null,
            stageHint: /upload|storage|media|empty|Bucket/i.test(msg)
              ? 'upload'
              : /Permission|RLS|publisher|shop|service/i.test(msg)
                ? 'rls_or_publisher'
                : 'other',
          },
          runId: 'publish-debug',
        });
        // #endregion
      }
    })();
  };

  const submitCreatePost = (payload: CreatePostPayload) => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H5',
      location: 'index.tsx:submitCreatePost:entry',
      message: 'submitCreatePost called',
      data: {
        hasProfile: !!profile?.id,
        role: profile?.role ?? null,
        textLen: payload?.text?.length ?? 0,
      },
      runId: 'publish-debug',
    });
    // #endregion
    if (!profile?.id) {
      Alert.alert('Sign in required', 'Please sign in to publish a post.');
      return;
    }

    const startJob = useUploadProgressStore.getState().startJob;
    const setProgress = useUploadProgressStore.getState().setProgress;
    const completeJob = useUploadProgressStore.getState().completeJob;
    const failJob = useUploadProgressStore.getState().failJob;

    const jobId = startJob({
      kind: 'post',
      caption: payload.text.slice(0, 80) || 'Posting…',
      thumbnailUri: null,
    });

    setShowTextPostComposer(false);

    void (async () => {
      try {
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H5',
          location: 'index.tsx:submitCreatePost:start',
          message: 'Text post publish started',
          data: {
            profileId: profile.id,
            role: profile.role ?? null,
            textLen: payload.text?.length ?? 0,
          },
          runId: 'publish-debug',
        });
        // #endregion
        setProgress(jobId, 15, 'uploading');
        const publisher = await resolveContentPublisher();
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H4',
          location: 'index.tsx:submitCreatePost:publisher',
          message: 'Post publisher resolved',
          data: {
            kind: publisher?.kind ?? null,
            shopId: publisher?.kind === 'shop' ? publisher.shop.id : null,
            proId: publisher?.kind === 'service_provider' ? publisher.pro.id : null,
          },
          runId: 'publish-debug',
        });
        // #endregion
        if (!publisher) {
          throw new Error('Could not resolve your shop or service profile. Please try again.');
        }
        setProgress(jobId, 55, 'saving');
        const meta = {
          text: payload.text,
          fontStyle: payload.fontStyle,
          background: payload.background,
          textColor: payload.textColor,
        };
        await createPost({
          ...(publisher.kind === 'shop'
            ? { shop_id: publisher.shop.id }
            : { service_provider_id: publisher.pro.id }),
          caption: `__TEXT_CARD__${JSON.stringify(meta)}`,
          media_urls: [],
          media_type: 'image',
        });
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H2',
          location: 'index.tsx:submitCreatePost:created',
          message: 'Post insert ok',
          data: { kind: publisher.kind },
          runId: 'publish-debug',
        });
        // #endregion
        setProgress(jobId, 96, 'saving');
        completeJob(jobId);
        Toast.show({
          type: 'success',
          text1: 'Post Published Successfully!',
          text2: 'Your update is live on Home.',
        });
        addNotification(isServiceProvider ? 'Update shared from your profile.' : 'Update shared from your shop.');
        void refreshHomeFeedSafely();
      } catch (e: any) {
        const msg = e?.message || 'Could not publish post. Please try again.';
        failJob(jobId, msg);
        Alert.alert('Could not share update', msg);
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H2',
          location: 'index.tsx:submitCreatePost:error',
          message: 'Post publish failed',
          data: {
            errorMessage: msg,
            errorCode: e?.code ?? null,
            stageHint: /Permission|RLS|publisher|shop|service/i.test(msg)
              ? 'rls_or_publisher'
              : 'other',
          },
          runId: 'publish-debug',
        });
        // #endregion
      }
    })();
  };

  const submitStory = async () => {
    if (!storyMedia && !storyDraft.trim()) {
      Alert.alert('Add media or caption', 'Pick a photo/video or write a short caption before sharing.');
      return;
    }
    if (!profile) return;
    setPosting(true);
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H-story',
      location: 'index.tsx:submitStory:start',
      message: 'Story publish started',
      data: {
        hasMedia: !!storyMedia,
        mediaType: storyMedia?.type ?? null,
        hasCaption: !!storyDraft.trim(),
        sellerShopId,
        role: profile.role ?? null,
      },
      runId: 'story-fix',
    });
    // #endregion
    try {
      const publisher = await resolveContentPublisher();
      if (!publisher) {
        // #region agent log
        agentDebugLog({
          hypothesisId: 'H-story',
          location: 'index.tsx:submitStory:noPublisher',
          message: 'Story publish aborted — no shop/pro',
          data: { sellerShopId, role: profile.role ?? null },
          runId: 'story-fix',
        });
        // #endregion
        return;
      }
      let mediaUrl = storyMedia?.uri ?? '';
      let mediaType: 'image' | 'video' = storyMedia?.type ?? 'image';
      if (storyMedia) {
        mediaUrl = await uploadMediaUrl(storyMedia.uri, storyMedia.type, 'stories');
      } else {
        mediaUrl = 'https://placehold.co/600x900/141420/FF5722/png?text=Story';
        mediaType = 'image';
      }
      const created = await createStory({
        ...(publisher.kind === 'shop'
          ? { shop_id: publisher.shop.id }
          : { service_provider_id: publisher.pro.id }),
        author_id: profile.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: storyDraft.trim(),
      });
      const displayName = publisher.kind === 'shop' ? publisher.shop.name : publisher.pro.business_name;
      const logo = publisher.kind === 'shop'
        ? (publisher.shop.logo_url ?? null)
        : (publisher.pro.portfolio_photos?.[0] ?? profile.avatar_url ?? null);
      setStories(prev => [{ ...created, shop_name: displayName, shop_logo: logo }, ...prev]);
      setStoryDraft('');
      setStoryMedia(null);
      setShowStoryComposer(false);
      addNotification('Story shared — followers will see it for 24 hours.');
      Toast.show({
        type: 'success',
        text1: 'Story shared',
        text2: 'Visible for 24 hours in your Stories ring.',
        visibilityTime: 2000,
      });
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H-story',
        location: 'index.tsx:submitStory:success',
        message: 'Story published',
        data: { storyId: created?.id ?? null, mediaType },
        runId: 'story-fix',
      });
      // #endregion
    } catch (e: any) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H-story',
        location: 'index.tsx:submitStory:error',
        message: 'Story publish failed',
        data: { errorMessage: e?.message ?? String(e) },
        runId: 'story-fix',
      });
      // #endregion
      Alert.alert('Could not post story', e?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleAddToCart = async (productId: string, shopId: string) => {
    if (!profile) return;
    await addItem(profile.id, productId, shopId, 1);
    addNotification('Added to cart');
  };

  if (!profile) {
    return (
      <View style={ff.loader}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  const serviceProHero = isServiceProvider && feedView === 'posts' ? (
    <ServiceProHeaderHero
      stats={serviceProStats}
      loading={serviceProStatsLoading}
      isAvailable={proAvailable}
      providerProfileId={profile.id}
      provider={serviceProRecord}
      rating={serviceProRecord?.avg_rating ?? 0}
      reviewCount={serviceProRecord?.total_reviews ?? 0}
      onToggleAvailability={value => void handleToggleProAvailability(value)}
      onListService={() => void openListServiceModal()}
      onOpenActiveRequests={() => {
        setProLeadsFilter('all');
        setShowProLeadsDrawer(true);
      }}
      onOpenQuoteInquiries={() => {
        setProLeadsFilter('quotes');
        setShowProLeadsDrawer(true);
      }}
      onStatsChange={setServiceProStats}
    />
  ) : null;

  return (
    <View style={ff.root}>
      <UploadProgressBar onDismissSuccess={() => { void refreshHomeFeedSafely(); }} />

      {isBuyer && !isServiceProvider ? (
        <FeedHeader
          city={profile?.city}
          radiusKm={profile?.radius_km}
          feedMode={feedMode}
          notificationCount={notifications.length}
          followingBadge={followedShopIds.length}
          onOpenLocation={() => setLocationSheetOpen(true)}
          onChangeMode={setFeedMode}
          showModeSwitcher={feedView === 'posts'}
        />
      ) : isMerchantSeller ? (
        <SellerHeader
          city={profile?.city}
          radiusKm={profile?.radius_km}
          notificationCount={notifications.length}
          onOpenTargetZone={() => setMerchantRadiusOpen(true)}
          leftSlot={
            <SpringPressable
              onPress={() => {
                // #region agent log
                agentDebugLog({hypothesisId:'H2',location:'index.tsx:createPlus',message:'Create + button tapped',data:{isServiceProvider,isMerchantSeller,role:profile?.role??null}});
                // #endregion
                setShowCreateMenu(true);
              }}
              style={ff.postPlusBtn}
              pressedScale={0.92}
            >
              <Text style={ff.postPlusIcon}>+</Text>
            </SpringPressable>
          }
        />
      ) : (
        <Header
          city={profile?.city}
          radiusKm={profile?.radius_km}
          notificationCount={notifications.length}
          leftSlot={
            isServiceProvider ? (
              <SpringPressable
                onPress={() => {
                  // #region agent log
                  agentDebugLog({hypothesisId:'H2',location:'index.tsx:createPlus',message:'Create + button tapped',data:{isServiceProvider,isMerchantSeller,role:profile?.role??null}});
                  // #endregion
                  setShowCreateMenu(true);
                }}
                style={ff.postPlusBtn}
                pressedScale={0.92}
              >
                <Text style={ff.postPlusIcon}>+</Text>
              </SpringPressable>
            ) : undefined
          }
        />
      )}

      {/* Search UI removed */}

      <GlassSurface style={ff.contentTabs} radius={20} intensity={22}>
        <SpringPressable
          style={[ff.contentTab, feedView === 'posts' && ff.contentTabActive]}
          onPress={() => setFeedView('posts')}
          accessibilityRole="tab"
        >
          <Text style={[ff.contentTabText, feedView === 'posts' && ff.contentTabTextActive]}>Posts</Text>
        </SpringPressable>
        <SpringPressable
          style={[ff.contentTab, (feedView === 'sparks' || showSparksViewer) && ff.contentTabActive]}
          onPress={() => {
            // #region agent log
            agentDebugLog({hypothesisId:'H4',location:'index.tsx:sparksTab',message:'Moments tab opened viewer',data:{sparkCount:sparks.length}});
            // #endregion
            setFeedView('posts');
            setShowSparksViewer(true);
          }}
          accessibilityRole="tab"
        >
          <Text style={[ff.contentTabText, (feedView === 'sparks' || showSparksViewer) && ff.contentTabTextActive]}>Moments</Text>
        </SpringPressable>
      </GlassSurface>

      {isMerchantSeller ? (
        <SellerMasonryFeed
          posts={filteredPosts}
          userId={profile!.id}
          sellerShopId={sellerShopId}
          loading={loading}
          loadingMore={loadingMore}
          refreshing={refreshing}
          activePostKey={activePostKey}
          isRegionalFallback={isRegionalFallback}
          extraDataKey={`${postCacheVersion}`}
          refreshControl={pullRefreshControl}
          scrollHandlers={scrollHandlers}
          onRefresh={onRefresh}
          onEndReached={onEndReached}
          onAdjustRadius={() => setMerchantRadiusOpen(true)}
          onDeleted={handlePostDeleted}
          onViewableItemsChanged={onPostsViewableItemsChanged}
          viewabilityConfig={postsViewabilityConfig}
          onRetry={() => { void refreshHomeFeedSafely(); }}
          listHeader={(
            <View>
              <SellerHeaderHero
                metrics={sellerMetrics}
                loading={sellerMetricsLoading}
                unreadEnquiries={sellerMetrics?.new_leads ?? 0}
                onFlashDeal={() => setShowFlashDealSource(true)}
                onAddProduct={() => router.push('/seller/upload' as any)}
                onPostSpark={() => {
                  // #region agent log
                  agentDebugLog({hypothesisId:'H5',location:'index.tsx:onPostSpark',message:'SellerHeaderHero Post Moment tapped',data:{sellerShopId}});
                  // #endregion
                  openSparkComposer(false);
                }}
                onViewEnquiries={() => router.push('/seller/enquiries' as any)}
              />
              <SellerSparksCarousel
                stories={stories}
                sparks={ownSparks}
                storiesHydrating={storiesHydrating}
                avatarUrl={sellerMetrics?.shop?.logo_url ?? profile?.avatar_url}
                shopName={sellerMetrics?.shop?.name}
                currentUserId={profile?.id}
                currentShopId={sellerShopId}
                onAddStory={openStoryComposer}
                onOpenStoryGroup={openStoryGroup}
                onOpenSparks={() => {
                  setFeedView('posts');
                  setShowSparksViewer(true);
                }}
              />
            </View>
          )}
        />
      ) : loading && posts.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
          {...scrollHandlers}
          refreshControl={pullRefreshControl}
        >
          {serviceProHero}
          <FeedHydrationSkeleton />
        </ScrollView>
      ) : (
      <ErrorBoundary onRefresh={() => { void refreshHomeFeedSafely(); }}>
      <View style={{ flex: 1 }}>
      <FlashList
        data={filteredPosts}
        extraData={`${filteredPosts.length}-${postCacheVersion}-${sellerShopId}-${activePostKey}-${serviceProRecord?.id ?? ''}-${serviceProRecord?.business_name ?? ''}-${serviceProRecord?.portfolio_photos?.length ?? 0}-${proAvailable}`}
        keyExtractor={(item, index) => safeFeedItemKey(item, index)}
        numColumns={1}
        estimatedItemSize={520}
        drawDistance={WINDOW_HEIGHT * 2}
        onViewableItemsChanged={onPostsViewableItemsChanged}
        viewabilityConfig={postsViewabilityConfig}
        {...scrollHandlers}
        renderItem={({ item }) => {
          if (!item?.id) return null;
          return (
            <PostCard
              post={item}
              userId={profile!.id}
              isBuyer={!!isBuyer}
              isSellerOwner={isOwnShopPost(item)}
              layout="feed"
              isMediaActive={
                activePostKey == null
                || activePostKey === (item.feed_item_id ?? item.id)
              }
              onAddToCart={handleAddToCart}
              onDeleted={handlePostDeleted}
            />
          );
        }}
        refreshControl={pullRefreshControl}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} /> : null}
        ListHeaderComponent={
          <View>
            {serviceProHero}

            {Platform.OS === 'web' && (
              <TouchableOpacity onPress={onRefresh} style={ff.webRefresh} disabled={refreshing}>
                <Text style={ff.webRefreshText}>{refreshing ? 'Refreshing…' : '↓ Tap to refresh feed'}</Text>
              </TouchableOpacity>
            )}

            {isRegionalFallback ? (
              <FeedRegionalBanner onAdjustRadius={() => setLocationSheetOpen(true)} />
            ) : null}

            {isBuyer && feedMode === 'following' && topRatedShops.length > 0 ? (
              <TopRatedShopsCarousel
                city={profile?.city || ''}
                shops={topRatedShops}
                onOpenShop={shop => router.push(`/shop/${shop.id}` as any)}
                onSwitchNearby={() => setFeedMode('nearby')}
              />
            ) : null}

            <SparksCarousel
              stories={stories}
              sparks={isSeller ? ownSparks : sparks}
              storiesHydrating={storiesHydrating}
              isSeller={!!isSeller}
              currentUserId={profile?.id}
              currentShopId={sellerShopId}
              onAddStory={openStoryComposer}
              onOpenStoryGroup={openStoryGroup}
              onOpenSparks={() => {
                setFeedView('posts');
                setShowSparksViewer(true);
              }}
              onDiscoverShops={() => router.push('/(tabs)/shops' as any)}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={ff.emptyState}>
            <Text style={ff.emptyEmoji}>{feedMode === 'following' ? '🫶' : '🛍️'}</Text>
            <Text style={ff.emptyText}>
              {feedMode === 'following'
                ? 'No posts from followed shops yet. Switch to Nearby or follow more local shops.'
                : 'No posts nearby yet. Try a larger radius in Profile, or pull down to refresh.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
      />
      </View>
      </ErrorBoundary>
      )}

      <MerchantRadiusSheet
        visible={merchantRadiusOpen}
        city={profile?.city || ''}
        currentRadius={profile?.radius_km ?? 5}
        onSaveRadius={km => { void handleSaveMerchantRadius(km); }}
        onClose={() => setMerchantRadiusOpen(false)}
      />

      <MediaSourceSheet
        visible={showFlashDealSource}
        title="Create Flash Deal"
        cameraLabel="Take Photo or Video"
        galleryLabel="Choose from Gallery"
        onClose={() => setShowFlashDealSource(false)}
        onSelect={choice => void handleFlashDealSource(choice)}
      />

      {/* Seller / service pro create menu */}
      <Modal transparent visible={showCreateMenu} animationType="fade" onRequestClose={() => setShowCreateMenu(false)}>
        <Pressable
          style={ff.modalBackdrop}
          onPress={() => {
            void hapticLight();
            setShowCreateMenu(false);
          }}
        >
          <Pressable onPress={() => {}}>
          <GlassSurface style={ff.modalSheet} radius={24} overflow="visible">
            <View style={ff.modalHandle} />
            {isServiceProvider ? (
              <ProCreateMenuSheet
                onListService={() => {
                  setShowCreateMenu(false);
                  void openListServiceModal();
                }}
                onStory={() => {
                  openStoryComposer();
                }}
                onSpark={() => {
                  // #region agent log
                  agentDebugLog({hypothesisId:'H1',location:'index.tsx:onSpark',message:'Create menu Moment tapped (service pro)',data:{isServiceProvider:true,showCreateMenu:true}});
                  // #endregion
                  openSparkComposer(true);
                }}
                onTextUpdate={() => {
                  setShowCreateMenu(false);
                  setShowTextPostComposer(true);
                }}
              />
            ) : (
              <>
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
                openStoryComposer();
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
                // #region agent log
                agentDebugLog({hypothesisId:'H1',location:'index.tsx:sellerSparkRow',message:'Create menu Moment tapped (seller)',data:{isMerchantSeller:true,hasShop}});
                // #endregion
                openSparkComposer(true);
              }}
            >
              <Text style={ff.createIcon}>🎬</Text>
              <View style={ff.createTextWrap}>
                <Text style={ff.createTitle}>Moment</Text>
                <Text style={ff.createSub}>Short vertical video for the Moments tab.</Text>
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
              </>
            )}
          </GlassSurface>
          </Pressable>
        </Pressable>
      </Modal>

      <ErrorBoundary onRefresh={() => {
        setViewStory(null);
        setViewStoryPages([]);
      }}>
        <StoryViewerModal
          visible={viewStory != null}
          stories={viewStoryPages.length ? viewStoryPages : (viewStory ? [viewStory] : [])}
          startIndex={viewStoryStartIndex}
          currentUserId={profile?.id}
          onClose={() => {
            setViewStory(null);
            setViewStoryPages([]);
          }}
          onDeleted={(storyId) => {
            setStories(prev => prev.filter(s => s.id !== storyId));
            setViewStoryPages(prev => {
              const next = prev.filter(s => s.id !== storyId);
              if (!next.length) setViewStory(null);
              return next;
            });
          }}
        />
      </ErrorBoundary>

      <Modal transparent visible={showStoryComposer} animationType="slide" onRequestClose={() => setShowStoryComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.storySheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Create Story</Text>
            <TouchableOpacity
              style={ff.mediaPickSolid}
              activeOpacity={0.85}
              onPress={() => { void pickStoryMediaSafely(); }}
            >
              <Text style={ff.mediaPickText}>
                {storyMedia ? '✓ Media selected — tap to change' : '📷 Pick photo or short video'}
              </Text>
            </TouchableOpacity>
            <TextInput
              value={storyDraft}
              onChangeText={setStoryDraft}
              multiline
              placeholder="Caption (optional)"
              placeholderTextColor={Colors.dim}
              style={ff.modalInput}
            />
            <TouchableOpacity
              onPress={() => { void submitStory(); }}
              disabled={posting}
              activeOpacity={0.88}
              style={[ff.primaryBtn, posting && ff.primaryBtnDisabled]}
            >
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Share Story</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowStoryComposer(false);
                setStoryMedia(null);
                setStoryDraft('');
              }}
              style={ff.storyCancel}
            >
              <Text style={ff.storyCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LocationRadiusSheet
        visible={locationSheetOpen}
        city={profile?.city || ''}
        currentRadius={profile?.radius_km ?? 5}
        detecting={detectingLocation}
        onDetectLocation={() => { void handleDetectFeedLocation(); }}
        onSaveRadius={km => { void handleSaveFeedRadius(km); }}
        onClose={() => setLocationSheetOpen(false)}
      />

      <SparksReelsViewer
        visible={showSparksViewer}
        sparks={sparks}
        canCreate={!!(isServiceProvider || isMerchantSeller)}
        onDeleted={handleMomentDeleted}
        onCreateSpark={() => {
          // #region agent log
          agentDebugLog({
            hypothesisId: 'H8',
            location: 'index.tsx:sparksViewerCreate',
            message: 'Create Moment from immersive Moments viewer',
            data: { sparkCount: sparks.length, showSparksViewer: true },
            runId: 'publish-debug',
          });
          // #endregion
          // Close viewer fully before opening composer — nested Modals break on Android
          setShowSparksViewer(false);
          setFeedView('posts');
          InteractionManager.runAfterInteractions(() => {
            openSparkComposer(false);
          });
        }}
        onClose={() => {
          // #region agent log
          agentDebugLog({hypothesisId:'H4',location:'index.tsx:sparksViewerClose',message:'Moments viewer closed',data:{sparkCount:sparks.length}});
          // #endregion
          setShowSparksViewer(false);
          setFeedView('posts');
        }}
      />

      <UploadSparkModal
        key={sparkComposerKey}
        visible={showSparkComposer}
        defaultLocation={profile?.city ?? ''}
        shopId={sellerShopId}
        serviceProviderId={serviceProRecord?.id ?? null}
        userId={profile?.id ?? null}
        onClose={() => {
          agentDebugLog({hypothesisId:'H3',location:'index.tsx:uploadClose',message:'UploadSparkModal onClose',data:{showSparkComposer}});
          setShowSparkComposer(false);
        }}
        onPublish={submitSpark}
      />

      <CreatePostModal
        visible={showTextPostComposer}
        isServiceProvider={isServiceProvider}
        onClose={() => setShowTextPostComposer(false)}
        onPublish={submitCreatePost}
      />

      <AddServiceSkillModal
        visible={showAddServiceModal}
        provider={skillFormProvider ?? serviceProRecord}
        onClose={() => {
          setShowAddServiceModal(false);
        }}
        onSaved={provider => {
          setServiceProRecord(provider);
          setSkillFormProvider(provider);
          setProAvailable(provider.is_available);
          setServiceProStats(prev => (prev
            ? { ...prev, is_available: provider.is_available }
            : { active_requests: 0, quote_inquiries: 0, is_available: provider.is_available }));
          addNotification('Service listing updated successfully.');
          Toast.show({
            type: 'success',
            text1: 'Service listing updated successfully.',
          });
        }}
      />

      {isServiceProvider && (
        <ProLeadsDrawer
          visible={showProLeadsDrawer}
          providerProfileId={profile.id}
          filter={proLeadsFilter}
          onClose={() => setShowProLeadsDrawer(false)}
        />
      )}
    </View>
  );
}

const ff = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  postPlusBtn: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 4 },
  postPlusIcon: { fontSize: 28, color: Colors.text, fontWeight: '300' },
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
  feedModeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  feedModeChipActive: { backgroundColor: Colors.orange + '2E', borderColor: Colors.orange + 'CC' },
  feedModeText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  feedModeTextActive: { color: Colors.orange },
  contentTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 4,
  },
  contentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  contentTabActive: {
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '66',
  },
  contentTabText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  contentTabTextActive: { color: Colors.orange },
  stories: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: GLASS.border, alignItems: 'center' },
  storyHint: { color: Colors.dim, fontSize: 12, flex: 1 },
  sparksSection: {
    marginTop: 12,
    paddingBottom: 4,
  },
  sparksSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 2,
  },
  sparksSectionEyebrow: {
    color: Colors.orange,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: Fonts.bodySemiBold,
  },
  sparksSectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.bodySemiBold,
  },
  sparksCarousel: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  sparkThumbWrap: { width: 108 },
  sparkGradientBorder: {
    borderRadius: 20,
    padding: 2,
  },
  sparkThumbInner: {
    height: 152,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  sparkThumbImg: { width: '100%', height: '100%' },
  sparkThumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  sparkThumbEmoji: { fontSize: 28 },
  sparkThumbScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  sparkThumbLabel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  sparkSeeAll: {
    height: 152,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sparkSeeAllText: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  modalSheet: { padding: 20, maxHeight: '80%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  storySheet: {
    padding: 20,
    paddingBottom: 28,
    maxHeight: '80%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  mediaPickSolid: {
    padding: 14,
    marginBottom: 12,
    borderRadius: GLASS.cardRadius,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  storyCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  storyCancelText: {
    color: Colors.sub,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 16, opacity: 0.65 },
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
  modalInput: { backgroundColor: GLASS.bg, borderRadius: GLASS.cardRadius, padding: 12, color: Colors.text, minHeight: 80, marginBottom: 12, textAlignVertical: 'top', borderWidth: 1, borderColor: GLASS.border },
  textStyleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  textStyleChip: {
    flex: 1,
    backgroundColor: GLASS.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  textStyleChipActive: { borderColor: Colors.orange + 'AA', backgroundColor: Colors.orange + '22' },
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
  mediaPick: { padding: 14, marginBottom: 12 },
  mediaPickText: { color: Colors.sub, fontWeight: '600' },
  primaryBtnWrap: { borderRadius: GLASS.cardRadius, overflow: 'hidden' },
  primaryBtn: { backgroundColor: Colors.orange, borderRadius: GLASS.cardRadius, paddingVertical: 13, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: Colors.white, fontWeight: '700' },
}));

const sf = createDynamicStyles((Colors) => ({
  story: { alignItems: 'center', width: 64, gap: 5 },
  storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: Colors.orange, padding: 2 },
  storyAvatar: { flex: 1, borderRadius: 28, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  storyEmoji: { fontSize: 26 },
  storyPlusIcon: { fontSize: 32, color: Colors.text, fontWeight: '300' },
  storyName: { fontSize: 10, color: Colors.sub, textAlign: 'center' },
}));
