// components/services/ProsMapView.web.tsx — Web pin list + carousel preview

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Colors, Fonts, Shadow, createDynamicStyles } from '../../constants/theme';
import {
  CAT_TINT, formatProDistance, getPresenceDisplay, getProCategoryLabel, getProMapPinColor, unicodeProsStyle,
} from '../../lib/prosUtils';
import type { ServiceProvider } from '../../types';
import { CategoryIcon } from './ServiceIcons';

export type ProsMapViewProps = {
  pros: ServiceProvider[];
  userLat?: number;
  userLng?: number;
  onSelectPro: (pro: ServiceProvider) => void;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
};

export function ProsMapView({
  pros,
  onSelectPro,
  selectedId: controlledId,
  onSelectedIdChange,
}: ProsMapViewProps) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(300, width - 48);
  const [internalId, setInternalId] = useState<string | null>(pros[0]?.id ?? null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;
  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalId(id);
  };

  const list = useMemo(() => pros, [pros]);

  useEffect(() => {
    if (!list.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !list.some(p => p.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [list]);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {list.map(pro => {
          const color = getProMapPinColor(pro);
          const presence = getPresenceDisplay(pro);
          const tint = CAT_TINT[pro.category] ?? color;
          const active = pro.id === selectedId;
          return (
            <Pressable
              key={pro.id}
              style={[s.pin, { borderColor: active ? Colors.orange : color }, active && s.pinActive]}
              onPress={() => setSelectedId(pro.id)}
            >
              <View style={[s.pinIcon, { backgroundColor: `${tint}22` }]}>
                <CategoryIcon id={pro.category} size={16} color={tint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, unicodeProsStyle]} numberOfLines={1}>{pro.business_name}</Text>
                <Text style={s.meta}>
                  {presence.label} · {getProCategoryLabel(pro)}
                  {formatProDistance(pro.distance_km) ? ` · ${formatProDistance(pro.distance_km)} away` : ''}
                </Text>
                <Text style={[s.rate, { color: tint }]} numberOfLines={1}>
                  {pro.base_rate_label || 'Rate on request'}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!list.length ? (
          <Text style={s.empty}>No pros in this radius yet.</Text>
        ) : null}
      </ScrollView>

      {selectedId ? (
        <ScrollView
          horizontal
          style={s.carousel}
          contentContainerStyle={s.carouselContent}
          showsHorizontalScrollIndicator={false}
        >
          {list.map(item => {
            const active = item.id === selectedId;
            const tint = CAT_TINT[item.category] ?? Colors.orange;
            return (
              <Pressable
                key={item.id}
                style={[s.carouselCard, { width: cardW }, active && s.carouselCardActive]}
                onPress={() => {
                  setSelectedId(item.id);
                  onSelectPro(item);
                }}
              >
                <Text style={[s.carouselName, unicodeProsStyle]} numberOfLines={1}>{item.business_name}</Text>
                <Text style={s.carouselMeta}>{getProCategoryLabel(item)}</Text>
                <Text style={[s.carouselRate, { color: tint }]}>{item.base_rate_label || 'Rate on request'}</Text>
                <Text style={s.carouselCta}>Tap to open profile</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: 16, paddingBottom: 140, gap: 10 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: Colors.card,
  },
  pinActive: { backgroundColor: Colors.surface },
  pinIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: Colors.text, fontSize: 15, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  meta: { color: Colors.sub, fontSize: 12, marginTop: 2 },
  rate: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  empty: { color: Colors.sub, textAlign: 'center', marginTop: 40 },
  carousel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
  },
  carouselContent: { paddingHorizontal: 16 },
  carouselCard: {
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
    ...Shadow.md,
  },
  carouselCardActive: { borderColor: Colors.orange },
  carouselName: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  carouselMeta: { color: Colors.sub, fontSize: 12, marginTop: 4 },
  carouselRate: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  carouselCta: { marginTop: 8, fontSize: 11, fontWeight: '700', color: Colors.dim },
}));
