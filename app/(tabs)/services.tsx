// app/(tabs)/services.tsx — Pros: hyper-local verified service marketplace

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import { touchServiceProviderActivity } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  matchesSubcategoryChip, parseProsFilter,
} from '../../lib/prosUtils';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { ServiceCard } from '../../components/services/ServiceCard';
import { ServiceDetail } from '../../components/services/ServiceDetail';
import { ProChatDrawer } from '../../components/services/ProChatDrawer';
import { RequestServiceModal } from '../../components/services/RequestServiceModal';
import { ProsMapView } from '../../components/services/ProsMapView';
import { LocationBar } from '../../components/services/LocationBar';
import { ProsFilterBar } from '../../components/services/ProsFilterBar';
import { CategoryIcon } from '../../components/services/ServiceIcons';
import {
  detectProsLocation,
  fetchNearbyPros,
  geoFromCityName,
  geoFromProfile,
  persistProsLocation,
  type ProsGeo,
  type ProRadiusKm,
} from '../../services/proApi';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { ServiceProvider } from '../../types';

type ViewMode = 'list' | 'map';

export default function ServicesScreen() {
  const profile = useAuthStore(s => s.profile);
  const updateLocalProfile = useAuthStore(s => s.updateProfile);

  const [geo, setGeo] = useState<ProsGeo | null>(() => geoFromProfile(profile));
  const [radiusKm, setRadiusKm] = useState<number>(profile?.radius_km ?? 5);
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [filter, setFilter] = useState('all');
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [selected, setSelected] = useState<ServiceProvider | null>(null);
  const [chatPro, setChatPro] = useState<ServiceProvider | null>(null);
  const [requestPro, setRequestPro] = useState<ServiceProvider | null>(null);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const autoGpsAttempted = useRef(false);

  const hasLocation = !!geo;

  const applyGeo = useCallback(async (next: ProsGeo, opts?: { persist?: boolean; radius?: number }) => {
    setGeo(next);
    const r = opts?.radius ?? radiusKm;
    if (opts?.persist !== false) {
      await persistProsLocation(profile?.id, next, r);
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
      const result = await detectProsLocation();
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
        text2: `Showing pros near ${result.geo.city}.`,
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

  const handleChangeRadius = useCallback(async (km: ProRadiusKm | number) => {
    setRadiusKm(km);
    if (geo) {
      await persistProsLocation(profile?.id, geo, km);
      updateLocalProfile({ radius_km: km });
    }
  }, [geo, profile?.id, updateLocalProfile]);

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

  const loadServices = useCallback(async (isRefresh = false) => {
    if (!geo) {
      setServices([]);
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    const { category, subcategory } = parseProsFilter(
      subFilter && (filter === 'other' || filter.startsWith('other'))
        ? `other:${subFilter}`
        : filter,
    );
    try {
      const data = await fetchNearbyPros({
        lat: geo.lat,
        lng: geo.lng,
        radiusKm,
        category,
        subcategory,
      });
      setServices(data ?? []);
    } catch (e) {
      console.error(e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [geo, filter, subFilter, radiusKm]);

  const refreshServices = useCallback(async () => {
    await loadServices(true);
  }, [loadServices]);

  const { refreshControl, scrollHandlers } = useScreenRefresh(refreshServices);

  useEffect(() => { void loadServices(); }, [loadServices]);

  useEffect(() => {
    if (profile?.role === 'service_provider') {
      touchServiceProviderActivity(profile.id).catch(() => {});
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    const channelId = `pros-presence-${profile?.id ?? 'anon'}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_providers' }, payload => {
        const row = payload.new as ServiceProvider;
        setServices(prev => prev.map(item => (item.id === row.id ? { ...item, ...row } : item)));
        setSelected(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setChatPro(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setRequestPro(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const handleFilterSelect = (next: string) => {
    setFilter(next);
    setSubFilter(null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services.filter(svc => {
      if (subFilter && filter !== 'all' && !(filter === 'other' || filter.startsWith('other'))) {
        if (!matchesSubcategoryChip(svc, subFilter)) return false;
      }
      if (!q) return true;
      return (
        svc.business_name.toLowerCase().includes(q)
        || svc.category.toLowerCase().includes(q)
        || (svc.subcategory ?? '').toLowerCase().includes(q)
        || svc.description.toLowerCase().includes(q)
      );
    });
  }, [services, search, subFilter, filter]);

  const listHeader = (
    <View style={s.headerBody}>
      <ProsFilterBar
        filter={filter}
        subFilter={subFilter}
        radiusKm={radiusKm}
        viewMode={viewMode}
        search={search}
        searchFocused={searchFocused}
        onChangeFilter={handleFilterSelect}
        onChangeSubFilter={setSubFilter}
        onChangeRadius={km => { void handleChangeRadius(km); }}
        onChangeViewMode={setViewMode}
        onChangeSearch={setSearch}
        onSearchFocus={setSearchFocused}
      />
    </View>
  );

  const handleProviderUpdate = (updated: ServiceProvider) => {
    setServices(prev => prev.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected(prev => (prev?.id === updated.id ? updated : prev));
  };

  return (
    <View style={s.root}>
      <LocationBar
        city={geo?.city || profile?.city || ''}
        radiusKm={radiusKm}
        detecting={detecting}
        hasLocation={hasLocation}
        onDetectLocation={() => { void handleDetectLocation(); }}
        onSelectCity={city => { void handleSelectCity(city); }}
        onChangeRadius={km => { void handleChangeRadius(km); }}
      />

      {!hasLocation ? null : viewMode === 'map' ? (
        <View style={s.body}>
          {listHeader}
          {loading && !services.length ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
          ) : (
            <ProsMapView
              pros={filtered}
              userLat={geo?.lat}
              userLng={geo?.lng}
              selectedId={mapSelectedId}
              onSelectedIdChange={setMapSelectedId}
              onSelectPro={setSelected}
            />
          )}
        </View>
      ) : loading && !services.length ? (
        <View style={s.body}>
          {listHeader}
          <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
        </View>
      ) : hasLocation ? (
        <FlashList
          data={filtered}
          estimatedItemSize={260}
          keyExtractor={item => item.id}
          {...scrollHandlers}
          refreshControl={refreshControl}
          ListHeaderComponent={listHeader}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          renderItem={({ item }) => (
            <ServiceCard
              svc={item}
              currentUserId={profile?.id}
              onSelect={setSelected}
              onChat={setChatPro}
              onRequest={setRequestPro}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <CategoryIcon id="plumber" size={32} color={Colors.orange} />
              </View>
              <Text style={s.emptyTitle}>No pros nearby</Text>
              <Text style={s.emptyText}>
                Try another category or increase your search radius.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      ) : null}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            {selected && profile ? (
              <ServiceDetail
                svc={selected}
                userId={profile.id}
                onClose={() => setSelected(null)}
                onProviderUpdate={handleProviderUpdate}
                onChat={pro => { setSelected(null); setChatPro(pro); }}
                onRequest={pro => { setRequestPro(pro); }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {chatPro && profile ? (
        <ProChatDrawer pro={chatPro} userId={profile.id} onClose={() => setChatPro(null)} />
      ) : null}

      {profile ? (
        <RequestServiceModal
          visible={!!requestPro}
          pro={requestPro}
          buyerId={profile.id}
          buyerName={profile.name}
          onClose={() => setRequestPro(null)}
        />
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1 },
  headerBody: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.bg,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 88 },
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 20,
  },
  empty: { alignItems: 'center', paddingTop: 72, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: `${Colors.orange}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.dim,
    fontSize: 13,
    fontFamily: Fonts.body,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
}));
