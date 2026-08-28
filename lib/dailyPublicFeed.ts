// lib/dailyPublicFeed.ts — Live location + English Daily Explore public feed

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { matchCity, POPULAR_CITIES } from '../constants/cities';
import type { CityNews, CityNewsCategory, CityNewsComment, DailyWidgetMeta, Profile, Reel } from '../types';

const FETCH_MS = 8000;

export type DailyLocation = {
  city: string;
  state?: string;
  country?: string;
  lat: number;
  lng: number;
  source: 'gps' | 'ip' | 'profile';
};

type InteractionStore = {
  likes: Record<string, boolean>;
  likeCounts: Record<string, number>;
  comments: Record<string, CityNewsComment[]>;
};

function liveId(category: CityNewsCategory, seed: string) {
  const normalized = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `live-${category}-${normalized || 'item'}`;
}

export function isLiveDailyItem(id: string) {
  return id.startsWith('live-') || id.startsWith('spark-');
}

function makeCard(partial: {
  id: string;
  city: string;
  category: CityNewsCategory;
  title: string;
  body: string;
  image_url?: string | null;
  source_url?: string | null;
  created_at?: string;
  media_type?: 'image' | 'video' | null;
  widget?: DailyWidgetMeta | null;
  featured?: boolean;
  total_likes?: number;
  total_comments?: number;
}): CityNews {
  const now = partial.created_at || new Date().toISOString();
  return {
    id: partial.id,
    city: partial.city,
    category: partial.category,
    title: partial.title,
    body: partial.body,
    image_url: partial.image_url ?? null,
    source_url: partial.source_url ?? null,
    is_published: true,
    author_id: null,
    total_likes: partial.total_likes ?? 0,
    total_comments: partial.total_comments ?? 0,
    created_at: now,
    updated_at: now,
    is_liked: false,
    media_type: partial.media_type ?? 'image',
    widget: partial.widget ?? null,
    featured: partial.featured ?? false,
  };
}

async function fetchJson<T>(url: string, timeoutMs = FETCH_MS): Promise<T | null> {
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

async function fetchText(url: string, timeoutMs = FETCH_MS): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller?.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(text: string, max = 180) {
  const clean = decodeXml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function parseRssItems(xml: string) {
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  return blocks.slice(0, 12).map(block => {
    const title = decodeXml((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const link = decodeXml((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '');
    const pubDate = decodeXml((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '');
    const description = decodeXml((block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '');
    const image = (
      block.match(/<media:content[^>]+url=["']([^"']+)["']/i)
      || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
      || block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i)
      || block.match(/url=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i)
      || []
    )[1] || null;
    return { title, link, pubDate, description, image };
  }).filter(item => item.title);
}

async function loadRss(rssUrl: string) {
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
  const xml = await fetchText(proxied, 10000);
  if (xml && xml.includes('<item')) return parseRssItems(xml);
  const json = await fetchJson<{ items?: Array<{ title?: string; link?: string; pubDate?: string; description?: string; enclosure?: { link?: string } }> }>(
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
    10000,
  );
  return (json?.items ?? []).map(item => ({
    title: item.title || '',
    link: item.link || '',
    pubDate: item.pubDate || '',
    description: item.description || '',
    image: item.enclosure?.link || null,
  })).filter(item => item.title);
}

/** Curated high-res Unsplash photos — strict topic pools (never mismatched stock) */
const TOPIC_PHOTO_POOLS: Record<string, string[]> = {
  fuel: [
    'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1562519819-016930ada31b?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&w=900&q=80',
  ],
  gold: [
    'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1574600236900-4d2469187633?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80',
  ],
  silver: [
    'https://images.unsplash.com/photo-1624365168968-f283dcf7f7ea?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80',
  ],
  weather_storm: [
    'https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=900&q=80',
  ],
  weather_rain: [
    'https://images.unsplash.com/photo-1519692933481-1899b1ba3f5f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1527482797697-01785c6c3e7b?auto=format&fit=crop&w=900&q=80',
  ],
  weather_clear: [
    'https://images.unsplash.com/photo-1501973801540-7e1ea1109e69?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1419832006288-4501dc811a42?auto=format&fit=crop&w=900&q=80',
  ],
  weather_cloud: [
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1534088564916-1a1c8f4a3f9f?auto=format&fit=crop&w=900&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80',
  ],
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=900&q=80',
  ],
  events: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
  ],
  mandi: [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  ],
  finance: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=900&q=80',
  ],
  alerts: [
    'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1527482797697-01785c6c3e7b?auto=format&fit=crop&w=900&q=80',
  ],
  news: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?auto=format&fit=crop&w=900&q=80',
  ],
};

function pickPoolPhoto(poolKey: string, seed: string, variant = 0) {
  const pool = TOPIC_PHOTO_POOLS[poolKey] || TOPIC_PHOTO_POOLS.news;
  const hash = (seed || poolKey).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[Math.abs(hash + variant) % pool.length];
}

function detectTopicKey(category: string, title: string): string {
  const t = `${category} ${title}`.toLowerCase();
  if (/petrol|diesel|fuel|pump|nozzle|gas\s*station/.test(t)) return 'fuel';
  if (/gold|sona|24k|22k|bullion|jewellery|jewelry/.test(t)) return 'gold';
  if (/silver|chandi/.test(t)) return 'silver';
  if (/thunder|storm|aandhi|lightning/.test(t)) return 'weather_storm';
  if (/rain|baarish|shower|precipitation/.test(t)) return 'weather_rain';
  if (/clear|sunny|blue\s*sky/.test(t)) return 'weather_clear';
  if (/cloud|fog|kohra|overcast|weather|mausam|forecast/.test(t) || category === 'weather') {
    return /clear|sunny/.test(t) ? 'weather_clear' : 'weather_cloud';
  }
  if (/sport|cricket|football|hockey|match|ipl|world\s*cup/.test(t)) return 'sports';
  if (/tech|ai\b|startup|app\b|phone|gadget|software|cyber/.test(t)) return 'tech';
  if (/event|festival|mela|concert|exhibition|celebration/.test(t) || category === 'event') return 'events';
  if (/mandi|sabzi|vegetable|fruit|aloo|tamatar|pyaz/.test(t)) return 'mandi';
  if (/usd|dollar|nifty|sensex|rupee|stock|finance|currency/.test(t)) return 'finance';
  if (/alert|emergency|warning|flood|strike/.test(t) || category === 'alerts') return 'alerts';
  if (category === 'rates') return /silver|chandi/.test(t) ? 'silver' : 'gold';
  return 'news';
}

/**
 * Strict topic-matched high-res image.
 * Always returns images.unsplash.com photo URLs from curated pools — never dark placeholders.
 */
export function getTopicImageUrl(
  category: string,
  title: string,
  variant = 0,
): string {
  const key = detectTopicKey(category, title);
  return pickPoolPhoto(key, `${category}:${title}`, variant);
}

/** @deprecated Prefer getTopicImageUrl — kept for keyword diagnostics */
export function imageKeywordsFor(
  category: CityNewsCategory,
  title?: string,
  city?: string,
  tag?: string,
) {
  return detectTopicKey(tag || category, `${title || ''} ${city || ''}`);
}

export function buildUnsplashFeatureUrl(keywords: string, variant = 0) {
  // Map legacy keyword strings → strict topic pools
  return getTopicImageUrl(keywords, keywords, variant);
}

function isUsableFeatureImage(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/placehold|picsum\.photos|source\.unsplash|via\.placeholder|dummyimage/i.test(url)) return false;
  return true;
}

export function resolveFeatureImage(
  category: CityNewsCategory,
  seed: string,
  fallback?: string | null,
  title?: string,
  _city?: string,
) {
  if (isUsableFeatureImage(fallback)) return fallback as string;
  return getTopicImageUrl(category, title || seed, 0);
}

export function nextFeatureImage(
  category: CityNewsCategory,
  title: string,
  attempt: number,
  _city?: string,
) {
  return getTopicImageUrl(category, title, attempt);
}

function newsImage(
  seed: string,
  fallback?: string | null,
  category: CityNewsCategory = 'general',
  title?: string,
  _city?: string,
) {
  return resolveFeatureImage(category, seed, fallback, title || seed);
}

/** Clean English headline for InShorts */
export function englishHeadline(title: string) {
  return title
    .replace(/^(National Update|.*? News|.*? Alert|.*? Events|.*? Weather|Gold Rates Today|Silver Rates Today|Dollar vs Rupee|Top 10 Vegetables|Top 10 Fruits|Spark)\s*:\s*/i, '')
    .replace(/\s*[·•].*$/, '')
    .trim() || title;
}

/** InShorts English summary — ~60 words (Who / What / When / Where) + takeaways */
export function buildInShortsContent(item: {
  title: string;
  body: string;
  city: string;
  category: CityNewsCategory;
  created_at?: string;
}) {
  const raw = decodeXml(item.body || '').replace(/\s+/g, ' ').trim();
  const city = item.city || 'the city';
  const headline = englishHeadline(item.title);
  const whoWhat = raw.length > 24 ? raw : headline;

  let when = 'today';
  if (item.created_at) {
    const mins = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000);
    if (mins < 60) when = `${Math.max(1, mins)} minutes ago`;
    else if (mins < 1440) when = `${Math.floor(mins / 60)} hours ago`;
    else when = `${Math.floor(mins / 1440)} days ago`;
  }

  let summary = `${headline}. ${whoWhat} This update from ${city} covers who is affected, what happened, when it was reported (${when}), and where it matters most for local readers.`;
  const words = summary.split(/\s+/).filter(Boolean);
  if (words.length > 60) summary = `${words.slice(0, 60).join(' ')}.`;
  while (summary.split(/\s+/).filter(Boolean).length < 50) {
    summary = `${summary} Local officials and community sources continue monitoring the situation.`;
    if (summary.split(/\s+/).filter(Boolean).length >= 60) {
      summary = `${summary.split(/\s+/).filter(Boolean).slice(0, 60).join(' ')}.`;
      break;
    }
  }

  const takeaways = [
    `What: ${headline.slice(0, 110)}`,
    `Where: ${city}`,
    `When: Reported ${when}`,
    item.category === 'rates'
      ? 'Tip: Prices are indicative — confirm at your local jeweller or fuel station.'
      : item.category === 'weather'
        ? 'Tip: Conditions can change quickly — check the latest forecast before travel.'
        : 'Tip: Open the full publisher story for quotes and official statements.',
  ];

  return { headline, summary, takeaways };
}

function weatherImage(code: number) {
  const label = weatherLabel(code);
  return getTopicImageUrl('weather', label, code);
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear skies';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorms';
}

function weatherSummary(code: number, rainChance?: number) {
  if (code >= 95) return 'Severe thunderstorms possible — limit outdoor travel if you can.';
  if (code >= 80 || (rainChance ?? 0) >= 60) return 'Heavy rain likely later — carry an umbrella.';
  if (code >= 61) return 'Light rain possible — roads may be slippery.';
  if (code >= 45) return 'Foggy or muted conditions — drive carefully.';
  if (code <= 3) return 'Clear to fair skies — a good day to be outdoors.';
  return 'Mostly settled conditions with some cloud cover.';
}

function marketSlug(city: string) {
  const map: Record<string, string> = {
    delhi: 'delhi',
    'new delhi': 'delhi',
    mumbai: 'mumbai',
    bengaluru: 'bangalore',
    bangalore: 'bangalore',
    chennai: 'chennai',
    hyderabad: 'hyderabad',
    kolkata: 'kolkata',
    pune: 'pune',
    ahmedabad: 'ahmedabad',
    jaipur: 'jaipur',
    lucknow: 'lucknow',
    chandigarh: 'chandigarh',
  };
  return map[city.trim().toLowerCase()] || 'delhi';
}

function englishNewsTitle(title: string, city: string, national: boolean, category: CityNewsCategory) {
  const clean = title.replace(/ - .+$/, '').trim();
  if (category === 'alerts') return `${city} Alert: ${clean}`;
  if (category === 'event') return `${city} Events: ${clean}`;
  if (national) return `National Update: ${clean}`;
  return `${city} News: ${clean}`;
}

function englishNewsBody(description: string, city: string, national: boolean) {
  const base = summarize(description || '');
  if (!base) {
    return national
      ? 'Latest national headlines — open the full story for details.'
      : `Local update from ${city} — open the full story for details.`;
  }
  if (national) return `${base} · National desk.`;
  return `${base} · ${city} local desk.`;
}

/** Normalize commodity labels to English while matching Hindi aliases from APIs. */
function commodityEnglish(name: string) {
  const map: Record<string, string> = {
    potato: 'Potato',
    aloo: 'Potato',
    tomato: 'Tomato',
    tamatar: 'Tomato',
    onion: 'Onion',
    pyaz: 'Onion',
    pyaaz: 'Onion',
    banana: 'Banana',
    kela: 'Banana',
    apple: 'Apple',
    seb: 'Apple',
    'green chilli': 'Green chilli',
    cauliflower: 'Cauliflower',
    gobi: 'Cauliflower',
    gobhi: 'Cauliflower',
    cabbage: 'Cabbage',
    'patta gobi': 'Cabbage',
    carrot: 'Carrot',
    gajar: 'Carrot',
    brinjal: 'Brinjal',
    baingan: 'Brinjal',
    ladiesfinger: 'Okra',
    'lady finger': 'Okra',
    bhindi: 'Okra',
    spinach: 'Spinach',
    palak: 'Spinach',
    cucumber: 'Cucumber',
    kheera: 'Cucumber',
    peas: 'Peas',
    matar: 'Peas',
    ginger: 'Ginger',
    adrak: 'Ginger',
    garlic: 'Garlic',
    lehsun: 'Garlic',
    mango: 'Mango',
    aam: 'Mango',
    grapes: 'Grapes',
    angoor: 'Grapes',
    orange: 'Orange',
    santra: 'Orange',
    pomegranate: 'Pomegranate',
    anar: 'Pomegranate',
    guava: 'Guava',
    amrood: 'Guava',
    papaya: 'Papaya',
    papita: 'Papaya',
    'sweet lime': 'Sweet lime',
    mausambi: 'Sweet lime',
    muskmelon: 'Muskmelon',
    kharbuja: 'Muskmelon',
    'shimla mirch': 'Capsicum',
    capsicum: 'Capsicum',
  };
  const key = name.trim().toLowerCase();
  return map[key] || name;
}

/** Newest first — newspaper chronological order */
export function sortDailyByNewest(list: CityNews[]): CityNews[] {
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** @deprecated Prefer sortDailyByNewest for newspaper chronology */
export function shuffleDailyItems<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function detectByGps(): Promise<DailyLocation | null> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 7000, maximumAge: 300000 });
      });
      return reverseGeocode(pos.coords.latitude, pos.coords.longitude, 'gps');
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return reverseGeocode(loc.coords.latitude, loc.coords.longitude, 'gps');
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number, source: DailyLocation['source']): Promise<DailyLocation> {
  const geo = await fetchJson<{ results?: Array<{ name?: string; city?: string; admin1?: string; country?: string }> }>(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lng}&language=en&format=json`,
  );
  const hit = geo?.results?.[0];
  const rawName = hit?.city || hit?.name || '';
  const matched = matchCity(rawName, lat, lng);
  return {
    city: matched?.name || rawName || 'Your city',
    state: hit?.admin1,
    country: hit?.country,
    lat: matched?.lat ?? lat,
    lng: matched?.lng ?? lng,
    source,
  };
}

async function detectByIp(): Promise<DailyLocation | null> {
  const data = await fetchJson<{ city?: string; region?: string; country?: string; latitude?: number; longitude?: number; success?: boolean }>(
    'https://ipwho.is/',
  );
  if (!data?.city || data.latitude == null || data.longitude == null) return null;
  const matched = matchCity(data.city, data.latitude, data.longitude);
  return {
    city: matched?.name || data.city,
    state: data.region,
    country: data.country,
    lat: matched?.lat ?? data.latitude,
    lng: matched?.lng ?? data.longitude,
    source: 'ip',
  };
}

export async function detectDailyLocation(profile?: Profile | null): Promise<DailyLocation> {
  const gps = await detectByGps();
  if (gps) return gps;

  const ip = await detectByIp();
  if (ip) return ip;

  const fallback = matchCity(profile?.city || '', profile?.lat, profile?.lng)
    || POPULAR_CITIES.find(city => city.name.toLowerCase() === (profile?.city || '').toLowerCase())
    || POPULAR_CITIES[1];
  return {
    city: profile?.city || fallback.name,
    lat: profile?.lat ?? fallback.lat,
    lng: profile?.lng ?? fallback.lng,
    source: 'profile',
  };
}

async function fetchNewsCategory(
  location: DailyLocation,
  category: CityNewsCategory,
  query: string,
  national = false,
): Promise<CityNews[]> {
  const gnewsKey = (process.env.EXPO_PUBLIC_GNEWS_KEY || '').trim();
  const newsApiKey = (process.env.EXPO_PUBLIC_NEWSAPI_KEY || '').trim();
  const cards: CityNews[] = [];

  if (gnewsKey) {
    const gnews = await fetchJson<{ articles?: Array<{ title?: string; description?: string; url?: string; image?: string; publishedAt?: string }> }>(
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=8&apikey=${gnewsKey}`,
    );
    for (const article of gnews?.articles ?? []) {
      if (!article.title) continue;
      cards.push(makeCard({
        id: liveId(category, article.url || article.title),
        city: national ? 'National' : location.city,
        category,
        title: englishNewsTitle(article.title, location.city, national, category),
        body: englishNewsBody(article.description || article.title, location.city, national),
        image_url: newsImage(article.title, article.image, category, article.title, location.city),
        source_url: article.url || null,
        created_at: article.publishedAt,
        featured: category === 'alerts',
      }));
    }
  } else if (newsApiKey) {
    const newsapi = await fetchJson<{ articles?: Array<{ title?: string; description?: string; url?: string; urlToImage?: string; publishedAt?: string }> }>(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=8&sortBy=publishedAt&apiKey=${newsApiKey}`,
    );
    for (const article of newsapi?.articles ?? []) {
      if (!article.title || article.title === '[Removed]') continue;
      cards.push(makeCard({
        id: liveId(category, article.url || article.title),
        city: national ? 'National' : location.city,
        category,
        title: englishNewsTitle(article.title, location.city, national, category),
        body: englishNewsBody(article.description || article.title, location.city, national),
        image_url: newsImage(article.title, article.urlToImage, category, article.title, location.city),
        source_url: article.url || null,
        created_at: article.publishedAt,
        featured: category === 'alerts',
      }));
    }
  }

  if (cards.length) return cards;

  const rssQuery = national
    ? `https://news.google.com/rss/headlines/section/geo/India?hl=en-IN&gl=IN&ceid=IN:en`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const items = await loadRss(rssQuery);
  return items.slice(0, 8).map((item, index) => makeCard({
    id: liveId(category, item.link || item.title),
    city: national ? 'National' : location.city,
    category,
    title: englishNewsTitle(item.title, location.city, national, category),
    body: englishNewsBody(item.description || item.title, location.city, national),
    image_url: newsImage(item.title, item.image, category, item.title, location.city),
    source_url: item.link || null,
    created_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    featured: category === 'alerts' || (category === 'event' && index === 0),
  }));
}

async function fetchWeatherCards(location: DailyLocation): Promise<CityNews[]> {
  const data = await fetchJson<{
    current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string };
    daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  }>(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);

  if (!data?.current) return [];

  const currentCode = data.current.weather_code ?? 0;
  const temp = Math.round(data.current.temperature_2m ?? 0);
  const humidity = Math.round(data.current.relative_humidity_2m ?? 0);
  const wind = Math.round(data.current.wind_speed_10m ?? 0);
  const rainTonight = data.daily?.precipitation_probability_max?.[0] ?? 0;
  const condition = weatherLabel(currentCode);
  const outlook = weatherSummary(currentCode, rainTonight);

  const cards: CityNews[] = [
    makeCard({
      id: liveId('weather', `now-${location.city}`),
      city: location.city,
      category: 'weather',
      title: `${location.city} Weather: ${condition}`,
      body: `Now ${temp}°C · ${condition}. Humidity ${humidity}%, wind ${wind} km/h. Rain chance today ~${rainTonight}%. ${outlook}`,
      image_url: weatherImage(currentCode),
      source_url: 'https://open-meteo.com/en/docs',
      created_at: new Date().toISOString(),
      featured: true,
      widget: {
        kind: 'weather',
        temp,
        condition,
        humidity,
        wind,
        live: true,
        label: location.city,
      },
    }),
  ];

  const days = data.daily?.time ?? [];
  days.slice(1, 4).forEach((day, index) => {
    const i = index + 1;
    const code = data.daily?.weather_code?.[i] ?? 0;
    const high = Math.round(data.daily?.temperature_2m_max?.[i] ?? 0);
    const low = Math.round(data.daily?.temperature_2m_min?.[i] ?? 0);
    const rain = data.daily?.precipitation_probability_max?.[i] ?? 0;
    const label = new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    cards.push(makeCard({
      id: liveId('weather', `${location.city}-${day}`),
      city: location.city,
      category: 'weather',
      title: `${label} Forecast: ${high}°/${low}° — ${weatherLabel(code)}`,
      body: `${weatherLabel(code)}. Rain chance ${rain}%. ${weatherSummary(code, rain)}`,
      image_url: weatherImage(code),
      created_at: `${day}T08:00:00.000Z`,
      widget: {
        kind: 'weather',
        temp: high,
        condition: weatherLabel(code),
        label,
        live: false,
      },
    }));
  });

  return cards;
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; prev: number; changePct: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const data = await fetchJson<any>(proxied, 10000);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number') return null;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  return { price, prev: Number(prev), changePct };
}

async function fetchIndexQuote(symbol: string, label: string): Promise<CityNews | null> {
  const quote = await fetchYahooQuote(symbol);
  if (!quote) return null;
  const sign = quote.changePct >= 0 ? '+' : '';
  const trend = quote.changePct >= 0 ? 'tezii' : 'giraawat';
  return makeCard({
    id: liveId('rates', symbol),
    city: 'National',
    category: 'rates',
    title: `${label} Live: ${quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${sign}${quote.changePct.toFixed(2)}%) — aaj ${trend}`,
    body: `Bazaar desk · pehle band ${quote.prev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Auto-refresh har 60s.`,
    image_url: resolveFeatureImage('rates', label, 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=60'),
    source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    featured: Math.abs(quote.changePct) >= 0.6,
    created_at: new Date().toISOString(),
    widget: {
      kind: 'index',
      label,
      value: quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      changePct: quote.changePct,
      live: true,
      cadence: 'daily',
    },
  });
}

async function fetchMetalCards(inrPerUsd: number | null): Promise<CityNews[]> {
  const [gold, silver] = await Promise.all([
    fetchYahooQuote('GC=F'),
    fetchYahooQuote('SI=F'),
  ]);
  const cards: CityNews[] = [];
  const fx = inrPerUsd && inrPerUsd > 0 ? inrPerUsd : 83;
  const now = new Date().toISOString();
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const amt = (price: number, pct: number) => {
    const delta = (price * pct) / 100;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(Math.round(delta)).toLocaleString('en-IN')}`;
  };

  if (gold) {
    const gold24k10g = (gold.price / 31.1035) * 10 * fx;
    const gold22k10g = gold24k10g * (22 / 24);
    const gold24k1g = gold24k10g / 10;
    const gold22k1g = gold22k10g / 10;
    const sign = gold.changePct >= 0 ? '+' : '';
    cards.push(makeCard({
      id: liveId('rates', 'gold-inr'),
      city: 'National',
      category: 'rates',
      title: `Gold Rates Today: 24K ${fmt(gold24k10g)}/10g · 22K ${fmt(gold22k10g)}/10g (${sign}${gold.changePct.toFixed(2)}%)`,
      body: `Daily metal desk — indicative Indian rates from international spot. 24K & 22K shown per 10g and per gram. Confirm with your jeweller for making charges.`,
      image_url: getTopicImageUrl('rates', 'Gold 24K bullion jewelry rates today'),
      featured: true,
      created_at: now,
      widget: {
        kind: 'gold',
        label: 'Gold · Daily',
        value: fmt(gold24k10g),
        changePct: gold.changePct,
        unit: '/10g 24K',
        live: true,
        cadence: 'daily',
        items: [
          { name: '24K / 10g', price: fmt(gold24k10g), changePct: gold.changePct },
          { name: '24K / 1g', price: fmt(gold24k1g), changePct: gold.changePct },
          { name: '22K / 10g', price: fmt(gold22k10g), changePct: gold.changePct },
          { name: '22K / 1g', price: fmt(gold22k1g), changePct: gold.changePct },
          { name: 'Day change', price: `${sign}${gold.changePct.toFixed(2)}% · ${amt(gold24k10g, gold.changePct)}`, changePct: gold.changePct },
        ],
      },
    }));
  }

  if (silver) {
    const perKg = (silver.price / 31.1035) * 1000 * fx;
    const per10g = perKg / 100;
    const sign = silver.changePct >= 0 ? '+' : '';
    cards.push(makeCard({
      id: liveId('rates', 'silver-inr'),
      city: 'National',
      category: 'rates',
      title: `Silver Rates Today: ${fmt(perKg)}/kg · ${fmt(per10g)}/10g (${sign}${silver.changePct.toFixed(2)}%)`,
      body: `Daily silver desk — indicative rates per kilogram and per 10 grams from international spot.`,
      image_url: getTopicImageUrl('rates', 'Silver bullion metal rates today'),
      created_at: now,
      featured: true,
      widget: {
        kind: 'silver',
        label: 'Silver · Daily',
        value: fmt(perKg),
        changePct: silver.changePct,
        unit: '/kg',
        live: true,
        cadence: 'daily',
        items: [
          { name: 'Silver / 1kg', price: fmt(perKg), changePct: silver.changePct },
          { name: 'Silver / 10g', price: fmt(per10g), changePct: silver.changePct },
          { name: 'Day change', price: `${sign}${silver.changePct.toFixed(2)}% · ${amt(perKg, silver.changePct)}`, changePct: silver.changePct },
        ],
      },
    }));
  }

  return cards;
}

/** City petrol/diesel desk — base pumps + crude day move */
async function fetchFuelCards(location: DailyLocation): Promise<CityNews[]> {
  const bases: Record<string, { petrol: number; diesel: number }> = {
    delhi: { petrol: 94.77, diesel: 87.67 },
    'new delhi': { petrol: 94.77, diesel: 87.67 },
    mumbai: { petrol: 104.81, diesel: 92.15 },
    bengaluru: { petrol: 102.99, diesel: 89.92 },
    bangalore: { petrol: 102.99, diesel: 89.92 },
    chennai: { petrol: 101.4, diesel: 93.4 },
    hyderabad: { petrol: 107.46, diesel: 95.72 },
    kolkata: { petrol: 105.41, diesel: 92.76 },
    pune: { petrol: 104.82, diesel: 91.98 },
    chandigarh: { petrol: 94.52, diesel: 82.45 },
    jaipur: { petrol: 104.72, diesel: 90.14 },
    lucknow: { petrol: 95.3, diesel: 88.1 },
    ahmedabad: { petrol: 94.7, diesel: 89.95 },
  };
  const key = location.city.trim().toLowerCase();
  const base = bases[key] || { petrol: 96.5, diesel: 89.2 };
  const crude = await fetchYahooQuote('CL=F');
  const adj = crude ? crude.changePct * 0.15 : 0;
  const petrol = Math.round((base.petrol * (1 + adj / 100)) * 100) / 100;
  const diesel = Math.round((base.diesel * (1 + adj / 100)) * 100) / 100;
  const change = crude?.changePct ?? 0;

  return [
    makeCard({
      id: liveId('rates', `fuel-${key}`),
      city: location.city,
      category: 'rates',
      title: `${location.city} Fuel: Petrol ₹${petrol.toFixed(2)} · Diesel ₹${diesel.toFixed(2)}/L`,
      body: `Local pump estimate adjusted for crude oil movement. Exact prices at your station may differ slightly.`,
      image_url: getTopicImageUrl('rates', 'Petrol diesel fuel pump nozzle gas station'),
      featured: true,
      created_at: new Date().toISOString(),
      widget: {
        kind: 'fuel',
        label: `${location.city} Fuel`,
        changePct: change,
        live: true,
        cadence: 'daily',
        items: [
          { name: 'Petrol / L', price: `₹${petrol.toFixed(2)}`, changePct: change },
          { name: 'Diesel / L', price: `₹${diesel.toFixed(2)}`, changePct: change },
        ],
      },
    }),
  ];
}

const TOP_VEGETABLES: Array<{ name: string; baseMin: number; baseMax: number; unit?: string }> = [
  { name: 'Potato', baseMin: 20, baseMax: 30 },
  { name: 'Tomato', baseMin: 30, baseMax: 45 },
  { name: 'Onion', baseMin: 25, baseMax: 38 },
  { name: 'Cauliflower', baseMin: 28, baseMax: 40 },
  { name: 'Okra', baseMin: 35, baseMax: 55 },
  { name: 'Peas', baseMin: 40, baseMax: 70 },
  { name: 'Cucumber', baseMin: 20, baseMax: 35 },
  { name: 'Brinjal', baseMin: 25, baseMax: 40 },
  { name: 'Capsicum', baseMin: 40, baseMax: 70 },
  { name: 'Spinach', baseMin: 15, baseMax: 28 },
];

const TOP_FRUITS: Array<{ name: string; baseMin: number; baseMax: number; unit?: string }> = [
  { name: 'Apple', baseMin: 120, baseMax: 180 },
  { name: 'Banana', baseMin: 40, baseMax: 60, unit: '/dozen' },
  { name: 'Guava', baseMin: 50, baseMax: 80 },
  { name: 'Pomegranate', baseMin: 140, baseMax: 220 },
  { name: 'Orange', baseMin: 60, baseMax: 100 },
  { name: 'Papaya', baseMin: 30, baseMax: 50 },
  { name: 'Sweet lime', baseMin: 50, baseMax: 80 },
  { name: 'Muskmelon', baseMin: 30, baseMax: 55 },
  { name: 'Mango', baseMin: 80, baseMax: 150 },
  { name: 'Grapes', baseMin: 70, baseMax: 120 },
];

function weeklyRangePrice(baseMin: number, baseMax: number, salt: number, unit = '/kg') {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const drift = ((week + salt) % 7) - 3;
  const min = Math.max(8, baseMin + drift);
  const max = Math.max(min + 5, baseMax + drift);
  return `₹${min}–₹${max}${unit}`;
}

function matchLivePrice(
  rows: Array<{ name: string; price: string }>,
  target: string,
): string | null {
  const t = target.toLowerCase();
  const hit = rows.find(r => {
    const n = r.name.toLowerCase();
    return n.includes(t) || t.includes(n) || commodityEnglish(r.name).toLowerCase() === t;
  });
  return hit?.price || null;
}

async function loadMandiRows(location: DailyLocation): Promise<Array<{ name: string; price: string }>> {
  const govKey = (process.env.EXPO_PUBLIC_DATA_GOV_IN_KEY || '').trim();
  if (govKey) {
    const gov = await fetchJson<{ records?: Array<{ commodity?: string; modal_price?: string }> }>(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-9ccd-e8c9c98fd8d3?api-key=${govKey}&format=json&limit=60&filters[district]=${encodeURIComponent(location.city)}`,
    );
    if (gov?.records?.length) {
      return gov.records.map(row => ({
        name: commodityEnglish(row.commodity || 'Item'),
        price: `₹${row.modal_price}/qtl`,
      }));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const slug = marketSlug(location.city);
  const veg = await fetchJson<{ data?: Array<{ commodity_name?: string; price?: string; min_price?: string; max_price?: string }> }>(
    `https://vegetablemarketprice.com/api/dataapi/market/${slug}/daypricereport?date=${today}`,
  );
  return (veg?.data ?? []).map(row => ({
    name: commodityEnglish(row.commodity_name || 'Item'),
    price: `₹${row.min_price || row.price}–${row.max_price || row.price}/kg`,
  }));
}

async function fetchMandiCards(location: DailyLocation): Promise<CityNews[]> {
  const weekStamp = new Date().toISOString();
  const liveRows = await loadMandiRows(location);

  const vegItems = TOP_VEGETABLES.map((row, i) => ({
    name: row.name,
    price: matchLivePrice(liveRows, row.name)
      || weeklyRangePrice(row.baseMin, row.baseMax, i, row.unit || '/kg'),
  }));

  const fruitItems = TOP_FRUITS.map((row, i) => ({
    name: row.name,
    price: matchLivePrice(liveRows, row.name)
      || weeklyRangePrice(row.baseMin, row.baseMax, i + 20, row.unit || '/kg'),
  }));

  return [
    makeCard({
      id: liveId('rates', `weekly-veg-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Top 10 Vegetables: This week’s ${location.city} market rates`,
      body: `Weekly vegetable board for ${location.city}. Ranges are approximate and may vary by local mandi and retail.`,
      image_url: getTopicImageUrl('rates', 'vegetables market produce India'),
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Top 10 Vegetables`,
        items: vegItems,
        live: liveRows.length > 0,
        cadence: 'weekly',
      },
    }),
    makeCard({
      id: liveId('rates', `weekly-fruit-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Top 10 Fruits: Apple, Banana, Pomegranate — ${location.city} weekly rates`,
      body: `Weekly fruit board for ${location.city}. Fresh rates for this week; local mandi and retail prices may differ.`,
      image_url: getTopicImageUrl('rates', 'fresh fruits market India'),
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Top 10 Fruits`,
        items: fruitItems,
        live: liveRows.length > 0,
        cadence: 'weekly',
      },
    }),
  ];
}

async function fetchRatesCards(location: DailyLocation): Promise<CityNews[]> {
  const fx = await fetchJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(
    'https://open.er-api.com/v6/latest/USD',
  );
  const inr = fx?.rates?.INR;
  const cards: CityNews[] = [];
  const now = new Date().toISOString();

  if (inr) {
    cards.push(makeCard({
      id: liveId('rates', 'usd-inr'),
      city: 'National',
      category: 'rates',
      title: `Dollar vs Rupee: USD/INR ab ${inr.toFixed(2)} pe`,
      body: `Live currency desk · updated ${fx?.time_last_update_utc || 'just now'}.`,
      image_url: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=60',
      source_url: 'https://www.exchangerate-api.com',
      featured: true,
      created_at: now,
      widget: {
        kind: 'fx',
        label: 'USD / INR',
        value: inr.toFixed(2),
        changePct: null,
        live: true,
        cadence: 'daily',
      },
    }));
  }

  const [metals, fuel, nifty, sensex, mandi] = await Promise.all([
    fetchMetalCards(inr ?? null),
    fetchFuelCards(location),
    fetchIndexQuote('^NSEI', 'NIFTY 50'),
    fetchIndexQuote('^BSESN', 'SENSEX'),
    fetchMandiCards(location),
  ]);
  cards.push(...metals, ...fuel);
  if (nifty) cards.push(nifty);
  if (sensex) cards.push(sensex);
  cards.push(...mandi);
  return cards;
}

/** Convert Sparks (reels) into tall Explore tiles */
export function sparksToDailyItems(reels: Reel[], city: string): CityNews[] {
  return reels.slice(0, 12).map(reel => makeCard({
    id: `spark-${reel.id}`,
    city,
    category: 'general',
    title: reel.caption?.trim()
      ? `Spark: ${reel.caption.trim()}`
      : `${reel.shop_name || 'Local shop'} ka naya Spark`,
    body: reel.shop_name ? `${reel.shop_name} ka short video · Sparks se seedha Daily pe.` : 'Local Spark · short video news vibe.',
    image_url: reel.media_url || resolveFeatureImage('general', reel.id, null, reel.caption || reel.shop_name || 'spark'),
    media_type: 'video',
    featured: true,
    created_at: reel.created_at,
    total_likes: reel.total_likes,
    total_comments: reel.total_comments,
  }));
}

export async function fetchDailyPublicFeed(location: DailyLocation): Promise<CityNews[]> {
  const [localNews, nationalNews, alerts, events, weather, rates] = await Promise.all([
    fetchNewsCategory(location, 'general', `${location.city} India news`),
    fetchNewsCategory(location, 'general', 'India national headlines', true),
    fetchNewsCategory(location, 'alerts', `${location.city} (alert OR warning OR emergency OR flood OR rain OR strike)`),
    fetchNewsCategory(location, 'event', `${location.city} (festival OR event OR concert OR exhibition OR mela)`),
    fetchWeatherCards(location),
    fetchRatesCards(location),
  ]);

  const merged = [...weather, ...rates, ...alerts, ...events, ...localNews, ...nationalNews];
  const seen = new Set<string>();
  const unique = merged.filter(item => {
    const key = item.title.toLowerCase();
    if (seen.has(key) || seen.has(item.id)) return false;
    seen.add(key);
    seen.add(item.id);
    return true;
  });

  return sortDailyByNewest(unique);
}

function storageKey(userId: string) {
  return `daily-interactions:${userId}`;
}

async function readInteractions(userId: string): Promise<InteractionStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return { likes: {}, likeCounts: {}, comments: {} };
    return JSON.parse(raw) as InteractionStore;
  } catch {
    return { likes: {}, likeCounts: {}, comments: {} };
  }
}

async function writeInteractions(userId: string, store: InteractionStore) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(store));
}

export async function applyDailyInteractions(items: CityNews[], userId?: string): Promise<CityNews[]> {
  if (!userId) return items;
  const store = await readInteractions(userId);
  return items.map(item => ({
    ...item,
    is_liked: store.likes[item.id] ?? item.is_liked ?? false,
    total_likes: store.likeCounts[item.id] ?? item.total_likes ?? 0,
    total_comments: store.comments[item.id]?.length ?? item.total_comments ?? 0,
  }));
}

export async function toggleLiveDailyLike(userId: string, item: CityNews) {
  const store = await readInteractions(userId);
  const currentlyLiked = store.likes[item.id] ?? !!item.is_liked;
  const liked = !currentlyLiked;
  store.likes[item.id] = liked;
  store.likeCounts[item.id] = Math.max(0, (store.likeCounts[item.id] ?? item.total_likes ?? 0) + (liked ? 1 : -1));
  await writeInteractions(userId, store);
  return { liked, total_likes: store.likeCounts[item.id] };
}

export async function getLiveDailyComments(userId: string, newsId: string): Promise<CityNewsComment[]> {
  const store = await readInteractions(userId);
  return store.comments[newsId] ?? [];
}

export async function addLiveDailyComment(userId: string, newsId: string, text: string, profile?: Profile | null): Promise<CityNewsComment> {
  const store = await readInteractions(userId);
  const comment: CityNewsComment = {
    id: `live-comment-${Date.now()}`,
    news_id: newsId,
    user_id: userId,
    text: text.trim(),
    created_at: new Date().toISOString(),
    user: profile ? { ...profile } : undefined,
  };
  store.comments[newsId] = [...(store.comments[newsId] ?? []), comment];
  await writeInteractions(userId, store);
  return comment;
}
