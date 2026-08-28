// lib/prosUtils.ts — Pros presence, labels, and filter helpers

import { Colors, OTHER_SERVICE_SUBCATEGORIES, SERVICE_CATEGORIES } from '../constants/theme';
import type { ServiceProvider } from '../types';

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

  if (status === 'online' || (svc.is_available && isRecentlyActive(svc.last_active_at))) {
    return {
      label: svc.is_available ? '🟢 Available' : '🟢 Online',
      color: Colors.green,
      dotColor: Colors.green,
    };
  }
  if (status === 'away') {
    return { label: '🟡 Away', color: Colors.amber, dotColor: Colors.amber };
  }
  if (status === 'custom' && svc.custom_status?.trim()) {
    return { label: svc.custom_status.trim(), color: Colors.purple, dotColor: Colors.purple };
  }
  return {
    label: `🔴 Offline (${formatLastActive(svc.last_active_at)})`,
    color: Colors.dim,
    dotColor: Colors.dim,
  };
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

export function otherFilterLabel(filter: string, otherSubOpen: boolean): string {
  if (!filter.startsWith('other')) return 'Other';
  if (filter === 'other') return otherSubOpen ? 'Other ▴' : 'Other ▾';
  const sub = OTHER_SERVICE_SUBCATEGORIES.find(c => `other:${c.id}` === filter);
  return sub?.label ?? 'Other';
}
