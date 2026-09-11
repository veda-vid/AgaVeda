// components/seller/SellerHeader.tsx — Clean merchant home top bar + target zone pill

import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { formatSellerTargetLabel } from '../../services/sellerApi';
import { SpringPressable } from '../ui/modernSurfaces';
import { VedastyaWordmark } from '../common/VedastyaWordmark';

type SellerHeaderProps = {
  city?: string | null;
  radiusKm?: number | null;
  notificationCount?: number;
  onOpenTargetZone: () => void;
  leftSlot?: ReactNode;
};

export function SellerHeader({
  city,
  radiusKm,
  notificationCount = 0,
  onOpenTargetZone,
  leftSlot,
}: SellerHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const count = Math.max(0, notificationCount);
  const badgeLabel = count > 99 ? '99+' : String(count);
  const targetLabel = formatSellerTargetLabel(city, radiusKm);

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <View style={s.left}>{leftSlot ?? <View style={s.sideSpacer} />}</View>

      <View style={s.center}>
        {/* hideAccent removes the rounded gold capsule under the tagline */}
        <VedastyaWordmark size="md" showTagline hideAccent />
        <SpringPressable
          onPress={onOpenTargetZone}
          pressedScale={0.97}
          style={s.pillWrap}
          accessibilityRole="button"
        >
          <View style={s.pill}>
            <Text style={s.pillDot}>📍</Text>
            <Text style={s.pillText} numberOfLines={1}>{targetLabel}</Text>
            <Text style={s.pillChevron}>▾</Text>
          </View>
        </SpringPressable>
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
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: Colors.bg,
  },
  left: { width: 48, alignItems: 'flex-start' },
  right: { width: 48, alignItems: 'flex-end' },
  sideSpacer: { width: 40 },
  center: { flex: 1, alignItems: 'center', gap: 8 },
  pillWrap: { maxWidth: '100%' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  pillDot: { fontSize: 12 },
  pillText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  pillChevron: {
    fontSize: 11,
    color: Colors.orange,
    fontWeight: '800',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bellIcon: { fontSize: 16 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
}));
