// components/feed/FeedHeader.tsx — Buyer home location chip + mode switcher

import type { ReactNode } from 'react';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Colors, Fonts, createDynamicStyles, getThemeMeta, CurrentThemeId } from '../../constants/theme';
import { formatFeedLocationLabel } from '../../services/feedApi';
import { SpringPressable, GlassSurface } from '../ui/modernSurfaces';
import { VedastyaWordmark } from '../common/VedastyaWordmark';

type FeedMode = 'nearby' | 'following';

type Props = {
  city?: string | null;
  radiusKm?: number | null;
  feedMode: FeedMode;
  notificationCount?: number;
  followingBadge?: number;
  leftSlot?: ReactNode;
  onOpenLocation: () => void;
  onChangeMode: (mode: FeedMode) => void;
  showModeSwitcher?: boolean;
};

export function FeedHeader({
  city,
  radiusKm,
  feedMode,
  notificationCount = 0,
  followingBadge = 0,
  leftSlot,
  onOpenLocation,
  onChangeMode,
  showModeSwitcher = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const count = Math.max(0, notificationCount);
  const badgeLabel = count > 99 ? '99+' : String(count);
  const light = getThemeMeta(CurrentThemeId).isLight;
  const locationLabel = formatFeedLocationLabel(city, radiusKm);

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.topRow}>
        <View style={s.side}>{leftSlot ?? <View style={s.spacer} />}</View>
        <View style={s.center}>
          <VedastyaWordmark size="md" showTagline />
        </View>
        <View style={[s.side, { alignItems: 'flex-end' }]}>
          <SpringPressable
            onPress={() => router.push('/(tabs)/notifications' as any)}
            style={s.bellBtn}
            pressedScale={0.9}
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

      <SpringPressable style={s.locationChipWrap} pressedScale={0.98} onPress={onOpenLocation}>
        {Platform.OS === 'web' ? (
          <View style={[s.locationChip, s.locationChipWeb]}>
            <Text style={s.pin}>📍</Text>
            <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
            <Text style={s.edit}>✏️</Text>
          </View>
        ) : (
          <View style={s.locationChip}>
            <BlurView
              intensity={22}
              tint={light ? 'light' : 'dark'}
              style={s.blurFill}
            />
            <View style={s.locationInner}>
              <Text style={s.pin}>📍</Text>
              <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
              <Text style={s.edit}>✏️</Text>
            </View>
          </View>
        )}
      </SpringPressable>

      {showModeSwitcher ? (
        <GlassSurface style={s.modeRow} radius={18} intensity={20}>
          <ModePill
            label="Nearby"
            active={feedMode === 'nearby'}
            onPress={() => onChangeMode('nearby')}
          />
          <ModePill
            label="Following"
            active={feedMode === 'following'}
            badge={followingBadge}
            onPress={() => onChangeMode('following')}
          />
        </GlassSurface>
      ) : null}
    </View>
  );
}

function ModePill({
  label, active, badge, onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <SpringPressable
      style={[s.modePill, active && s.modePillActive]}
      pressedScale={0.94}
      onPress={onPress}
    >
      <Text style={[s.modeText, active && s.modeTextActive]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={s.modeBadge}>
          <Text style={s.modeBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </SpringPressable>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 48, justifyContent: 'center' },
  spacer: { width: 36, height: 36 },
  center: { flex: 1, alignItems: 'center' },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  bellIcon: { fontSize: 16 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  locationChipWrap: { width: '100%' },
  locationChip: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card + 'AA',
  },
  locationChipWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  blurFill: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object) },
  locationInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  pin: { fontSize: 14 },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  edit: { fontSize: 13 },
  modeRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
  },
  modePillActive: {
    backgroundColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.sub,
  },
  modeTextActive: { color: Colors.white },
  modeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  modeBadgeText: { color: Colors.orange, fontSize: 10, fontWeight: '800' },
}));
