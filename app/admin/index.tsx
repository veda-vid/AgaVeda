// app/admin/index.tsx — Super admin dashboard
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Pressable, TextInput, Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  adminListCityNews,
  createCityNews,
  updateCityNews,
  setCityNewsPublished,
  adminListProfiles,
  adminSetProfileSuspended,
  adminListShops,
  adminSetShopsActiveByOwner,
} from '../../lib/api';
import { Colors, createDynamicStyles } from '../../constants/theme';
import type { CityNews, CityNewsCategory, Profile, Shop } from '../../types';

const CATEGORIES: CityNewsCategory[] = ['event', 'rates', 'weather', 'alerts', 'general'];

function catLabel(c: CityNewsCategory) {
  return c === 'general' ? 'General' : c.charAt(0).toUpperCase() + c.slice(1);
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);

  const [loading, setLoading] = useState(true);

  const [news, setNews] = useState<CityNews[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newsCity, setNewsCity] = useState('');
  const [newsCategory, setNewsCategory] = useState<CityNewsCategory>('general');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [newsImageUrl, setNewsImageUrl] = useState<string>('');
  const [newsSourceUrl, setNewsSourceUrl] = useState<string>('');
  const [newsPublished, setNewsPublished] = useState(false);

  const safeRefresh = async () => {
    setLoading(true);
    try {
      const [n, p, s] = await Promise.all([
        adminListCityNews(80),
        adminListProfiles(60),
        adminListShops(60),
      ]);
      setNews((n ?? []) as CityNews[]);
      setProfiles((p ?? []) as Profile[]);
      setShops((s ?? []) as Shop[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'super_admin') {
      router.replace('/admin/login' as any);
      return;
    }
    setNewsCity(profile.city || '');
    safeRefresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  const openCreate = () => {
    setEditingId(null);
    setNewsCity(profile?.city || '');
    setNewsCategory('general');
    setNewsTitle('');
    setNewsBody('');
    setNewsImageUrl('');
    setNewsSourceUrl('');
    setNewsPublished(false);
    setNewsModalOpen(true);
  };

  const openEdit = (item: CityNews) => {
    setEditingId(item.id);
    setNewsCity(item.city);
    setNewsCategory(item.category);
    setNewsTitle(item.title);
    setNewsBody(item.body);
    setNewsImageUrl(item.image_url ?? '');
    setNewsSourceUrl(item.source_url ?? '');
    setNewsPublished(!!item.is_published);
    setNewsModalOpen(true);
  };

  const saveNews = async () => {
    if (!newsCity.trim() || !newsTitle.trim()) {
      Alert.alert('Missing fields', 'City and title are required.');
      return;
    }
    try {
      if (editingId) {
        await updateCityNews(editingId, {
          city: newsCity.trim(),
          category: newsCategory,
          title: newsTitle.trim(),
          body: newsBody,
          image_url: newsImageUrl.trim() ? newsImageUrl.trim() : null,
          source_url: newsSourceUrl.trim() ? newsSourceUrl.trim() : null,
          is_published: newsPublished,
        });
      } else {
        await createCityNews({
          city: newsCity.trim(),
          category: newsCategory,
          title: newsTitle.trim(),
          body: newsBody,
          image_url: newsImageUrl.trim() ? newsImageUrl.trim() : null,
          source_url: newsSourceUrl.trim() ? newsSourceUrl.trim() : null,
          is_published: newsPublished,
          author_id: profile?.id ?? null,
        });
      }
      setNewsModalOpen(false);
      await safeRefresh();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again.');
    }
  };

  const toggleNewsPublished = async (item: CityNews) => {
    try {
      await setCityNewsPublished(item.id, !item.is_published);
      await safeRefresh();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Try again.');
    }
  };

  const toggleUserSuspended = async (p: Profile) => {
    try {
      const next = !p.is_suspended;
      await adminSetProfileSuspended(p.id, next);
      // Make their shops inactive too so their content disappears
      await adminSetShopsActiveByOwner(p.id, !next);
      await safeRefresh();
    } catch (e: any) {
      Alert.alert('Restriction failed', e?.message || 'Try again.');
    }
  };

  if (!profile) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Super Admin Dashboard</Text>
            <Text style={s.sub}>City Newspaper + Moderation</Text>
          </View>
          <TouchableOpacity onPress={() => { signOut().catch(() => {}); router.replace('/admin/login' as any); }} style={s.logoutBtn}>
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>City News</Text>
            <TouchableOpacity onPress={openCreate} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>New</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={news}
            keyExtractor={i => i.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <View style={s.newsCard}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.newsMeta}>{item.city} · {catLabel(item.category)}</Text>
                  <Text style={s.newsTitle}>{item.title}</Text>
                  <Text style={s.newsBody} numberOfLines={3}>{item.body}</Text>
                  <Text style={s.newsMeta}>{item.is_published ? 'Published' : 'Draft'}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={() => toggleNewsPublished(item)} style={s.btn}>
                    <Text style={s.btnText}>{item.is_published ? 'Unpublish' : 'Publish'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={s.btnSecondary}>
                    <Text style={s.btnSecondaryText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>User Restrictions</Text>
          <Text style={s.sectionHint}>Suspending a user also deactivates their shops (hides their content).</Text>
          <FlatList
            data={profiles}
            keyExtractor={i => i.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <View style={s.newsCard}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.newsMeta}>{item.name} · {item.role}</Text>
                  <Text style={s.newsMeta}>{item.city} {item.is_suspended ? '· Suspended' : ''}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={() => toggleUserSuspended(item)} style={[s.btn, item.is_suspended && { backgroundColor: Colors.card }]}>
                    <Text style={[s.btnText, item.is_suspended && { color: Colors.orange }]}>{item.is_suspended ? 'Unsuspend' : 'Suspend'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={newsModalOpen} animationType="slide" onRequestClose={() => setNewsModalOpen(false)} transparent>
        <Pressable style={s.modalBackdrop} onPress={() => setNewsModalOpen(false)} />
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>{editingId ? 'Edit City News' : 'New City News'}</Text>

          <TextInput value={newsCity} onChangeText={setNewsCity} placeholder="City (e.g. Chandigarh)" style={s.input} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={newsTitle} onChangeText={setNewsTitle} placeholder="Title" style={[s.input, { flex: 1 }]} />
          </View>

          <TextInput
            value={newsBody}
            onChangeText={setNewsBody}
            placeholder="Body (short article)"
            style={[s.input, { minHeight: 90 }]}
            multiline
          />

          <TextInput value={newsImageUrl} onChangeText={setNewsImageUrl} placeholder="Image URL (optional)" style={s.input} />
          <TextInput value={newsSourceUrl} onChangeText={setNewsSourceUrl} placeholder="Source URL (optional)" style={s.input} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setNewsCategory(prev => {
              const idx = CATEGORIES.indexOf(newsCategory);
              const next = CATEGORIES[(idx + 1) % CATEGORIES.length];
              return next;
            })} style={s.chip}>
              <Text style={s.chipText}>Category: {catLabel(newsCategory)}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setNewsPublished(v => !v)} style={[s.primaryBtn, { backgroundColor: newsPublished ? Colors.orange : Colors.card, borderWidth: 1, borderColor: Colors.border2 }]}>
            <Text style={[s.primaryBtnText, { color: newsPublished ? Colors.white : Colors.sub }]}>
              {newsPublished ? 'Published: ON' : 'Published: OFF'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setNewsModalOpen(false)} style={[s.btnSecondary, { flex: 1 }]}>
              <Text style={s.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveNews} style={[s.primaryBtn, { flex: 1 }]}>
              <Text style={s.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.text },
  sub: { color: Colors.sub, fontSize: 13, marginTop: 4 },
  logoutBtn: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: Colors.sub, fontWeight: '800' },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  sectionHint: { fontSize: 12, color: Colors.dim, marginTop: 6, marginBottom: 12 },
  newsCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12 },
  newsMeta: { color: Colors.dim, fontSize: 12 },
  newsTitle: { color: Colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 },
  newsBody: { color: Colors.sub, fontSize: 13, marginTop: 2 },
  sectionSpacing: { height: 10 },
  primaryBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  primaryBtnText: { color: Colors.white, fontWeight: '900' },
  btn: { backgroundColor: Colors.orange + '22', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 100, borderWidth: 1, borderColor: Colors.orange + '55' },
  btnText: { color: Colors.orange, fontWeight: '900' },
  btnSecondary: { backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border2 },
  btnSecondaryText: { color: Colors.sub, fontWeight: '900' },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, padding: 12, color: Colors.text, marginTop: 10 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0008' },
  modalSheet: { marginTop: 'auto', backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 26 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  chip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 12 },
  chipText: { color: Colors.sub, fontWeight: '900' },
}));

