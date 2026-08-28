// components/seller/LocationSetupPicker.tsx — Smart location + radius setup
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, ActivityIndicator,
  TextInput, Animated, LayoutChangeEvent, PanResponder, Image,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../constants/theme';

const WebIframe = 'iframe' as any;
const RADIUS_MIN = 5;
const RADIUS_MAX = 50;

export type LocationMethod = 'gps' | 'manual';

function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function GpsPulseLoader() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={loc.pulseWrap}>
      <Animated.View style={[loc.pulseRing, loc.pulseRing1, { opacity: pulse, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[loc.pulseRing, loc.pulseRing2, { opacity: pulse }]} />
      <View style={loc.pulseCore}><Text style={loc.pulseIcon}>📡</Text></View>
    </View>
  );
}

type SearchResult = { label: string; lat: number; lng: number };

async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 3) return [];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'CityConnect/1.0' }, signal: controller.signal },
    );
    const data = await response.json();
    return (data ?? []).map((row: any) => ({
      label: row.display_name as string,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function RadiusSlider({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = (value - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => setFromX(evt.nativeEvent.locationX),
      onPanResponderMove: evt => setFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  const setFromX = (x: number) => {
    if (trackWidth <= 0) return;
    const r = Math.max(0, Math.min(1, x / trackWidth));
    const next = Math.round(RADIUS_MIN + r * (RADIUS_MAX - RADIUS_MIN));
    onChange(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, next)));
  };

  return (
    <View style={loc.sliderBlock}>
      <View style={loc.sliderHeader}>
        <Text style={loc.sliderLabel}>Service radius</Text>
        <View style={loc.sliderValuePill}>
          <Text style={loc.sliderValueText}>{value} km</Text>
        </View>
      </View>
      <View
        style={loc.sliderTrackWrap}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={loc.sliderTrack}>
          <View style={[loc.sliderFill, { width: `${ratio * 100}%` }]} />
        </View>
        <View style={[loc.sliderThumb, { left: Math.max(0, ratio * (trackWidth - 22)) }]} />
      </View>
      <View style={loc.sliderTicks}>
        <Text style={loc.sliderTick}>{RADIUS_MIN} km</Text>
        <Text style={loc.sliderTick}>{RADIUS_MAX} km</Text>
      </View>
      <View style={loc.radiusQuickRow}>
        {[5, 10, 20, 30, 50].map(km => (
          <Pressable
            key={km}
            onPress={() => onChange(km)}
            style={[loc.radiusQuick, value === km && loc.radiusQuickActive]}
          >
            <Text style={[loc.radiusQuickText, value === km && loc.radiusQuickTextActive]}>{km} km</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MapPreview({
  lat, lng, radiusKm, onPinMove,
}: {
  lat: number; lng: number; radiusKm: number;
  onPinMove?: (lat: number, lng: number) => void;
}) {
  const mapSize = 280;
  const radiusPx = 24 + (radiusKm / RADIUS_MAX) * 56;

  if (Platform.OS === 'web') {
    const bbox = 0.012 + radiusKm * 0.0008;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - bbox},${lat - bbox},${lng + bbox},${lat + bbox}&layer=mapnik&marker=${lat},${lng}`;
    return (
      <View style={loc.mapFrame}>
        <WebIframe
          title="Shop location map"
          src={embedUrl}
          style={{ width: '100%', height: mapSize, border: 'none', borderRadius: 14 }}
        />
        <View style={loc.mapRadiusOverlay} pointerEvents="none">
          <Svg width={mapSize} height={mapSize}>
            <Circle
              cx={mapSize / 2}
              cy={mapSize / 2}
              r={radiusPx}
              fill={hexAlpha(Colors.orange, '22')}
              stroke={Colors.orange}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          </Svg>
        </View>
      </View>
    );
  }

  const tileUrl = `https://tile.openstreetmap.org/15/${Math.floor((lng + 180) / 360 * Math.pow(2, 15))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 15))}.png`;

  return (
    <Pressable
      style={loc.mapFrame}
      onPress={evt => {
        if (!onPinMove) return;
        const { locationX, locationY } = evt.nativeEvent;
        const dx = (locationX - mapSize / 2) / mapSize;
        const dy = (locationY - mapSize / 2) / mapSize;
        onPinMove(lat - dy * 0.008, lng + dx * 0.008);
      }}
    >
      <Image source={{ uri: tileUrl }} style={loc.mapTile} resizeMode="cover" />
      <View style={loc.mapGridOverlay} />
      <View style={loc.mapPinCenter}><Text style={loc.mapPinEmoji}>📍</Text></View>
      <Svg width={mapSize} height={mapSize} style={loc.mapRadiusSvg}>
        <Circle
          cx={mapSize / 2}
          cy={mapSize / 2}
          r={radiusPx}
          fill={hexAlpha(Colors.orange, '22')}
          stroke={Colors.orange}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </Svg>
      <Text style={loc.mapTapHintText}>Tap map to adjust pin</Text>
    </Pressable>
  );
}

export function LocationSetupPicker({
  method, onMethodChange,
  coords, address, city, manualQuery, onManualQueryChange,
  serviceRadiusKm, onServiceRadiusChange,
  detecting, resolving, onDetectGps, onConfirmManual,
  onSelectPlace,
}: {
  method: LocationMethod;
  onMethodChange: (m: LocationMethod) => void;
  coords: { lat: number; lng: number } | null;
  address: string;
  city: string;
  manualQuery: string;
  onManualQueryChange: (q: string) => void;
  serviceRadiusKm: number;
  onServiceRadiusChange: (km: number) => void;
  detecting: boolean;
  resolving: boolean;
  onDetectGps: () => void;
  onConfirmManual: () => void;
  onSelectPlace: (place: SearchResult) => void;
}) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSuggestions(await searchPlaces(query));
      setSearching(false);
    }, 350);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const hasLocation = coords != null && address.trim().length > 0;

  return (
    <View style={loc.root}>
      <View style={loc.segmentRow}>
        <Pressable
          style={[loc.segmentCard, method === 'gps' && loc.segmentCardActive]}
          onPress={() => onMethodChange('gps')}
        >
          <View style={[loc.segmentIconWrap, method === 'gps' && loc.segmentIconActive]}>
            <Text style={loc.segmentIcon}>📍</Text>
          </View>
          <Text style={[loc.segmentTitle, method === 'gps' && loc.segmentTitleActive]}>GPS Detect</Text>
          <Text style={loc.segmentHint}>One-tap auto pick</Text>
          {method === 'gps' && coords ? (
            <View style={loc.statusDot}><Text style={loc.statusDotText}>Live</Text></View>
          ) : null}
        </Pressable>
        <Pressable
          style={[loc.segmentCard, method === 'manual' && loc.segmentCardActive]}
          onPress={() => onMethodChange('manual')}
        >
          <View style={[loc.segmentIconWrap, method === 'manual' && loc.segmentIconActive]}>
            <Text style={loc.segmentIcon}>🔍</Text>
          </View>
          <Text style={[loc.segmentTitle, method === 'manual' && loc.segmentTitleActive]}>Search & Pin</Text>
          <Text style={loc.segmentHint}>Address autocomplete</Text>
          {method === 'manual' && hasLocation ? (
            <View style={[loc.statusDot, loc.statusDotManual]}><Text style={loc.statusDotText}>Set</Text></View>
          ) : null}
        </Pressable>
      </View>

      {method === 'gps' ? (
        <Pressable
          style={[loc.detectBtn, detecting && loc.detectBtnLoading]}
          onPress={onDetectGps}
          disabled={detecting}
        >
          {detecting ? (
            <>
              <GpsPulseLoader />
              <View style={{ flex: 1 }}>
                <Text style={loc.detectBtnTitle}>Detecting location…</Text>
                <Text style={loc.detectBtnSub}>Fetching GPS coordinates & address</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={loc.detectBtnEmoji}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={loc.detectBtnTitle}>Detect Current Location</Text>
                <Text style={loc.detectBtnSub}>Uses GPS for exact pin, street & city</Text>
              </View>
              <Text style={loc.detectChevron}>→</Text>
            </>
          )}
        </Pressable>
      ) : (
        <View style={loc.searchBlock}>
          <Text style={loc.fieldLabel}>Search address</Text>
          <View style={loc.searchWrap}>
            <TextInput
              style={loc.searchInput}
              value={manualQuery}
              onChangeText={t => { onManualQueryChange(t); runSearch(t); }}
              placeholder="Search street, area, city…"
              placeholderTextColor={Colors.dim}
            />
            {searching ? <ActivityIndicator color={Colors.orange} size="small" /> : null}
          </View>
          {suggestions.length > 0 ? (
            <View style={loc.suggestList}>
              {suggestions.map((item, i) => (
                <Pressable
                  key={`${item.lat}-${item.lng}-${i}`}
                  style={loc.suggestItem}
                  onPress={() => { onSelectPlace(item); setSuggestions([]); }}
                >
                  <Text style={loc.suggestIcon}>📍</Text>
                  <Text style={loc.suggestText} numberOfLines={2}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            style={[loc.confirmBtn, resolving && loc.confirmBtnDisabled]}
            onPress={onConfirmManual}
            disabled={resolving}
          >
            {resolving
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={loc.confirmBtnText}>Confirm Address</Text>}
          </Pressable>
        </View>
      )}

      <RadiusSlider value={serviceRadiusKm} onChange={onServiceRadiusChange} />

      <View style={loc.mapSection}>
        <Text style={loc.fieldLabel}>Map preview</Text>
        {coords ? (
          <MapPreview
            lat={coords.lat}
            lng={coords.lng}
            radiusKm={serviceRadiusKm}
            onPinMove={(lat, lng) => onSelectPlace({ label: address || manualQuery, lat, lng })}
          />
        ) : (
          <View style={loc.mapPlaceholder}>
            <Text style={loc.mapPlaceholderEmoji}>🗺️</Text>
            <Text style={loc.mapPlaceholderText}>Detect or search a location to preview your reach</Text>
          </View>
        )}
        <View style={loc.metaRow}>
          {address ? (
            <View style={loc.metaPill}><Text style={loc.metaPillText} numberOfLines={2}>📫 {address}</Text></View>
          ) : null}
          {city ? (
            <View style={loc.metaPill}><Text style={loc.metaPillText}>🏙️ {city}</Text></View>
          ) : null}
          {coords ? (
            <View style={loc.metaPill}>
              <Text style={loc.metaPillText}>📐 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
            </View>
          ) : null}
          <View style={[loc.metaPill, loc.metaPillAccent]}>
            <Text style={[loc.metaPillText, loc.metaPillTextAccent]}>🎯 {serviceRadiusKm} km reach</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const loc = StyleSheet.create({
  root: { gap: 16 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentCard: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2,
    borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, position: 'relative',
  },
  segmentCardActive: {
    borderColor: Colors.orange, backgroundColor: hexAlpha(Colors.orange, '10'),
    shadowColor: Colors.orange, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  segmentIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border2,
  },
  segmentIconActive: { borderColor: Colors.orange, backgroundColor: hexAlpha(Colors.orange, '18') },
  segmentIcon: { fontSize: 22 },
  segmentTitle: { fontSize: 13, fontWeight: '800', color: Colors.sub, fontFamily: Fonts.bodySemiBold },
  segmentTitleActive: { color: Colors.orange },
  segmentHint: { fontSize: 10, color: Colors.dim, textAlign: 'center' },
  statusDot: {
    position: 'absolute', top: 8, right: 8, backgroundColor: '#10B981',
    borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusDotManual: { backgroundColor: Colors.blue },
  statusDotText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  detectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.orange, borderRadius: 16, padding: 16,
    shadowColor: Colors.orange, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  detectBtnLoading: { backgroundColor: hexAlpha(Colors.orange, 'CC') },
  detectBtnEmoji: { fontSize: 28 },
  detectBtnTitle: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  detectBtnSub: { color: hexAlpha('#FFFFFF', 'CC'), fontSize: 12, marginTop: 2 },
  detectChevron: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  pulseWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: Colors.white,
  },
  pulseRing1: { width: 48, height: 48 },
  pulseRing2: { width: 32, height: 32, borderColor: hexAlpha('#FFFFFF', '88') },
  pulseCore: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: hexAlpha('#FFFFFF', '33'),
    alignItems: 'center', justifyContent: 'center',
  },
  pulseIcon: { fontSize: 14 },
  searchBlock: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10 },
  suggestList: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2,
    overflow: 'hidden',
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border2,
  },
  suggestIcon: { fontSize: 14, marginTop: 1 },
  suggestText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
  confirmBtn: {
    backgroundColor: Colors.orange, borderRadius: 12, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.75 },
  confirmBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  sliderBlock: { gap: 8 },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 12, fontWeight: '700', color: Colors.sub },
  sliderValuePill: {
    backgroundColor: hexAlpha(Colors.orange, '22'), borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  sliderValueText: { color: Colors.orange, fontWeight: '800', fontSize: 13 },
  sliderTrackWrap: { height: 32, justifyContent: 'center', position: 'relative' },
  sliderTrack: {
    height: 8, borderRadius: 999, backgroundColor: Colors.border2, overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: Colors.orange, borderRadius: 999 },
  sliderThumb: {
    position: 'absolute', top: 5, width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.white, borderWidth: 3, borderColor: Colors.orange,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderTick: { fontSize: 10, color: Colors.dim },
  radiusQuickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusQuick: {
    borderRadius: 999, borderWidth: 1, borderColor: Colors.border2,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.surface,
  },
  radiusQuickActive: { borderColor: Colors.orange, backgroundColor: hexAlpha(Colors.orange, '18') },
  radiusQuickText: { fontSize: 11, fontWeight: '700', color: Colors.sub },
  radiusQuickTextActive: { color: Colors.orange },
  mapSection: { gap: 8 },
  mapFrame: {
    borderRadius: 16, overflow: 'hidden', height: 280,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface, position: 'relative',
  },
  mapTile: { width: '100%', height: '100%' },
  mapGridOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: hexAlpha(Colors.blue, '08') },
  mapPinCenter: { position: 'absolute', top: '42%', left: '46%' },
  mapPinEmoji: { fontSize: 30 },
  mapRadiusSvg: { ...StyleSheet.absoluteFillObject },
  mapRadiusOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  mapTapHintText: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    backgroundColor: hexAlpha('#000000', '88'), color: Colors.white,
    fontSize: 10, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  mapPlaceholder: {
    height: 160, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, padding: 20, gap: 8,
  },
  mapPlaceholderEmoji: { fontSize: 36 },
  mapPlaceholderText: { fontSize: 12, color: Colors.dim, textAlign: 'center', lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%',
  },
  metaPillAccent: { borderColor: hexAlpha(Colors.orange, '44'), backgroundColor: hexAlpha(Colors.orange, '12') },
  metaPillText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
  metaPillTextAccent: { color: Colors.orange, fontWeight: '800' },
});
