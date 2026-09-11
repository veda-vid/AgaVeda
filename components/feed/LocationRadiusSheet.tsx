// components/feed/LocationRadiusSheet.tsx — GPS + radius picker for buyer home

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, Platform, ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { FEED_RADIUS_OPTIONS, type FeedRadiusKm } from '../../services/feedApi';
import { SpringPressable } from '../ui/modernSurfaces';

type Props = {
  visible: boolean;
  city: string;
  currentRadius: number;
  detecting?: boolean;
  onDetectLocation: () => void;
  onSaveRadius: (km: number) => void;
  onClose: () => void;
};

export function LocationRadiusSheet({
  visible,
  city,
  currentRadius,
  detecting,
  onDetectLocation,
  onSaveRadius,
  onClose,
}: Props) {
  const [radius, setRadius] = useState(currentRadius);

  useEffect(() => {
    if (visible) setRadius(currentRadius);
  }, [visible, currentRadius]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Location & coverage</Text>
          <Text style={s.sub}>
            Update GPS or preview how far your Nearby feed should reach around {city || 'your area'}.
          </Text>

          <View style={s.preview}>
            <Text style={s.previewEmoji}>📡</Text>
            <Text style={s.previewCity} numberOfLines={1}>{city || 'Your area'}</Text>
            <Text style={s.previewRadius}>{radius} km coverage</Text>
          </View>

          <Text style={s.section}>Radius</Text>
          <View style={s.chipRow}>
            {FEED_RADIUS_OPTIONS.map(km => {
              const active = radius === km;
              return (
                <SpringPressable
                  key={km}
                  pressedScale={0.96}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setRadius(km as FeedRadiusKm)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{km} km</Text>
                </SpringPressable>
              );
            })}
          </View>

          <SpringPressable
            style={s.secondaryBtn}
            pressedScale={0.97}
            disabled={detecting}
            onPress={onDetectLocation}
          >
            {detecting ? (
              <ActivityIndicator color={Colors.orange} />
            ) : (
              <Text style={s.secondaryBtnText}>📍 Use Current Location</Text>
            )}
          </SpringPressable>

          <SpringPressable
            style={s.primaryBtn}
            pressedScale={0.97}
            onPress={() => {
              onSaveRadius(radius);
              onClose();
            }}
          >
            <Text style={s.primaryBtnText}>Apply & Refresh Feed</Text>
          </SpringPressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
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
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.sub,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  preview: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 14,
    gap: 4,
  },
  previewEmoji: { fontSize: 26 },
  previewCity: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  previewRadius: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.orange,
  },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dim,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  chipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chipText: { color: Colors.sub, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: Colors.white },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    marginBottom: 8,
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
}));
