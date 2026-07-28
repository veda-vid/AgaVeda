// app/(tabs)/services.tsx
import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Linking, ScrollView, StyleSheet,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { getServicesNearby, getReviews, addReview } from '../../lib/api';
import { Colors, SERVICE_CATEGORIES } from '../../constants/theme';
import type { ServiceProvider } from '../../types';

const CAT_ICONS: Record<string, string> = {
  plumber: '🔧', electrician: '⚡', ac_technician: '❄️',
  painter: '🖌️', cleaning: '🧹', gardening: '🌿',
  security: '🔒', carpenter: '🪚', pest_control: '🐛', other: '🛠️',
};

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <Text style={{ fontSize: size, color: Colors.amber }}>
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
      <Text style={{ color: Colors.sub, fontSize: size - 2 }}> {rating.toFixed(1)}</Text>
    </Text>
  );
}

function ServiceCard({ svc, onSelect }: { svc: ServiceProvider; onSelect: (s: ServiceProvider) => void }) {
  return (
    <TouchableOpacity onPress={() => onSelect(svc)} activeOpacity={0.85} style={s.card}>
      <View style={s.cardTop}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarEmoji}>{CAT_ICONS[svc.category] ?? '🛠️'}</Text>
          {svc.is_available && <View style={s.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{svc.business_name}</Text>
            {svc.is_verified && <Text style={{ fontSize: 13 }}>✅</Text>}
            <View style={[s.availBadge, { backgroundColor: svc.is_available ? Colors.green + '22' : Colors.dim + '22' }]}>
              <Text style={[s.availText, { color: svc.is_available ? Colors.green : Colors.dim }]}>
                {svc.is_available ? 'Available' : 'Busy'}
              </Text>
            </View>
          </View>
          <Text style={s.catText}>{SERVICE_CATEGORIES.find(c => c.id === svc.category)?.label ?? svc.category} · {svc.experience_years} yrs exp · {svc.total_jobs} jobs</Text>
          <StarRow rating={svc.avg_rating} />
          <Text style={s.reviewCount}>({svc.total_reviews} reviews)</Text>
          <Text style={s.area}>📍 {svc.area_served}</Text>
        </View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${svc.phone}`)}>
          <Text style={s.callBtnText}>📞 Call Now</Text>
        </TouchableOpacity>
        {svc.whatsapp ? (
          <TouchableOpacity style={s.waBtn} onPress={() => Linking.openURL(`https://wa.me/${svc.whatsapp}`)}>
            <Text style={s.waBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.reviewBtn} onPress={() => onSelect(svc)}>
            <Text style={s.reviewBtnText}>⭐ Reviews</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ServiceDetail({ svc, userId, onClose }: { svc: ServiceProvider; userId: string; onClose: () => void }) {
  const [reviews,   setReviews]   = useState<any[]>([]);
  const [myRating,  setMyRating]  = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting,   setPosting]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getReviews(svc.id, 'service_provider').then(setReviews).catch(console.error);
  }, [svc.id]);

  const submitReview = async () => {
    if (!myComment.trim()) return;
    setPosting(true);
    try {
      const r = await addReview({ reviewer_id: userId, target_id: svc.id, target_type: 'service_provider', rating: myRating, comment: myComment.trim() });
      setReviews(prev => [r, ...prev]);
      setMyComment(''); setSubmitted(true);
    } catch (e: any) { console.error(e); }
    finally { setPosting(false); }
  };

  return (
    <ScrollView style={d.root} showsVerticalScrollIndicator={false}>
      <View style={d.handle} />
      {/* Header */}
      <View style={d.header}>
        <View style={d.bigAvatar}><Text style={{ fontSize: 44 }}>{CAT_ICONS[svc.category] ?? '🛠️'}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={d.name}>{svc.business_name}</Text>
          <Text style={d.catLabel}>{SERVICE_CATEGORIES.find(c => c.id === svc.category)?.label}</Text>
          <StarRow rating={svc.avg_rating} size={15} />
          <Text style={d.meta}>{svc.total_reviews} reviews · {svc.experience_years} yrs experience · {svc.total_jobs} jobs done</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={d.statsRow}>
        {[[svc.avg_rating.toFixed(1), 'Rating'], [svc.total_jobs + '', 'Jobs'], [svc.experience_years + 'yr', 'Experience']].map(([v, l]) => (
          <View key={l} style={d.stat}>
            <Text style={d.statVal}>{v}</Text>
            <Text style={d.statLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Description */}
      {svc.description ? <Text style={d.desc}>{svc.description}</Text> : null}
      <Text style={d.area}>📍 Serves: {svc.area_served}</Text>

      {/* Contact buttons */}
      <View style={d.ctaRow}>
        <TouchableOpacity style={d.callBtn} onPress={() => Linking.openURL(`tel:${svc.phone}`)}>
          <Text style={d.callBtnText}>📞 Call Now</Text>
        </TouchableOpacity>
        {svc.whatsapp && (
          <TouchableOpacity style={d.waBtn} onPress={() => Linking.openURL(`https://wa.me/${svc.whatsapp}`)}>
            <Text style={d.waBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Write review */}
      {!submitted && (
        <View style={d.reviewForm}>
          <Text style={d.sectionTitle}>Write a Review</Text>
          <View style={d.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setMyRating(n)}>
                <Text style={{ fontSize: 28, color: n <= myRating ? Colors.amber : Colors.border2 }}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={myComment} onChangeText={setMyComment}
            placeholder="Share your experience…" placeholderTextColor={Colors.dim}
            multiline numberOfLines={3}
            style={d.reviewInput}
          />
          <TouchableOpacity onPress={submitReview} disabled={posting} style={d.submitBtn}>
            <Text style={d.submitBtnText}>{posting ? 'Posting…' : 'Submit Review'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {submitted && (
        <View style={d.successBox}>
          <Text style={d.successText}>✅ Review submitted! Thank you.</Text>
        </View>
      )}

      {/* Reviews list */}
      <Text style={d.sectionTitle}>Reviews ({reviews.length})</Text>
      {reviews.length === 0
        ? <Text style={d.noReviews}>No reviews yet. Be the first!</Text>
        : reviews.map(r => (
            <View key={r.id} style={d.reviewCard}>
              <View style={d.reviewHeader}>
                <Text style={d.reviewUser}>{r.reviewer?.name ?? 'User'}</Text>
                <Text style={{ color: Colors.amber }}>{'★'.repeat(r.rating)}</Text>
              </View>
              <Text style={d.reviewText}>{r.comment}</Text>
            </View>
          ))
      }
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function ServicesScreen() {
  const profile = useAuthStore(s => s.profile);
  const [services,  setServices]  = useState<ServiceProvider[]>([]);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [selected,  setSelected]  = useState<ServiceProvider | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    getServicesNearby(
      profile.lat ?? 19.076,
      profile.lng ?? 72.877,
      profile.radius_km ?? 5,
      filter === 'all' ? undefined : filter,
    )
      .then(data => { if (!cancelled) setServices(data ?? []); })
      .catch(e => { console.error(e); if (!cancelled) setServices([]); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, filter]);

  const onRefresh = () => {
    if (!profile) return;
    setRefreshing(true);
    getServicesNearby(profile.lat ?? 19.076, profile.lng ?? 72.877, profile.radius_km ?? 5, filter === 'all' ? undefined : filter)
      .then(setServices)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const filtered = services.filter(s =>
    s.business_name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Local Services</Text>
        <Text style={s.sub}>Verified professionals · Rated by your neighbours</Text>

        <View style={s.searchWrap}>
          <Text>🔍 </Text>
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search plumber, electrician…" placeholderTextColor={Colors.dim} />
        </View>

        <FlatList
          data={[{ id: 'all', label: 'All', emoji: '🛠️' }, ...SERVICE_CATEGORIES]}
          horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setFilter(item.id)} style={[s.chip, filter === item.id && s.chipActive]}>
              <Text style={[s.chipText, filter === item.id && { color: Colors.white }]}>
                {(item as any).emoji} {item.label}
              </Text>
            </TouchableOpacity>
          )}
          style={{ marginBottom: 4 }}
        />
      </View>

      {loading
        ? <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
        : <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <ServiceCard svc={item} onSelect={setSelected} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={6}
            windowSize={7}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>🔧</Text>
                <Text style={{ color: Colors.sub, fontSize: 16 }}>No services found nearby</Text>
                <Text style={{ color: Colors.dim, fontSize: 13 }}>Try increasing your radius in Profile</Text>
              </View>
            }
          />
      }

      {selected && (
        <TouchableOpacity onPress={() => setSelected(null)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <ServiceDetail svc={selected} userId={profile!.id} onClose={() => setSelected(null)} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  header:      { backgroundColor: Colors.bg, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:       { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  sub:         { fontSize: 13, color: Colors.sub, marginBottom: 14 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 24, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  chip:        { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  chipActive:  { backgroundColor: Colors.purple, borderColor: Colors.purple },
  chipText:    { fontSize: 12, fontWeight: '600', color: Colors.sub },
  card:        { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 18, padding: 16, gap: 14 },
  cardTop:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap:  { width: 58, height: 58, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarEmoji: { fontSize: 28 },
  onlineDot:   { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: 7, backgroundColor: Colors.green, borderWidth: 2, borderColor: Colors.bg },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  name:        { fontSize: 15, fontWeight: '700', color: Colors.text },
  availBadge:  { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  availText:   { fontSize: 10, fontWeight: '700' },
  catText:     { fontSize: 12, color: Colors.purple, fontWeight: '600', marginBottom: 3 },
  reviewCount: { fontSize: 11, color: Colors.dim },
  area:        { fontSize: 11, color: Colors.sub, marginTop: 3 },
  actions:     { flexDirection: 'row', gap: 8 },
  callBtn:     { flex: 1, backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '44', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callBtnText: { color: Colors.green, fontWeight: '700', fontSize: 13 },
  waBtn:       { flex: 1, backgroundColor: Colors.blue + '22', borderWidth: 1, borderColor: Colors.blue + '44', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  waBtnText:   { color: Colors.blue, fontWeight: '700', fontSize: 13 },
  reviewBtn:   { flex: 1, backgroundColor: Colors.amber + '22', borderWidth: 1, borderColor: Colors.amber + '44', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reviewBtnText:{ color: Colors.amber, fontWeight: '700', fontSize: 13 },
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.surface, borderRadius: 24, maxHeight: '90%', padding: 20 },
});

const d = StyleSheet.create({
  root:        { },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  header:      { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16 },
  bigAvatar:   { width: 70, height: 70, borderRadius: 18, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  name:        { fontSize: 20, fontWeight: '800', color: Colors.text },
  catLabel:    { fontSize: 13, color: Colors.purple, fontWeight: '600' },
  meta:        { fontSize: 12, color: Colors.sub },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  stat:        { flex: 1, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, alignItems: 'center' },
  statVal:     { fontSize: 20, fontWeight: '800', color: Colors.orange },
  statLabel:   { fontSize: 10, color: Colors.sub, marginTop: 2 },
  desc:        { fontSize: 14, color: Colors.sub, lineHeight: 20, marginBottom: 8 },
  area:        { fontSize: 13, color: Colors.sub, marginBottom: 16 },
  ctaRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  callBtn:     { flex: 1, backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '44', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  callBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  waBtn:       { flex: 1, backgroundColor: Colors.blue + '22', borderWidth: 1, borderColor: Colors.blue + '44', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  waBtnText:   { color: Colors.blue, fontWeight: '700', fontSize: 14 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  reviewForm:  { backgroundColor: Colors.bg, borderRadius: 14, padding: 16, marginBottom: 16 },
  starsRow:    { flexDirection: 'row', gap: 6, marginBottom: 12 },
  reviewInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.text, fontSize: 14, minHeight: 80, marginBottom: 12, textAlignVertical: 'top' },
  submitBtn:   { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  submitBtnText:{ color: Colors.white, fontWeight: '700', fontSize: 14 },
  successBox:  { backgroundColor: Colors.green + '22', borderRadius: 12, padding: 14, marginBottom: 16 },
  successText: { color: Colors.green, fontWeight: '600', textAlign: 'center' },
  noReviews:   { color: Colors.dim, textAlign: 'center', paddingVertical: 20 },
  reviewCard:  { backgroundColor: Colors.bg, borderRadius: 12, padding: 12, marginBottom: 10 },
  reviewHeader:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewUser:  { fontWeight: '700', color: Colors.text, fontSize: 13 },
  reviewText:  { fontSize: 13, color: Colors.sub, lineHeight: 18 },
});
