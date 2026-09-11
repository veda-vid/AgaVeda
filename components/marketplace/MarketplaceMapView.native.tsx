// components/marketplace/MarketplaceMapView.native.tsx — Native map markers (iOS/Android)

import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Pressable, TouchableOpacity,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Fonts, Shadow, createDynamicStyles } from '../../constants/theme';
import {
  formatDistanceKm, getShopMarkerColor, getShopStatusDisplay, unicodeMarketplaceStyle,
} from '../../lib/marketplaceUtils';
import { categoryMeta } from './marketplaceMedia';
import type { Shop } from '../../types';

export type MarketplaceMapViewProps = {
  shops: Shop[];
  userLat?: number;
  userLng?: number;
  now: Date;
  onSelectShop: (shop: Shop) => void;
  onCall: (shop: Shop) => void;
  onChat: (shop: Shop) => void;
};

export function MarketplaceMapView({
  shops, userLat, userLng, now, onSelectShop, onCall, onChat,
}: MarketplaceMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shops.find(s => s.id === selectedId) ?? null;

  const region = useMemo(() => {
    const points = shops.filter(s => s.lat && s.lng);
    if (!points.length && userLat != null && userLng != null) {
      return { latitude: userLat, longitude: userLng, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    }
    const lats = points.map(s => s.lat);
    const lngs = points.map(s => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max(0.04, (maxLat - minLat) * 1.4);
    const lngDelta = Math.max(0.04, (maxLng - minLng) * 1.4);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [shops, userLat, userLng]);

  return (
    <View style={s.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={userLat != null && userLng != null}
        showsMyLocationButton
      >
        {shops.map(shop => {
          if (!shop.lat || !shop.lng) return null;
          const color = getShopMarkerColor(shop, now);
          const status = getShopStatusDisplay(shop, now);
          return (
            <Marker
              key={shop.id}
              coordinate={{ latitude: shop.lat, longitude: shop.lng }}
              pinColor={color}
              title={shop.name}
              description={status.shortLabel}
              onPress={() => setSelectedId(shop.id)}
            />
          );
        })}
      </MapView>

      {selected ? (
        <View style={s.previewCard}>
          <Pressable style={s.previewMain} onPress={() => onSelectShop(selected)}>
            <Text style={[s.previewName, unicodeMarketplaceStyle]} numberOfLines={1}>{selected.name}</Text>
            <Text style={s.previewMeta}>
              {categoryMeta(selected.category).emoji} {formatDistanceKm(selected.distance_km)} · {getShopStatusDisplay(selected, now).shortLabel}
            </Text>
          </Pressable>
          <View style={s.previewActions}>
            <TouchableOpacity style={s.previewBtn} onPress={() => onCall(selected)}>
              <Text style={s.previewBtnText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.previewBtn, s.previewBtnPrimary]} onPress={() => onChat(selected)}>
              <Text style={[s.previewBtnText, s.previewBtnTextPrimary]}>Chat</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.previewClose} onPress={() => setSelectedId(null)}>
            <Text style={s.previewCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.surface },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    ...Shadow.md,
  },
  previewMain: { paddingRight: 28 },
  previewName: { color: Colors.text, fontSize: 16, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  previewMeta: { color: Colors.sub, fontSize: 12, marginTop: 4, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  previewBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.card },
  previewBtnPrimary: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  previewBtnText: { color: Colors.text, fontWeight: '800', fontSize: 13 },
  previewBtnTextPrimary: { color: Colors.white },
  previewClose: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: Colors.dim, fontSize: 14, fontWeight: '700' },
}));
