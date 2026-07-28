// app/(tabs)/shops.tsx — Shops discovery screen
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Linking, StyleSheet, Dimensions } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { getShopsNearby, getReviews, addReview, getProductsByShop } from '../../lib/api';
import { Colors, SHOP_CATEGORIES } from '../../constants/theme';
import type { Shop } from '../../types';

function ShopCard({ shop, onSelect, isBuyer }: { shop: Shop; onSelect: (s: Shop) => void; isBuyer: boolean }) {
  const { followedShopIds, toggleFollowedShop } = useAuthStore();
  const [following, setFollowing] = useState(followedShopIds.includes(shop.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFollowing(followedShopIds.includes(shop.id));
  }, [followedShopIds, shop.id]);

  const handleFollow = async () => {
    if (!isBuyer || busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      await toggleFollowedShop(shop.id, shop.name);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity onPress={() => onSelect(shop)} activeOpacity={0.85} style={s.card}>
      <View style={s.cardLeft}>
        <View style={s.logoWrap}>
          <Text style={s.logoEmoji}>{shop.logo_url ?? '🏪'}</Text>
          <View style={[s.statusDot, { backgroundColor: shop.is_open ? Colors.green : Colors.dim }]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Text style={s.shopName} numberOfLines={1}>{shop.name}</Text>
            {shop.is_verified && <Text style={{ fontSize: 12 }}>✅</Text>}
          </View>
          <Text style={s.shopMeta}>{shop.category} · {shop.total_products} items · {shop.distance_km?.toFixed(1)} km</Text>
          <Text style={s.rating}>⭐ {shop.avg_rating.toFixed(1)} <Text style={s.ratingCount}>({shop.total_reviews})</Text></Text>
          <Text style={s.desc} numberOfLines={2}>{shop.description}</Text>
        </View>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity onPress={() => onSelect(shop)} style={s.actionBtn}>
          <Text style={s.actionBtnText}>👁 View</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${shop.phone}`)} style={s.actionBtn}>
          <Text style={s.actionBtnText}>📞 Call</Text>
        </TouchableOpacity>
        {isBuyer && (
          <TouchableOpacity onPress={handleFollow} style={[s.actionBtn, following && s.followingBtn]} disabled={busy}>
            <Text style={[s.actionBtnText, following && { color: Colors.orange }]}>{following ? '✓ Following' : '＋ Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ShopDetail({ shop, userId, isBuyer }: { shop: Shop; userId: string; isBuyer: boolean }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addItem } = useCartStore();
  const { addNotification } = useAuthStore();

  useEffect(() => {
    getReviews(shop.id, 'shop').then(setReviews).catch(console.error);
    getProductsByShop(shop.id).then(setProducts).catch(console.error);
  }, [shop.id]);

  const submitReview = async () => {
    if (!myComment.trim()) return;
    setPosting(true);
    try {
      const review = await addReview({ reviewer_id: userId, target_id: shop.id, target_type: 'shop', rating: myRating, comment: myComment.trim() });
      setReviews(prev => [review, ...prev]);
      setMyComment('');
      setSubmitted(true);
    } catch (e) { console.error(e); }
    finally { setPosting(false); }
  };

  const addProduct = async (productId: string) => {
    try {
      await addItem(userId, productId, shop.id, 1);
      addNotification(`Added from ${shop.name}`);
    } catch (e) { console.error(e); }
  };

  return (
    <View style={d.root}>
      <View style={d.handle} />
      <Text style={d.shopName}>{shop.name}</Text>
      <View style={d.row}>
        <View style={d.logoWrap}><Text style={{ fontSize: 40 }}>{shop.logo_url ?? '🏪'}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={d.rating}>⭐ {shop.avg_rating.toFixed(1)}  ({shop.total_reviews} reviews)</Text>
          <Text style={d.meta}>{shop.category} · {shop.distance_km?.toFixed(1)} km · {shop.is_open ? '🟢 Open' : '🔴 Closed'}</Text>
          <Text style={d.meta}>{shop.address}</Text>
        </View>
      </View>
      <Text style={d.desc}>{shop.description}</Text>
      <View style={d.statsRow}>
        {[[shop.total_products+'','Products'],[shop.total_followers+'','Followers'],[shop.avg_rating.toFixed(1),'Avg Rating']].map(([v,l])=>(
          <View key={l} style={d.stat}>
            <Text style={d.statVal}>{v}</Text>
            <Text style={d.statLabel}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <TouchableOpacity style={d.ctaBtn} onPress={() => Linking.openURL(`tel:${shop.phone}`)}>
          <Text style={d.ctaBtnText}>📞 Call Shop</Text>
        </TouchableOpacity>
        {shop.whatsapp && (
          <TouchableOpacity style={[d.ctaBtn, { backgroundColor: Colors.green + '22', borderColor: Colors.green + '44' }]}
            onPress={() => Linking.openURL(`https://wa.me/${shop.whatsapp}`)}>
            <Text style={[d.ctaBtnText, { color: Colors.green }]}>💬 WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>

      {isBuyer && products.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={d.reviewsTitle}>Products</Text>
          {products.slice(0, 6).map((p: any) => (
            <View key={p.id} style={d.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={d.productTitle}>{p.title}</Text>
                <Text style={d.productPrice}>₹{Number(p.discounted_price ?? p.price).toFixed(0)}</Text>
              </View>
              <TouchableOpacity style={d.addBtn} onPress={() => addProduct(p.id)}>
                <Text style={d.addBtnText}>🛒 Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {isBuyer && !submitted && (
        <View style={d.reviewForm}>
          <Text style={d.reviewsTitle}>Leave a Review</Text>
          <View style={d.starsRow}>
            {[1,2,3,4,5].map(n => (
              <TouchableOpacity key={n} onPress={() => setMyRating(n)}>
                <Text style={{ fontSize: 24, color: n <= myRating ? Colors.amber : Colors.border2 }}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={myComment} onChangeText={setMyComment} multiline numberOfLines={3} placeholder="Share your experience" placeholderTextColor={Colors.dim} style={d.reviewInput} />
          <TouchableOpacity onPress={submitReview} disabled={posting} style={d.submitBtn}>
            <Text style={d.submitBtnText}>{posting ? 'Posting…' : 'Submit Review'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {reviews.length > 0 && (
        <>
          <Text style={d.reviewsTitle}>Recent Reviews</Text>
          {reviews.slice(0, 3).map(r => (
            <View key={r.id} style={d.review}>
              <Text style={d.reviewRating}>{'⭐'.repeat(r.rating)}</Text>
              <Text style={d.reviewText}>{r.comment}</Text>
              <Text style={d.reviewMeta}>{r.reviewer?.name ?? 'User'} · {timeAgo(r.created_at)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export default function ShopsScreen() {
  const profile = useAuthStore(s => s.profile);
  const [shops, setShops] = useState<Shop[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Shop | null>(null);
  const isBuyer = profile?.role === 'buyer';

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    getShopsNearby(
      profile.lat ?? 19.076,
      profile.lng ?? 72.877,
      profile.radius_km ?? 5,
      filter === 'all' ? undefined : filter,
    )
      .then(data => { if (!cancelled) setShops(data ?? []); })
      .catch(e => { console.error(e); if (!cancelled) setShops([]); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, filter]);

  const onRefresh = () => {
    if (!profile) return;
    setRefreshing(true);
    getShopsNearby(profile.lat ?? 19.076, profile.lng ?? 72.877, profile.radius_km ?? 5, filter === 'all' ? undefined : filter)
      .then(setShops)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>{isBuyer ? 'Discover & Follow' : 'Local Shops'}</Text>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search shops…" placeholderTextColor={Colors.dim} />
        </View>
        <FlatList
          data={[{ id: 'all', label: 'All', emoji: '🏬' }, ...SHOP_CATEGORIES]}
          horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setFilter(item.id)} style={[s.filterChip, filter === item.id && s.filterActive]}>
              <Text style={s.filterText}>{(item as any).emoji} {item.label}</Text>
            </TouchableOpacity>
          )}
          style={s.filters}
        />
      </View>

      {loading
        ? <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
        : <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (<ShopCard shop={item} onSelect={setSelected} isBuyer={!!isBuyer} />)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
      }

      {selected && (
        <TouchableOpacity onPress={() => setSelected(null)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <ShopDetail shop={selected} userId={profile!.id} isBuyer={!!isBuyer} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

function timeAgo(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
  return `${Math.floor(sec/86400)}d ago`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.bg, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 24, paddingHorizontal: 14, marginBottom: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  filters: { marginBottom: 12 },
  filterChip: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  filterActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 18, padding: 16, gap: 14 },
  cardLeft: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  logoWrap: { width: 62, height: 62, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoEmoji: { fontSize: 30 },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.bg },
  shopName: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  shopMeta: { fontSize: 12, color: Colors.sub, marginBottom: 4 },
  rating: { fontSize: 12, color: Colors.amber, marginBottom: 4 },
  ratingCount: { color: Colors.dim },
  desc: { fontSize: 12, color: Colors.sub, lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  followingBtn: { borderColor: Colors.orange + '44', backgroundColor: Colors.orange + '11' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, maxHeight: '80%' },
});

const d = StyleSheet.create({
  root: { gap: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 12 },
  shopName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginVertical: 8 },
  logoWrap: { width: 68, height: 68, borderRadius: 18, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  rating: { fontSize: 14, color: Colors.amber, fontWeight: '600' },
  meta: { fontSize: 13, color: Colors.sub },
  desc: { fontSize: 14, color: Colors.sub, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: Colors.orange },
  statLabel: { fontSize: 10, color: Colors.sub, marginTop: 2 },
  ctaBtn: { flex: 1, backgroundColor: Colors.orange + '22', borderWidth: 1, borderColor: Colors.orange + '44', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaBtnText: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
  reviewsTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  reviewForm: { backgroundColor: Colors.bg, borderRadius: 14, padding: 12, marginTop: 12 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  reviewInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  submitBtnText: { color: Colors.white, fontWeight: '700' },
  review: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, gap: 4, marginBottom: 8 },
  reviewRating: { fontSize: 12 },
  reviewText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  reviewMeta: { fontSize: 11, color: Colors.dim },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  productTitle: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  productPrice: { color: Colors.amber, fontWeight: '700', marginTop: 2 },
  addBtn: { backgroundColor: Colors.orange + '22', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.orange + '44' },
  addBtnText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },
});
