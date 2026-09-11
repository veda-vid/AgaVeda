// components/marketplace/marketplaceMedia.ts

import { SHOP_CATEGORIES } from '../../constants/theme';
import { getSupabaseConfig } from '../../lib/config';

const { url: SUPABASE_URL } = getSupabaseConfig();

export function resolveShopMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!SUPABASE_URL) return value;
  const base = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\//, '')}`;
}

export function categoryMeta(category: string) {
  return SHOP_CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '🏪' };
}

export function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}
