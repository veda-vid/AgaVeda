// services/marketplaceApi.ts — Marketplace geo + nearby discovery helpers

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { matchCity, POPULAR_CITIES, type CityOption } from '../constants/cities';
import {
  getActiveAds,
  getProductPreviewsByShopIds,
  getProductTitlesByShopIds,
  getShopsNearby,
  updateProfile,
} from '../lib/api';
import { softBoot } from '../lib/bootGuards';
import {
  MARKETPLACE_PAGE_SIZE,
  MARKETPLACE_RADIUS_OPTIONS,
  type MarketplaceRadiusKm,
} from '../lib/marketplaceUtils';
import type { Ad, Profile, Shop } from '../types';

export type MarketplaceGeo = {
  city: string;
  lat: number;
  lng: number;
  source: 'profile' | 'gps' | 'manual';
};

export type MarketplaceLocationResult =
  | { ok: true; geo: MarketplaceGeo }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error'; message: string };

export const CITY_OPTIONS: CityOption[] = POPULAR_CITIES;
export { MARKETPLACE_RADIUS_OPTIONS, MARKETPLACE_PAGE_SIZE };
export type { MarketplaceRadiusKm };

export type ProductPreview = {
  id: string;
  title: string;
  image_url: string | null;
  price: number;
};

export function hasValidCoords(profile?: Profile | null): boolean {
  return profile?.lat != null
    && profile?.lng != null
    && Number.isFinite(Number(profile.lat))
    && Number.isFinite(Number(profile.lng));
}

export function geoFromProfile(profile?: Profile | null): MarketplaceGeo | null {
  if (!hasValidCoords(profile)) return null;
  const matched = matchCity(profile!.city || '', profile!.lat, profile!.lng);
  return {
    city: matched?.name || profile!.city || 'Your area',
    lat: Number(profile!.lat),
    lng: Number(profile!.lng),
    source: 'profile',
  };
}

export function geoFromCityName(cityName: string): MarketplaceGeo | null {
  const matched = matchCity(cityName)
    || POPULAR_CITIES.find(c => c.name.toLowerCase() === cityName.trim().toLowerCase())
    || null;
  if (!matched) return null;
  return {
    city: matched.name,
    lat: matched.lat,
    lng: matched.lng,
    source: 'manual',
  };
}

export async function detectMarketplaceLocation(): Promise<MarketplaceLocationResult> {
  try {
    if (Platform.OS === 'web') {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Use Browse Other Cities on web, or open the app on your phone for GPS.',
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
        message: 'Location permission was denied. You can still browse another city.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;
    let city = 'Your area';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const hit = places?.[0];
      const raw = hit?.city || hit?.subregion || hit?.region || '';
      const matched = matchCity(raw, latitude, longitude);
      city = matched?.name || raw || city;
    } catch {
      const matched = matchCity('', latitude, longitude);
      if (matched) city = matched.name;
    }

    return {
      ok: true,
      geo: { city, lat: latitude, lng: longitude, source: 'gps' },
    };
  } catch {
    return {
      ok: false,
      reason: 'error',
      message: 'Could not read your location. Try again or browse another city.',
    };
  }
}

export async function persistMarketplaceLocation(
  userId: string | undefined,
  geo: MarketplaceGeo,
  radiusKm?: number,
): Promise<void> {
  if (!userId) return;
  const patch: Partial<Profile> = {
    city: geo.city,
    lat: geo.lat,
    lng: geo.lng,
  };
  if (radiusKm != null) patch.radius_km = radiusKm;
  try {
    await updateProfile(userId, patch);
  } catch { /* local geo still drives discovery */ }
}

export async function fetchNearbyShopsPage(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  offset?: number;
  limit?: number;
}): Promise<{ shops: Shop[]; hasMore: boolean }> {
  return softBoot(
    getShopsNearby(input.lat, input.lng, input.radiusKm, {
      category: input.category,
      offset: input.offset ?? 0,
      limit: input.limit ?? MARKETPLACE_PAGE_SIZE,
    }),
    { shops: [] as Shop[], hasMore: false },
    'marketplaceApi.nearby',
  );
}

export async function fetchShopProductMeta(shopIds: string[]) {
  const [titles, previews] = await Promise.all([
    softBoot(getProductTitlesByShopIds(shopIds), {} as Record<string, string[]>, 'marketplaceApi.titles'),
    softBoot(
      getProductPreviewsByShopIds(shopIds, 3),
      {} as Record<string, ProductPreview[]>,
      'marketplaceApi.previews',
    ),
  ]);
  return { titles, previews };
}

export async function fetchMarketplaceDeals(city: string): Promise<Ad[]> {
  if (!city.trim()) return [];
  return softBoot(getActiveAds(city), [] as Ad[], 'marketplaceApi.deals');
}

export function formatMarketplaceNearLabel(city: string, radiusKm: number) {
  const name = city.trim() || 'your area';
  return `${name} • Within ${radiusKm} km`;
}
