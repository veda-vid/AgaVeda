// services/proApi.ts — Pros marketplace location + nearby discovery helpers

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { matchCity, POPULAR_CITIES, type CityOption } from '../constants/cities';
import { getServicesNearby, updateProfile } from '../lib/api';
import { softBoot } from '../lib/bootGuards';
import type { Profile, ServiceProvider } from '../types';
import { PRO_RADIUS_OPTIONS, type ProRadiusKm } from '../lib/prosUtils';

export type ProsGeo = {
  city: string;
  lat: number;
  lng: number;
  source: 'profile' | 'gps' | 'manual';
};

export type ProsLocationResult =
  | { ok: true; geo: ProsGeo }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error'; message: string };

export const CITY_OPTIONS: CityOption[] = POPULAR_CITIES;
export { PRO_RADIUS_OPTIONS };
export type { ProRadiusKm };

export function hasValidCoords(profile?: Profile | null): boolean {
  return profile?.lat != null
    && profile?.lng != null
    && Number.isFinite(Number(profile.lat))
    && Number.isFinite(Number(profile.lng));
}

export function geoFromProfile(profile?: Profile | null): ProsGeo | null {
  if (!hasValidCoords(profile)) return null;
  const matched = matchCity(profile!.city || '', profile!.lat, profile!.lng);
  return {
    city: matched?.name || profile!.city || 'Your area',
    lat: Number(profile!.lat),
    lng: Number(profile!.lng),
    source: 'profile',
  };
}

export function geoFromCityName(cityName: string): ProsGeo | null {
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

/** Request fine location and reverse-geocode to a popular city when possible. */
export async function detectProsLocation(): Promise<ProsLocationResult> {
  try {
    if (Platform.OS === 'web') {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Use Select City Manually on web, or open the app on your phone for GPS.',
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
        message: 'Location permission was denied. You can still pick a city manually.',
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
      message: 'Could not read your location. Try again or select a city.',
    };
  }
}

/** Persist city/coords onto the signed-in profile (best-effort). */
export async function persistProsLocation(
  userId: string | undefined,
  geo: ProsGeo,
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
  } catch {
    /* non-blocking — local geo still drives discovery */
  }
}

export async function fetchNearbyPros(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  subcategory?: string;
}): Promise<ServiceProvider[]> {
  return softBoot(
    getServicesNearby(
      input.lat,
      input.lng,
      input.radiusKm,
      input.category,
      input.subcategory,
    ),
    [] as ServiceProvider[],
    'proApi.nearby',
  );
}

export function formatNearLabel(city: string, radiusKm: number) {
  const name = city.trim() || 'your area';
  return `Near ${name} (${radiusKm} km radius)`;
}
