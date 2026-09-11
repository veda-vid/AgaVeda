// components/seller/MerchantRadiusSheet.tsx — Target customer broadcast zone

import { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import {
  SELLER_RADIUS_OPTIONS,
  type SellerRadiusKm,
} from '../../services/sellerApi';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';

type Props = {
  visible: boolean;
  city: string;
  currentRadius: number;
  onSaveRadius: (km: SellerRadiusKm) => void;
  onClose: () => void;
};

export function MerchantRadiusSheet({
  visible,
  city,
  currentRadius,
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
        <Pressable onPress={() => {}}>
          <GlassSurface style={s.sheet} radius={24} intensity={36}>
            <View style={s.handle} />
            <Text style={s.title}>Target broadcast zone</Text>
            <Text style={s.sub}>
              Choose how far your shop reaches nearby buyers around{' '}
              {!city || /^current location$/i.test(city) ? 'your area' : city}.
              Metrics and your local market feed update instantly.
            </Text>

            <View style={s.preview}>
              <Text style={s.previewEmoji}>📡</Text>
              <Text style={s.previewCity} numberOfLines={1}>
                {!city || /^current location$/i.test(city) ? 'Your area' : city}
              </Text>
              <Text style={s.previewRadius}>{radius} km customer reach</Text>
            </View>

            <Text style={s.section}>Radius</Text>
            <View style={s.chipRow}>
              {SELLER_RADIUS_OPTIONS.map(km => {
                const active = radius === km;
                return (
                  <SpringPressable
                    key={km}
                    pressedScale={0.96}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setRadius(km)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{km} km</Text>
                  </SpringPressable>
                );
              })}
            </View>

            <SpringPressable
              style={s.primaryBtn}
              pressedScale={0.97}
              onPress={() => {
                onSaveRadius(radius as SellerRadiusKm);
                onClose();
              }}
            >
              <Text style={s.primaryBtnText}>Apply & Refresh Market</Text>
            </SpringPressable>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    marginHorizontal: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
    marginBottom: 16,
  },
  preview: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  previewEmoji: { fontSize: 28, marginBottom: 6 },
  previewCity: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  previewRadius: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.orange,
    fontWeight: '700',
  },
  section: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.dim,
    marginBottom: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  chipActive: {
    backgroundColor: Colors.orange + '22',
    borderColor: Colors.orange,
  },
  chipText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.sub,
  },
  chipTextActive: { color: Colors.orange },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
}));
