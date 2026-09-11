// app/(tabs)/shops.tsx — Marketplace: hyper-local shop discovery hub

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, Pressable,
  Modal, Platform, Linking, useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { touchShopActivity } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  getMarketplaceColumns,
  MARKETPLACE_PAGE_SIZE,
  MARKETPLACE_RADIUS_OPTIONS,
} from '../../lib/marketplaceUtils';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { MarketplaceCard } from '../../components/marketplace/MarketplaceCard';
import { ShopDetail } from '../../components/marketplace/ShopDetail';
import { ShopChatDrawer } from '../../components/marketplace/ShopChatDrawer';
import { MarketplaceMapView } from '../../components/marketplace/MarketplaceMapView';
import { MarketplaceHeader } from '../../components/marketplace/MarketplaceHeader';
import { FilterBar } from '../../components/marketplace/FilterBar';
import {
  MarketplaceDeals,
  buildDealsFromAdsAndShops,
  type MarketplaceDealItem,
} from '../../components/marketplace/MarketplaceDeals';
import {
  detectMarketplaceLocation,
  fetchMarketplaceDeals,
  fetchNearbyShopsPage,
  fetchShopProductMeta,
  geoFromCityName,
  geoFromProfile,
  persistMarketplaceLocation,
  type MarketplaceGeo,
  type MarketplaceRadiusKm,
  type ProductPreview,
} from '../../services/marketplaceApi';
import { Colors, Fonts, SHOP_CATEGORIES, Shadow, createDynamicStyles } from '../../constants/theme';
import type { Ad, Shop } from '../../types';

type ViewMode = 'list' | 'map';

export default function ShopsScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const loadFollows = useAuthStore(s => s.loadFollows);
  const updateLocalProfile = useAuthStore(s => s.updateProfile);

  const [geo, setGeo] = useState<MarketplaceGeo | null>(() => geoFromProfile(profile));
  const [shops, setShops] = useState<Shop[]>([]);
  const [productIndex, setProductIndex] = useState<Record<string, string[]>>({});
  const [productPreviews, setProductPreviews] = useState<Record<string, ProductPreview[]>>({});
  const [ads, setAds] = useState<Ad[]>([]);
  const [followerOverrides, setFollowerOverrides] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(
    MARKETPLACE_RADIUS_OPTIONS.includes((profile?.radius_km ?? 5) as MarketplaceRadiusKm)
      ? (profile?.radius_km ?? 5)
      : 5,
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<Shop | null>(null);
  const [chatShop, setChatShop] = useState<Shop | null>(null);
  const [hoursTick, setHoursTick] = useState(() => new Date());
  const autoGpsAttempted = useRef(false);
  const { width } = useWindowDimensions();
  const isBuyer = profile?.role === 'buyer';
  const { category } = useLocalSearchParams<{ category?: string }>();
  const columns = getMarketplaceColumns(width);
  const gap = 12;
  const cardWidth = columns > 1 ? (width - 32 - gap * (columns - 1)) / columns : width - 32;
  const hasLocation = !!geo;

  const applyGeo = useCallback(async (next: MarketplaceGeo, opts?: { persist?: boolean; radius?: number }) => {
    setGeo(next);
    const r = opts?.radius ?? radiusKm;
    if (opts?.persist !== false) {
      await persistMarketplaceLocation(profile?.id, next, r);
      updateLocalProfile({
        city: next.city,
        lat: next.lat,
        lng: next.lng,
        radius_km: r,
      });
    }
  }, [profile?.id, radiusKm, updateLocalProfile]);

  const handleDetectLocation = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await detectMarketplaceLocation();
      if (!result.ok) {
        Toast.show({
          type: 'error',
          text1: 'Location unavailable',
          text2: result.message,
        });
        return;
      }
      await applyGeo(result.geo);
      Toast.show({
        type: 'success',
        text1: 'Location updated',
        text2: `Showing shops near ${result.geo.city}.`,
      });
    } finally {
      setDetecting(false);
    }
  }, [applyGeo]);

  const handleSelectCity = useCallback(async (cityName: string) => {
    const next = geoFromCityName(cityName);
    if (!next) {
      Toast.show({ type: 'error', text1: 'City not found', text2: 'Pick another city from the list.' });
      return;
    }
    await applyGeo(next);
  }, [applyGeo]);

  const handleChangeRadius = useCallback(async (km: MarketplaceRadiusKm | number) => {
    setRadiusKm(km);
    if (geo) {
      await persistMarketplaceLocation(profile?.id, geo, km);
      updateLocalProfile({ radius_km: km });
    }
  }, [geo, profile?.id, updateLocalProfile]);

  useEffect(() => {
    if (profile?.id) void loadFollows(profile.id);
  }, [profile?.id, loadFollows]);

  // Auto GPS when profile coords are missing
  useEffect(() => {
    if (autoGpsAttempted.current) return;
    if (geoFromProfile(profile)) {
      setGeo(geoFromProfile(profile));
      return;
    }
    autoGpsAttempted.current = true;
    void handleDetectLocation();
  }, [profile, handleDetectLocation]);

  useEffect(() => {
    if (profile?.city && profile.lat != null && profile.lng != null && !geo) {
      setGeo(geoFromProfile(profile));
    }
  }, [profile?.city, profile?.lat, profile?.lng, geo]);

  useEffect(() => {
    if (!category) return;
    const isValid = SHOP_CATEGORIES.some(item => item.id === category);
    if (category === 'all' || !isValid) setFilter('all');
    else setFilter(category);
  }, [category]);

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean, silent = false) => {
    if (!geo) {
      setShops([]);
      setProductIndex({});
      setProductPreviews({});
      setLoading(false);
      return;
    }
    if (!silent && pageOffset === 0 && replace) setLoading(true);
    if (pageOffset > 0) setLoadingMore(true);
    try {
      const { shops: page, hasMore: more } = await fetchNearbyShopsPage({
        lat: geo.lat,
        lng: geo.lng,
        radiusKm,
        category: filter === 'all' ? undefined : filter,
        offset: pageOffset,
        limit: MARKETPLACE_PAGE_SIZE,
      });
      setHasMore(more);
      setOffset(pageOffset + page.length);
      setShops(prev => {
        const merged = replace ? page : [...prev, ...page];
        const seen = new Set<string>();
        return merged.filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      });
      const ids = page.map(s => s.id);
      if (ids.length) {
        const { titles, previews } = await fetchShopProductMeta(ids);
        setProductIndex(prev => ({ ...prev, ...titles }));
        setProductPreviews(prev => ({ ...prev, ...previews }));
      }
    } catch (e) {
      console.error(e);
      if (replace) {
        setShops([]);
        setProductIndex({});
        setProductPreviews({});
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [geo, radiusKm, filter]);

  const loadDeals = useCallback(async () => {
    if (!geo?.city) {
      setAds([]);
      return;
    }
    const next = await fetchMarketplaceDeals(geo.city);
    setAds(next);
  }, [geo?.city]);

  const loadShops = useCallback(async () => {
    setHoursTick(new Date());
    await Promise.all([fetchPage(0, true, true), loadDeals()]);
  }, [fetchPage, loadDeals]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    await fetchPage(offset, false);
  }, [fetchPage, offset, loadingMore, hasMore, loading]);

  const { refreshing, onRefresh, scrollHandlers } = useScreenRefresh(loadShops);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    void fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    if (profile?.role === 'seller') {
      touchShopActivity(profile.id).catch(() => {});
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    const channelId = `marketplace-shops-${profile?.id ?? 'anon'}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops' }, payload => {
        const row = payload.new as Shop;
        setShops(prev => prev.map(s => (s.id === row.id ? { ...s, ...row } : s)));
        setSelected(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setChatShop(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setHoursTick(new Date());
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(shop => {
      const products = productIndex[shop.id] ?? [];
      return (
        shop.name.toLowerCase().includes(q)
        || shop.category.toLowerCase().includes(q)
        || (shop.status_message ?? '').toLowerCase().includes(q)
        || products.some(title => title.toLowerCase().includes(q))
      );
    });
  }, [shops, search, productIndex]);

  const deals = useMemo(
    () => buildDealsFromAdsAndShops(ads, shops),
    [ads, shops],
  );

  const getFollowers = (shop: Shop) => followerOverrides[shop.id] ?? shop.total_followers;

  const handleFollowerDelta = (shopId: string, delta: number) => {
    setFollowerOverrides(prev => {
      const shop = shops.find(s => s.id === shopId) ?? selected;
      const base = prev[shopId] ?? shop?.total_followers ?? 0;
      return { ...prev, [shopId]: Math.max(0, base + delta) };
    });
  };

  const handleShopUpdate = (updated: Shop) => {
    setShops(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
    setSelected(prev => (prev?.id === updated.id ? updated : prev));
    setFollowerOverrides(prev => ({ ...prev, [updated.id]: updated.total_followers }));
  };

  const openShopFromDeal = (deal: MarketplaceDealItem) => {
    if (!deal.shopId) return;
    const hit = shops.find(s => s.id === deal.shopId);
    if (hit) setSelected(hit);
  };

  const listHeader = (
    <View style={s.headerBody}>
      <FilterBar
        filter={filter}
        radiusKm={radiusKm}
        matchCount={filtered.length}
        viewMode={viewMode}
        search={search}
        searchFocused={searchFocused}
        onChangeFilter={setFilter}
        onChangeRadius={km => { void handleChangeRadius(km); }}
        onChangeViewMode={setViewMode}
        onChangeSearch={setSearch}
        onSearchFocus={setSearchFocused}
      />
      <MarketplaceDeals deals={deals} onPressDeal={openShopFromDeal} />
    </View>
  );

  const emptyNearby = !loading && hasLocation && !filtered.length && !search.trim();

  return (
    <View style={s.root}>
      <MarketplaceHeader
        city={geo?.city || profile?.city || ''}
        radiusKm={radiusKm}
        detecting={detecting}
        hasLocation={hasLocation}
        onDetectLocation={() => { void handleDetectLocation(); }}
        onSelectCity={city => { void handleSelectCity(city); }}
        onChangeRadius={km => { void handleChangeRadius(km); }}
      />

      {!hasLocation ? null : viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          {listHeader}
          {loading && !shops.length ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
          ) : (
            <MarketplaceMapView
              shops={filtered}
              userLat={geo?.lat}
              userLng={geo?.lng}
              now={hoursTick}
              onSelectShop={setSelected}
              onCall={shop => Linking.openURL(`tel:${shop.phone}`)}
              onChat={setChatShop}
            />
          )}
        </View>
      ) : loading && !shops.length ? (
        <View style={{ flex: 1 }}>
          {listHeader}
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
        </View>
      ) : (
        <FlashList
          key={`marketplace-${columns}`}
          data={filtered}
          numColumns={columns}
          estimatedItemSize={380}
          keyExtractor={item => item.id}
          {...scrollHandlers}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          renderItem={({ item }) => (
            <View style={{ width: cardWidth, marginBottom: gap, marginHorizontal: columns === 1 ? 16 : gap / 2 }}>
              <MarketplaceCard
                shop={item}
                width={cardWidth}
                now={hoursTick}
                currentUserId={profile?.id}
                productPreviews={productPreviews[item.id] ?? []}
                followerCount={getFollowers(item)}
                onSelect={setSelected}
                onCall={shop => Linking.openURL(`tel:${shop.phone}`)}
                onChat={setChatShop}
                onEditShop={() => router.push('/seller/shop' as any)}
                onFollowerDelta={handleFollowerDelta}
              />
            </View>
          )}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} />
          ) : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>{emptyNearby ? '📍' : '🏪'}</Text>
              <Text style={s.emptyTitle}>
                {search.trim()
                  ? 'No matching shops'
                  : emptyNearby
                    ? 'No shops in range'
                    : 'No shops nearby'}
              </Text>
              <Text style={s.emptyText}>
                {search.trim()
                  ? 'Try a different search term or widen your radius.'
                  : 'Try another category, increase your search radius, or browse another city.'}
              </Text>
              {emptyNearby ? (
                <View style={s.emptyActions}>
                  <TouchableOpacity
                    style={s.emptyPrimary}
                    onPress={() => { void handleDetectLocation(); }}
                    activeOpacity={0.9}
                  >
                    <Text style={s.emptyPrimaryText}>📍 Use Current Location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.emptySecondary}
                    onPress={() => { void handleChangeRadius(50); }}
                    activeOpacity={0.9}
                  >
                    <Text style={s.emptySecondaryText}>Widen to 50 km</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          }
        />
      )}

      {hasLocation && viewMode === 'map' ? (
        <TouchableOpacity
          style={s.modeToggle}
          onPress={() => setViewMode('list')}
          activeOpacity={0.9}
        >
          <Text style={s.modeToggleText}>📋 List View</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            {selected && profile ? (
              <ShopDetail
                shop={selected}
                userId={profile.id}
                isBuyer={!!isBuyer}
                now={hoursTick}
                followerCount={getFollowers(selected)}
                onFollowerDelta={delta => handleFollowerDelta(selected.id, delta)}
                onShopUpdate={handleShopUpdate}
                onEditShop={() => { setSelected(null); router.push('/seller/shop' as any); }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {chatShop && profile ? (
        <ShopChatDrawer shop={chatShop} userId={profile.id} onClose={() => setChatShop(null)} />
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  headerBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  listContent: { paddingTop: 4, paddingBottom: 100, paddingHorizontal: 8 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  emptyText: { color: Colors.dim, fontSize: 13, fontFamily: Fonts.body, textAlign: 'center', lineHeight: 19 },
  emptyActions: { width: '100%', gap: 8, marginTop: 12 },
  emptyPrimary: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  emptyPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  emptySecondary: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
  },
  emptySecondaryText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  modeToggle: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: Colors.orange,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Shadow.md,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  modeToggleText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 16,
  },
}));
