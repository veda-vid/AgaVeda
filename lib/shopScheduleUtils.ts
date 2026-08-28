// lib/shopScheduleUtils.ts — Weekly operating schedule helpers for seller shops

import type { Shop, ShopDayHours, ShopOperatingHours } from '../types';

export const WEEKDAYS = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]['key'];

export interface DayHours extends ShopDayHours {}

export type WeeklySchedule = Record<WeekdayKey, DayHours>;

export type { ShopOperatingHours };

const DAY_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function getWeekdayKey(date: Date = new Date()): WeekdayKey {
  return DAY_KEYS[date.getDay()] as WeekdayKey;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Normalize any shop time string to minutes since midnight (local 24h).
 * Supports: "14:00", "2:00 PM", "02:00 PM", ISO datetimes, "14:00:00".
 */
export function parseShopTimeToMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toLowerCase() === 'pm') hour += 12;
    return hour * 60 + Number(twelveHour[2]);
  }

  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return hour * 60 + minute;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.getHours() * 60 + parsed.getMinutes();
  }

  return null;
}

/** @deprecated Use parseShopTimeToMinutes */
export function timeStringToMinutes(value: string): number | null {
  return parseShopTimeToMinutes(value);
}

export function formatTimeLabel(value: string): string {
  const mins = parseShopTimeToMinutes(value);
  if (mins == null) return value;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad2(m)} ${suffix}`;
}

export function defaultDayHours(open = '09:00', close = '20:00', enabled = true): DayHours {
  return { enabled, open, close };
}

export function defaultWeeklySchedule(): WeeklySchedule {
  const day = defaultDayHours();
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day, enabled: true, open: '10:00', close: '18:00' },
    sun: { ...day, enabled: false },
  };
}

export function presetStandardHours(): WeeklySchedule {
  return defaultWeeklySchedule();
}

export function preset24_7Schedule(): WeeklySchedule {
  const day = defaultDayHours('00:00', '23:59', true);
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

function parseMinutesFromShopTime(value?: string | null): number | null {
  return parseShopTimeToMinutes(value);
}

export function scheduleFromLegacyTimes(openTime?: string, closeTime?: string): WeeklySchedule {
  const openMin = parseMinutesFromShopTime(openTime);
  const closeMin = parseMinutesFromShopTime(closeTime);
  const open = openMin != null ? minutesToTimeString(openMin) : '09:00';
  const close = closeMin != null ? minutesToTimeString(closeMin) : '20:00';
  const base = defaultDayHours(open, close, true);
  return {
    mon: { ...base },
    tue: { ...base },
    wed: { ...base },
    thu: { ...base },
    fri: { ...base },
    sat: { ...base },
    sun: { ...base, enabled: false },
  };
}

export function parseOperatingHours(shop: Partial<Shop>): ShopOperatingHours {
  const raw = shop.operating_hours;
  if (raw?.schedule) {
    const base = defaultWeeklySchedule();
    const merged = { ...base };
    for (const key of Object.keys(base) as WeekdayKey[]) {
      if (raw.schedule[key]) merged[key] = { ...base[key], ...raw.schedule[key] };
    }
    return {
      schedule: merged,
      closedToday: !!raw.closedToday,
      is24_7: !!raw.is24_7,
    };
  }
  return {
    schedule: scheduleFromLegacyTimes(shop.open_time, shop.close_time),
    closedToday: false,
    is24_7: false,
  };
}

/** Primary open/close pair for marketplace — uses today's schedule as HH:MM strings. */
export function scheduleToLegacyTimes(
  hours: ShopOperatingHours,
  now: Date = new Date(),
): { openTime: string; closeTime: string } {
  const dayKey = getWeekdayKey(now);
  const day = hours.schedule[dayKey] as DayHours | undefined;
  if (hours.is24_7) {
    return { openTime: '00:00', closeTime: '23:59' };
  }
  if (!day?.enabled || hours.closedToday) {
    const mon = hours.schedule.mon as DayHours | undefined;
    const fallback = mon?.enabled ? mon : defaultDayHours();
    return { openTime: fallback.open, closeTime: fallback.close };
  }
  return { openTime: day.open, closeTime: day.close };
}

/** @deprecated Use openTime/closeTime from scheduleToLegacyTimes */
export function timeStringToIsoToday(time: string): string {
  const mins = parseShopTimeToMinutes(time) ?? 9 * 60;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toISOString();
}

export function isDayOpenNow(
  hours: ShopOperatingHours,
  now: Date = new Date(),
): boolean {
  if (hours.closedToday) return false;
  if (hours.is24_7) return true;
  const day = hours.schedule[getWeekdayKey(now)];
  if (!day?.enabled) return false;
  const openMin = parseShopTimeToMinutes(day.open);
  const closeMin = parseShopTimeToMinutes(day.close);
  if (openMin == null || closeMin == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (openMin === closeMin) return false;
  if (closeMin > openMin) return current >= openMin && current < closeMin;
  return current >= openMin || current < closeMin;
}

export function formatScheduleSummary(schedule: WeeklySchedule): string {
  const enabled = WEEKDAYS.filter(d => schedule[d.key].enabled);
  if (!enabled.length) return 'Closed all week';
  const first = schedule[enabled[0].key];
  const hours = `${formatTimeLabel(first.open)} – ${formatTimeLabel(first.close)}`;
  if (enabled.length === 7) return `Daily · ${hours}`;
  if (enabled.length === 5 && !schedule.sat.enabled && !schedule.sun.enabled) {
    return `Mon–Fri · ${hours}`;
  }
  return `${enabled.map(d => d.label).join(', ')} · ${hours}`;
}
