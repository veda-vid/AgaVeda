// app/(tabs)/deals.tsx — Discounted products
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { getDiscountedProducts } from '../../lib/api';
import { Colors } from '../../constants/theme';

export default function DealsScreen() {
  const profile = useAuthStore(s => s.profile);
  const [items,     setItems]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [filter,    setFilter]    = useState('all');

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    getDiscountedProducts(profile.lat ?? 19.076, profile.lng ?? 72.877, profile.radius_km ?? 5)
      .then(data => { if (!cancelled) setItems(data ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km]);

  const onRefresh = () => {
    if (!profile) return;
    setRefreshing(true);
    getDiscountedProducts(profile.lat ?? 19.076, profile.lng ?? 72.877, profile.radius_km ?? 5)
      .then(setItems)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const pctGroups = ['all', '20+', '30+', '40+', '50+'];
  const filtered = filter === 'all' ? items : items.filter(i => i.discount_pct >= parseInt(filter));

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.imgBox}>
          <Text style={{ fontSize: 40 }}>{item.images?.[0] ? '📦' : '🏷️'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.shopName}>by {item.shop_name}</Text>
          <Text style={s.shopCity}>📍 {item.shop_city} · {item.distance_km?.toFixed(1)} km</Text>
          <View style={s.priceRow}>
            <Text style={s.priceNew}>₹{item.discounted_price?.toFixed(0)}</Text>
            <Text style={s.priceOld}>₹{item.price}</Text>
            <View style={s.badge}><Text style={s.badgeText}>{item.discount_pct}% OFF</Text></View>
          </View>
        </View>
      </View>
      <View style={s.cardBottom}>
        <TouchableOpacity style={s.grabBtn}>
          <Text style={s.grabBtnText}>Grab Deal →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Text style={{ fontSize: 22 }}>🔥</Text>
          <Text style={s.title}>Hot Deals</Text>
          <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View>
        </View>
        <Text style={s.sub}>Exclusive discounts from local shops near you</Text>

        {/* Filter chips */}
        <View style={s.filtersRow}>
          {pctGroups.map(g => (
            <TouchableOpacity key={g} onPress={() => setFilter(g)} style={[s.chip, filter === g && s.chipActive]}>
              <Text style={[s.chipText, filter === g && { color: Colors.white }]}>{g === 'all' ? 'All' : `${g} off`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Flash banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>⚡ Flash Sale — Up to 50% OFF</Text>
        <Text style={s.bannerSub}>Limited stock. Grab before it's gone!</Text>
      </View>

      {loading
        ? <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
        : <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>🏷️</Text>
                <Text style={{ color: Colors.sub, fontSize: 16 }}>No deals right now</Text>
                <Text style={{ color: Colors.dim, fontSize: 13 }}>Pull down to refresh</Text>
              </View>
            }
          />
      }
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  header:      { backgroundColor: Colors.bg, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:       { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub:         { fontSize: 13, color: Colors.sub, marginBottom: 14 },
  liveBadge:   { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  liveText:    { fontSize: 9, color: Colors.white, fontWeight: '800', letterSpacing: 1 },
  filtersRow:  { flexDirection: 'row', gap: 8 },
  chip:        { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive:  { backgroundColor: Colors.red, borderColor: Colors.red },
  chipText:    { fontSize: 12, fontWeight: '600', color: Colors.sub },
  banner:      { backgroundColor: '#1a0800', borderBottomWidth: 1, borderBottomColor: Colors.orange + '33', padding: 16 },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: Colors.amber },
  bannerSub:   { fontSize: 12, color: Colors.sub, marginTop: 3 },
  card:        { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 18, overflow: 'hidden' },
  cardTop:     { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start' },
  imgBox:      { width: 72, height: 72, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  itemTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  shopName:    { fontSize: 12, color: Colors.sub, marginBottom: 2 },
  shopCity:    { fontSize: 11, color: Colors.dim, marginBottom: 8 },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceNew:    { fontSize: 20, fontWeight: '800', color: Colors.orange },
  priceOld:    { fontSize: 13, color: Colors.dim, textDecorationLine: 'line-through' },
  badge:       { backgroundColor: Colors.red + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.red + '44' },
  badgeText:   { fontSize: 10, color: Colors.red, fontWeight: '700' },
  cardBottom:  { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  grabBtn:     { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  grabBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
