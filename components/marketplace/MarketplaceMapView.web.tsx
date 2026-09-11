// components/marketplace/MarketplaceMapView.web.tsx — Web map discovery (no react-native-maps)

import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity, ScrollView,
} from 'react-native';
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
  shops, now, onSelectShop, onCall, onChat,
}: MarketplaceMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shops.find(s => s.id === selectedId) ?? null;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.webMap}>
        {shops.map(shop => {
          const color = getShopMarkerColor(shop, now);
          const status = getShopStatusDisplay(shop, now);
          return (
            <Pressable
              key={shop.id}
              style={[s.webPin, { borderColor: color }]}
              onPress={() => setSelectedId(shop.id)}
            >
              <Text style={[s.webPinDot, { color }]}>●</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.previewName, unicodeMarketplaceStyle]} numberOfLines={1}>{shop.name}</Text>
                <Text style={s.previewMeta}>{status.shortLabel} · {formatDistanceKm(shop.distance_km)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {selected ? (
        <View style={s.previewCard}>
          <Pressable style={s.previewMain} onPress={() => onSelectShop(selected)}>
            <Text style={[s.previewName, unicodeMarketplaceStyle]} numberOfLines={1}>{selected.name}</Text>
            <Text style={s.previewMeta}>
              {categoryMeta(selected.category).emoji} {formatDistanceKm(selected.distance_km)}
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
  webMap: { padding: 16, gap: 10 },
  webPin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: Colors.card,
  },
  webPinDot: { fontSize: 18, fontWeight: '900' },
}));
