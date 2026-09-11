// components/services/ProsMapView.native.tsx — Custom pins + bottom carousel

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Pressable, FlatList, useWindowDimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Colors, Fonts, Shadow, createDynamicStyles } from '../../constants/theme';
import {
  CAT_TINT, formatProDistance, getProCategoryLabel, getProMapPinColor, unicodeProsStyle,
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

function MapPin({ pro, active }: { pro: ServiceProvider; active: boolean }) {
  const tint = CAT_TINT[pro.category] ?? getProMapPinColor(pro);
  const rate = pro.base_rate_label?.replace(/^₹\s*/, '') || '—';
  return (
    <View style={[pinS.wrap, active && pinS.wrapActive]}>
      <View style={[pinS.bubble, { borderColor: tint, backgroundColor: Colors.surface }]}>
        <CategoryIcon id={pro.category} size={14} color={tint} />
        <Text style={[pinS.rate, { color: tint }]} numberOfLines={1}>₹{rate}</Text>
      </View>
      <View style={[pinS.arrow, { borderTopColor: tint }]} />
    </View>
  );
}

export function ProsMapView({
  pros,
  userLat,
  userLng,
  onSelectPro,
  selectedId: controlledId,
  onSelectedIdChange,
}: ProsMapViewProps) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(300, width - 48);
  const listRef = useRef<FlatList<ServiceProvider>>(null);
  const [internalId, setInternalId] = useState<string | null>(pros[0]?.id ?? null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;

  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalId(id);
  };

  const mappable = useMemo(
    () => pros.filter(p => p.lat != null && p.lng != null),
    [pros],
  );

  const region: Region = useMemo(() => {
    if (!mappable.length && userLat != null && userLng != null) {
      return { latitude: userLat, longitude: userLng, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    }
    if (!mappable.length) {
      return { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    }
    const lats = mappable.map(p => p.lat as number);
    const lngs = mappable.map(p => p.lng as number);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.5),
    };
  }, [mappable, userLat, userLng]);

  useEffect(() => {
    if (!mappable.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !mappable.some(p => p.id === selectedId)) {
      setSelectedId(mappable[0].id);
    }
  }, [mappable]);

  useEffect(() => {
    if (!selectedId) return;
    const idx = mappable.findIndex(p => p.id === selectedId);
    if (idx >= 0) {
      try {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch { /* layout not ready */ }
    }
  }, [selectedId, mappable]);

  return (
    <View style={s.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={userLat != null && userLng != null}
        showsMyLocationButton
      >
        {mappable.map(pro => (
          <Marker
            key={pro.id}
            coordinate={{ latitude: pro.lat as number, longitude: pro.lng as number }}
            onPress={() => setSelectedId(pro.id)}
            tracksViewChanges={false}
          >
            <MapPin pro={pro} active={pro.id === selectedId} />
          </Marker>
        ))}
      </MapView>

      {mappable.length ? (
        <FlatList
          ref={listRef}
          data={mappable}
          horizontal
          style={s.carousel}
          contentContainerStyle={s.carouselContent}
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          snapToInterval={cardW + 12}
          decelerationRate="fast"
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (cardW + 12));
            const item = mappable[idx];
            if (item) setSelectedId(item.id);
          }}
          getItemLayout={(_, index) => ({
            length: cardW + 12,
            offset: (cardW + 12) * index,
            index,
          })}
          renderItem={({ item }) => {
            const active = item.id === selectedId;
            const tint = CAT_TINT[item.category] ?? Colors.orange;
            return (
              <Pressable
                style={[s.carouselCard, { width: cardW }, active && s.carouselCardActive]}
                onPress={() => {
                  setSelectedId(item.id);
                  onSelectPro(item);
                }}
              >
                <View style={[s.carouselAccent, { backgroundColor: tint }]} />
                <Text style={[s.carouselName, unicodeProsStyle]} numberOfLines={1}>
                  {item.business_name}
                </Text>
                <Text style={s.carouselMeta} numberOfLines={1}>
                  {getProCategoryLabel(item)}
                  {formatProDistance(item.distance_km) ? ` · ${formatProDistance(item.distance_km)} away` : ''}
                </Text>
                <Text style={[s.carouselRate, { color: tint }]} numberOfLines={1}>
                  {item.base_rate_label || 'Rate on request'}
                </Text>
                <Text style={s.carouselCta}>Tap to open profile</Text>
              </Pressable>
            );
          }}
        />
      ) : (
        <View style={s.emptyMap}>
          <Text style={s.emptyMapText}>No pros with map pins in this radius.</Text>
        </View>
      )}
    </View>
  );
}

const pinS = createDynamicStyles((Colors) => ({
  wrap: { alignItems: 'center' },
  wrapActive: { transform: [{ scale: 1.08 }] },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    maxWidth: 110,
    ...Shadow.sm,
  },
  rate: { fontSize: 10, fontWeight: '800', maxWidth: 70 },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
}));

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.surface },
  carousel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
  },
  carouselContent: {
    paddingHorizontal: 16,
  },
  carouselCard: {
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
    overflow: 'hidden',
    ...Shadow.md,
  },
  carouselCardActive: {
    borderColor: Colors.orange,
  },
  carouselAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  carouselName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Fonts.bodySemiBold,
    paddingLeft: 6,
  },
  carouselMeta: {
    color: Colors.sub,
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 6,
  },
  carouselRate: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    paddingLeft: 6,
  },
  carouselCta: {
    marginTop: 8,
    paddingLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dim,
  },
  emptyMap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  emptyMapText: { color: Colors.sub, textAlign: 'center', fontSize: 13 },
}));
