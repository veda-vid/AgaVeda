// app/seller/enquiries.tsx — Seller lead & enquiry management dashboard
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  getShopByOwner, getShopEnquiries, updateEnquiryStatus,
} from '../../lib/api';
import { getSupabase } from '../../lib/supabase';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { EnquiryCard } from '../../components/seller/EnquiryCard';
import { EnquiryChatDrawer } from '../../components/seller/EnquiryChatDrawer';
import { filterEnquiriesByTab } from '../../lib/enquiryUtils';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { Shop, ShopEnquiry, ShopEnquiryStatus } from '../../types';

type TabKey = 'all' | 'quote' | 'callback';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Enquiries' },
  { key: 'quote', label: 'Product Quotes' },
  { key: 'callback', label: 'Callback Requests' },
];

const EMPTY_COPY: Record<TabKey, { title: string; text: string }> = {
  all: {
    title: 'No enquiries yet',
    text: 'When buyers message your shop, request quotes, or ask for a callback, leads will appear here.',
  },
  quote: {
    title: 'No product quotes',
    text: 'Price and stock enquiries from product pins will show up in this tab.',
  },
  callback: {
    title: 'No callback requests',
    text: 'Phone and WhatsApp callback requests from nearby buyers will appear here.',
  },
};

export default function SellerEnquiriesScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const [shop, setShop] = useState<Shop | null>(null);
  const [enquiries, setEnquiries] = useState<ShopEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [chatEnquiry, setChatEnquiry] = useState<ShopEnquiry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const ownedShop = await getShopByOwner(profile.id);
    setShop(ownedShop);
    if (!ownedShop) {
      setEnquiries([]);
      return;
    }
    const rows = await getShopEnquiries(ownedShop.id, ownedShop.lat, ownedShop.lng);
    setEnquiries(rows);
  }, [profile?.id]);

  const { refreshControl } = usePullToRefresh(load);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (!shop?.id) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`shop-enquiries-${shop.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'shop_enquiries',
        filter: `shop_id=eq.${shop.id}`,
      }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop?.id, load]);

  const filtered = useMemo(() => filterEnquiriesByTab(enquiries, tab), [enquiries, tab]);
  const newCount = enquiries.filter(e => e.status === 'new').length;

  const handleStatusChange = async (id: string, status: ShopEnquiryStatus) => {
    setUpdatingId(id);
    try {
      const updated = await updateEnquiryStatus(id, status);
      setEnquiries(prev => prev.map(e => (e.id === id ? { ...e, ...updated } : e)));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChatSent = () => {
    if (!chatEnquiry || chatEnquiry.status !== 'new') return;
    void handleStatusChange(chatEnquiry.id, 'contacted');
  };

  if (!profile) return null;

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Text style={s.backText}>←</Text>
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Enquiries & Leads</Text>
            {newCount > 0 ? (
              <View style={s.newPill}>
                <View style={s.newDot} />
                <Text style={s.newPillText}>{newCount} new</Text>
              </View>
            ) : null}
          </View>
          <View style={s.headerSpacer} />
        </View>

        <View style={s.tabRow}>
          {TABS.map(item => {
            const active = tab === item.key;
            const count = filterEnquiriesByTab(enquiries, item.key).length;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[s.tabChip, active && s.tabChipActive]}
              >
                <Text style={[s.tabLabel, active && s.tabLabelActive]} numberOfLines={1}>
                  {item.label}
                </Text>
                {count > 0 ? (
                  <View style={[s.tabCount, active && s.tabCountActive]}>
                    <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : !shop ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🏪</Text>
          <Text style={s.emptyTitle}>Set up your shop first</Text>
          <Text style={s.emptyText}>Create your shop profile to start receiving buyer enquiries.</Text>
          <Pressable style={s.ctaBtn} onPress={() => router.push('/seller/shop' as any)}>
            <Text style={s.ctaBtnText}>Create Shop</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <View style={updatingId === item.id ? s.cardUpdating : undefined}>
              <EnquiryCard
                enquiry={item}
                shop={shop}
                onStatusChange={handleStatusChange}
                onChat={setChatEnquiry}
              />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={(
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>📥</Text>
              <Text style={s.emptyTitle}>{EMPTY_COPY[tab].title}</Text>
              <Text style={s.emptyText}>{EMPTY_COPY[tab].text}</Text>
            </View>
          )}
        />
      )}

      {shop && chatEnquiry ? (
        <EnquiryChatDrawer
          visible={!!chatEnquiry}
          shop={shop}
          buyerId={chatEnquiry.buyer_id}
          buyerName={chatEnquiry.buyer?.name || 'Buyer'}
          sellerId={profile.id}
          onClose={() => setChatEnquiry(null)}
          onSent={handleChatSent}
        />
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  safeTop: { backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: { color: Colors.text, fontSize: 17, fontFamily: Fonts.displayXBold, fontWeight: '800' },
  newPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blue + '22',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.blue },
  newPillText: { color: Colors.blue, fontSize: 11, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  headerSpacer: { width: 36 },
  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12,
    ...(Platform.OS === 'web' ? { flexWrap: 'wrap' as const } : {}),
  },
  tabChip: {
    flex: 1, minWidth: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2,
  },
  tabChipActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '14' },
  tabLabel: { color: Colors.sub, fontSize: 11, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  tabLabelActive: { color: Colors.orange },
  tabCount: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.border2,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: Colors.orange },
  tabCountText: { color: Colors.sub, fontSize: 10, fontWeight: '800' },
  tabCountTextActive: { color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  listContent: { padding: 16, paddingBottom: 40 },
  cardUpdating: { opacity: 0.7 },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 28, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontFamily: Fonts.bodySemiBold, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: Colors.dim, fontSize: 13, fontFamily: Fonts.body, textAlign: 'center', lineHeight: 19 },
  ctaBtn: {
    marginTop: 12, backgroundColor: Colors.orange, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  ctaBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 14 },
}));
