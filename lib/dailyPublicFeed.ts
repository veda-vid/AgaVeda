// lib/dailyPublicFeed.ts — Live location + English Daily Explore public feed

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { matchCity, POPULAR_CITIES } from '../constants/cities';
import { withTimeout } from './withTimeout';
import { softBoot } from './bootGuards';
import type { CityNews, CityNewsCategory, CityNewsComment, DailyWidgetMeta, Profile, Reel } from '../types';

const FETCH_MS = 8000;

export type DailyRegion = 'local' | 'national' | 'international';

export type DailyLocation = {
  city: string;
  /** Finer GPS locality (e.g. neighbourhood / range) when reverse-geocoded. */
  area?: string;
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
  traffic: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=85',
  ],
  wheat: [
    'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=85',
  ],
  rice: [
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1536304997881-eca63e8e4b36?auto=format&fit=crop&w=1200&q=85',
  ],
  millets: [
    'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=1200&q=85',
  ],
  accident: [
    'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=85',
  ],
  international: [
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=85',
  ],
  world: [
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=85',
  ],
  news: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?auto=format&fit=crop&w=1200&q=85',
  ],
};

function pickPoolPhoto(poolKey: string, seed: string, variant = 0) {
  const unsplash = TOPIC_PHOTO_POOLS[poolKey] || TOPIC_PHOTO_POOLS.news;
  const pexels = PEXELS_PHOTO_POOLS[poolKey];
  const hash = (seed || poolKey).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = Math.abs(hash + variant);
  if (pexels?.length && variant % 2 === 1) {
    return pexels[idx % pexels.length];
  }
  return unsplash[idx % unsplash.length];
}

/** Curated Pexels HD pools — alternated with Unsplash for variety */
const PEXELS_PHOTO_POOLS: Record<string, string[]> = {
  traffic: [
    'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/2081124/pexels-photo-2081124.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
  gold: [
    'https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
  wheat: [
    'https://images.pexels.com/photos/265005/pexels-photo-265005.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
  tech: [
    'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
  international: [
    'https://images.pexels.com/photos/3769138/pexels-photo-3769138.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
  sports: [
    'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ],
};

/** Primary entity keys extracted from headline + body for context-aware thumbnails */
export type TopicEntity =
  | 'gold' | 'silver' | 'fuel' | 'wheat' | 'rice' | 'millets' | 'mandi'
  | 'weather_storm' | 'weather_rain' | 'weather_clear' | 'weather_cloud'
  | 'sports' | 'tech' | 'events' | 'finance' | 'alerts' | 'accident' | 'traffic'
  | 'international' | 'news';

const ENTITY_PATTERNS: Array<{ entity: TopicEntity; re: RegExp }> = [
  { entity: 'gold', re: /\b(gold|sona|24k|22k|18k|bullion|jewellery|jewelry)\b/i },
  { entity: 'silver', re: /\b(silver|chandi)\b/i },
  { entity: 'fuel', re: /\b(petrol|diesel|fuel|pump|gas\s*station|crude)\b/i },
  { entity: 'wheat', re: /\b(wheat|gehu|gehun)\b/i },
  { entity: 'rice', re: /\b(rice|basmati|parmal|chawal)\b/i },
  { entity: 'millets', re: /\b(millet|bajra|ragi|jowar|shree\s*anna|pearl\s*millet|finger\s*millet|sorghum)\b/i },
  { entity: 'mandi', re: /\b(mandi|sabzi|vegetable|fruit|aloo|tamatar|pyaz|produce)\b/i },
  { entity: 'accident', re: /\b(accident|crash|collision|pile-?up|road\s*mishap)\b/i },
  { entity: 'traffic', re: /\b(traffic|jam|congestion|gridlock|road\s*block|blockade)\b/i },
  { entity: 'weather_storm', re: /\b(thunder|storm|aandhi|lightning|cyclone)\b/i },
  { entity: 'weather_rain', re: /\b(rain|baarish|shower|precipitation|flood)\b/i },
  { entity: 'weather_clear', re: /\b(clear|sunny|blue\s*sky)\b/i },
  { entity: 'sports', re: /\b(sport|cricket|football|hockey|match|ipl|world\s*cup|tennis)\b/i },
  { entity: 'tech', re: /\b(tech|ai\b|startup|software|cyber|gadget|smartphone|silicon)\b/i },
  { entity: 'events', re: /\b(event|festival|mela|concert|exhibition|celebration)\b/i },
  { entity: 'finance', re: /\b(usd|dollar|nifty|sensex|rupee|stock|finance|currency|market\s*index)\b/i },
  { entity: 'alerts', re: /\b(alert|emergency|warning|strike|evacuation)\b/i },
  { entity: 'international', re: /\b(global|world|international|foreign|overseas|europe|america|china|middle\s*east)\b/i },
];

export function extractTopicEntities(title: string, body = ''): TopicEntity[] {
  const text = `${title} ${body}`.toLowerCase();
  const hits: TopicEntity[] = [];
  for (const { entity, re } of ENTITY_PATTERNS) {
    if (re.test(text)) hits.push(entity);
  }
  if (/cloud|fog|kohra|overcast|weather|mausam|forecast/.test(text) && !hits.some(h => h.startsWith('weather_'))) {
    hits.push(/clear|sunny/.test(text) ? 'weather_clear' : 'weather_cloud');
  }
  return hits.length ? hits : ['news'];
}

export function isRateWidgetVisual(item: Pick<CityNews, 'widget' | 'category'>) {
  const kind = item.widget?.kind;
  return item.category === 'rates' && !!kind && ['gold', 'silver', 'fuel', 'mandi', 'fx', 'index'].includes(kind);
}

function detectTopicKey(category: string, title: string, body = ''): string {
  const entities = extractTopicEntities(title, body);
  if (entities[0] !== 'news') return entities[0];
  const t = `${category} ${title} ${body}`.toLowerCase();
  if (category === 'weather') return /clear|sunny/.test(t) ? 'weather_clear' : 'weather_cloud';
  if (category === 'alerts') return 'alerts';
  if (category === 'event') return 'events';
  if (category === 'rates') return /silver|chandi/.test(t) ? 'silver' : 'gold';
  return 'news';
}

/**
 * Context-aware HD thumbnail — entity extraction from title + optional body.
 * Third argument may be body text or variant index for backward compatibility.
 */
export function getTopicImageUrl(
  category: string,
  title: string,
  bodyOrVariant?: string | number,
  variant = 0,
): string {
  let body = '';
  let v = variant;
  if (typeof bodyOrVariant === 'number') {
    v = bodyOrVariant;
  } else if (typeof bodyOrVariant === 'string') {
    body = bodyOrVariant;
  }
  const key = detectTopicKey(category, title, body);
  return pickPoolPhoto(key, `${category}:${title}:${body}`, v);
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

function isLowResolutionImage(url: string) {
  if (/thumb|thumbnail|small|icon|avatar|w=\d{1,2}\b|h=\d{1,2}\b|width=\d{1,2}\b|height=\d{1,2}\b/i.test(url)) return true;
  const dim = url.match(/[?&](?:w|width)=(\d+)/i);
  if (dim && Number(dim[1]) < 400) return true;
  return false;
}

function isUsableFeatureImage(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/placehold|picsum\.photos|source\.unsplash|via\.placeholder|dummyimage/i.test(url)) return false;
  if (isLowResolutionImage(url)) return false;
  return true;
}

export function resolveFeatureImage(
  category: CityNewsCategory,
  seed: string,
  fallback?: string | null,
  title?: string,
  body?: string,
) {
  if (isUsableFeatureImage(fallback)) return fallback as string;
  return getTopicImageUrl(category, title || seed, body || seed, 0);
}

export function nextFeatureImage(
  category: CityNewsCategory,
  title: string,
  attempt: number,
  body?: string,
) {
  return getTopicImageUrl(category, title, body, attempt);
}

/** Resolve hero/thumbnail for a news card — HD entity match with fallback chain */
export function heroImageFor(item: Pick<CityNews, 'category' | 'title' | 'body' | 'image_url'>, attempt = 0) {
  if (attempt === 0 && isUsableFeatureImage(item.image_url)) {
    return item.image_url as string;
  }
  return getTopicImageUrl(item.category, item.title, item.body, attempt);
}

export function isHeroImageUsable(url?: string | null) {
  return isUsableFeatureImage(url);
}

function newsImage(
  seed: string,
  fallback?: string | null,
  category: CityNewsCategory = 'general',
  title?: string,
  body?: string,
) {
  return resolveFeatureImage(category, seed, fallback, title || seed, body);
}

/** Clean English headline for InShorts */
export function englishHeadline(title: string) {
  return title
    .replace(/^(National Update|.*? News|.*? Alert|.*? Events|.*? Weather|Gold Rates Today|Silver Rates Today|Dollar vs Rupee|Top 10 Vegetables|Top 10 Fruits|Spark|Moment)\s*:\s*/i, '')
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

/** Compact emoji for Discover-style weather pulse cards. */
export function weatherEmoji(code?: number | null) {
  const c = code ?? 0;
  if (c === 0) return '☀️';
  if (c <= 3) return '⛅';
  if (c <= 48) return '🌫️';
  if (c <= 67) return '🌧️';
  if (c <= 77) return '❄️';
  if (c <= 82) return '🌦️';
  return '⛈️';
}

export type WeatherPulse = {
  temp: number;
  rainPct: number | null;
  aqi: number | null;
  weatherCode: number;
  areaName: string;
  condition: string;
  /** Tomorrow's sunrise local time, e.g. "6:04 AM" */
  sunriseTomorrow?: string | null;
};

function formatSunriseLocal(isoLocal: string | undefined | null): string | null {
  if (!isoLocal) return null;
  // open-meteo: "2026-09-12T06:04"
  const m = isoLocal.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

/** Lightweight weather snapshot for the Daily header slider (independent of the full feed). */
export async function fetchWeatherPulse(location: DailyLocation): Promise<WeatherPulse | null> {
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const areaName = (location.area || location.city || 'Your area').trim();
  const [data, air] = await Promise.all([
    fetchJson<{
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: {
        precipitation_probability_max?: number[];
        sunrise?: string[];
      };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + '&current=temperature_2m,weather_code'
      + '&daily=precipitation_probability_max,sunrise&timezone=auto&forecast_days=2',
      7000,
    ),
    fetchJson<{
      current?: { european_aqi?: number; us_aqi?: number };
    }>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,us_aqi`,
      7000,
    ),
  ]);

  if (data?.current?.temperature_2m == null && data?.current?.weather_code == null) {
    return null;
  }

  const weatherCode = data?.current?.weather_code ?? 2;
  const temp = Math.round(data?.current?.temperature_2m ?? 28);
  const rainRaw = data?.daily?.precipitation_probability_max?.[0];
  const rainPct = typeof rainRaw === 'number' && Number.isFinite(rainRaw) ? Math.round(rainRaw) : null;
  const aqiRaw = air?.current?.us_aqi ?? air?.current?.european_aqi;
  const aqi = typeof aqiRaw === 'number' && Number.isFinite(aqiRaw) ? Math.round(aqiRaw) : null;
  const sunriseTomorrow = formatSunriseLocal(data?.daily?.sunrise?.[1] ?? data?.daily?.sunrise?.[0]);

  return {
    temp,
    rainPct,
    aqi,
    weatherCode,
    areaName,
    condition: weatherLabel(weatherCode),
    sunriseTomorrow,
  };
}

export function fallbackWeatherPulse(location: DailyLocation): WeatherPulse {
  return {
    temp: 28,
    rainPct: null,
    aqi: null,
    weatherCode: 2,
    areaName: (location.area || location.city || 'Your area').trim(),
    condition: 'Partly cloudy',
    sunriseTomorrow: null,
  };
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

function englishNewsTitle(title: string, city: string, scope: DailyRegion, category: CityNewsCategory) {
  const clean = title.replace(/ - .+$/, '').trim();
  if (category === 'alerts') return `${city} Alert: ${clean}`;
  if (category === 'event') return `${city} Events: ${clean}`;
  if (scope === 'international') return `World Update: ${clean}`;
  if (scope === 'national') return `National Update: ${clean}`;
  return `${city} News: ${clean}`;
}

function englishNewsBody(description: string, city: string, scope: DailyRegion) {
  const base = summarize(description || '');
  if (!base) {
    if (scope === 'international') return 'Latest global headlines — open the full story for details.';
    if (scope === 'national') return 'Latest national headlines — open the full story for details.';
    return `Local update from ${city} — open the full story for details.`;
  }
  if (scope === 'international') return `${base} · International desk.`;
  if (scope === 'national') return `${base} · National desk.`;
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

const TITLE_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on',
  'or', 'that', 'the', 'their', 'there', 'they', 'this', 'to', 'was', 'were', 'will', 'with',
  'news', 'update', 'updates', 'says', 'said', 'new', 'latest', 'report', 'reports',
]);

function normalizeTitleTokens(title: string): Set<string> {
  const clean = englishHeadline(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !TITLE_STOPWORDS.has(word));
  return new Set(clean);
}

function tokenJaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Fuzzy headline dedupe — drops items with >75% token-set similarity. */
export function dedupeDailyItems(items: CityNews[]): CityNews[] {
  const kept: CityNews[] = [];
  const tokenSets: Set<string>[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    const tokens = normalizeTitleTokens(item.title);
    const duplicate = tokenSets.some(existing => tokenJaccardSimilarity(tokens, existing) > 0.75);
    if (duplicate) continue;
    kept.push(item);
    tokenSets.push(tokens);
    seenIds.add(item.id);
  }
  return kept;
}

function formatUpdatedBadge(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Updated just now';
  return `Updated ${d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function movementTag(changePct: number) {
  const sign = changePct >= 0 ? '+' : '';
  const emoji = changePct >= 0 ? '🟢' : '🔴';
  return `${emoji} ${sign}${changePct.toFixed(1)}%`;
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
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2500,
          maximumAge: 300000,
          enableHighAccuracy: false,
        });
      });
      return reverseGeocode(pos.coords.latitude, pos.coords.longitude, 'gps');
    }
    const { status } = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      2500,
      'location.permission',
    );
    if (status !== 'granted') return null;
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      2500,
      'location.gps',
    );
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
  const locality = (hit?.name || '').trim();
  const cityName = (hit?.city || '').trim();
  const rawName = cityName || locality;
  const matched = matchCity(rawName, lat, lng);
  const city = cityName || matched?.name || locality || 'Your city';
  // Prefer the precise place name from GPS reverse-geocode for weather cards.
  const area = locality && locality.toLowerCase() !== city.toLowerCase()
    ? locality
    : (locality || city);
  return {
    city,
    area,
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
    area: data.city,
    state: data.region,
    country: data.country,
    lat: matched?.lat ?? data.latitude,
    lng: matched?.lng ?? data.longitude,
    source: 'ip',
  };
}

export async function detectDailyLocation(profile?: Profile | null): Promise<DailyLocation> {
  const fallbackCity = matchCity(profile?.city || '', profile?.lat, profile?.lng)
    || POPULAR_CITIES.find(city => city.name.toLowerCase() === (profile?.city || '').toLowerCase())
    || POPULAR_CITIES[1];
  const profileFallback: DailyLocation = {
    city: profile?.city || fallbackCity.name,
    lat: profile?.lat ?? fallbackCity.lat,
    lng: profile?.lng ?? fallbackCity.lng,
    source: 'profile',
  };

  try {
    const gps = await softBoot(detectByGps(), null, 'daily.gps');
    if (gps) return gps;

    const ip = await softBoot(detectByIp(), null, 'daily.ip');
    if (ip) return ip;
  } catch (error) {
    console.warn('[daily] Location detection failed — using profile / default city.', error);
  }

  return profileFallback;
}

async function fetchNewsCategory(
  location: DailyLocation,
  category: CityNewsCategory,
  query: string,
  scope: DailyRegion = 'local',
): Promise<CityNews[]> {
  const gnewsKey = (process.env.EXPO_PUBLIC_GNEWS_KEY || '').trim();
  const newsApiKey = (process.env.EXPO_PUBLIC_NEWSAPI_KEY || '').trim();
  const cards: CityNews[] = [];
  const desk = scope === 'national' ? 'National' : scope === 'international' ? 'International' : location.city;

  if (gnewsKey) {
    const gnews = await fetchJson<{ articles?: Array<{ title?: string; description?: string; url?: string; image?: string; publishedAt?: string }> }>(
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=8&apikey=${gnewsKey}`,
    );
    for (const article of gnews?.articles ?? []) {
      if (!article.title) continue;
      const body = article.description || article.title;
      cards.push(makeCard({
        id: liveId(category, article.url || article.title),
        city: desk,
        category,
        title: englishNewsTitle(article.title, location.city, scope, category),
        body: englishNewsBody(body, location.city, scope),
        image_url: newsImage(article.title, article.image, category, article.title, body),
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
      const body = article.description || article.title;
      cards.push(makeCard({
        id: liveId(category, article.url || article.title),
        city: desk,
        category,
        title: englishNewsTitle(article.title, location.city, scope, category),
        body: englishNewsBody(body, location.city, scope),
        image_url: newsImage(article.title, article.urlToImage, category, article.title, body),
        source_url: article.url || null,
        created_at: article.publishedAt,
        featured: category === 'alerts',
      }));
    }
  }

  if (cards.length) return cards;

  const rssQuery = scope === 'international'
    ? 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en'
    : scope === 'national'
      ? 'https://news.google.com/rss/headlines/section/geo/India?hl=en-IN&gl=IN&ceid=IN:en'
      : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const items = await loadRss(rssQuery);
  return items.slice(0, 8).map((item, index) => {
    const body = item.description || item.title;
    return makeCard({
      id: liveId(category, item.link || item.title),
      city: desk,
      category,
      title: englishNewsTitle(item.title, location.city, scope, category),
      body: englishNewsBody(body, location.city, scope),
      image_url: newsImage(item.title, item.image, category, item.title, body),
      source_url: item.link || null,
      created_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
      featured: category === 'alerts' || (category === 'event' && index === 0),
    });
  });
}

async function fetchWeatherCards(location: DailyLocation): Promise<CityNews[]> {
  const [data, air] = await Promise.all([
    fetchJson<{
      current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string };
      daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
    }>(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`),
    fetchJson<{
      current?: { european_aqi?: number; us_aqi?: number };
    }>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lng}&current=european_aqi,us_aqi`),
  ]);

  if (!data?.current) return [];

  const currentCode = data.current.weather_code ?? 0;
  const temp = Math.round(data.current.temperature_2m ?? 0);
  const humidity = Math.round(data.current.relative_humidity_2m ?? 0);
  const wind = Math.round(data.current.wind_speed_10m ?? 0);
  const rainTonight = data.daily?.precipitation_probability_max?.[0] ?? 0;
  const aqiRaw = air?.current?.us_aqi ?? air?.current?.european_aqi;
  const aqi = typeof aqiRaw === 'number' && Number.isFinite(aqiRaw) ? Math.round(aqiRaw) : undefined;
  const condition = weatherLabel(currentCode);
  const outlook = weatherSummary(currentCode, rainTonight);
  const areaLabel = location.area || location.city;

  const cards: CityNews[] = [
    makeCard({
      id: liveId('weather', `now-${location.city}`),
      city: location.city,
      category: 'weather',
      title: `${areaLabel} Weather: ${condition}`,
      body: `Now ${temp}°C · ${condition}. Humidity ${humidity}%, wind ${wind} km/h. Rain chance today ~${rainTonight}%.${aqi != null ? ` AQI ${aqi}.` : ''} ${outlook}`,
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
        rainChance: rainTonight,
        aqi,
        weatherCode: currentCode,
        live: true,
        label: areaLabel,
        updatedAt: new Date().toISOString(),
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
        weatherCode: code,
        rainChance: rain,
        label,
        live: false,
      },
    }));
  });

  return cards;
}

async function fetchYahooQuote(symbol: string): Promise<{
  price: number;
  prev: number;
  changePct: number;
  trend7d: number | null;
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const data = await fetchJson<any>(proxied, 10000);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number') return null;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  const closes = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as Array<number | null> | undefined)
    ?.filter((c): c is number => typeof c === 'number') ?? [];
  const trend7d = closes.length >= 2
    ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
    : null;
  return { price, prev: Number(prev), changePct, trend7d };
}

async function fetchIndexQuote(symbol: string, label: string): Promise<CityNews | null> {
  const quote = await fetchYahooQuote(symbol);
  if (!quote) return null;
  const sign = quote.changePct >= 0 ? '+' : '';
  const now = new Date().toISOString();
  return makeCard({
    id: liveId('rates', symbol),
    city: 'National',
    category: 'rates',
    title: `${label} Live: ${quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${sign}${quote.changePct.toFixed(2)}%)`,
    body: `Market desk · previous close ${quote.prev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Refreshes every 60 seconds.`,
    image_url: null,
    source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    featured: Math.abs(quote.changePct) >= 0.6,
    created_at: now,
    widget: {
      kind: 'index',
      label,
      value: quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      changePct: quote.changePct,
      live: true,
      cadence: 'daily',
      updatedAt: now,
      items: [
        {
          name: label,
          price: quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
          changePct: quote.changePct,
          baseline: quote.prev.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
          trend7d: quote.trend7d,
        },
      ],
    },
  });
}

async function fetchMetalCards(
  inrPerUsd: number | null,
  cityLabel = 'National',
  idSuffix = 'national',
): Promise<CityNews[]> {
  const { getNationalBullionDesk } = await import('./nationalMarketRates');
  const desk = await getNationalBullionDesk();
  const cards: CityNews[] = [];
  if (!desk) return cards;

  const fx = desk.usdInr || (inrPerUsd && inrPerUsd > 0 ? inrPerUsd : null);
  if (!fx && !desk.gold10g24k) return cards;

  const now = desk.updatedAt || new Date().toISOString();
  const goldChange = desk.goldChangePct ?? 0;
  const silverChange = desk.silverChangePct ?? 0;
  const gold24k10g = desk.gold10g24k;
  const gold22k10g = desk.gold10g22k ?? gold24k10g * (22 / 24);
  const gold18k10g = desk.gold10g18k ?? gold24k10g * (18 / 24);
  const gold24k1g = gold24k10g / 10;
  const gold22k1g = gold22k10g / 10;
  const gold18k1g = gold18k10g / 10;
  const prevFactor = goldChange ? 1 / (1 + goldChange / 100) : 1;
  const prev24k10g = gold24k10g * prevFactor;
  const perKg = desk.silverKg;
  const per100g = perKg / 10;
  const per10g = perKg / 100;
  const prevKg = perKg * (silverChange ? 1 / (1 + silverChange / 100) : 1);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const fmtBaseline = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const amt = (price: number, pct: number) => {
    const delta = (price * pct) / 100;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(Math.round(delta)).toLocaleString('en-IN')}`;
  };

  const goldTag = movementTag(goldChange);
  cards.push(makeCard({
    id: liveId('rates', `gold-inr-${idSuffix}`),
    city: cityLabel,
    category: 'rates',
    title: `Gold Rates Today: 24K ${fmt(gold24k10g)}/10g · 22K ${fmt(gold22k10g)}/10g · 18K ${fmt(gold18k10g)}/10g (${goldTag})`,
    body: `India retail bullion desk (${desk.source}) — updated daily. ${formatUpdatedBadge(now)}. Confirm with your local jeweller for making charges.`,
    image_url: null,
    featured: true,
    created_at: now,
    widget: {
      kind: 'gold',
      label: 'Gold · India Retail',
      value: fmt(gold24k10g),
      changePct: goldChange,
      unit: '/10g 24K',
      live: true,
      cadence: 'daily',
      updatedAt: now,
      items: [
        { name: '24K / 10g', price: fmt(gold24k10g), changePct: goldChange, baseline: fmtBaseline(prev24k10g) },
        { name: '24K / 1g', price: fmt(gold24k1g), changePct: goldChange, baseline: fmtBaseline(prev24k10g / 10) },
        { name: '22K / 10g', price: fmt(gold22k10g), changePct: goldChange, baseline: fmtBaseline(prev24k10g * (22 / 24)) },
        { name: '22K / 1g', price: fmt(gold22k1g), changePct: goldChange, baseline: fmtBaseline((prev24k10g / 10) * (22 / 24)) },
        { name: '18K / 10g', price: fmt(gold18k10g), changePct: goldChange, baseline: fmtBaseline(prev24k10g * (18 / 24)) },
        { name: '18K / 1g', price: fmt(gold18k1g), changePct: goldChange, baseline: fmtBaseline((prev24k10g / 10) * (18 / 24)) },
        { name: 'Day change', price: `${goldTag} · ${amt(gold24k10g, goldChange)}`, changePct: goldChange },
      ],
    },
  }));

  const silverTag = movementTag(silverChange);
  cards.push(makeCard({
    id: liveId('rates', `silver-inr-${idSuffix}`),
    city: cityLabel,
    category: 'rates',
    title: `Silver Rates Today: ${fmt(perKg)}/kg · ${fmt(per100g)}/100g (${silverTag})`,
    body: `India retail silver desk — updated daily with national bullion rates. ${formatUpdatedBadge(now)}.`,
    image_url: null,
    created_at: now,
    featured: true,
    widget: {
      kind: 'silver',
      label: 'Silver · India Retail',
      value: fmt(perKg),
      changePct: silverChange,
      unit: '/kg',
      live: true,
      cadence: 'daily',
      updatedAt: now,
      items: [
        { name: 'Silver / 1kg', price: fmt(perKg), changePct: silverChange, baseline: fmtBaseline(prevKg) },
        { name: 'Silver / 100g', price: fmt(per100g), changePct: silverChange, baseline: fmtBaseline(prevKg / 10) },
        { name: 'Silver / 10g', price: fmt(per10g), changePct: silverChange, baseline: fmtBaseline(prevKg / 100) },
        { name: 'Day change', price: `${silverTag} · ${amt(perKg, silverChange)}`, changePct: silverChange },
      ],
    },
  }));

  return cards;
}

/** City petrol / diesel / Speed — published daily desks (national oil-company city rates). */
async function fetchFuelCards(location: DailyLocation): Promise<CityNews[]> {
  const { getCityFuelDesk } = await import('./nationalMarketRates');
  const desk = await getCityFuelDesk(location.city);
  const key = location.city.trim().toLowerCase().replace(/\s+/g, '-');
  const change = desk.changePct ?? 0;
  const now = desk.updatedAt || new Date().toISOString();

  return [
    makeCard({
      id: liveId('rates', `fuel-${key}`),
      city: location.city,
      category: 'rates',
      title: `${location.city} Fuel: Petrol ₹${desk.petrol.toFixed(2)} · Diesel ₹${desk.diesel.toFixed(2)} · Speed ₹${desk.speed.toFixed(2)}/L`,
      body: `Daily city pump desk from national published rates (${desk.source}, ${desk.asOfDate}). Speed = regular petrol + ₹7.50 premium grade. Confirm at your local station.`,
      image_url: null,
      featured: true,
      created_at: now,
      widget: {
        kind: 'fuel',
        label: `${location.city} Fuel`,
        changePct: change,
        live: true,
        cadence: 'daily',
        updatedAt: now,
        items: [
          { name: 'Petrol / L', price: `₹${desk.petrol.toFixed(2)}`, changePct: change },
          { name: 'Diesel / L', price: `₹${desk.diesel.toFixed(2)}`, changePct: change },
          { name: 'Speed / L', price: `₹${desk.speed.toFixed(2)}`, changePct: change },
        ],
      },
    }),
  ];
}

async function fetchMandiCards(location: DailyLocation): Promise<CityNews[]> {
  const weekStamp = new Date().toISOString();
  const { loadLiveMandiRows, matchLiveMandiPrice, produceForSeason, SEASONAL_VEGETABLES, SEASONAL_FRUITS, currentMandiSeason, mandiSeasonLabel } = await import('./seasonalMandi');
  const liveRows = await loadLiveMandiRows(location);

  const vegItems = produceForSeason(SEASONAL_VEGETABLES, currentMandiSeason(), 10)
    .map((row) => {
      const price = matchLiveMandiPrice(liveRows, row.name);
      if (!price || /[–-]/.test(price)) return null;
      return { name: row.name, price, trend7d: 0 };
    })
    .filter((r): r is { name: string; price: string; trend7d: number } => !!r);

  const fruitItems = produceForSeason(SEASONAL_FRUITS, currentMandiSeason(), 10)
    .map((row) => {
      const price = matchLiveMandiPrice(liveRows, row.name);
      if (!price || /[–-]/.test(price)) return null;
      return {
        name: row.name.replace(/\s*\(late\)\s*/i, '').trim(),
        price,
        trend7d: 0,
      };
    })
    .filter((r): r is { name: string; price: string; trend7d: number } => !!r);

  // Fill from exact live desk when seasonal matches are thin.
  if (vegItems.length < 6) {
    for (const row of liveRows) {
      if (vegItems.length >= 12) break;
      if (fruitItems.some(f => f.name.toLowerCase() === row.name.toLowerCase())) continue;
      if (/wheat|rice|maize|bajra|ragi|jowar|mustard|moong/i.test(row.name)) continue;
      if (vegItems.some(v => v.name.toLowerCase() === row.name.toLowerCase())) continue;
      vegItems.push({ name: row.name, price: row.price, trend7d: 0 });
    }
  }

  return [
    makeCard({
      id: liveId('rates', `weekly-veg-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Seasonal Vegetables · ${mandiSeasonLabel(currentMandiSeason())}: ${location.city} market rates`,
      body: `Exact mandi bhaav for ${location.city} (${mandiSeasonLabel(currentMandiSeason())}). ${formatUpdatedBadge(weekStamp)}.`,
      image_url: null,
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Top Vegetables`,
        items: vegItems,
        live: liveRows.length > 0,
        cadence: 'daily',
        updatedAt: weekStamp,
      },
    }),
    makeCard({
      id: liveId('rates', `weekly-fruit-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Seasonal Fruits · ${mandiSeasonLabel(currentMandiSeason())}: ${location.city} rates`,
      body: `Exact fruit desk for ${location.city} (${mandiSeasonLabel(currentMandiSeason())}). ${formatUpdatedBadge(weekStamp)}.`,
      image_url: null,
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Top Fruits`,
        items: fruitItems,
        live: liveRows.length > 0,
        cadence: 'daily',
        updatedAt: weekStamp,
      },
    }),
  ];
}

async function fetchGrainsMilletsCards(location: DailyLocation): Promise<CityNews[]> {
  const weekStamp = new Date().toISOString();
  const { loadLiveMandiRows, matchLiveMandiPrice } = await import('./seasonalMandi');
  const liveRows = await loadLiveMandiRows(location);

  const grainNames = [
    'Wheat / Gehu',
    'Rice · Basmati',
    'Rice · Parmal',
    'Maize / Makka',
  ];
  const milletNames = [
    'Pearl Millet / Bajra',
    'Finger Millet / Ragi',
    'Sorghum / Jowar',
    'Foxtail Millet / Kangni',
    'Barnyard Millet / Sanwa',
  ];

  const grainItems = grainNames
    .map((name) => {
      const price = matchLiveMandiPrice(liveRows, name.split('/')[0].trim())
        || matchLiveMandiPrice(liveRows, name);
      if (!price || /[–-]/.test(price)) return null;
      return { name, price, changePct: 0 };
    })
    .filter((r): r is { name: string; price: string; changePct: number } => !!r);

  const milletItems = milletNames
    .map((name) => {
      const price = matchLiveMandiPrice(liveRows, name.split('/')[0].trim())
        || matchLiveMandiPrice(liveRows, name);
      if (!price || /[–-]/.test(price)) return null;
      return { name, price, changePct: 0 };
    })
    .filter((r): r is { name: string; price: string; changePct: number } => !!r);

  // Also include any exact live anaaj rows not already listed.
  for (const row of liveRows) {
    if (!/wheat|rice|maize|bajra|ragi|jowar|mustard|moong|millet/i.test(row.name)) continue;
    if (grainItems.some(g => g.name.toLowerCase().includes(row.name.toLowerCase().slice(0, 5)))) continue;
    if (milletItems.some(g => g.name.toLowerCase().includes(row.name.toLowerCase().slice(0, 5)))) continue;
    if (/bajra|ragi|jowar|millet/i.test(row.name)) milletItems.push({ name: row.name, price: row.price, changePct: 0 });
    else grainItems.push({ name: row.name, price: row.price, changePct: 0 });
  }

  return [
    makeCard({
      id: liveId('rates', `weekly-grains-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Grains Mandi Board: Wheat, Rice, Maize — ${location.city}`,
      body: `Exact staples board for ${location.city}. ${formatUpdatedBadge(weekStamp)}.`,
      image_url: null,
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Grains`,
        items: grainItems,
        live: grainItems.length > 0,
        cadence: 'daily',
        updatedAt: weekStamp,
      },
    }),
    makeCard({
      id: liveId('rates', `weekly-millets-${location.city}`),
      city: location.city,
      category: 'rates',
      title: `Shree Anna Millets: Bajra, Ragi, Jowar — ${location.city}`,
      body: `Exact millets mandi board for ${location.city}. ${formatUpdatedBadge(weekStamp)}.`,
      image_url: null,
      featured: true,
      created_at: weekStamp,
      widget: {
        kind: 'mandi',
        label: `${location.city} · Shree Anna`,
        items: milletItems,
        live: milletItems.length > 0,
        cadence: 'daily',
        updatedAt: weekStamp,
      },
    }),
  ];
}

async function fetchLocalRatesCards(location: DailyLocation): Promise<CityNews[]> {
  const fx = await fetchJson<{ rates?: Record<string, number> }>('https://open.er-api.com/v6/latest/USD');
  const inr = fx?.rates?.INR ?? null;
  const citySlug = location.city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'local';
  const [metals, fuel, mandi, grains] = await Promise.all([
    fetchMetalCards(inr, location.city, citySlug),
    fetchFuelCards(location),
    fetchMandiCards(location),
    fetchGrainsMilletsCards(location),
  ]);
  return [...metals, ...fuel, ...mandi, ...grains];
}

async function fetchFxCard(cityLabel: string): Promise<CityNews | null> {
  const fx = await fetchJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(
    'https://open.er-api.com/v6/latest/USD',
  );
  const inr = fx?.rates?.INR;
  if (!inr) return null;
  const now = new Date().toISOString();
  return makeCard({
    id: liveId('rates', `usd-inr-${cityLabel.toLowerCase()}`),
    city: cityLabel,
    category: 'rates',
    title: `USD/INR Spot: ${inr.toFixed(2)}`,
    body: `International FX desk · ${formatUpdatedBadge(fx?.time_last_update_utc || now)}.`,
    image_url: null,
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
      updatedAt: fx?.time_last_update_utc || now,
    },
  });
}

async function fetchNationalRatesCards(): Promise<CityNews[]> {
  const fx = await fetchJson<{ rates?: Record<string, number> }>('https://open.er-api.com/v6/latest/USD');
  const inr = fx?.rates?.INR;
  const [metals, nifty, sensex] = await Promise.all([
    fetchMetalCards(inr ?? null),
    fetchIndexQuote('^NSEI', 'NIFTY 50'),
    fetchIndexQuote('^BSESN', 'SENSEX'),
  ]);
  const cards: CityNews[] = [...metals];
  if (nifty) cards.push(nifty);
  if (sensex) cards.push(sensex);
  return cards;
}

async function fetchInternationalMarketCards(): Promise<CityNews[]> {
  const [fx, dow, nasdaq, sp500] = await Promise.all([
    fetchFxCard('International'),
    fetchIndexQuote('^DJI', 'DOW JONES'),
    fetchIndexQuote('^IXIC', 'NASDAQ'),
    fetchIndexQuote('^GSPC', 'S&P 500'),
  ]);
  return [fx, dow, nasdaq, sp500].filter((c): c is CityNews => !!c);
}

/** @deprecated Use fetchLocalRatesCards / fetchNationalRatesCards by region */
async function fetchRatesCards(location: DailyLocation): Promise<CityNews[]> {
  const [local, national] = await Promise.all([
    fetchLocalRatesCards(location),
    fetchNationalRatesCards(),
  ]);
  return [...national, ...local];
}

/** Convert Sparks (reels) into tall Explore tiles */
export function sparksToDailyItems(reels: Reel[], city: string): CityNews[] {
  return reels.slice(0, 12).map(reel => makeCard({
    id: `spark-${reel.id}`,
    city,
    category: 'general',
    title: reel.caption?.trim()
      ? `Moment: ${reel.caption.trim()}`
      : `New Moment from ${reel.shop_name || 'a local shop'}`,
    body: reel.shop_name
      ? `Short video from ${reel.shop_name} · featured on Daily from Moments.`
      : 'Local Moment · short-form video update.',
    image_url: reel.media_url || resolveFeatureImage('general', reel.id, null, reel.caption || reel.shop_name || 'spark'),
    media_type: 'video',
    featured: true,
    created_at: reel.created_at,
    total_likes: reel.total_likes,
    total_comments: reel.total_comments,
  }));
}

export async function fetchDailyPublicFeed(
  location: DailyLocation,
  region: DailyRegion = 'local',
): Promise<CityNews[]> {
  if (region === 'national') {
    const stateQuery = location.state
      ? `${location.state} India alert OR warning OR emergency`
      : 'India national emergency alert';
    const [nationalNews, alerts, events, rates] = await Promise.all([
      fetchNewsCategory(location, 'general', 'India national headlines economy politics', 'national'),
      fetchNewsCategory(location, 'alerts', stateQuery, 'national'),
      fetchNewsCategory(location, 'event', 'India national festival event celebration', 'national'),
      fetchNationalRatesCards(),
    ]);
    return sortDailyByNewest(dedupeDailyItems([...rates, ...alerts, ...events, ...nationalNews]));
  }

  if (region === 'international') {
    const [worldNews, techNews, markets] = await Promise.all([
      fetchNewsCategory(location, 'general', 'world international headlines global news', 'international'),
      fetchNewsCategory(location, 'general', 'technology AI startup global innovation', 'international'),
      fetchInternationalMarketCards(),
    ]);
    return sortDailyByNewest(dedupeDailyItems([...markets, ...techNews, ...worldNews]));
  }

  const stateAlert = location.state
    ? `${location.city} OR ${location.state} (alert OR warning OR emergency OR flood OR rain OR strike)`
    : `${location.city} (alert OR warning OR emergency OR flood OR rain OR strike)`;
  const [localNews, alerts, events, weather, rates] = await Promise.all([
    fetchNewsCategory(location, 'general', `${location.city} India news`),
    fetchNewsCategory(location, 'alerts', stateAlert),
    fetchNewsCategory(location, 'event', `${location.city} (festival OR event OR concert OR exhibition OR mela)`),
    fetchWeatherCards(location),
    fetchLocalRatesCards(location),
  ]);

  const merged = [...rates, ...weather, ...alerts, ...events, ...localNews];
  return sortDailyByNewest(dedupeDailyItems(merged));
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

/** Load comments for any Daily item (Supabase or live cache). */
export async function fetchDailyComments(newsId: string, userId?: string): Promise<CityNewsComment[]> {
  if (isLiveDailyItem(newsId)) {
    if (!userId) return [];
    return getLiveDailyComments(userId, newsId);
  }
  const { getCityNewsComments } = await import('./api');
  return getCityNewsComments(newsId);
}

/** Post a comment to Supabase or the live interaction cache. */
export async function postDailyComment(
  newsId: string,
  userId: string,
  text: string,
  profile?: Profile | null,
): Promise<CityNewsComment> {
  if (isLiveDailyItem(newsId)) {
    return addLiveDailyComment(userId, newsId, text, profile);
  }
  const { addCityNewsComment } = await import('./api');
  return addCityNewsComment(userId, newsId, text);
}
