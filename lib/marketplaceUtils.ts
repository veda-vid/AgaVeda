// lib/marketplaceUtils.ts — Marketplace shop presence, hours, and chat helpers

import { Colors } from '../constants/theme';
import { SHOP_CATEGORIES } from '../constants/theme';
import type { Shop } from '../types';
import {
  getWeekdayKey, parseShopTimeToMinutes, formatTimeLabel,
} from './shopScheduleUtils';
import type { ShopOperatingHours } from '../types';

export const CLOSING_SOON_MINUTES = 30;

export type ShopHoursState =
  | 'open'
  | 'closing_soon'
  | 'closed_before_open'
  | 'closed_after_close'
  | 'unknown';

const EMERALD = '#10B981';
const SLATE = '#64748B';
const AMBER = '#F59E0B';
const ROSE = '#E11D48';

export interface ShopStatusGlassTheme {
  glassBg: string;
  glassBorder: string;
  textColor: string;
  dotColor?: string;
}

export interface ShopStatusDisplay {
  state: ShopHoursState;
  badge: string;
  shortLabel: string;
  badgeBg: string;
  badgeColor: string;
  glass: ShopStatusGlassTheme;
  /** Exact daily hours shown under shop name, e.g. "9:00 AM – 6:00 PM" */
  hoursLabel: string | null;
  /** Secondary status line (closing time, etc.) */
  subline: string | null;
  announcement: string | null;
  actionsEnabled: boolean;
  /** Chat allowed when closed (leave a message) */
  allowInquiry: boolean;
  cardDimmed: boolean;
  showPulse: boolean;
}

function glassTheme(tint: string, alpha = 'BF'): ShopStatusGlassTheme {
  return {
    glassBg: hexAlpha(tint, alpha),
    glassBorder: hexAlpha('#FFFFFF', '55'),
    textColor: '#FFFFFF',
    dotColor: '#FFFFFF',
  };
}

function hexAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/** Resolved hours string from schedule or legacy open/close columns. */
export function resolveShopHoursLabel(shop: Shop, now: Date = new Date()): string | null {
  const oh = shop.operating_hours;
  if (oh?.is24_7) return 'Open 24 hours';
  if (oh?.schedule) {
    const dayKey = getWeekdayKey(now);
    const day = oh.schedule[dayKey];
    if (day?.enabled) {
      return `${formatTimeLabel(day.open)} – ${formatTimeLabel(day.close)}`;
    }
  }
  return formatShopHours(shop.open_time, shop.close_time);
}

function parseMinutesFromShopTime(value?: string | null): number | null {
  return parseShopTimeToMinutes(value);
}

export function formatClockTime(value?: string | null): string | null {
  const mins = parseShopTimeToMinutes(value);
  if (mins != null) return formatTimeLabel(minutesToTimeString(mins));
  return null;
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatShopHours(openTime?: string | null, closeTime?: string | null): string | null {
  const open = formatClockTime(openTime);
  const close = formatClockTime(closeTime);
  if (open && close) return `${open} – ${close}`;
  return open || close || null;
}

/** Evaluate open/closed from minute values. Inclusive start, exclusive end. */
function evaluateHoursWindow(
  openMin: number,
  closeMin: number,
  currentMin: number,
): ShopHoursState {
  if (openMin === closeMin) return 'closed_after_close';

  if (closeMin > openMin) {
    if (currentMin < openMin) return 'closed_before_open';
    if (currentMin >= closeMin) return 'closed_after_close';
    if (closeMin - currentMin <= CLOSING_SOON_MINUTES) return 'closing_soon';
    return 'open';
  }

  // Overnight window (e.g. 22:00 → 06:00)
  const isOpen = currentMin >= openMin || currentMin < closeMin;
  if (!isOpen) return 'closed_before_open';
  const minsToClose = currentMin >= openMin
    ? (1440 - currentMin) + closeMin
    : closeMin - currentMin;
  if (minsToClose <= CLOSING_SOON_MINUTES) return 'closing_soon';
  return 'open';
}

/** Compare user's local time against shop open/close window. */
export function getShopHoursState(
  openTime?: string | null,
  closeTime?: string | null,
  now: Date = new Date(),
  operatingHours?: ShopOperatingHours | null,
): ShopHoursState {
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (operatingHours?.schedule) {
    if (operatingHours.closedToday) return 'closed_after_close';
    if (operatingHours.is24_7) return 'open';
    const dayKey = getWeekdayKey(now);
    const day = operatingHours.schedule[dayKey];
    if (!day?.enabled) return 'closed_after_close';

    const openMin = parseShopTimeToMinutes(day.open);
    const closeMin = parseShopTimeToMinutes(day.close);
    if (openMin == null || closeMin == null) return 'unknown';

    return evaluateHoursWindow(openMin, closeMin, currentMin);
  }

  const openMin = parseMinutesFromShopTime(openTime);
  const closeMin = parseMinutesFromShopTime(closeTime);
  if (openMin == null || closeMin == null) return 'unknown';

  return evaluateHoursWindow(openMin, closeMin, currentMin);
}

/** @deprecated Use getShopHoursState — kept for callers that only need a boolean. */
export function isShopWithinHours(
  openTime?: string | null,
  closeTime?: string | null,
  now: Date = new Date(),
): boolean {
  const state = getShopHoursState(openTime, closeTime, now);
  return state === 'open' || state === 'closing_soon';
}

export function formatLastActive(ts?: string | null): string {
  if (!ts) return 'long ago';
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getShopCategoryLabel(category: string): string {
  return SHOP_CATEGORIES.find(c => c.id === category)?.label ?? category;
}

function statusBase(
  shop: Shop,
  now: Date,
  hoursState: ShopHoursState,
): Omit<ShopStatusDisplay, 'badge' | 'shortLabel' | 'badgeBg' | 'badgeColor' | 'glass' | 'subline' | 'actionsEnabled' | 'allowInquiry' | 'cardDimmed' | 'showPulse'> {
  const hoursLabel = resolveShopHoursLabel(shop, now);
  return {
    state: hoursState,
    hoursLabel,
    announcement: shop.status_message?.trim() || null,
  };
}

export function getShopStatusDisplay(
  shop: Shop,
  now: Date = new Date(),
): ShopStatusDisplay {
  const operatingHours = shop.operating_hours ?? null;
  const hoursState = getShopHoursState(shop.open_time, shop.close_time, now, operatingHours);
  const openLabel = formatClockTime(shop.open_time);
  const closeLabel = formatClockTime(shop.close_time);
  const presence = shop.presence_status ?? (shop.is_open ? 'open' : 'closed');
  const base = statusBase(shop, now, hoursState);
  const hoursSub = base.hoursLabel ? `🕒 ${base.hoursLabel}` : null;

  if (hoursState === 'unknown') {
    const fallbackOpen = presence === 'open' || presence === 'busy';
    const tint = fallbackOpen ? EMERALD : SLATE;
    return {
      ...base,
      badge: fallbackOpen ? '🟢 Open Now' : '🔴 Closed',
      shortLabel: fallbackOpen ? 'Open Now' : 'Closed',
      badgeBg: tint,
      badgeColor: '#FFFFFF',
      glass: glassTheme(tint),
      subline: base.hoursLabel ? hoursSub : null,
      actionsEnabled: fallbackOpen && shop.accepts_messages !== false,
      allowInquiry: !fallbackOpen && shop.accepts_messages !== false,
      cardDimmed: !fallbackOpen,
      showPulse: fallbackOpen,
    };
  }

  if (hoursState === 'closed_before_open') {
    const todayOpen = operatingHours?.schedule?.[getWeekdayKey(now)]?.open;
    const opensAt = todayOpen ? formatTimeLabel(todayOpen) : openLabel;
    const shortLabel = opensAt ? `Closed • Opens ${opensAt}` : 'Closed';
    return {
      ...base,
      badge: `🔴 ${shortLabel}`,
      shortLabel,
      badgeBg: ROSE,
      badgeColor: '#FFFFFF',
      glass: glassTheme(ROSE),
      subline: opensAt ? `Opens at ${opensAt}` : 'Outside business hours',
      actionsEnabled: false,
      allowInquiry: shop.accepts_messages !== false,
      cardDimmed: true,
      showPulse: false,
    };
  }

  if (hoursState === 'closed_after_close') {
    return {
      ...base,
      badge: '🔴 Closed for today',
      shortLabel: 'Closed for today',
      badgeBg: SLATE,
      badgeColor: '#FFFFFF',
      glass: glassTheme(SLATE, 'CC'),
      subline: hoursSub ?? 'Closed for today',
      actionsEnabled: false,
      allowInquiry: shop.accepts_messages !== false,
      cardDimmed: true,
      showPulse: false,
    };
  }

  if (hoursState === 'closing_soon') {
    const todayClose = operatingHours?.schedule?.[getWeekdayKey(now)]?.close;
    const closesAt = todayClose ? formatTimeLabel(todayClose) : closeLabel;
    return {
      ...base,
      badge: '🟠 Closes Soon',
      shortLabel: 'Closes Soon',
      badgeBg: AMBER,
      badgeColor: '#FFFFFF',
      glass: glassTheme(AMBER),
      subline: closesAt ? `Closes at ${closesAt}` : hoursSub,
      actionsEnabled: shop.accepts_messages !== false && presence !== 'closed',
      allowInquiry: false,
      cardDimmed: false,
      showPulse: false,
    };
  }

  if (presence === 'busy') {
    return {
      ...base,
      badge: '🟡 Busy',
      shortLabel: 'Busy',
      badgeBg: Colors.amber,
      badgeColor: '#FFFFFF',
      glass: glassTheme(Colors.amber),
      subline: base.hoursLabel ? `Busy • ${base.hoursLabel}` : 'Busy right now',
      actionsEnabled: shop.accepts_messages !== false,
      allowInquiry: false,
      cardDimmed: false,
      showPulse: false,
    };
  }

  if (presence === 'custom') {
    return {
      ...base,
      badge: base.announcement ?? '📢 Shop update',
      shortLabel: base.announcement ?? 'Shop update',
      badgeBg: Colors.purple,
      badgeColor: '#FFFFFF',
      glass: glassTheme(Colors.purple),
      subline: hoursSub,
      actionsEnabled: shop.accepts_messages !== false,
      allowInquiry: false,
      cardDimmed: false,
      showPulse: false,
    };
  }

  // hoursState is 'open' — business hours take precedence over stale DB flags
  return {
    ...base,
    badge: '🟢 Open Now',
    shortLabel: 'Open Now',
    badgeBg: EMERALD,
    badgeColor: '#FFFFFF',
    glass: glassTheme(EMERALD),
    subline: hoursSub ?? 'Open now',
    actionsEnabled: shop.accepts_messages !== false,
    allowInquiry: false,
    cardDimmed: false,
    showPulse: true,
  };
}

/** @deprecated Alias for getShopStatusDisplay — returns legacy shape for gradual migration. */
export function getShopPresenceDisplay(
  shop: Shop,
  now: Date = new Date(),
): {
  badge: string;
  color: string;
  hoursLine: string | null;
  announcement: string | null;
} {
  const status = getShopStatusDisplay(shop, now);
  return {
    badge: status.badge,
    color: status.badgeBg,
    hoursLine: status.subline,
    announcement: status.announcement,
  };
}

/** Call/chat button labels and enabled flags — driven by `getShopHoursState()` only. */
export interface ShopActionState {
  hoursState: ShopHoursState;
  callEnabled: boolean;
  callLabel: string;
  chatEnabled: boolean;
  chatLabel: string;
  inquiryEnabled: boolean;
  usePrimaryActions: boolean;
}

export function getShopActionState(shop: Shop, now: Date = new Date()): ShopActionState {
  const hoursState = getShopHoursState(
    shop.open_time,
    shop.close_time,
    now,
    shop.operating_hours ?? null,
  );
  const acceptsMessages = shop.accepts_messages !== false;
  const isOpen = hoursState === 'open' || hoursState === 'closing_soon';

  if (hoursState === 'open') {
    return {
      hoursState,
      callEnabled: true,
      callLabel: 'Call Shop',
      chatEnabled: acceptsMessages,
      chatLabel: 'Chat',
      inquiryEnabled: false,
      usePrimaryActions: true,
    };
  }

  if (hoursState === 'closing_soon') {
    return {
      hoursState,
      callEnabled: true,
      callLabel: 'Call Shop (Closing Soon)',
      chatEnabled: acceptsMessages,
      chatLabel: 'Chat',
      inquiryEnabled: false,
      usePrimaryActions: true,
    };
  }

  if (hoursState === 'closed_before_open' || hoursState === 'closed_after_close') {
    return {
      hoursState,
      callEnabled: false,
      callLabel: 'Shop Closed',
      chatEnabled: false,
      chatLabel: acceptsMessages ? 'Leave Message' : 'Shop Closed',
      inquiryEnabled: acceptsMessages,
      usePrimaryActions: false,
    };
  }

  // unknown — fall back to legacy flags
  const presence = shop.presence_status ?? (shop.is_open ? 'open' : 'closed');
  const fallbackOpen = presence === 'open' || presence === 'busy';
  return {
    hoursState,
    callEnabled: fallbackOpen,
    callLabel: fallbackOpen ? 'Call Shop' : 'Shop Closed',
    chatEnabled: fallbackOpen && acceptsMessages,
    chatLabel: fallbackOpen ? 'Chat' : (acceptsMessages ? 'Leave Message' : 'Shop Closed'),
    inquiryEnabled: !fallbackOpen && acceptsMessages,
    usePrimaryActions: fallbackOpen,
  };
}

export function canChatWithShop(shop: Shop, now: Date = new Date()): boolean {
  const actions = getShopActionState(shop, now);
  return actions.chatEnabled || actions.inquiryEnabled;
}

export function canCallShop(shop: Shop, now: Date = new Date()): boolean {
  return getShopActionState(shop, now).callEnabled;
}

export function formatDistanceKm(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Nearby';
  return `${value.toFixed(1)} km`;
}
