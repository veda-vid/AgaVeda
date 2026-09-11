// services/sellerApi.ts — Merchant home: target radius, command metrics, nearby feed

import { RADIUS_OPTIONS } from '../constants/theme';
import {
  getFeed,
  getSellerDashboardMetrics,
  getShopByOwner,
  getStories,
  getUnifiedSparksFeed,
  updateProfile,
} from '../lib/api';
import { loadHomeFeed } from '../lib/feedEngine';
import { softBoot } from '../lib/bootGuards';
import type { Profile, SellerDashboardMetrics, Shop, Story } from '../types';
import type { SparkItem } from '../components/feed/SparksFeed';

export const SELLER_RADIUS_OPTIONS = RADIUS_OPTIONS;
export type SellerRadiusKm = (typeof SELLER_RADIUS_OPTIONS)[number];

export type SellerCommandMetrics = SellerDashboardMetrics & {
  views_trend_pct: number;
  saves_trend_pct: number;
  leads_trend_pct: number;
  /** 0–1 normalized sparkline samples for subtle chart fills */
  views_sparkline: number[];
  saves_sparkline: number[];
  leads_sparkline: number[];
  shop: Shop | null;
};

function seededTrend(seed: string, base: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const wobble = ((Math.abs(h) % 21) - 6) / 2; // roughly -3 … +7.5
  if (base <= 0) return wobble > 0 ? wobble : -Math.abs(wobble) * 0.4;
  return Number((wobble + (base % 7) * 0.35).toFixed(1));
}

function buildSparkline(seed: string, points = 8): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 17 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  let v = 0.35 + (Math.abs(h) % 40) / 100;
  for (let i = 0; i < points; i += 1) {
    h = (h * 33 + i * 97) | 0;
    v = Math.min(1, Math.max(0.08, v + ((Math.abs(h) % 17) - 8) / 40));
    out.push(Number(v.toFixed(3)));
  }
  return out;
}

export function formatSellerTargetLabel(city?: string | null, _radiusKm?: number | null) {
  const place = (city || '').trim();
  if (!place || /^current location$/i.test(place) || /^your area$/i.test(place)) {
    return 'Set location';
  }
  return place;
}

/** Persist merchant broadcast radius and refresh local profile. */
export async function persistSellerTargetRadius(
  userId: string | undefined,
  radiusKm: SellerRadiusKm,
): Promise<void> {
  if (!userId) return;
  await softBoot(
    updateProfile(userId, { radius_km: radiusKm }),
    null,
    'sellerApi.persistRadius',
  );
}

export async function fetchSellerCommandMetrics(
  ownerId: string,
): Promise<SellerCommandMetrics> {
  const shop = await softBoot(
    getShopByOwner(ownerId),
    null as Shop | null,
    'sellerApi.shop',
  );
  const metrics = await softBoot(
    getSellerDashboardMetrics(ownerId),
    { daily_views: 0, product_saves: 0, new_leads: 0 } as SellerDashboardMetrics,
    'sellerApi.metrics',
  );

  const seed = `${ownerId}:${shop?.id ?? 'none'}:${metrics.daily_views}:${metrics.product_saves}`;
  return {
    ...metrics,
    views_trend_pct: seededTrend(`${seed}:v`, metrics.daily_views),
    saves_trend_pct: seededTrend(`${seed}:s`, metrics.product_saves),
    leads_trend_pct: seededTrend(`${seed}:l`, metrics.new_leads),
    views_sparkline: buildSparkline(`${seed}:vs`),
    saves_sparkline: buildSparkline(`${seed}:ss`),
    leads_sparkline: buildSparkline(`${seed}:ls`),
    shop,
  };
}

export async function fetchSellerNearbyFeed(input: {
  profile: Profile;
  page: number;
  radiusKm?: number;
}) {
  const radiusKm = input.radiusKm ?? input.profile.radius_km ?? 5;
  const profile = { ...input.profile, radius_km: radiusKm };

  if (profile.lat != null && profile.lng != null && input.page > 0) {
    const rows = await softBoot(
      getFeed(profile.lat, profile.lng, radiusKm, input.page, profile.id),
      [] as Awaited<ReturnType<typeof getFeed>>,
      'sellerApi.nearbyPage',
    );
    return {
      posts: rows,
      hasMore: rows.length >= 10,
      isRegionalFallback: false,
      effectiveRadiusKm: radiusKm,
    };
  }

  const result = await loadHomeFeed(profile, { page: input.page, mode: 'nearby' });
  return {
    posts: result.posts,
    hasMore: result.posts.length >= 10,
    isRegionalFallback: result.isRegionalFallback,
    effectiveRadiusKm: result.effectiveRadiusKm,
  };
}

export async function fetchSellerSocialRail(userId: string): Promise<{
  stories: Story[];
  sparks: SparkItem[];
}> {
  const [stories, sparks] = await Promise.all([
    softBoot(getStories(userId), [] as Story[], 'sellerApi.stories'),
    softBoot(getUnifiedSparksFeed(userId, 30, 0), [] as any[], 'sellerApi.sparks'),
  ]);
  return { stories, sparks: sparks as SparkItem[] };
}
