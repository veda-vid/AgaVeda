// components/marketplace/FilterBar.tsx — Glassmorphic radius + category chips

import type { ReactNode } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Colors, Fonts, SHOP_CATEGORIES, createDynamicStyles, getThemeMeta, CurrentThemeId,
} from '../../constants/theme';
import { MARKETPLACE_RADIUS_OPTIONS, unicodeMarketplaceStyle } from '../../lib/marketplaceUtils';
import { hexAlpha } from './marketplaceMedia';
import { ScalePressable } from '../services/ServiceIcons';
import Svg, { Circle, Path } from 'react-native-svg';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All', emoji: '🏬' },
  ...SHOP_CATEGORIES,
];

function IconSearch({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} />
      <Path d="M16 16l5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type Props = {
  filter: string;
  radiusKm: number;
  matchCount: number;
  viewMode: 'list' | 'map';
  search: string;
  searchFocused: boolean;
  onChangeFilter: (id: string) => void;
  onChangeRadius: (km: number) => void;
  onChangeViewMode: (mode: 'list' | 'map') => void;
  onChangeSearch: (q: string) => void;
  onSearchFocus: (v: boolean) => void;
};

function GlassRail({ children }: { children: ReactNode }) {
  const light = getThemeMeta(CurrentThemeId).isLight;
  if (Platform.OS === 'web') {
    return <View style={[s.glass, s.glassWeb]}>{children}</View>;
  }
  return (
    <View style={s.glass}>
      <BlurView
        intensity={22}
        tint={light ? 'light' : 'dark'}
        style={s.blurFill}
      />
      <View style={s.glassInner}>{children}</View>
    </View>
  );
}

export function FilterBar({
  filter,
  radiusKm,
  matchCount,
  viewMode,
  search,
  searchFocused,
  onChangeFilter,
  onChangeRadius,
  onChangeViewMode,
  onChangeSearch,
  onSearchFocus,
}: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.toolbarRow}>
        <View style={[s.searchWrap, searchFocused && s.searchWrapFocused, { flex: 1 }]}>
          <IconSearch color={searchFocused ? Colors.orange : Colors.dim} size={18} />
          <TextInput
            style={[s.searchInput, unicodeMarketplaceStyle]}
            value={search}
            onChangeText={onChangeSearch}
            onFocus={() => onSearchFocus(true)}
            onBlur={() => onSearchFocus(false)}
            placeholder="Search shops, categories, or products"
            placeholderTextColor={Colors.dim}
            returnKeyType="search"
          />
          {search.trim() ? (
            <Text style={s.resultCount}>{matchCount}</Text>
          ) : null}
        </View>
        <View style={s.viewToggle}>
          {(['list', 'map'] as const).map(mode => (
            <ScalePressable
              key={mode}
              pressedScale={0.96}
              style={[s.viewToggleBtn, viewMode === mode && s.viewToggleBtnActive]}
              onPress={() => onChangeViewMode(mode)}
            >
              <Text style={[s.viewToggleText, viewMode === mode && s.viewToggleTextActive]}>
                {mode === 'list' ? 'List' : 'Map'}
              </Text>
            </ScalePressable>
          ))}
        </View>
      </View>

      <GlassRail>
        <FlashList
          data={[...MARKETPLACE_RADIUS_OPTIONS]}
          horizontal
          estimatedItemSize={72}
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => `r-${item}`}
          contentContainerStyle={s.railContent}
          renderItem={({ item }) => {
            const active = radiusKm === item;
            return (
              <ScalePressable
                pressedScale={0.96}
                style={[s.radiusChip, active && s.radiusChipActive]}
                onPress={() => onChangeRadius(item)}
              >
                <Text style={[s.radiusChipText, active && s.radiusChipTextActive]}>
                  {item} km
                </Text>
              </ScalePressable>
            );
          }}
        />
      </GlassRail>

      <Animated.View entering={FadeIn.duration(220)}>
        <Text style={s.matchPill}>
          {matchCount === 1
            ? '1 shop found nearby'
            : `${matchCount} shops found nearby`}
        </Text>
      </Animated.View>

      <GlassRail>
        <FlashList
          data={CATEGORY_FILTERS}
          horizontal
          estimatedItemSize={110}
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={s.railContent}
          renderItem={({ item }) => {
            const active = filter === item.id;
            return (
              <ScalePressable
                pressedScale={0.96}
                style={[s.chip, active && s.chipActive]}
                onPress={() => onChangeFilter(item.id)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {item.emoji} {item.label}
                </Text>
              </ScalePressable>
            );
          }}
        />
      </GlassRail>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { gap: 8, marginTop: 4 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    paddingHorizontal: 12,
  },
  searchWrapFocused: { borderColor: Colors.orange },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.body,
    paddingVertical: 11,
  },
  resultCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: hexAlpha(Colors.orange, '22'),
    color: Colors.orange,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 26,
    overflow: 'hidden',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    overflow: 'hidden',
  },
  viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  viewToggleBtnActive: { backgroundColor: Colors.orange },
  viewToggleText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  viewToggleTextActive: { color: Colors.white },
  glass: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: hexAlpha(Colors.card, 'AA'),
    height: 48,
  },
  glassWeb: { paddingVertical: 0 },
  blurFill: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object) },
  glassInner: { height: 48, justifyContent: 'center' },
  railContent: { paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  radiusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  radiusChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusChipText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  radiusChipTextActive: { color: Colors.white },
  matchPill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.orange,
    backgroundColor: hexAlpha(Colors.orange, '18'),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.sub },
  chipTextActive: { color: Colors.white },
}));
