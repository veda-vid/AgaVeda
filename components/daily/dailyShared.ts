// components/daily/dailyShared.ts — Shared Daily UI constants & helpers

import type { DailyRegion } from '../../lib/dailyPublicFeed';
import { Platform } from 'react-native';
import { Colors } from '../../constants/theme';
import type { CityNewsCategory } from '../../types';

export type { DailyRegion };

export function formatCityDisplay(city: string) {
  const trimmed = city.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Tab label for the auto-detected local region */
export function localRegionTabLabel(city: string) {
  const name = formatCityDisplay(city);
  return name || 'Your city';
}

export const DAILY_REGIONS: Array<{ id: DailyRegion; label: string; emoji: string }> = [
  { id: 'local', label: 'City', emoji: '📍' },
  { id: 'national', label: 'National', emoji: '🇮🇳' },
  { id: 'international', label: 'International', emoji: '🌐' },
];

export const DAILY_CATEGORIES: Array<{ id: DailyFilterId; label: string; emoji: string }> = [
  { id: 'all', label: 'All', emoji: '📰' },
  { id: 'general', label: 'Top', emoji: '🔥' },
  { id: 'alerts', label: 'Alerts', emoji: '🚨' },
  { id: 'event', label: 'Events', emoji: '📍' },
  { id: 'weather', label: 'Weather', emoji: '⛅' },
  { id: 'rates', label: 'Rates', emoji: '💹' },
  { id: 'pins', label: 'Pins', emoji: '📌' },
];

/** System-safe text for Hindi / English Unicode content. */
export const unicodeContentStyle = Platform.select({
  web: {
    fontFamily: 'system-ui, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", sans-serif',
  } as object,
  default: { fontFamily: undefined },
});

export type DailyFilterId = 'all' | 'pins' | CityNewsCategory;

/** Instagram-style pulsing live status for masonry tiles */
export function liveStatusBadge(item: {
  category: CityNewsCategory;
  city?: string;
  widget?: { kind?: string; live?: boolean; cadence?: string } | null;
  media_type?: string | null;
}) {
  if (item.category === 'alerts') {
    return { text: '🚨 ALERT', accent: '#FF4444', pulse: true };
  }
  if (item.category === 'rates' || (item.widget && item.widget.live !== false)) {
    if (item.widget?.cadence === 'weekly') {
      return { text: '📅 WEEKLY', accent: '#A855F7', pulse: false };
    }
    return { text: '🟢 LIVE SPOT', accent: '#22C55E', pulse: true };
  }
  if (item.city && item.city !== 'National' && item.city !== 'International') {
    return { text: '⚡ LOCAL', accent: '#3B82F6', pulse: true };
  }
  if (item.media_type === 'video') {
    return { text: '▶ SPARK', accent: '#F97316', pulse: false };
  }
  return { text: '📰 TOP', accent: Colors.orange, pulse: false };
}

/** Neon-accent tile badge for masonry cards */
export function tileCategoryBadge(item: {
  category: CityNewsCategory;
  city?: string;
  widget?: { kind?: string } | null;
  media_type?: string | null;
}) {
  if (item.category === 'alerts') {
    return { label: 'Alert', emoji: '🚨', accent: '#FF4444' };
  }
  if (item.category === 'rates' || item.widget) {
    return { label: 'Market Rate', emoji: '💹', accent: '#22C55E' };
  }
  if (item.category === 'weather') {
    return { label: 'Weather', emoji: '⛅', accent: '#38BDF8' };
  }
  if (item.category === 'event') {
    return { label: 'Event', emoji: '📍', accent: '#A855F7' };
  }
  if (item.media_type === 'video') {
    return { label: 'Moment', emoji: '▶', accent: '#F97316' };
  }
  if (item.city && item.city !== 'National' && item.city !== 'International') {
    return { label: 'Local News', emoji: '⚡', accent: '#3B82F6' };
  }
  return { label: 'Top Story', emoji: '📰', accent: Colors.orange };
}

export function categoryMeta(category: CityNewsCategory) {
  return DAILY_CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '📰' };
}

export function formatTimeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (Number.isNaN(seconds) || seconds < 0) return 'now';
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
