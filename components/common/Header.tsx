// components/common/Header.tsx — Buyer/seller home top bar with safe-area + notification badge

import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { SpringPressable } from '../ui/modernSurfaces';
import { VedastyaWordmark } from './VedastyaWordmark';

type HeaderProps = {
  city?: string | null;
  radiusKm?: number | null;
  notificationCount?: number;
  /** Optional left-side control (e.g. seller create +). */
  leftSlot?: ReactNode;
};

/**
 * Luxury feed header: premium Vedastya wordmark + tagline,
 * notch-safe top padding, and integrated notification badge.
 */
export function Header({
  city,
  radiusKm,
  notificationCount = 0,
  leftSlot,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const count = Math.max(0, notificationCount);
  const badgeLabel = count > 99 ? '99+' : String(count);

  const locationParts = [
    city?.trim() || null,
    radiusKm != null && Number.isFinite(Number(radiusKm))
      ? `${Number(radiusKm)} km`
      : null,
  ].filter(Boolean);

  const locationLine = locationParts.length
    ? `📍 ${locationParts.join(' • ')}`
    : null;

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <View style={s.left}>{leftSlot ?? <View style={s.sideSpacer} />}</View>

      <View style={s.center}>
        <VedastyaWordmark size="md" showTagline />
        {locationLine ? (
          <Text style={s.location} numberOfLines={1}>{locationLine}</Text>
        ) : null}
      </View>

      <View style={s.right}>
        <SpringPressable
          onPress={() => router.push('/(tabs)/notifications' as any)}
          style={s.bellBtn}
          pressedScale={0.9}
          accessibilityRole="button"
        >
          <Text style={s.bellIcon}>🔔</Text>
          {count > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </SpringPressable>
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Colors.bg,
  },
  left: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  right: { width: 48, alignItems: 'flex-end', justifyContent: 'center' },
  sideSpacer: { width: 36, height: 36 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  location: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.sub,
    marginTop: 4,
    textAlign: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    lineHeight: 12,
  },
}));
