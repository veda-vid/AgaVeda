// lib/profileUtils.ts — Profile screen helpers

import { Platform } from 'react-native';
import { RADIUS_OPTIONS, SHOP_CATEGORIES } from '../constants/theme';
import type { Post } from '../types';

export const unicodeProsStyle = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: {},
}) as object;

export const PROFILE_RADIUS_OPTIONS = RADIUS_OPTIONS;
export type ProfileRadiusKm = (typeof PROFILE_RADIUS_OPTIONS)[number];

export function matchesSettingsSearch(query: string, ...haystack: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.some(part => part.toLowerCase().includes(q));
}

export function countDailyBoardPins(
  items: Record<string, unknown>,
  boards: Array<{ item_ids: string[] }>,
): number {
  const unique = new Set<string>();
  for (const board of boards) {
    for (const id of board.item_ids) unique.add(id);
  }
  return unique.size;
}

export function formatCoverageLabel(city?: string | null, radiusKm?: number | null) {
  const place = (city || '').trim() || 'Your area';
  const km = typeof radiusKm === 'number' && Number.isFinite(radiusKm) ? radiusKm : 5;
  return `${place} • ${km} km Coverage`;
}

export function shopHandle(name?: string | null) {
  const slug = (name || 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `@${slug || 'shop'}`;
}

export function formatCompactCount(value?: number | null) {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function formatClockTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(parsed);
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatShopHours(openTime?: string | null, closeTime?: string | null) {
  const open = formatClockTime(openTime);
  const close = formatClockTime(closeTime);
  if (open && close) return `${open} – ${close}`;
  return open || close || null;
}

export function categoryRankLabel(category?: string | null) {
  const meta = SHOP_CATEGORIES.find(item => item.id === category);
  if (!meta) return 'Category Rank';
  if (meta.id === 'toys') return 'Toy Shop Rank';
  return `${meta.label} Rank`;
}

export function formatSellerLevel(tier?: string | null) {
  const match = String(tier || 'Tier 4').match(/(\d+)/);
  return `Level ${match?.[1] || '4'}`;
}

export function hasCaptionTags(caption?: string) {
  return /(^|\s)#[a-z0-9_]+/i.test(caption ?? '');
}

export type ProfilePostItem = Post & {
  shop_name?: string | null;
  shop_logo?: string | null;
  shop_category?: string | null;
  shop_avg_rating?: number | null;
  shop_is_open?: boolean | null;
  saved_at?: string;
  is_repost_entry?: boolean;
  reposted_by_name?: string | null;
  quote_caption?: string | null;
};

export function formatPostDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
