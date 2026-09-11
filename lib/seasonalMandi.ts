// lib/seasonalMandi.ts — Season-aware Indian mandi boards (fruits, veg, grains + millets)

import type { DailyLocation } from './dailyPublicFeed';

export type MandiSeason = 'winter' | 'summer' | 'monsoon' | 'autumn';

export type SeasonalProduce = {
  name: string;
  /** Typical wholesale ₹/kg (fruits/veg) or ₹/quintal (grains) */
  baseMin: number;
  baseMax: number;
  unit: '/kg' | '/dozen' | '/quintal';
  seasons: MandiSeason[] | 'year-round';
};

export function currentMandiSeason(date = new Date()): MandiSeason {
  const m = date.getMonth(); // 0–11
  if (m === 11 || m <= 1) return 'winter'; // Dec–Feb
  if (m >= 2 && m <= 4) return 'summer'; // Mar–May
  if (m >= 5 && m <= 8) return 'monsoon'; // Jun–Sep
  return 'autumn'; // Oct–Nov
}

export function mandiSeasonLabel(season: MandiSeason): string {
  switch (season) {
    case 'winter': return 'Winter harvest';
    case 'summer': return 'Summer harvest';
    case 'monsoon': return 'Monsoon harvest';
    case 'autumn': return 'Autumn harvest';
  }
}

/** City-tier multiplier so hills / metros get realistic local desks. */
export function areaPriceFactor(city: string): number {
  const key = city.trim().toLowerCase();
  if (/mumbai|bengaluru|bangalore|hyderabad|chennai|pune/.test(key)) return 1.12;
  if (/delhi|noida|gurgaon|gurugram|ghaziabad|faridabad/.test(key)) return 1.06;
  if (/shimla|manali|nainital|mussoorie|rishikesh|dehradun|srinagar/.test(key)) return 1.18;
  if (/kolkata|lucknow|jaipur|chandigarh|ahmedabad|indore|bhopal/.test(key)) return 1.04;
  return 1;
}

/** Seasonal vegetables — staples always included; extras rotate by season. */
export const SEASONAL_VEGETABLES: SeasonalProduce[] = [
  { name: 'Potato', baseMin: 18, baseMax: 32, unit: '/kg', seasons: 'year-round' },
  { name: 'Onion', baseMin: 22, baseMax: 40, unit: '/kg', seasons: 'year-round' },
  { name: 'Tomato', baseMin: 25, baseMax: 55, unit: '/kg', seasons: 'year-round' },
  { name: 'Green Chillies', baseMin: 40, baseMax: 90, unit: '/kg', seasons: 'year-round' },
  { name: 'Brinjal', baseMin: 24, baseMax: 42, unit: '/kg', seasons: 'year-round' },
  // Winter
  { name: 'Cauliflower', baseMin: 22, baseMax: 40, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Cabbage', baseMin: 16, baseMax: 28, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Peas', baseMin: 40, baseMax: 80, unit: '/kg', seasons: ['winter'] },
  { name: 'Carrot', baseMin: 20, baseMax: 36, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Radish', baseMin: 14, baseMax: 26, unit: '/kg', seasons: ['winter'] },
  { name: 'Spinach', baseMin: 12, baseMax: 28, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Fenugreek / Methi', baseMin: 18, baseMax: 35, unit: '/kg', seasons: ['winter'] },
  { name: 'Broccoli', baseMin: 50, baseMax: 90, unit: '/kg', seasons: ['winter'] },
  // Summer
  { name: 'Okra / Bhindi', baseMin: 30, baseMax: 60, unit: '/kg', seasons: ['summer', 'monsoon'] },
  { name: 'Bottle Gourd', baseMin: 18, baseMax: 32, unit: '/kg', seasons: ['summer', 'monsoon'] },
  { name: 'Bitter Gourd', baseMin: 28, baseMax: 48, unit: '/kg', seasons: ['summer', 'monsoon'] },
  { name: 'Cucumber', baseMin: 16, baseMax: 32, unit: '/kg', seasons: ['summer', 'monsoon'] },
  { name: 'Pumpkin', baseMin: 14, baseMax: 26, unit: '/kg', seasons: ['summer', 'monsoon'] },
  { name: 'Ridge Gourd', baseMin: 22, baseMax: 40, unit: '/kg', seasons: ['summer'] },
  { name: 'Capsicum', baseMin: 35, baseMax: 70, unit: '/kg', seasons: ['summer', 'winter'] },
  // Monsoon / autumn
  { name: 'French Beans', baseMin: 40, baseMax: 75, unit: '/kg', seasons: ['monsoon', 'autumn'] },
  { name: 'Corn / Bhutta', baseMin: 20, baseMax: 40, unit: '/kg', seasons: ['monsoon', 'autumn'] },
  { name: 'Ginger', baseMin: 60, baseMax: 120, unit: '/kg', seasons: ['monsoon', 'autumn', 'winter'] },
  { name: 'Arbi / Colocasia', baseMin: 30, baseMax: 55, unit: '/kg', seasons: ['monsoon', 'autumn'] },
];

/** Seasonal fruits — banana/papaya year-round; rest rotate. */
export const SEASONAL_FRUITS: SeasonalProduce[] = [
  { name: 'Banana', baseMin: 35, baseMax: 60, unit: '/dozen', seasons: 'year-round' },
  { name: 'Papaya', baseMin: 25, baseMax: 48, unit: '/kg', seasons: 'year-round' },
  // Winter
  { name: 'Orange', baseMin: 45, baseMax: 90, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Sweet Lime / Mosambi', baseMin: 40, baseMax: 75, unit: '/kg', seasons: ['winter'] },
  { name: 'Guava', baseMin: 40, baseMax: 70, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Apple', baseMin: 100, baseMax: 180, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Pomegranate', baseMin: 120, baseMax: 220, unit: '/kg', seasons: ['winter', 'autumn'] },
  { name: 'Grapes', baseMin: 60, baseMax: 120, unit: '/kg', seasons: ['winter', 'summer'] },
  { name: 'Strawberry', baseMin: 180, baseMax: 320, unit: '/kg', seasons: ['winter'] },
  // Summer
  { name: 'Mango', baseMin: 60, baseMax: 160, unit: '/kg', seasons: ['summer'] },
  { name: 'Watermelon', baseMin: 12, baseMax: 28, unit: '/kg', seasons: ['summer'] },
  { name: 'Muskmelon', baseMin: 25, baseMax: 50, unit: '/kg', seasons: ['summer'] },
  { name: 'Lychee', baseMin: 80, baseMax: 160, unit: '/kg', seasons: ['summer'] },
  { name: 'Jackfruit', baseMin: 20, baseMax: 40, unit: '/kg', seasons: ['summer'] },
  { name: 'Jamun', baseMin: 50, baseMax: 100, unit: '/kg', seasons: ['summer'] },
  // Monsoon / autumn
  { name: 'Pear', baseMin: 70, baseMax: 130, unit: '/kg', seasons: ['monsoon', 'autumn'] },
  { name: 'Peach', baseMin: 80, baseMax: 150, unit: '/kg', seasons: ['monsoon'] },
  { name: 'Plum', baseMin: 90, baseMax: 160, unit: '/kg', seasons: ['monsoon'] },
  { name: 'Custard Apple', baseMin: 60, baseMax: 120, unit: '/kg', seasons: ['monsoon', 'autumn'] },
  { name: 'Pomegranate (late)', baseMin: 110, baseMax: 200, unit: '/kg', seasons: ['monsoon'] },
];

/** Anaaj staples + Shree Anna millets (₹/quintal wholesale). */
export const ANAAJ_STAPLES: SeasonalProduce[] = [
  { name: 'Wheat / Gehu', baseMin: 2200, baseMax: 2480, unit: '/quintal', seasons: 'year-round' },
  { name: 'Rice · Basmati', baseMin: 4800, baseMax: 6500, unit: '/quintal', seasons: 'year-round' },
  { name: 'Rice · Parmal', baseMin: 2800, baseMax: 3400, unit: '/quintal', seasons: 'year-round' },
  { name: 'Maize / Makka', baseMin: 1850, baseMax: 2200, unit: '/quintal', seasons: 'year-round' },
  { name: 'Mustard / Sarson', baseMin: 5200, baseMax: 6000, unit: '/quintal', seasons: 'year-round' },
  { name: 'Moong Dal', baseMin: 7200, baseMax: 8600, unit: '/quintal', seasons: 'year-round' },
];

export const ANAAJ_MILLETS: SeasonalProduce[] = [
  { name: 'Pearl Millet / Bajra', baseMin: 2050, baseMax: 2400, unit: '/quintal', seasons: 'year-round' },
  { name: 'Finger Millet / Ragi', baseMin: 3100, baseMax: 3700, unit: '/quintal', seasons: 'year-round' },
  { name: 'Sorghum / Jowar', baseMin: 2300, baseMax: 2750, unit: '/quintal', seasons: 'year-round' },
  { name: 'Foxtail Millet / Kangni', baseMin: 2800, baseMax: 3400, unit: '/quintal', seasons: 'year-round' },
  { name: 'Barnyard Millet / Sanwa', baseMin: 3000, baseMax: 3600, unit: '/quintal', seasons: 'year-round' },
];

export function produceForSeason(
  catalog: SeasonalProduce[],
  season: MandiSeason,
  limit = 10,
): SeasonalProduce[] {
  const inSeason = catalog.filter(row =>
    row.seasons === 'year-round' || row.seasons.includes(season),
  );
  // Prefer year-round staples first, then seasonal specialty crops.
  const staples = inSeason.filter(r => r.seasons === 'year-round');
  const seasonal = inSeason.filter(r => r.seasons !== 'year-round');
  return [...staples, ...seasonal].slice(0, limit);
}

function commodityKey(name: string) {
  return name.toLowerCase().split(/[/(·]/)[0].trim();
}

/** Significant tokens for fuzzy commodity matching (Wheat / Gehu ↔ Wheat). */
function commodityTokens(name: string): string[] {
  const stop = new Set([
    'the', 'and', 'dal', 'raw', 'late', 'dry', 'wet', 'big', 'small', 'other',
    'faq', 'whole', 'leaves', 'green', 'common', 'mill', 'quality',
  ]);
  return name
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/[^a-z0-9]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !stop.has(t));
}

const ALIAS_TOKENS: Record<string, string[]> = {
  wheat: ['wheat', 'gehu'],
  rice: ['rice', 'paddy', 'basmati', 'parmal'],
  maize: ['maize', 'makka', 'corn'],
  bajra: ['bajra', 'pearl'],
  ragi: ['ragi', 'finger'],
  jowar: ['jowar', 'sorghum'],
  mustard: ['mustard', 'sarson'],
  moong: ['moong', 'mung'],
  banana: ['banana', 'plantain'],
  'sweet lime': ['mousambi', 'mosambi', 'sweet'],
  mosambi: ['mousambi', 'mosambi'],
  pomegranate: ['pomegranate', 'anar'],
  guava: ['guava'],
  papaya: ['papaya'],
  apple: ['apple'],
  mango: ['mango'],
  orange: ['orange', 'santra'],
  grapes: ['grape', 'grapes'],
  watermelon: ['watermelon', 'tarbuj'],
  muskmelon: ['muskmelon', 'kharbuja'],
  foxtail: ['foxtail', 'kangni'],
  barnyard: ['barnyard', 'sanwa'],
};

export function matchLiveMandiPrice(
  rows: Array<{ name: string; price: string }>,
  target: string,
): string | null {
  const tKey = commodityKey(target);
  const tTokens = new Set([
    ...commodityTokens(target),
    ...(ALIAS_TOKENS[tKey] || []),
  ]);
  // Also map first alias group if target contains known keys.
  for (const [alias, toks] of Object.entries(ALIAS_TOKENS)) {
    if (target.toLowerCase().includes(alias)) toks.forEach(x => tTokens.add(x));
  }

  let best: { price: string; score: number } | null = null;
  for (const row of rows) {
    const nKey = commodityKey(row.name);
    const nTokens = commodityTokens(row.name);
    let score = 0;
    if (nKey === tKey) score += 10;
    if (nKey.includes(tKey) || tKey.includes(nKey)) score += 6;
    for (const tok of nTokens) {
      if (tTokens.has(tok)) score += 3;
    }
    if (score <= 0) continue;
    if (!best || score > best.score) best = { price: row.price, score };
  }
  return best && best.score >= 3 ? best.price : null;
}

export type PricedMandiRow = {
  id: string;
  name: string;
  price: string;
  unit: string;
  changePct: number;
};

/** Price a produce row — live exact price only (no estimates / ranges). */
export function priceProduceRow(
  row: SeasonalProduce,
  city: string,
  liveRows: Array<{ name: string; price: string }>,
  idPrefix: string,
  index: number,
): PricedMandiRow | null {
  const live = matchLiveMandiPrice(liveRows, row.name);
  if (!live) return null;

  // Reject ranges / approximations — exact single price only.
  if (/[–-]/.test(live) || /approx|estimat|~|to\b/i.test(live)) return null;

  let price = live.trim();
  let unit: string;

  if (row.unit === '/quintal') {
    unit = '₹/quintal';
    if (!/qtl|quintal/i.test(price)) {
      const n = Number(String(price).replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n)) return null;
      price = `₹${Math.round(n).toLocaleString('en-IN')}/quintal`;
    }
  } else if (row.unit === '/dozen') {
    // Prefer exact live dozen; otherwise accept exact ₹/kg from the desk.
    if (live && /dozen/i.test(live)) {
      unit = '₹/dozen';
      price = live.trim();
    } else if (live && (/\/kg/i.test(live) || /^₹?\s*\d/.test(live))) {
      unit = '₹/kg';
      price = /\/kg/i.test(live) ? live.trim() : `${live.trim()}/kg`;
    } else {
      return null;
    }
  } else {
    unit = '₹/kg';
    if (/\/qtl|quintal/i.test(price)) {
      const n = Number(String(price).replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return null;
      // Official mandi modal is ₹/quintal → exact ₹/kg = modal/100.
      price = `₹${Math.round(n / 100)}/kg`;
    } else if (!/\/kg/i.test(price)) {
      price = `${price}/kg`;
    }
  }

  return {
    id: `${idPrefix}-${commodityKey(row.name).replace(/\s+/g, '-')}`,
    name: row.name.replace(/\s*\(late\)\s*/i, '').trim(),
    price,
    unit,
    changePct: 0,
  };
}

const MARKET_SLUG: Record<string, string> = {
  delhi: 'delhi',
  'new delhi': 'delhi',
  noida: 'noida',
  gurgaon: 'gurgaon',
  gurugram: 'gurgaon',
  mumbai: 'mumbai',
  bengaluru: 'bangalore',
  bangalore: 'bangalore',
  chennai: 'chennai',
  hyderabad: 'hyderabad',
  kolkata: 'kolkata',
  pune: 'pune',
  jaipur: 'jaipur',
  lucknow: 'lucknow',
  ahmedabad: 'ahmedabad',
  chandigarh: 'chandigarh',
  rishikesh: 'dehradun',
  dehradun: 'dehradun',
};

function marketSlug(city: string) {
  const key = city.trim().toLowerCase();
  return MARKET_SLUG[key] || key.replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'delhi';
}

async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; VedastyaCityConnect/1.0)',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseExactRupee(cell: string): string | null {
  const cleaned = cell.replace(/&#x20b9;/gi, '₹').trim();
  // Exact single price only — reject ranges like "₹33 - 39".
  if (/[–-]/.test(cleaned)) return null;
  const m = cleaned.match(/₹?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** Scrape today's exact retail mandi board (single price column, not the range). */
async function scrapeVegetableMarketExact(city: string): Promise<Array<{ name: string; price: string }>> {
  const slug = marketSlug(city);
  const html = await fetchText(`https://vegetablemarketprice.com/market/${slug}/today`, 14000);
  if (!html) return [];

  const rows = html.match(/<tr[^>]*class="[^"]*todayVegetableTableRows[^"]*"[\s\S]*?<\/tr>/gi) ?? [];
  const out: Array<{ name: string; price: string }> = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    );
    // Typical: [image, name, exact ₹, range, unit]
    const name = cells.find(c => c && !/^₹/.test(c) && !/^\d/.test(c) && !/^1kg$/i.test(c) && c.length > 1);
    const exactCell = cells.find(c => /^₹?\s*\d/.test(c) && !/[–-]/.test(c));
    if (!name || !exactCell) continue;
    const exact = parseExactRupee(exactCell);
    if (!exact) continue;
    const unit = /dozen/i.test(name) ? '/dozen' : '/kg';
    out.push({ name, price: `${exact}${unit}` });
  }

  return out;
}

const CITY_TO_MANDI_STATE: Record<string, string> = {
  mumbai: 'Maharashtra',
  pune: 'Maharashtra',
  nagpur: 'Maharashtra',
  lucknow: 'Uttar Pradesh',
  noida: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  varanasi: 'Uttar Pradesh',
  bengaluru: 'Karnataka',
  bangalore: 'Karnataka',
  mysore: 'Karnataka',
  chandigarh: 'Punjab',
  ludhiana: 'Punjab',
  amritsar: 'Punjab',
  indore: 'Madhya Pradesh',
  bhopal: 'Madhya Pradesh',
  delhi: 'Uttar Pradesh',
  'new delhi': 'Uttar Pradesh',
  gurgaon: 'Uttar Pradesh',
  gurugram: 'Uttar Pradesh',
  jaipur: 'Madhya Pradesh',
  ahmedabad: 'Madhya Pradesh',
  chennai: 'Karnataka',
  hyderabad: 'Karnataka',
  kolkata: 'Uttar Pradesh',
  rishikesh: 'Uttar Pradesh',
  dehradun: 'Uttar Pradesh',
};

const FRUIT_NAME_RE = /apple|banana|guava|papaya|pomegranate|mango|orange|grape|watermelon|muskmelon|mosambi|mousambi|sweet\s*lime|pear|peach|plum|lychee|jackfruit|strawberry|custard|amla|lemon|lime/i;
const ANAAJ_NAME_RE = /wheat|rice|paddy|maize|makka|bajra|ragi|jowar|sorghum|millet|mustard|sarson|moong|mung|foxtail|kangni|barnyard|sanwa|gehu/i;

function isFruitCommodity(name: string) {
  return FRUIT_NAME_RE.test(name);
}

function isAnaajCommodity(name: string) {
  return ANAAJ_NAME_RE.test(name);
}

function median(nums: number[]) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One state pull from mandi-api — exact modal prices for fruits (/kg) and anaaj (/quintal).
 */
async function fetchStateMandiExact(city: string): Promise<Array<{ name: string; price: string }>> {
  const key = city.trim().toLowerCase();
  const state = CITY_TO_MANDI_STATE[key] || 'Uttar Pradesh';
  const json = await fetchJson<{
    success?: boolean;
    data?: Array<{
      commodity?: string;
      modal_price?: number;
      market?: string;
      district?: string;
      state?: string;
    }>;
  }>(`https://mandi-api.onrender.com/v1/prices?state=${encodeURIComponent(state)}`, 14000);

  const rows = json?.data ?? [];
  if (!rows.length) return [];

  const cityToken = key.split(/\s+/)[0];
  const byCommodity = new Map<string, Array<{ modal: number; near: boolean; name: string }>>();

  for (const row of rows) {
    const name = (row.commodity || '').trim();
    const modal = row.modal_price;
    if (!name || typeof modal !== 'number' || !Number.isFinite(modal) || modal <= 0) continue;
    if (!isFruitCommodity(name) && !isAnaajCommodity(name)) continue;
    const near = `${row.market || ''} ${row.district || ''}`.toLowerCase().includes(cityToken);
    const list = byCommodity.get(name) || [];
    list.push({ modal, near, name });
    byCommodity.set(name, list);
  }

  const out: Array<{ name: string; price: string }> = [];
  for (const [, list] of byCommodity) {
    const nearList = list.filter(x => x.near);
    const pool = nearList.length ? nearList : list;
    const modal = median(pool.map(x => x.modal));
    if (modal == null) continue;
    const name = pool[0].name;
    if (isAnaajCommodity(name) && !isFruitCommodity(name)) {
      out.push({
        name,
        price: `₹${Math.round(modal).toLocaleString('en-IN')}/quintal`,
      });
    } else {
      const perKg = Math.max(1, Math.round(modal / 100));
      out.push({ name, price: `₹${perKg}/kg` });
    }
  }
  return out;
}

/** National fruit desk — exact modal for common fruits (fills Seasonal Fruits tab). */
async function fetchNationalFruitExact(city: string): Promise<Array<{ name: string; price: string }>> {
  const key = city.trim().toLowerCase();
  const preferredState = CITY_TO_MANDI_STATE[key] || '';
  const fruits = [
    'Apple', 'Banana', 'Guava', 'Pomegranate', 'Mango', 'Orange', 'Grapes',
    'Papaya', 'Watermelon', 'Mousambi',
  ];

  const results = await Promise.all(fruits.map(async (commodity) => {
    const json = await fetchJson<{
      data?: Array<{ commodity?: string; modal_price?: number; state?: string; market?: string; district?: string }>;
    }>(
      `https://mandi-api.onrender.com/v1/prices?commodity=${encodeURIComponent(commodity)}`,
      10000,
    );
    const rows = (json?.data ?? []).filter(r =>
      typeof r.modal_price === 'number' && Number.isFinite(r.modal_price) && (r.modal_price as number) > 0,
    );
    if (!rows.length) return null;
    const sameState = preferredState
      ? rows.filter(r => (r.state || '').toLowerCase() === preferredState.toLowerCase())
      : [];
    const pool = sameState.length ? sameState : rows;
    const modal = median(pool.map(r => Number(r.modal_price)));
    if (modal == null) return null;
    const name = pool[0].commodity || commodity;
    return { name, price: `₹${Math.max(1, Math.round(modal / 100))}/kg` };
  }));

  return results.filter((r): r is { name: string; price: string } => !!r);
}

/** Live exact wholesale/retail rows for the city — never estimates. */
export async function loadLiveMandiRows(
  location: Pick<DailyLocation, 'city'>,
): Promise<Array<{ name: string; price: string }>> {
  const city = location.city || 'Delhi';
  const govKey = (process.env.EXPO_PUBLIC_DATA_GOV_IN_KEY || '').trim();

  const [govRows, retailRows, stateRows, fruitRows] = await Promise.all([
    (async () => {
      if (!govKey) return [] as Array<{ name: string; price: string }>;
      const gov = await fetchJson<{ records?: Array<{ commodity?: string; modal_price?: string }> }>(
        `https://api.data.gov.in/resource/9ef84268-d588-465a-9ccd-e8c9c98fd8d3?api-key=${govKey}&format=json&limit=80&filters[district]=${encodeURIComponent(city)}`,
      );
      return (gov?.records ?? [])
        .filter(r => r.commodity && r.modal_price && !String(r.modal_price).includes('-'))
        .map(row => ({
          name: String(row.commodity),
          price: `₹${row.modal_price}/qtl`,
        }));
    })(),
    scrapeVegetableMarketExact(city),
    fetchStateMandiExact(city),
    fetchNationalFruitExact(city),
  ]);

  // Prefer city retail for veg; state anaaj; national fruits fill gaps.
  const byName = new Map<string, { name: string; price: string }>();
  for (const row of [...retailRows, ...stateRows, ...fruitRows, ...govRows]) {
    const k = commodityKey(row.name);
    if (!byName.has(k)) byName.set(k, row);
  }
  return [...byName.values()];
}

export function classifyLiveMandiKind(name: string): 'fruit' | 'anaaj' | 'sabji' {
  if (isAnaajCommodity(name) && !isFruitCommodity(name)) return 'anaaj';
  if (isFruitCommodity(name)) return 'fruit';
  return 'sabji';
}
