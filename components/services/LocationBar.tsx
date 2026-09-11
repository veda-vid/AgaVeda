// components/services/LocationBar.tsx — Pros location header + GPS / city picker

import { useMemo, useState } from 'react';
import {
  View, Text, Modal, Pressable, FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { SpringPressable } from '../ui/modernSurfaces';
import {
  CITY_OPTIONS,
  PRO_RADIUS_OPTIONS,
  formatNearLabel,
  type ProRadiusKm,
  type ProsGeo,
} from '../../services/proApi';

type Props = {
  city: string;
  radiusKm: number;
  detecting?: boolean;
  hasLocation: boolean;
  onDetectLocation: () => void;
  onSelectCity: (city: string) => void;
  onChangeRadius: (km: ProRadiusKm) => void;
};

export function LocationBar({
  city,
  radiusKm,
  detecting,
  hasLocation,
  onDetectLocation,
  onSelectCity,
  onChangeRadius,
}: Props) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<'none' | 'edit' | 'city'>('none');
  const label = useMemo(() => formatNearLabel(city, radiusKm), [city, radiusKm]);

  return (
    <>
      <View style={[s.bar, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
        <View style={s.brandRow}>
          <Text style={s.brand}>Pros</Text>
          <Text style={s.sub}>Local verified professionals</Text>
        </View>

        {hasLocation ? (
          <SpringPressable
            style={s.locationChip}
            pressedScale={0.98}
            onPress={() => setSheet('edit')}
          >
            <Text style={s.pin}>📍</Text>
            <Text style={s.locationText} numberOfLines={1}>{label}</Text>
            <Text style={s.editIcon}>✏️</Text>
          </SpringPressable>
        ) : (
          <View style={s.needCard}>
            <Text style={s.needEmoji}>📍</Text>
            <Text style={s.needTitle}>Find pros near you</Text>
            <Text style={s.needBody}>
              Turn on location or pick your city to see verified professionals within your radius.
            </Text>
            <SpringPressable
              style={s.primaryBtn}
              pressedScale={0.97}
              disabled={detecting}
              onPress={onDetectLocation}
            >
              {detecting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={s.primaryBtnText}>📍 Detect My Location</Text>
              )}
            </SpringPressable>
            <SpringPressable
              style={s.secondaryBtn}
              pressedScale={0.97}
              onPress={() => setSheet('city')}
            >
              <Text style={s.secondaryBtnText}>🏙️ Select City Manually</Text>
            </SpringPressable>
          </View>
        )}
      </View>

      <Modal
        visible={sheet === 'edit'}
        transparent
        animationType="fade"
        onRequestClose={() => setSheet('none')}
      >
        <Pressable style={s.backdrop} onPress={() => setSheet('none')}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Search area</Text>
            <Text style={s.sheetSub}>Adjust radius or change city anytime.</Text>

            <Text style={s.sectionLabel}>Radius</Text>
            <View style={s.radiusRow}>
              {PRO_RADIUS_OPTIONS.map(r => {
                const active = radiusKm === r;
                return (
                  <Pressable
                    key={r}
                    style={[s.radiusChip, active && s.radiusChipActive]}
                    onPress={() => onChangeRadius(r)}
                  >
                    <Text style={[s.radiusText, active && s.radiusTextActive]}>{r} km</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={s.rowBtn}
              onPress={() => {
                setSheet('none');
                onDetectLocation();
              }}
            >
              <Text style={s.rowBtnText}>📍 Detect My Location</Text>
            </Pressable>
            <Pressable
              style={s.rowBtn}
              onPress={() => setSheet('city')}
            >
              <Text style={s.rowBtnText}>🏙️ Change City</Text>
            </Pressable>
            <Pressable style={s.cancelBtn} onPress={() => setSheet('none')}>
              <Text style={s.cancelText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={sheet === 'city'}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet('none')}
      >
        <Pressable style={s.backdrop} onPress={() => setSheet('none')}>
          <Pressable style={[s.sheet, s.citySheet]} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Select city</Text>
            <Text style={s.sheetSub}>Pros update immediately for the city you pick.</Text>
            <FlatList
              data={CITY_OPTIONS}
              keyExtractor={item => item.name}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const active = item.name.toLowerCase() === city.trim().toLowerCase();
                return (
                  <Pressable
                    style={[s.cityRow, active && s.cityRowActive]}
                    onPress={() => {
                      onSelectCity(item.name);
                      setSheet('none');
                    }}
                  >
                    <Text style={[s.cityRowText, active && s.cityRowTextActive]}>
                      📍 {item.name}
                      {item.state ? ` · ${item.state}` : ''}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Compact empty-location card used when header already rendered without coords. */
export function LocationRequiredCard({
  detecting,
  onDetectLocation,
  onSelectCity,
}: {
  detecting?: boolean;
  onDetectLocation: () => void;
  onSelectCity: () => void;
}) {
  return (
    <View style={s.needCardStandalone}>
      <Text style={s.needEmoji}>📍</Text>
      <Text style={s.needTitle}>Location needed</Text>
      <Text style={s.needBody}>
        Detect GPS or choose a city to load professionals near you.
      </Text>
      <SpringPressable style={s.primaryBtn} pressedScale={0.97} disabled={detecting} onPress={onDetectLocation}>
        {detecting
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={s.primaryBtnText}>📍 Detect My Location</Text>}
      </SpringPressable>
      <SpringPressable style={s.secondaryBtn} pressedScale={0.97} onPress={onSelectCity}>
        <Text style={s.secondaryBtnText}>🏙️ Select City Manually</Text>
      </SpringPressable>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  bar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: { alignItems: 'center', marginBottom: 10 },
  brand: {
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  pin: { fontSize: 14 },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  editIcon: { fontSize: 13 },
  needCard: {
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
    gap: 8,
  },
  needCardStandalone: {
    marginHorizontal: 16,
    marginTop: 28,
    padding: 20,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
    gap: 8,
  },
  needEmoji: { fontSize: 32, marginBottom: 4 },
  needTitle: {
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  needBody: {
    fontSize: 13,
    color: Colors.sub,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  citySheet: { maxHeight: '78%' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginBottom: 12,
  },
  sheetTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetSub: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.sub,
    marginTop: 4,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dim,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  radiusChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusText: { color: Colors.sub, fontWeight: '700', fontSize: 13 },
  radiusTextActive: { color: Colors.white },
  rowBtn: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    marginBottom: 8,
  },
  rowBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: Colors.dim, fontWeight: '700', fontSize: 15 },
  cityRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    marginBottom: 6,
  },
  cityRowActive: { borderWidth: 1, borderColor: Colors.orange },
  cityRowText: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  cityRowTextActive: { color: Colors.orange },
}));

export type { ProsGeo };
