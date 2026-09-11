// lib/nationalMarketRates.ts — Daily national gold/silver + city fuel desks
// Gold/silver: live international spot → INR (national). Fuel: published city pumps (Goodreturns).
// Values are day-cached (Asia/Kolkata) so the UI stays correct even when a live source blips.

import AsyncStorage from '@react-native-async-storage/async-storage';

const TROY_OZ_GRAMS = 31.1034768;
/** BPCL Speed / premium petrol typical uplift over regular MS (₹/L). */
const SPEED_PREMIUM_INR = 7.5;

export type BullionDesk = {
  gold10g24k: number;
  gold10g22k: number | null;
  gold10g18k: number | null;
  goldChangePct: number | null;
  silverKg: number;
  silverChangePct: number | null;
  usdInr: number;
  source: string;
  asOfDate: string;
  updatedAt: string;
};

export type FuelDesk = {
  city: string;
  petrol: number;
  diesel: number;
  speed: number;
  changePct: number | null;
  source: string;
  asOfDate: string;
  updatedAt: string;
};

type CacheEnvelope<T> = {
  asOfDate: string;
  updatedAt: string;
  data: T;
};

function kolkataDateKey(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function roundMoney(n: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function readDayCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

async function writeDayCache<T>(key: string, data: T, asOfDate: string) {
  const envelope: CacheEnvelope<T> = {
    asOfDate,
    updatedAt: new Date().toISOString(),
    data,
  };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch { /* noop */ }
  return envelope;
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VedastyaCityConnect/1.0',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextHead(url: string, timeoutMs = 12000, maxChars = 8000): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      headers: {
        Accept: 'text/html',
        'User-Agent':
          'Mozilla/5.0 (compatible; VedastyaCityConnect/1.0; +https://vedastya.app)',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, maxChars);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function ozToInrPer10g(usdPerOz: number, usdInr: number) {
  return (usdPerOz / TROY_OZ_GRAMS) * 10 * usdInr;
}

function ozToInrPerKg(usdPerOz: number, usdInr: number) {
  return (usdPerOz / TROY_OZ_GRAMS) * 1000 * usdInr;
}

async function fetchUsdInr(): Promise<number | null> {
  const sources: Array<() => Promise<number | null>> = [
    async () => {
      const json = await fetchJson<{ rates?: { INR?: number } }>(
        'https://open.er-api.com/v6/latest/USD',
      );
      const n = json?.rates?.INR;
      return typeof n === 'number' && n > 50 ? n : null;
    },
    async () => {
      const json = await fetchJson<{ usd?: { inr?: number } }>(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      );
      const n = json?.usd?.inr;
      return typeof n === 'number' && n > 50 ? n : null;
    },
    async () => {
      const json = await fetchJson<{ rates?: { INR?: number } }>(
        'https://api.exchangerate-api.com/v4/latest/USD',
      );
      const n = json?.rates?.INR;
      return typeof n === 'number' && n > 50 ? n : null;
    },
  ];

  for (const src of sources) {
    try {
      const n = await src();
      if (n != null) return n;
    } catch { /* try next */ }
  }
  return null;
}

type SpotQuote = { price: number; prev: number; source: string };

async function fetchGoldSpotUsd(): Promise<SpotQuote | null> {
  const attempts: Array<() => Promise<SpotQuote | null>> = [
    async () => {
      const json = await fetchJson<{ price?: number }>('https://api.gold-api.com/price/XAU');
      const price = json?.price;
      if (typeof price !== 'number' || price < 500) return null;
      return { price, prev: price, source: 'gold-api' };
    },
    async () => {
      const json = await fetchJson<{
        chart?: { result?: Array<{ meta?: Record<string, number> }> };
      }>('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d');
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (typeof price !== 'number' || price < 500) return null;
      const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
      return { price, prev: Number(prev), source: 'yahoo-GC=F' };
    },
    async () => {
      const json = await fetchJson<Array<{
        spreadProfilePrices?: Array<{ bid?: number; ask?: number }>;
      }>>('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD');
      const row = json?.[0]?.spreadProfilePrices?.[0];
      const bid = row?.bid;
      const ask = row?.ask;
      if (typeof bid !== 'number' || typeof ask !== 'number') return null;
      const price = (bid + ask) / 2;
      if (price < 500) return null;
      return { price, prev: price, source: 'swissquote' };
    },
  ];

  for (const attempt of attempts) {
    try {
      const q = await attempt();
      if (q) return q;
    } catch { /* next */ }
  }
  return null;
}

async function fetchSilverSpotUsd(): Promise<SpotQuote | null> {
  const attempts: Array<() => Promise<SpotQuote | null>> = [
    async () => {
      const json = await fetchJson<{ price?: number }>('https://api.gold-api.com/price/XAG');
      const price = json?.price;
      if (typeof price !== 'number' || price < 5) return null;
      return { price, prev: price, source: 'gold-api' };
    },
    async () => {
      const json = await fetchJson<{
        chart?: { result?: Array<{ meta?: Record<string, number> }> };
      }>('https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=5d');
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (typeof price !== 'number' || price < 5) return null;
      const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
      return { price, prev: Number(prev), source: 'yahoo-SI=F' };
    },
  ];

  for (const attempt of attempts) {
    try {
      const q = await attempt();
      if (q) return q;
    } catch { /* next */ }
  }
  return null;
}

function changePct(price: number, prev: number) {
  if (!prev || !Number.isFinite(prev)) return null;
  return ((price - prev) / prev) * 100;
}

const BULLION_CACHE = 'market:national:bullion:v2';

function parseInrAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** India retail bullion desk (Goodreturns SSR) — 24K/22K/18K per gram + silver /kg. */
async function fetchIndiaRetailBullion(): Promise<{
  goldPerG24: number;
  goldPerG22: number | null;
  goldPerG18: number | null;
  silverKg: number | null;
  source: string;
} | null> {
  const goldUrls = [
    'https://www.goodreturns.in/gold-rates/',
    'https://www.goodreturns.in/gold-rates/delhi.html',
    'https://www.goodreturns.in/gold-rates/mumbai.html',
  ];
  let goldHtml: string | null = null;
  let goldSource = 'goodreturns';
  for (const url of goldUrls) {
    goldHtml = await fetchTextHead(url, 16000, 400000);
    if (goldHtml && /id="24K-price"/i.test(goldHtml)) {
      goldSource = url.includes('delhi') ? 'goodreturns:delhi' : url.includes('mumbai') ? 'goodreturns:mumbai' : 'goodreturns:national';
      break;
    }
    goldHtml = null;
  }
  if (!goldHtml) return null;

  const g24 = parseInrAmount(goldHtml.match(/id="24K-price"[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9,]+)/i)?.[1]);
  const g22 = parseInrAmount(goldHtml.match(/id="22K-price"[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9,]+)/i)?.[1]);
  const g18 = parseInrAmount(goldHtml.match(/id="18K-price"[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9,]+)/i)?.[1]);
  // Goodreturns quotes ₹/gram — reject if it looks like already /10g.
  if (g24 == null || g24 < 1000 || g24 > 100000) return null;

  const silverHtml = await fetchTextHead('https://www.goodreturns.in/silver-rates/', 16000, 400000);
  const silverKg = silverHtml
    ? parseInrAmount(
      silverHtml.match(/id="(?:silver-)?1kg-price"[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9,]+)/i)?.[1]
      || silverHtml.match(/(?:&#x20b9;|₹)\s*(2,?4[0-9],[0-9]{3})/)?.[1],
    )
    : null;

  return {
    goldPerG24: g24,
    goldPerG22: g22 && g22 > 500 ? g22 : null,
    goldPerG18: g18 && g18 > 400 ? g18 : null,
    silverKg: silverKg && silverKg > 10000 ? silverKg : null,
    source: goldSource,
  };
}

/** National India retail gold (24K / 10g) + silver (/kg). Day-cached; spot only as last resort. */
export async function getNationalBullionDesk(force = false): Promise<BullionDesk | null> {
  const today = kolkataDateKey();
  const cached = await readDayCache<BullionDesk>(BULLION_CACHE);
  if (!force && cached?.asOfDate === today && cached.data?.gold10g24k > 100000) {
    return cached.data;
  }

  const [usdInr, retail] = await Promise.all([
    fetchUsdInr(),
    fetchIndiaRetailBullion(),
  ]);

  if (retail) {
    const gold10g24k = roundMoney(retail.goldPerG24 * 10);
    const gold10g22k = retail.goldPerG22 != null ? roundMoney(retail.goldPerG22 * 10) : roundMoney(gold10g24k * (22 / 24));
    const gold10g18k = retail.goldPerG18 != null ? roundMoney(retail.goldPerG18 * 10) : roundMoney(gold10g24k * (18 / 24));
    let silverKg = retail.silverKg;
    if (silverKg == null) {
      const silverSpot = await fetchSilverSpotUsd();
      if (usdInr && silverSpot) silverKg = roundMoney(ozToInrPerKg(silverSpot.price, usdInr));
      else silverKg = cached?.data?.silverKg ?? null;
    }
    if (silverKg == null) silverKg = 0;

    const prevGold = cached?.data?.gold10g24k;
    const prevSilver = cached?.data?.silverKg;
    const desk: BullionDesk = {
      gold10g24k,
      gold10g22k,
      gold10g18k,
      goldChangePct: prevGold ? changePct(gold10g24k, prevGold) : null,
      silverKg,
      silverChangePct: prevSilver ? changePct(silverKg, prevSilver) : null,
      usdInr: roundMoney(usdInr ?? cached?.data?.usdInr ?? 95, 4),
      source: `india-retail:${retail.source}`,
      asOfDate: today,
      updatedAt: new Date().toISOString(),
    };
    await writeDayCache(BULLION_CACHE, desk, today);
    return desk;
  }

  // Last resort: international spot × FX (understates jewellery retail — only if Goodreturns fails).
  const [gold, silver] = await Promise.all([fetchGoldSpotUsd(), fetchSilverSpotUsd()]);
  if (usdInr && gold) {
    const gold10g24k = roundMoney(ozToInrPer10g(gold.price, usdInr));
    const silverKg = silver
      ? roundMoney(ozToInrPerKg(silver.price, usdInr))
      : cached?.data?.silverKg ?? 0;
    const desk: BullionDesk = {
      gold10g24k,
      gold10g22k: roundMoney(gold10g24k * (22 / 24)),
      gold10g18k: roundMoney(gold10g24k * (18 / 24)),
      goldChangePct: changePct(gold10g24k, ozToInrPer10g(gold.prev, usdInr)),
      silverKg,
      silverChangePct: silver ? changePct(silverKg, ozToInrPerKg(silver.prev, usdInr)) : null,
      usdInr: roundMoney(usdInr, 4),
      source: `spot-fallback:${gold.source}+fx`,
      asOfDate: today,
      updatedAt: new Date().toISOString(),
    };
    await writeDayCache(BULLION_CACHE, desk, today);
    return desk;
  }

  if (cached?.data && cached.data.gold10g24k > 0) return cached.data;
  return null;
}

/** Goodreturns city slug for petrol/diesel pages. */
const FUEL_CITY_SLUGS: Record<string, string> = {
  delhi: 'new-delhi',
  'new delhi': 'new-delhi',
  'new-delhi': 'new-delhi',
  mumbai: 'mumbai',
  bangalore: 'bangalore',
  bengaluru: 'bangalore',
  chennai: 'chennai',
  hyderabad: 'hyderabad',
  kolkata: 'kolkata',
  pune: 'pune',
  jaipur: 'jaipur',
  lucknow: 'lucknow',
  noida: 'noida',
  chandigarh: 'chandigarh',
  gurgaon: 'gurgaon',
  gurugram: 'gurgaon',
  ahmedabad: 'ahmedabad',
  patna: 'patna',
  bhubaneswar: 'bhubaneswar',
  trivandrum: 'trivandrum',
  'thiruvananthapuram': 'trivandrum',
  rishikesh: 'dehradun',
  dehradun: 'dehradun',
};

/** Last-resort metro desks (updated when scrape fails). Prefer live Goodreturns. */
const FUEL_FALLBACK: Record<string, { petrol: number; diesel: number }> = {
  'new-delhi': { petrol: 102.12, diesel: 95.2 },
  mumbai: { petrol: 111.21, diesel: 97.83 },
  bangalore: { petrol: 110.93, diesel: 96.5 },
  chennai: { petrol: 107.76, diesel: 95.8 },
  hyderabad: { petrol: 115.73, diesel: 100.5 },
  kolkata: { petrol: 113.51, diesel: 98.9 },
  pune: { petrol: 111.88, diesel: 97.5 },
  jaipur: { petrol: 113.5, diesel: 98.2 },
  lucknow: { petrol: 101.86, diesel: 94.5 },
  noida: { petrol: 101.77, diesel: 94.4 },
  chandigarh: { petrol: 102.2, diesel: 89.5 },
  gurgaon: { petrol: 102.97, diesel: 95.0 },
  ahmedabad: { petrol: 102.15, diesel: 94.8 },
  dehradun: { petrol: 100.55, diesel: 93.5 },
};

function resolveFuelSlug(city: string): string {
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ');
  if (FUEL_CITY_SLUGS[key]) return FUEL_CITY_SLUGS[key];
  const compact = key.replace(/\s+/g, '-');
  if (FUEL_CITY_SLUGS[compact]) return FUEL_CITY_SLUGS[compact];
  // Unknown city → nearest known metro slug heuristic: Delhi NCR default for north.
  if (/delhi|ncr|faridabad|ghaziabad/.test(key)) return 'new-delhi';
  return compact || 'new-delhi';
}

function parseLitreFromHtml(html: string): number | null {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
  const fromTitle = title.match(/Rs\.?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*Ltr/i);
  if (fromTitle) {
    const n = Number(fromTitle[1]);
    if (n >= 50 && n <= 200) return n;
  }
  const fromBody = html.match(
    /current price of (?:petrol|diesel) is Rs\.?\s*([0-9]+(?:\.[0-9]+)?)/i,
  );
  if (fromBody) {
    const n = Number(fromBody[1]);
    if (n >= 50 && n <= 200) return n;
  }
  return null;
}

async function scrapeCityFuel(slug: string): Promise<{ petrol: number; diesel: number } | null> {
  const [petrolHtml, dieselHtml] = await Promise.all([
    fetchTextHead(`https://www.goodreturns.in/petrol-price-in-${slug}.html`, 14000, 12000),
    fetchTextHead(`https://www.goodreturns.in/diesel-price-in-${slug}.html`, 14000, 12000),
  ]);

  const petrol = petrolHtml ? parseLitreFromHtml(petrolHtml) : null;
  const diesel = dieselHtml ? parseLitreFromHtml(dieselHtml) : null;

  if (petrol != null && diesel != null) {
    return { petrol, diesel };
  }

  // Retry New Delhi if a thin/unknown slug failed.
  if (slug !== 'new-delhi' && (petrol == null || diesel == null)) {
    return null;
  }
  if (petrol != null || diesel != null) {
    const fb = FUEL_FALLBACK[slug] || FUEL_FALLBACK['new-delhi'];
    return {
      petrol: petrol ?? fb.petrol,
      diesel: diesel ?? fb.diesel,
    };
  }
  return null;
}

function fuelCacheKey(slug: string) {
  return `market:fuel:v1:${slug}`;
}

/** City petrol/diesel + Speed (premium = petrol + national Speed uplift). Day-cached. */
export async function getCityFuelDesk(city: string, force = false): Promise<FuelDesk> {
  const today = kolkataDateKey();
  const slug = resolveFuelSlug(city);
  const key = fuelCacheKey(slug);
  const cached = await readDayCache<FuelDesk>(key);

  if (!force && cached?.asOfDate === today && cached.data?.petrol > 0) {
    return cached.data;
  }

  let petrol: number;
  let diesel: number;
  let source: string;
  let changePctValue: number | null = null;

  const live = await scrapeCityFuel(slug);
  if (live) {
    petrol = live.petrol;
    diesel = live.diesel;
    source = `goodreturns:${slug}`;
    if (cached?.data?.petrol) {
      changePctValue = changePct(petrol, cached.data.petrol);
    }
  } else if (cached?.data?.petrol) {
    return cached.data;
  } else {
    const fb = FUEL_FALLBACK[slug] || FUEL_FALLBACK['new-delhi'];
    petrol = fb.petrol;
    diesel = fb.diesel;
    source = `fallback:${slug}`;
  }

  const desk: FuelDesk = {
    city: city.trim() || slug,
    petrol: roundMoney(petrol, 2),
    diesel: roundMoney(diesel, 2),
    speed: roundMoney(petrol + SPEED_PREMIUM_INR, 2),
    changePct: changePctValue,
    source,
    asOfDate: today,
    updatedAt: new Date().toISOString(),
  };
  await writeDayCache(key, desk, today);
  return desk;
}

export async function getUsdInrCached(): Promise<number | null> {
  const desk = await getNationalBullionDesk();
  if (desk?.usdInr) return desk.usdInr;
  return fetchUsdInr();
}
