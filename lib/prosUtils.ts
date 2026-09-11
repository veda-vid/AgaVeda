// lib/prosUtils.ts — Pros presence, labels, filters, map pins, and Unicode helpers

import { Platform } from 'react-native';
import { Colors, OTHER_SERVICE_SUBCATEGORIES, SERVICE_CATEGORIES } from '../constants/theme';
import type { ServiceProvider } from '../types';

export const PRO_RADIUS_OPTIONS = [2, 5, 10, 25] as const;
export type ProRadiusKm = (typeof PRO_RADIUS_OPTIONS)[number];

const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const SLATE = '#64748B';

export const unicodeProsStyle = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: {},
}) as object;

export const CAT_TINT: Record<string, string> = {
  all: Colors.orange,
  plumber: Colors.orange,
  electrician: Colors.amber,
  ac_technician: Colors.blue,
  painter: Colors.purple,
  cleaning: Colors.green,
  gardening: Colors.green,
  security: Colors.blue,
  carpenter: Colors.amber,
  pest_control: Colors.purple,
  other: Colors.orange,
};

export function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export function formatLastActive(ts?: string | null): string {
  if (!ts) return 'long ago';
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function isRecentlyActive(ts?: string | null, windowMs = 5 * 60 * 1000): boolean {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() <= windowMs;
}

export function getPresenceDisplay(svc: ServiceProvider): { label: string; color: string; dotColor: string } {
  const status = svc.presence_status ?? 'offline';

  if (svc.is_available && (status === 'online' || isRecentlyActive(svc.last_active_at))) {
    return {
      label: 'Available · Online',
      color: Colors.green,
      dotColor: EMERALD,
    };
  }
  if (!svc.is_available || status === 'away') {
    return { label: 'Away', color: Colors.amber, dotColor: AMBER };
  }
  if (status === 'online' || isRecentlyActive(svc.last_active_at)) {
    return {
      label: 'Online',
      color: Colors.green,
      dotColor: EMERALD,
    };
  }
  if (status === 'custom' && svc.custom_status?.trim()) {
    return { label: svc.custom_status.trim(), color: Colors.purple, dotColor: Colors.purple };
  }
  return {
    label: `Offline · ${formatLastActive(svc.last_active_at)}`,
    color: Colors.dim,
    dotColor: SLATE,
  };
}

/** Map pin color: Green = Online, Amber = Away, Gray = Offline */
export function getProMapPinColor(svc: ServiceProvider): string {
  const status = svc.presence_status ?? 'offline';
  if (status === 'online' || (svc.is_available && isRecentlyActive(svc.last_active_at))) {
    return EMERALD;
  }
  if (status === 'away') return AMBER;
  return SLATE;
}

export function canChatWithPro(svc: ServiceProvider): boolean {
  const status = svc.presence_status ?? 'offline';
  if (status === 'online') return true;
  if (svc.is_available && status !== 'offline') return true;
  return false;
}

export function getProCategoryLabel(svc: ServiceProvider): string {
  if (svc.category === 'other' && svc.subcategory) {
    const sub = OTHER_SERVICE_SUBCATEGORIES.find(c => c.id === svc.subcategory);
    return sub?.label ?? svc.subcategory;
  }
  return SERVICE_CATEGORIES.find(c => c.id === svc.category)?.label ?? svc.category;
}

export function parseProsFilter(filter: string): { category?: string; subcategory?: string } {
  if (filter === 'all') return {};
  if (filter.startsWith('other:')) {
    return { category: 'other', subcategory: filter.slice(6) };
  }
  if (filter === 'other') return { category: 'other' };
  return { category: filter };
}

export function shouldShowSubcategoryChips(filter: string): boolean {
  return filter !== 'all';
}

export function getSubcategoryChipsForFilter(filter: string) {
  return OTHER_SERVICE_SUBCATEGORIES;
}

export function resolveSubcategoryFilter(
  mainFilter: string,
  subId: string | null,
): string {
  if (!subId) {
    if (mainFilter.startsWith('other:')) return 'other';
    return mainFilter;
  }
  if (mainFilter === 'other' || mainFilter.startsWith('other:')) {
    return `other:${subId}`;
  }
  return mainFilter;
}

export function matchesSubcategoryChip(svc: ServiceProvider, subId: string): boolean {
  if (svc.category === 'other') return svc.subcategory === subId;
  const sub = OTHER_SERVICE_SUBCATEGORIES.find(c => c.id === subId);
  if (!sub) return false;
  const hay = `${svc.business_name} ${svc.description} ${svc.subcategory ?? ''}`.toLowerCase();
  return hay.includes(sub.label.toLowerCase()) || hay.includes(sub.id.replace('_', ' '));
}

export function formatProDistance(km?: number): string {
  if (typeof km !== 'number' || Number.isNaN(km)) return '';
  return `${km.toFixed(1)} km`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

export function urgencyLabel(urgency: string): string {
  switch (urgency) {
    case 'emergency': return 'Emergency / Immediate';
    case 'today': return 'Today';
    case 'scheduled': return 'Scheduled Date';
    default: return urgency;
  }
}
