// services/feedApi.ts — Buyer home feed geo, radius, and discovery helpers

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { matchCity } from '../constants/cities';
import {
  getFeed,
  getFollowingFeed,
  getShopsNearby,
  getStories,
  getUnifiedSparksFeed,
  updateProfile,
} from '../lib/api';
import { loadHomeFeed } from '../lib/feedEngine';
import { softBoot } from '../lib/bootGuards';
import { RADIUS_OPTIONS } from '../constants/theme';
import type { Profile, Shop, Story } from '../types';

export const FEED_RADIUS_OPTIONS = RADIUS_OPTIONS;
export type FeedRadiusKm = (typeof FEED_RADIUS_OPTIONS)[number];

export type FeedGeo = {
  city: string;
  lat: number;
  lng: number;
  source: 'profile' | 'gps';
};

export type FeedLocationResult =
  | { ok: true; geo: FeedGeo }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error'; message: string };

export function formatFeedLocationLabel(city?: string | null, radiusKm?: number | null) {
  const raw = (city || '').trim();
  const place = !raw || /^current location$/i.test(raw) || /^your area$/i.test(raw)
    ? 'Set location'
    : raw;
  const km = typeof radiusKm === 'number' && Number.isFinite(radiusKm) ? radiusKm : 5;
  // Buyer chip keeps radius; place name is never the "Current Location" placeholder.
  return `${place} • ${km} km`;
}

/** Best-effort locality label from expo-location reverse geocode. */
export function localityFromGeocode(hit?: Location.LocationGeocodedAddress | null): string {
  if (!hit) return '';
  const candidates = [
    hit.city,
    hit.subregion,
    hit.district,
    hit.name,
    hit.street,
    hit.region,
  ];
  for (const c of candidates) {
    const v = (c || '').trim();
    if (v && !/^current location$/i.test(v)) return v;
  }
  return '';
}

export async function detectFeedLocation(): Promise<FeedLocationResult> {
  try {
    if (Platform.OS === 'web') {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Open the app on your phone to update GPS, or set your city in Profile.',
      };
    }
    const current = await Location.getForegroundPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Location permission was denied. You can still adjust radius from your saved city.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;
    let city = '';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const hit = places?.[0];
      const raw = localityFromGeocode(hit);
      const matched = matchCity(raw, latitude, longitude);
      city = matched?.name || raw;
    } catch {
      const matched = matchCity('', latitude, longitude);
      if (matched) city = matched.name;
    }
    if (!city) {
      const matched = matchCity('', latitude, longitude);
      city = matched?.name || 'Unknown area';
    }

    return {
      ok: true,
      geo: { city, lat: latitude, lng: longitude, source: 'gps' },
    };
  } catch {
    return {
      ok: false,
      reason: 'error',
      message: 'Could not read your location. Try again or update city in Profile.',
    };
  }
}

export async function persistFeedLocation(
  userId: string | undefined,
  patch: Partial<Pick<Profile, 'city' | 'lat' | 'lng' | 'radius_km'>>,
): Promise<void> {
  if (!userId) return;
  try {
    await updateProfile(userId, patch);
  } catch { /* local state still drives the feed */ }
}

export async function fetchBuyerHomePage(input: {
  profile: Profile;
  mode: 'nearby' | 'following';
  page: number;
  followedShopIds: string[];
  radiusKm?: number;
}) {
  const { profile, mode, page, followedShopIds } = input;
  const radiusKm = input.radiusKm ?? profile.radius_km ?? 5;

  if (mode === 'following') {
    const rows = await softBoot(
      getFollowingFeed(profile.id, page, followedShopIds),
      [] as Awaited<ReturnType<typeof getFollowingFeed>>,
      'feedApi.following',
    );
    if (page === 0 && rows.length === 0) {
      const fallback = await loadHomeFeed(
        { ...profile, radius_km: radiusKm },
        { page: 0, mode: 'nearby', followedShopIds },
      );
      return {
        posts: fallback.posts,
        hasMore: fallback.posts.length >= 10,
        isRegionalFallback: fallback.isRegionalFallback,
        effectiveRadiusKm: fallback.effectiveRadiusKm,
        usedFollowingFallback: true,
      };
    }
    return {
      posts: rows,
      hasMore: rows.length >= 10,
      isRegionalFallback: false,
      effectiveRadiusKm: radiusKm,
      usedFollowingFallback: false,
    };
  }

  if (profile.lat != null && profile.lng != null && page > 0) {
    const rows = await softBoot(
      getFeed(profile.lat, profile.lng, radiusKm, page, profile.id),
      [] as Awaited<ReturnType<typeof getFeed>>,
      'feedApi.nearbyPage',
    );
    return {
      posts: rows,
      hasMore: rows.length >= 10,
      isRegionalFallback: false,
      effectiveRadiusKm: radiusKm,
      usedFollowingFallback: false,
    };
  }

  const result = await loadHomeFeed(
    { ...profile, radius_km: radiusKm },
    { page, mode: 'nearby', followedShopIds },
  );
  return {
    posts: result.posts,
    hasMore: result.posts.length >= 10,
    isRegionalFallback: result.isRegionalFallback,
    effectiveRadiusKm: result.effectiveRadiusKm,
    usedFollowingFallback: false,
  };
}

export async function fetchTopRatedLocalShops(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  city?: string;
  excludeIds?: string[];
  limit?: number;
}): Promise<Shop[]> {
  const limit = input.limit ?? 12;
  const { shops } = await softBoot(
    getShopsNearby(input.lat, input.lng, input.radiusKm, { limit: Math.max(limit * 2, 20) }),
    { shops: [] as Shop[], hasMore: false },
    'feedApi.topRated',
  );
  const exclude = new Set(input.excludeIds ?? []);
  return [...shops]
    .filter(s => !exclude.has(s.id))
    .sort((a, b) => {
      const ratingDelta = (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
      if (ratingDelta !== 0) return ratingDelta;
      return (Number(b.total_reviews) || 0) - (Number(a.total_reviews) || 0);
    })
    .slice(0, limit);
}

export async function fetchBuyerStoriesAndSparks(
  userId: string,
  followedShopIds: string[],
) {
  const shopFilter = followedShopIds.length ? followedShopIds : undefined;
  const [stories, sparks] = await Promise.all([
    softBoot(getStories(userId), [] as Story[], 'feedApi.stories'),
    softBoot(
      getUnifiedSparksFeed(userId, 30, 0, shopFilter),
      [] as Awaited<ReturnType<typeof getUnifiedSparksFeed>>,
      'feedApi.sparks',
    ),
  ]);
  return { stories, sparks };
}
