// app/shop/[id].tsx — Full-screen shop profile opened from feed shop headers

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getShopById } from '../../lib/api';
import { ShopDetail } from '../../components/marketplace/ShopDetail';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { isBuyerRole } from '../../stores/roleUtils';
import type { Shop } from '../../types';

export default function ShopProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const params = useLocalSearchParams<{ id: string }>();
  const shopId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [shop, setShop] = useState<Shop | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!shopId) {
      setError('Shop not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getShopById(shopId);
      setShop(row);
      setFollowerCount(row.total_followers ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load this shop.');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isBuyer = isBuyerRole(profile?.role);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle} numberOfLines={1}>{shop?.name ?? 'Shop'}</Text>
        <View style={s.navSpacer} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : error || !shop || !profile ? (
        <View style={s.centered}>
          <Text style={s.errorTitle}>Unable to open shop</Text>
          <Text style={s.errorBody}>{error ?? 'This shop profile is unavailable.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void load()}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.body}>
          <ShopDetail
            shop={shop}
            userId={profile.id}
            isBuyer={!!isBuyer}
            now={now}
            followerCount={followerCount}
            onFollowerDelta={delta => setFollowerCount(n => Math.max(0, n + delta))}
            onShopUpdate={updated => {
              setShop(updated);
              setFollowerCount(updated.total_followers ?? followerCount);
            }}
            onEditShop={() => router.push('/seller/shop' as any)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { color: Colors.text, fontSize: 22, fontWeight: '600' },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  navSpacer: { width: 40 },
  body: { flex: 1, paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  errorBody: { color: Colors.sub, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: Colors.white, fontWeight: '800' },
}));
