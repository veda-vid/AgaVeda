// lib/locationSearch.ts — Nominatim (OpenStreetMap) location search & reverse geocode

export type LocationSuggestion = {
  id: string;
  label: string;
  city?: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
};

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CityConnect/1.0 (Spark location picker)';

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  region?: string;
  country?: string;
  county?: string;
  suburb?: string;
  neighbourhood?: string;
  road?: string;
  pedestrian?: string;
  historic?: string;
  tourism?: string;
};

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
};

function pickCity(address?: NominatimAddress, fallbackName?: string) {
  if (!address) return fallbackName;
  return (
    address.city
    ?? address.town
    ?? address.village
    ?? address.suburb
    ?? address.neighbourhood
    ?? address.historic
    ?? address.tourism
    ?? address.county
    ?? fallbackName
  );
}

function pickRegion(address?: NominatimAddress) {
  if (!address) return undefined;
  return address.state ?? address.region ?? address.county;
}

export function formatLocationLabel(
  city?: string,
  region?: string,
  country?: string,
): string {
  const parts = [city, region, country].filter(Boolean);
  return parts.join(', ');
}

export function mapNominatimResult(row: NominatimResult): LocationSuggestion {
  const city = pickCity(row.address, row.name);
  const region = pickRegion(row.address);
  const country = row.address?.country;
  const label = formatLocationLabel(city, region, country) || row.display_name || 'Unknown location';

  return {
    id: String(row.place_id),
    label,
    city,
    region,
    country,
    lat: Number(row.lat),
    lon: Number(row.lon),
  };
}

async function nominatimFetch(path: string) {
  const response = await fetch(`${NOMINATIM_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`Location service unavailable (${response.status})`);
  return response.json();
}

export async function searchLocations(query: string, limit = 8): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
  });

  const data = await nominatimFetch(`/search?${params.toString()}`);
  if (!Array.isArray(data)) return [];
  return data.map((row: NominatimResult) => mapNominatimResult(row));
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<LocationSuggestion | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
  });

  const data = await nominatimFetch(`/reverse?${params.toString()}`);
  if (!data || typeof data !== 'object') return null;
  return mapNominatimResult(data as NominatimResult);
}
