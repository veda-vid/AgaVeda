// constants/theme.ts — Design tokens for CityConnect / Vedastya (live-switchable)

import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { readLocalStorageSync } from '../lib/platformStorage';

export type AppThemeId = 'midnight' | 'sunrise' | 'forest' | 'ocean' | 'sand';

export const THEME_STORAGE_KEY = 'cityconnect.theme';

export const ThemePalettes = {
  midnight: {
    bg: '#08080E',
    surface: '#0F0F1A',
    card: '#141420',
    border: '#1C1C2E',
    border2: '#252538',
    orange: '#FF5722',
    amber: '#FFA726',
    gradient: ['#FF5722', '#FFA726'] as const,
    green: '#00C853',
    blue: '#448AFF',
    purple: '#7C4DFF',
    red: '#FF1744',
    yellow: '#FFD600',
    text: '#F5F0EB',
    sub: '#9997AA',
    dim: '#5A5870',
    white: '#FFFFFF',
    black: '#000000',
  },
  sunrise: {
    bg: '#FFF7F0',
    surface: '#FFFFFF',
    card: '#FFF1E8',
    border: '#F0D6C6',
    border2: '#E3C1AD',
    orange: '#E96A2C',
    amber: '#F5A623',
    gradient: ['#E96A2C', '#F5A623'] as const,
    green: '#1B8A5A',
    blue: '#2F6BFF',
    purple: '#7A4DFF',
    red: '#D93A62',
    yellow: '#E0B83F',
    text: '#2A1C14',
    sub: '#7B5E50',
    dim: '#A28879',
    white: '#FFFFFF',
    black: '#000000',
  },
  forest: {
    bg: '#07110C',
    surface: '#0D1913',
    card: '#12231A',
    border: '#1A3126',
    border2: '#234233',
    orange: '#2F9E67',
    amber: '#8DD06C',
    gradient: ['#2F9E67', '#8DD06C'] as const,
    green: '#34C759',
    blue: '#4DA3FF',
    purple: '#8B7CF6',
    red: '#FF5C79',
    yellow: '#D6C451',
    text: '#EEF7F1',
    sub: '#92AA9C',
    dim: '#5E776A',
    white: '#FFFFFF',
    black: '#000000',
  },
  ocean: {
    bg: '#061018',
    surface: '#0B1A26',
    card: '#102433',
    border: '#1A3347',
    border2: '#25465F',
    orange: '#22B8CF',
    amber: '#66D9E8',
    gradient: ['#1C7ED6', '#22B8CF'] as const,
    green: '#2ECC71',
    blue: '#4DABF7',
    purple: '#748FFC',
    red: '#FF6B6B',
    yellow: '#FCC419',
    text: '#E7F5FF',
    sub: '#8AA4B8',
    dim: '#5C7A90',
    white: '#FFFFFF',
    black: '#000000',
  },
  sand: {
    bg: '#F7F3EA',
    surface: '#FFFDF8',
    card: '#F3EBDD',
    border: '#E4D7C3',
    border2: '#D4C3A8',
    orange: '#C46B2D',
    amber: '#D4A017',
    gradient: ['#C46B2D', '#D4A017'] as const,
    green: '#2F7D4A',
    blue: '#3B6EA5',
    purple: '#7A5CAF',
    red: '#C44536',
    yellow: '#C9A227',
    text: '#2C241B',
    sub: '#7A6A58',
    dim: '#A39482',
    white: '#FFFFFF',
    black: '#000000',
  },
} as const;

export type AppColors = {
  bg: string;
  surface: string;
  card: string;
  border: string;
  border2: string;
  orange: string;
  amber: string;
  gradient: readonly [string, string];
  green: string;
  blue: string;
  purple: string;
  red: string;
  yellow: string;
  text: string;
  sub: string;
  dim: string;
  white: string;
  black: string;
};

export const THEME_OPTIONS = [
  { id: 'midnight' as AppThemeId, label: 'Midnight', accent: ThemePalettes.midnight.orange, note: 'Classic dark', previewBg: ThemePalettes.midnight.bg, previewText: ThemePalettes.midnight.text },
  { id: 'sunrise' as AppThemeId, label: 'Sunrise', accent: ThemePalettes.sunrise.orange, note: 'Warm light', previewBg: ThemePalettes.sunrise.bg, previewText: ThemePalettes.sunrise.text },
  { id: 'forest' as AppThemeId, label: 'Forest', accent: ThemePalettes.forest.orange, note: 'Calm green', previewBg: ThemePalettes.forest.bg, previewText: ThemePalettes.forest.text },
  { id: 'ocean' as AppThemeId, label: 'Ocean', accent: ThemePalettes.ocean.orange, note: 'Cool blue', previewBg: ThemePalettes.ocean.bg, previewText: ThemePalettes.ocean.text },
  { id: 'sand' as AppThemeId, label: 'Sand', accent: ThemePalettes.sand.orange, note: 'Soft daylight', previewBg: ThemePalettes.sand.bg, previewText: ThemePalettes.sand.text },
] as const;

const VALID_THEME_IDS: AppThemeId[] = ['midnight', 'sunrise', 'forest', 'ocean', 'sand'];

export function normalizeThemeId(value?: string | null): AppThemeId {
  if (value && VALID_THEME_IDS.includes(value as AppThemeId)) return value as AppThemeId;
  return 'midnight';
}

export function getThemeMeta(themeId: AppThemeId) {
  const isLight = themeId === 'sunrise' || themeId === 'sand';
  return {
    isLight,
    statusBar: isLight ? 'dark' as const : 'light' as const,
    label: THEME_OPTIONS.find(o => o.id === themeId)?.label ?? 'Midnight',
  };
}

function readStoredThemeId(): AppThemeId {
  // Sync DOM read on web only — native hydrates via themeStore + AsyncStorage.
  return normalizeThemeId(readLocalStorageSync(THEME_STORAGE_KEY));
}

/** Mutable live theme id (kept in sync by applyThemePalette / themeStore). */
export let CurrentThemeId: AppThemeId = readStoredThemeId();

/**
 * Shared mutable color tokens. Always mutate via applyThemePalette so every
 * screen reads the active palette (including light-theme text on light backgrounds).
 */
export const Colors: AppColors = { ...ThemePalettes[CurrentThemeId] };

export function applyThemePalette(themeId: AppThemeId) {
  const id = normalizeThemeId(themeId);
  CurrentThemeId = id;
  const next = ThemePalettes[id] as AppColors;
  (Object.keys(next) as (keyof AppColors)[]).forEach(key => {
    Colors[key] = next[key] as never;
  });
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Theme-aware styles without Proxy (Hermes/Android throws on Proxy property misses).
 * Each style key is a getter that resolves the StyleSheet for CurrentThemeId.
 */
export function createDynamicStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (C: AppColors) => T,
): T {
  const cache = new Map<AppThemeId, T>();

  const resolve = (): T => {
    const id = CurrentThemeId;
    const cached = cache.get(id);
    if (cached) return cached;
    const created = StyleSheet.create(factory(ThemePalettes[id] as AppColors) as T) as T;
    cache.set(id, created);
    return created;
  };

  const probe = factory(ThemePalettes.midnight as AppColors);
  const out = {} as T;
  (Object.keys(probe) as (keyof T)[]).forEach(key => {
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: true,
      get() {
        return (resolve() as T)[key];
      },
    });
  });
  return out;
}

export const DEFAULT_SHOP_BIO = 'Hey, I am new in the market. with hi smiles';

export const Fonts = {
  display: 'Syne_700Bold',
  displayXBold: 'Syne_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  orange: {
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const SHOP_CATEGORIES = [
  { id: 'grocery', label: 'Grocery', emoji: '🛒' },
  { id: 'electronics', label: 'Electronics', emoji: '💻' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'food', label: 'Food', emoji: '🍔' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
  { id: 'automobile', label: 'Automobile', emoji: '🚗' },
  { id: 'furniture', label: 'Furniture', emoji: '🛋️' },
  { id: 'beauty', label: 'Beauty', emoji: '💄' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'toys', label: 'Toys', emoji: '🧸' },
  { id: 'pet_supplies', label: 'Pet Supplies', emoji: '🐾' },
  { id: 'home_decor', label: 'Home Decor', emoji: '🪴' },
  { id: 'jewelry', label: 'Jewelry', emoji: '💍' },
  { id: 'watches', label: 'Watches', emoji: '⌚' },
  { id: 'footwear', label: 'Footwear', emoji: '👟' },
  { id: 'baby_kids', label: 'Baby & Kids', emoji: '🍼' },
  { id: 'stationery', label: 'Stationery', emoji: '✏️' },
  { id: 'gifts', label: 'Gifts', emoji: '🎁' },
  { id: 'florists', label: 'Florists', emoji: '💐' },
  { id: 'hardware', label: 'Hardware', emoji: '🛠️' },
  { id: 'kitchenware', label: 'Kitchenware', emoji: '🍳' },
  { id: 'mobile_accessories', label: 'Mobile Accessories', emoji: '📱' },
  { id: 'computer_accessories', label: 'Computer Accessories', emoji: '🖱️' },
  { id: 'appliances', label: 'Appliances', emoji: '🧯' },
  { id: 'bakery', label: 'Bakery', emoji: '🥖' },
  { id: 'cafe', label: 'Cafe', emoji: '☕' },
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { id: 'meat_seafood', label: 'Meat & Seafood', emoji: '🐟' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'organic', label: 'Organic', emoji: '🌿' },
  { id: 'liquor', label: 'Liquor', emoji: '🍷' },
  { id: 'eyewear', label: 'Eyewear', emoji: '👓' },
  { id: 'luggage', label: 'Luggage', emoji: '🧳' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'art_crafts', label: 'Art & Crafts', emoji: '🎨' },
  { id: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { id: 'medical_supplies', label: 'Medical Supplies', emoji: '🩺' },
  { id: 'industrial', label: 'Industrial', emoji: '🏭' },
  { id: 'gardening', label: 'Gardening', emoji: '🌱' },
  { id: 'cleaning_supplies', label: 'Cleaning Supplies', emoji: '🧴' },
  { id: 'fabrics', label: 'Fabrics', emoji: '🧵' },
  { id: 'tailoring', label: 'Tailoring', emoji: '✂️' },
  { id: 'salon', label: 'Salon', emoji: '💇' },
  { id: 'spa', label: 'Spa', emoji: '🧖' },
  { id: 'bicycle', label: 'Bicycle', emoji: '🚲' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'religious', label: 'Religious', emoji: '🪔' },
  { id: 'other', label: 'Other', emoji: '🏪' },
] as const;

export const SERVICE_CATEGORIES = [
  { id: 'plumber', label: 'Plumber', emoji: '🔧' },
  { id: 'electrician', label: 'Electrician', emoji: '⚡' },
  { id: 'ac_technician', label: 'AC Technician', emoji: '❄️' },
  { id: 'painter', label: 'Painter', emoji: '🖌️' },
  { id: 'cleaning', label: 'Cleaning', emoji: '🧹' },
  { id: 'gardening', label: 'Gardening', emoji: '🌿' },
  { id: 'security', label: 'Security', emoji: '🔒' },
  { id: 'carpenter', label: 'Carpenter', emoji: '🪚' },
  { id: 'pest_control', label: 'Pest Control', emoji: '🐛' },
  { id: 'other', label: 'Other', emoji: '🛠️' },
] as const;

/** Sub-skills shown under the "Other" filter dropdown on Pros */
export const OTHER_SERVICE_SUBCATEGORIES = [
  { id: 'mistri', label: 'Mistri / Mason' },
  { id: 'majdoor', label: 'Majdoor / Labour' },
  { id: 'welder', label: 'Welder' },
  { id: 'mechanic', label: 'Mechanic' },
  { id: 'appliance_repair', label: 'Appliance Repair' },
  { id: 'masonry', label: 'Masonry' },
  { id: 'glasswork', label: 'Glasswork' },
  { id: 'fabricator', label: 'Fabricator' },
] as const;

export const RADIUS_OPTIONS = [2, 5, 10, 25, 50] as const;
