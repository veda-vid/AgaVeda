// Popular Indian cities with coordinates for location onboarding

export interface CityOption {
  name: string;
  lat: number;
  lng: number;
  state?: string;
}

export const POPULAR_CITIES: CityOption[] = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, state: 'Maharashtra' },
  { name: 'Delhi', lat: 28.6139, lng: 77.209, state: 'Delhi' },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867, state: 'Telangana' },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, state: 'Gujarat' },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  { name: 'Noida', lat: 28.5355, lng: 77.391, state: 'Uttar Pradesh' },
  { name: 'Rishikesh', lat: 30.0869, lng: 78.2676, state: 'Uttarakhand' },
];

/** Find closest popular city within ~80km, or match by name */
export function matchCity(name: string, lat?: number | null, lng?: number | null): CityOption | null {
  const q = name.trim().toLowerCase();
  if (q) {
    const byName = POPULAR_CITIES.find(
      c => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()),
    );
    if (byName) return byName;
  }
  if (lat == null || lng == null) return null;
  let best: CityOption | null = null;
  let bestDist = Infinity;
  for (const c of POPULAR_CITIES) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= 80 ? best : null;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Static OSM map image URL for a pin at lat/lng */
export function staticMapUrl(lat: number, lng: number, zoom = 13, width = 640, height = 280): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`;
}
