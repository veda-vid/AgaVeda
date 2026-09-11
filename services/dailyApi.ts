// services/dailyApi.ts — City Veda dashboard data (fuel, bullion, FX, mandi, news, events)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { matchCity, POPULAR_CITIES } from '../constants/cities';
import {
  detectDailyLocation,
  fetchDailyPublicFeed,
  fetchWeatherPulse,
  fallbackWeatherPulse,
  weatherEmoji,
  type DailyLocation,
  type WeatherPulse,
} from '../lib/dailyPublicFeed';
import { softBoot } from '../lib/bootGuards';
import { withTimeout } from '../lib/withTimeout';
import {
  ANAAJ_MILLETS,
  ANAAJ_STAPLES,
  classifyLiveMandiKind,
  currentMandiSeason,
  loadLiveMandiRows,
  mandiSeasonLabel,
  priceProduceRow,
  produceForSeason,
  SEASONAL_FRUITS,
  SEASONAL_VEGETABLES,
} from '../lib/seasonalMandi';
import { getCityNews } from '../lib/api';
import type { CityNews, Profile } from '../types';

const CACHE_TTL_MS = 12 * 60 * 1000;

export type TickerTrend = 'up' | 'down' | 'flat';

export type TickerChip = {
  id: string;
  /** Discover-style weather pulse vs rate chip */
  kind?: 'weather' | 'rate';
  emoji: string;
  label: string;
  value: string;
  changePct?: number | null;
  trend: TickerTrend;
  group: 'weather' | 'fuel' | 'metal' | 'fx';
  /** Weather pulse extras (Google Discover-style card) */
  rainPct?: number | null;
  aqi?: number | null;
  weatherCode?: number | null;
  areaName?: string | null;
};

export type MandiItem = {
  id: string;
  name: string;
  price: string;
  unit: string;
  changePct?: number | null;
};

export type MandiBoard = {
  sabji: MandiItem[];
  fruits: MandiItem[];
  anaaj: MandiItem[];
  season: string;
  seasonLabel: string;
  updatedLabel: string;
  city: string;
};

export type CityEvent = {
  id: string;
  title: string;
  category: 'katha' | 'satsang' | 'exhibition' | 'sale' | 'fair' | 'music';
  host: string;
  venue: string;
  city: string;
  startsAt: string;
  lat?: number;
  lng?: number;
  bannerUrl?: string | null;
  reminded?: boolean;
};

export type CityVedaDashboard = {
  city: string;
  location: DailyLocation;
  ticker: TickerChip[];
  mandi: MandiBoard;
  news: CityNews[];
  events: CityEvent[];
  fetchedAt: string;
};

function cacheKey(city: string) {
  return `city-veda:v7:${city.trim().toLowerCase() || 'unknown'}`;
}

function trendFromPct(pct?: number | null): TickerTrend {
  if (pct == null || Number.isNaN(pct) || Math.abs(pct) < 0.05) return 'flat';
  return pct >= 0 ? 'up' : 'down';
}

function fmtInr(n: number, digits = 0) {
  return `₹${n.toLocaleString('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

function hashSalt(city: string) {
  let h = 0;
  const s = city.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 17;
}

function parseWidgetPrice(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Live FX + bullion + city fuel for the header slider (day-cached national desks). */
async function fetchLiveTickerMarkets(city: string): Promise<{
  usdInr: number | null;
  gold10g: number | null;
  silverKg: number | null;
  goldChange: number | null;
  silverChange: number | null;
  petrol: number | null;
  diesel: number | null;
  speed: number | null;
  fuelChange: number | null;
}> {
  const empty = {
    usdInr: null as number | null,
    gold10g: null as number | null,
    silverKg: null as number | null,
    goldChange: null as number | null,
    silverChange: null as number | null,
    petrol: null as number | null,
    diesel: null as number | null,
    speed: null as number | null,
    fuelChange: null as number | null,
  };

  try {
    const { getNationalBullionDesk, getCityFuelDesk } = await import('../lib/nationalMarketRates');
    const [bullion, fuel] = await Promise.all([
      getNationalBullionDesk(),
      getCityFuelDesk(city),
    ]);

    return {
      usdInr: bullion?.usdInr ?? null,
      gold10g: bullion?.gold10g24k ?? null,
      silverKg: bullion?.silverKg ?? null,
      goldChange: bullion?.goldChangePct ?? null,
      silverChange: bullion?.silverChangePct ?? null,
      petrol: fuel?.petrol ?? null,
      diesel: fuel?.diesel ?? null,
      speed: fuel?.speed ?? null,
      fuelChange: fuel?.changePct ?? null,
    };
  } catch {
    return empty;
  }
}

function applyLiveMarketsToTicker(
  ticker: TickerChip[],
  markets: Awaited<ReturnType<typeof fetchLiveTickerMarkets>>,
  feed: CityNews[],
): TickerChip[] {
  const fuelWidget = feed.find(i => i.widget?.kind === 'fuel');
  const goldWidget = feed.find(i => i.widget?.kind === 'gold');
  const silverWidget = feed.find(i => i.widget?.kind === 'silver');

  return ticker.map(chip => {
    if (chip.id === 'usd' && markets.usdInr != null) {
      return {
        ...chip,
        value: fmtInr(markets.usdInr, 2),
        changePct: chip.changePct,
      };
    }
    if (chip.id === 'gold') {
      const fromFeed = goldWidget?.widget?.items?.find(r => /24k.*10g/i.test(r.name))
        || goldWidget?.widget?.items?.[0];
      const live = markets.gold10g ?? parseWidgetPrice(fromFeed?.price);
      if (live == null) return chip;
      const change = markets.goldChange ?? fromFeed?.changePct ?? goldWidget?.widget?.changePct ?? chip.changePct;
      return {
        ...chip,
        value: `${fmtInr(Math.round(live))}/10g`,
        changePct: change,
        trend: trendFromPct(change),
      };
    }
    if (chip.id === 'silver') {
      const fromFeed = silverWidget?.widget?.items?.find(r => /1kg|\/kg/i.test(r.name))
        || silverWidget?.widget?.items?.[0];
      const live = markets.silverKg ?? parseWidgetPrice(fromFeed?.price);
      if (live == null) return chip;
      const change = markets.silverChange ?? fromFeed?.changePct ?? silverWidget?.widget?.changePct ?? chip.changePct;
      return {
        ...chip,
        value: `${fmtInr(Math.round(live))}/kg`,
        changePct: change,
        trend: trendFromPct(change),
      };
    }
    if (chip.id === 'petrol' || chip.id === 'diesel' || chip.id === 'speed') {
      const item = fuelWidget?.widget?.items?.find(r =>
        chip.id === 'petrol' ? /petrol/i.test(r.name)
          : chip.id === 'diesel' ? /diesel/i.test(r.name)
            : /speed|xp95|xp100/i.test(r.name),
      );
      const fromMarkets = chip.id === 'petrol' ? markets.petrol
        : chip.id === 'diesel' ? markets.diesel
          : markets.speed;
      const live = fromMarkets ?? parseWidgetPrice(item?.price);
      if (live == null) return chip;
      const change = markets.fuelChange ?? item?.changePct ?? fuelWidget?.widget?.changePct ?? chip.changePct;
      return {
        ...chip,
        value: `${fmtInr(live, 1)}/L`,
        changePct: change,
        trend: trendFromPct(change),
      };
    }
    return chip;
  });
}

function weatherChipFromPulse(pulse: WeatherPulse): TickerChip {
  return {
    id: 'weather',
    kind: 'weather',
    emoji: weatherEmoji(pulse.weatherCode),
    label: pulse.areaName,
    value: `${Math.round(pulse.temp)}°`,
    changePct: null,
    trend: 'flat',
    group: 'weather',
    rainPct: pulse.rainPct,
    aqi: pulse.aqi,
    weatherCode: pulse.weatherCode,
    areaName: pulse.areaName,
  };
}

function buildTickerFromFeed(
  city: string,
  feed: CityNews[],
  location?: DailyLocation,
  weatherPulse?: WeatherPulse | null,
  liveFuel?: { petrol: number; diesel: number; speed: number; changePct?: number | null } | null,
  liveBullion?: { gold10g: number; silverKg: number; goldChange?: number | null; silverChange?: number | null; usdInr?: number | null } | null,
): TickerChip[] {
  const weatherWidget = feed.find(i => i.widget?.kind === 'weather' && i.widget?.live)
    || feed.find(i => i.widget?.kind === 'weather');
  const fuelWidget = feed.find(i => i.widget?.kind === 'fuel');
  const goldWidget = feed.find(i => i.widget?.kind === 'gold');
  const silverWidget = feed.find(i => i.widget?.kind === 'silver');
  const fxWidget = feed.find(i => i.widget?.kind === 'fx');

  const petrolItem = fuelWidget?.widget?.items?.find(r => /petrol/i.test(r.name));
  const dieselItem = fuelWidget?.widget?.items?.find(r => /diesel/i.test(r.name));
  const speedItem = fuelWidget?.widget?.items?.find(r => /speed|xp95|xp100/i.test(r.name));
  const petrol = liveFuel?.petrol ?? parseWidgetPrice(petrolItem?.price) ?? 102.1;
  const diesel = liveFuel?.diesel ?? parseWidgetPrice(dieselItem?.price) ?? 95.2;
  const speed = liveFuel?.speed ?? parseWidgetPrice(speedItem?.price) ?? (petrol + 7.5);
  const fuelChange = liveFuel?.changePct ?? fuelWidget?.widget?.changePct ?? 0;

  const gold24 = goldWidget?.widget?.items?.find(r => /24k.*10g/i.test(r.name))
    || goldWidget?.widget?.items?.[0];
  const silverKgItem = silverWidget?.widget?.items?.find(r => /1kg|\/kg/i.test(r.name))
    || silverWidget?.widget?.items?.[0];

  const goldVal = liveBullion?.gold10g ?? parseWidgetPrice(gold24?.price);
  const silverVal = liveBullion?.silverKg ?? parseWidgetPrice(silverKgItem?.price);
  const goldChange = liveBullion?.goldChange ?? goldWidget?.widget?.changePct ?? gold24?.changePct ?? 0;
  const silverChange = liveBullion?.silverChange ?? silverWidget?.widget?.changePct ?? silverKgItem?.changePct ?? 0;

  const usdRaw = fxWidget?.widget?.value || fxWidget?.widget?.items?.[0]?.price;
  const usd = liveBullion?.usdInr ?? parseWidgetPrice(usdRaw) ?? 95.5;
  const fxChange = fxWidget?.widget?.changePct ?? 0.08;

  const pulse: WeatherPulse = weatherPulse ?? {
    temp: typeof weatherWidget?.widget?.temp === 'number' ? weatherWidget.widget.temp : 28,
    rainPct: weatherWidget?.widget?.rainChance ?? null,
    aqi: weatherWidget?.widget?.aqi ?? null,
    weatherCode: weatherWidget?.widget?.weatherCode ?? 2,
    areaName: (
      weatherWidget?.widget?.label
      || location?.area
      || location?.city
      || city
    ).trim(),
    condition: weatherWidget?.widget?.condition || 'Partly cloudy',
    sunriseTomorrow: null,
  };

  const chips: TickerChip[] = [weatherChipFromPulse(pulse)];

  if (pulse.sunriseTomorrow) {
    chips.push({
      id: 'sunrise',
      kind: 'rate',
      emoji: '🌅',
      label: 'Sunrise TM',
      value: pulse.sunriseTomorrow,
      changePct: null,
      trend: 'flat',
      group: 'weather',
    });
  }

  chips.push(
    {
      id: 'petrol',
      kind: 'rate',
      emoji: '⛽',
      label: 'Petrol',
      value: `${fmtInr(petrol, 1)}/L`,
      changePct: fuelChange,
      trend: trendFromPct(fuelChange),
      group: 'fuel',
    },
    {
      id: 'diesel',
      kind: 'rate',
      emoji: '⛽',
      label: 'Diesel',
      value: `${fmtInr(diesel, 1)}/L`,
      changePct: fuelChange,
      trend: trendFromPct(fuelChange),
      group: 'fuel',
    },
    {
      id: 'speed',
      kind: 'rate',
      emoji: '⛽',
      label: 'Speed',
      value: `${fmtInr(speed, 1)}/L`,
      changePct: fuelChange,
      trend: trendFromPct(fuelChange),
      group: 'fuel',
    },
    {
      id: 'gold',
      kind: 'rate',
      emoji: '🥇',
      label: 'Gold 24K',
      value: goldVal != null ? `${fmtInr(Math.round(goldVal))}/10g` : '—',
      changePct: goldChange,
      trend: trendFromPct(goldChange),
      group: 'metal',
    },
    {
      id: 'silver',
      kind: 'rate',
      emoji: '🥈',
      label: 'Silver',
      value: silverVal != null ? `${fmtInr(Math.round(silverVal))}/kg` : '—',
      changePct: silverChange,
      trend: trendFromPct(silverChange),
      group: 'metal',
    },
    {
      id: 'usd',
      kind: 'rate',
      emoji: '💵',
      label: '1 USD',
      value: fmtInr(usd, 2),
      changePct: fxChange,
      trend: trendFromPct(fxChange),
      group: 'fx',
    },
  );

  return chips;
}

async function buildSeasonalMandiBoard(
  city: string,
  location: DailyLocation,
  feed: CityNews[],
): Promise<MandiBoard> {
  const season = currentMandiSeason();
  const seasonLabel = mandiSeasonLabel(season);

  // Prefer live city desk; fall back to any mandi widgets already in the feed.
  let liveRows: Array<{ name: string; price: string }> = [];
  try {
    liveRows = await withTimeout(
      loadLiveMandiRows({ city: location.city || city }),
      22000,
      'dailyApi.liveMandi',
    ) ?? [];
  } catch {
    liveRows = [];
  }

  const feedRows = feed
    .filter(i => i.widget?.kind === 'mandi')
    .flatMap(i => i.widget?.items ?? [])
    .map(r => ({ name: r.name, price: r.price }));

  const mergedLive = [...liveRows, ...feedRows];
  const deskCity = location.area || location.city || city;
  const liveDesk = liveRows.length > 0;

  const vegCatalog = produceForSeason(SEASONAL_VEGETABLES, season, 10);
  const fruitCatalog = produceForSeason(SEASONAL_FRUITS, season, 10);
  const anaajCatalog = [
    ...ANAAJ_STAPLES,
    ...ANAAJ_MILLETS,
  ];

  const sabji = vegCatalog
    .map((row, i) => priceProduceRow(row, deskCity, mergedLive, 'sabji', i))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const fruits = fruitCatalog
    .map((row, i) => priceProduceRow(row, deskCity, mergedLive, 'fruit', i))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const anaaj = anaajCatalog
    .map((row, i) => priceProduceRow(row, deskCity, mergedLive, 'anaaj', i))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const fillFromLive = (
    bucket: typeof sabji,
    kind: 'sabji' | 'fruit' | 'anaaj',
    prefix: string,
    limit = 12,
  ) => {
    const have = new Set(bucket.map(r => r.name.toLowerCase()));
    for (const row of liveRows) {
      if (bucket.length >= limit) break;
      if (/[–-]/.test(row.price)) continue;
      if (classifyLiveMandiKind(row.name) !== kind) continue;
      if (have.has(row.name.toLowerCase())) continue;
      bucket.push({
        id: `${prefix}-live-${row.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: row.name,
        price: row.price,
        unit: /quintal|qtl/i.test(row.price)
          ? '₹/quintal'
          : /dozen/i.test(row.price)
            ? '₹/dozen'
            : '₹/kg',
        changePct: 0,
      });
      have.add(row.name.toLowerCase());
    }
  };

  // Always top up tabs from exact live desk so fruits/anaaj are not empty.
  if (sabji.length < 8) fillFromLive(sabji, 'sabji', 'sabji');
  if (fruits.length < 8) fillFromLive(fruits, 'fruit', 'fruit');
  if (anaaj.length < 8) fillFromLive(anaaj, 'anaaj', 'anaaj');

  const stampSource = feed.find(i => i.widget?.kind === 'mandi')?.widget?.updatedAt
    || new Date().toISOString();
  const d = new Date(stampSource);
  const sourceTag = liveDesk ? 'Live exact' : 'Awaiting desk';
  const timeLabel = Number.isNaN(d.getTime())
    ? `${seasonLabel} · ${sourceTag}`
    : `${seasonLabel} · ${sourceTag} · ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;

  return {
    sabji,
    fruits,
    anaaj,
    season,
    seasonLabel,
    updatedLabel: timeLabel,
    city: deskCity,
  };
}

export function classifyNewsPill(item: CityNews) {
  if (item.category === 'alerts') return 'Civic';
  if (item.category === 'event') return 'Events';
  if (item.category === 'weather') return 'Weather';
  if (item.category === 'rates') return 'Markets';
  const t = `${item.title} ${item.body}`.toLowerCase();
  if (/\b(traffic|jam|road|highway|bypass)\b/.test(t)) return 'Traffic';
  if (/\b(temple|aarti|ghat|yoga|spiritual|katha|satsang)\b/.test(t)) return 'Spiritual';
  if (/\b(civic|municipality|sewage|water|electricity)\b/.test(t)) return 'Civic';
  return 'Local';
}

function eventTemplates(city: string, lat: number, lng: number): CityEvent[] {
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const salt = hashSalt(city);
  const base = [
    {
      title: 'Bhagwat Katha',
      category: 'katha' as const,
      host: 'Local Mandir Trust',
      venue: `${city} Community Hall`,
      offset: 1 + (salt % 3),
      banner: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
    },
    {
      title: 'Evening Satsang',
      category: 'satsang' as const,
      host: 'Seva Samiti',
      venue: `${city} Ghat / Ashram`,
      offset: 2 + (salt % 2),
      banner: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    },
    {
      title: 'City Craft Exhibition',
      category: 'exhibition' as const,
      host: 'Municipal Arts Cell',
      venue: `${city} Exhibition Ground`,
      offset: 4,
      banner: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80',
    },
    {
      title: 'Seasonal Bazaar Sale',
      category: 'sale' as const,
      host: 'Merchants Association',
      venue: `${city} Main Market`,
      offset: 3,
      banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    },
    {
      title: 'Local Fair & Music Night',
      category: 'fair' as const,
      host: 'City Cultural Forum',
      venue: `${city} Stadium Lawn`,
      offset: 6,
      banner: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
    },
  ];

  return base.map((e, i) => ({
    id: `event-${city.toLowerCase().replace(/\s+/g, '-')}-${i}`,
    title: e.title,
    category: e.category,
    host: e.host,
    venue: e.venue,
    city,
    startsAt: new Date(now + e.offset * dayMs + (i + 1) * 3600 * 1000).toISOString(),
    lat,
    lng,
    bannerUrl: e.banner,
  }));
}

async function readCache(city: string): Promise<CityVedaDashboard | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(city));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CityVedaDashboard & { _ts?: number };
    if (!parsed?._ts || Date.now() - parsed._ts > CACHE_TTL_MS) return null;
    if (!parsed?.mandi?.fruits?.length) return null;
    if (!parsed?.ticker?.some(c => c.kind === 'weather' || c.id === 'weather')) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Stale-while-revalidate peek used by Daily screen for instant paint. */
export async function peekCityVedaDashboard(city: string): Promise<CityVedaDashboard | null> {
  return readCache(city);
}

async function writeCache(city: string, data: CityVedaDashboard) {
  try {
    await AsyncStorage.setItem(cacheKey(city), JSON.stringify({ ...data, _ts: Date.now() }));
  } catch { /* noop */ }
}

const REMIND_KEY = 'city-veda:event-reminders';

export async function getEventReminders(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(REMIND_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function toggleEventReminder(eventId: string): Promise<boolean> {
  const map = await getEventReminders();
  const next = !map[eventId];
  if (next) map[eventId] = true;
  else delete map[eventId];
  await AsyncStorage.setItem(REMIND_KEY, JSON.stringify(map));
  return next;
}

export function resolveCityCoords(city: string, profile?: Profile | null): DailyLocation {
  const matched = matchCity(city, profile?.lat, profile?.lng)
    || POPULAR_CITIES.find(c => c.name.toLowerCase() === city.trim().toLowerCase())
    || null;
  return {
    city: matched?.name || city || profile?.city || 'Your city',
    state: matched?.state,
    lat: matched?.lat ?? profile?.lat ?? 28.6139,
    lng: matched?.lng ?? profile?.lng ?? 77.209,
    source: 'profile',
  };
}

/** Full City Veda payload for a city. Prefer cache, then soft-boot live feed. */
export async function fetchCityVedaDashboard(
  city: string,
  profile?: Profile | null,
  opts?: { force?: boolean },
): Promise<CityVedaDashboard> {
  const cityFallback = resolveCityCoords(city, profile);
  // Prefer live GPS so weather pulse uses the user's actual area name + local temp.
  const detected = await softBoot(
    detectDailyLocation(profile),
    cityFallback,
    'dailyApi.gpsLocation',
  );
  const location: DailyLocation = detected.source === 'gps'
    ? {
        ...detected,
        // Keep selected city for city-scoped rates/news when picker differs,
        // but preserve GPS area + coords for weather.
        city: cityFallback.city || detected.city,
        area: detected.area || detected.city,
      }
    : {
        ...cityFallback,
        area: cityFallback.area || cityFallback.city,
      };
  const cityName = location.city;
  // Weather / mandi / local feed use precise coords when GPS is available.
  const feedLocation: DailyLocation = detected.source === 'gps' ? detected : location;
  const weatherFallback = fallbackWeatherPulse(feedLocation);

  // Weather is fetched alone (not inside the 3s full-feed softBoot) so the slider
  // always gets a Discover-style temperature card.
  const weatherPulse = await (async () => {
    try {
      const live = await withTimeout(
        fetchWeatherPulse(feedLocation),
        7000,
        'dailyApi.weatherPulse',
      );
      return live ?? weatherFallback;
    } catch {
      return weatherFallback;
    }
  })();

  if (!opts?.force) {
    const cached = await readCache(cityName);
    if (cached?.mandi?.fruits?.length && cached.ticker.some(c => c.kind === 'weather' || c.id === 'weather')) {
      return cached;
    }
    if (cached) {
      // Stale shape (pre-seasonal mandi / missing weather) — rebuild below.
    }
  }

  const feed = await (async () => {
    try {
      return await withTimeout(
        fetchDailyPublicFeed(feedLocation, 'local'),
        14000,
        'dailyApi.publicFeed',
      );
    } catch {
      return [] as CityNews[];
    }
  })();

  let stored: CityNews[] = [];
  if (profile?.id) {
    try {
      stored = await withTimeout(
        getCityNews(cityName, profile.id, 40),
        8000,
        'dailyApi.cityNews',
      );
    } catch {
      stored = [];
    }
  }

  // Local feed uses FX for metal conversion but may omit an FX widget — hydrate USD chip.
  // Fetch markets with a longer budget than softBoot (3s) so slider rates stay accurate.
  const [liveMarkets, mandi] = await Promise.all([
    (async () => {
      try {
        return await withTimeout(
          fetchLiveTickerMarkets(cityName),
          16000,
          'dailyApi.tickerMarkets',
        );
      } catch {
        return {
          usdInr: null,
          gold10g: null,
          silverKg: null,
          goldChange: null,
          silverChange: null,
          petrol: null,
          diesel: null,
          speed: null,
          fuelChange: null,
        };
      }
    })(),
    buildSeasonalMandiBoard(cityName, feedLocation, feed),
  ]);

  const editorial = [...stored, ...feed]
    .filter(i => i.category !== 'rates')
    .slice(0, 24);

  const reminders = await getEventReminders();
  const events = eventTemplates(cityName, location.lat, location.lng).map(e => ({
    ...e,
    reminded: !!reminders[e.id],
  }));

  const liveFuel = liveMarkets.petrol != null && liveMarkets.diesel != null && liveMarkets.speed != null
    ? {
      petrol: liveMarkets.petrol,
      diesel: liveMarkets.diesel,
      speed: liveMarkets.speed,
      changePct: liveMarkets.fuelChange,
    }
    : null;
  const liveBullion = liveMarkets.gold10g != null
    ? {
      gold10g: liveMarkets.gold10g,
      silverKg: liveMarkets.silverKg ?? 0,
      goldChange: liveMarkets.goldChange,
      silverChange: liveMarkets.silverChange,
      usdInr: liveMarkets.usdInr,
    }
    : null;

  let ticker = buildTickerFromFeed(
    cityName,
    feed,
    feedLocation,
    weatherPulse,
    liveFuel,
    liveBullion,
  );
  ticker = applyLiveMarketsToTicker(ticker, liveMarkets, feed);

  const dashboard: CityVedaDashboard = {
    city: cityName,
    location,
    ticker,
    mandi,
    news: editorial,
    events,
    fetchedAt: new Date().toISOString(),
  };

  await writeCache(cityName, dashboard);
  return dashboard;
}

export async function detectCityForDaily(profile?: Profile | null): Promise<string> {
  const loc = await softBoot(
    detectDailyLocation(profile),
    resolveCityCoords(profile?.city || 'Delhi', profile),
    'dailyApi.detectCity',
  );
  return loc.city;
}

export const CITY_PICKER_OPTIONS = POPULAR_CITIES.map(c => c.name);
