// constants/theme.ts — Design tokens for CityConnect

export const Colors = {
  // Core backgrounds
  bg:       '#08080E',
  surface:  '#0F0F1A',
  card:     '#141420',
  border:   '#1C1C2E',
  border2:  '#252538',

  // Brand
  orange:   '#FF5722',
  amber:    '#FFA726',
  gradient: ['#FF5722', '#FFA726'] as const,

  // Semantic
  green:    '#00C853',
  blue:     '#448AFF',
  purple:   '#7C4DFF',
  red:      '#FF1744',
  yellow:   '#FFD600',

  // Text
  text:     '#F5F0EB',
  sub:      '#9997AA',
  dim:      '#5A5870',
  white:    '#FFFFFF',
  black:    '#000000',
} as const;

export const DEFAULT_SHOP_BIO = 'Hey, I am new in the market. with hi smiles';

export const Fonts = {
  display: 'Syne_700Bold',
  displayXBold: 'Syne_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 9999,
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
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
  { id: 'grocery',     label: 'Grocery',      emoji: '🛒' },
  { id: 'electronics', label: 'Electronics',  emoji: '💻' },
  { id: 'fashion',     label: 'Fashion',      emoji: '👗' },
  { id: 'food',        label: 'Food',         emoji: '🍔' },
  { id: 'pharmacy',    label: 'Pharmacy',     emoji: '💊' },
  { id: 'automobile',  label: 'Automobile',   emoji: '🚗' },
  { id: 'furniture',   label: 'Furniture',    emoji: '🛋️' },
  { id: 'beauty',      label: 'Beauty',       emoji: '💄' },
  { id: 'sports',      label: 'Sports',       emoji: '⚽' },
  { id: 'books',       label: 'Books',        emoji: '📚' },
  { id: 'other',       label: 'Other',        emoji: '🏪' },
] as const;

export const SERVICE_CATEGORIES = [
  { id: 'plumber',      label: 'Plumber',       emoji: '🔧' },
  { id: 'electrician',  label: 'Electrician',   emoji: '⚡' },
  { id: 'ac_technician',label: 'AC Technician', emoji: '❄️' },
  { id: 'painter',      label: 'Painter',       emoji: '🖌️' },
  { id: 'cleaning',     label: 'Cleaning',      emoji: '🧹' },
  { id: 'gardening',    label: 'Gardening',     emoji: '🌿' },
  { id: 'security',     label: 'Security',      emoji: '🔒' },
  { id: 'carpenter',    label: 'Carpenter',     emoji: '🪚' },
  { id: 'pest_control', label: 'Pest Control',  emoji: '🐛' },
  { id: 'other',        label: 'Other',         emoji: '🛠️' },
] as const;

export const RADIUS_OPTIONS = [2, 5, 10, 20, 50] as const;
