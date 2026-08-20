// lib/dailyPublicFeed.ts — Live location, news, weather, and rates for the Daily page

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { matchCity, POPULAR_CITIES } from '../constants/cities';
import type { CityNews, CityNewsCategory, CityNewsComment, Profile } from '../types';

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
  return id.startsWith('live-');
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
    total_likes: 0,
    total_comments: 0,
    created_at: now,
    updated_at: now,
    is_liked: false,
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
    const image = (block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] || null;
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

function newsImage(seed: string, fallback?: string | null) {
  if (fallback && /^https?:\/\//i.test(fallback)) return fallback;
  return `https://picsum.photos/seed/${encodeURIComponent(seed.slice(0, 24) || 'news')}/800/1000`;
}

function weatherImage(code: number) {
  if (code >= 95) return 'https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=800&q=60';
  if (code >= 80) return 'https://images.unsplash.com/photo-1519692933481-1899b1ba3f5f?auto=format&fit=crop&w=800&q=60';
  if (code >= 61) return 'https://images.unsplash.com/photo-1527482797697-01785c6c3e7b?auto=format&fit=crop&w=800&q=60';
  if (code >= 45) return 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=800&q=60';
  return 'https://images.unsplash.com/photo-1501973801540-7e1ea1109e69?auto=format&fit=crop&w=800&q=60';
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
        title: article.title,
        body: summarize(article.description || article.title),
        image_url: newsImage(article.title, article.image),
        source_url: article.url || null,
        created_at: article.publishedAt,
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
        title: article.title,
        body: summarize(article.description || article.title),
        image_url: newsImage(article.title, article.urlToImage),
        source_url: article.url || null,
        created_at: article.publishedAt,
      }));
    }
  }

  if (cards.length) return cards;

  const rssQuery = national
    ? `https://news.google.com/rss/headlines/section/geo/India?hl=en-IN&gl=IN&ceid=IN:en`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const items = await loadRss(rssQuery);
  return items.slice(0, 8).map(item => makeCard({
    id: liveId(category, item.link || item.title),
    city: national ? 'National' : location.city,
    category,
    title: item.title.replace(/ - .+$/, ''),
    body: summarize(item.description || item.title),
    image_url: newsImage(item.title, item.image),
    source_url: item.link || null,
    created_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
  }));
}

async function fetchWeatherCards(location: DailyLocation): Promise<CityNews[]> {
  const data = await fetchJson<{
    current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string };
    daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  }>(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);

  if (!data?.current) return [];

  const currentCode = data.current.weather_code ?? 0;
  const cards: CityNews[] = [
    makeCard({
      id: liveId('weather', `now-${location.city}`),
      city: location.city,
      category: 'weather',
      title: `${Math.round(data.current.temperature_2m ?? 0)}° in ${location.city} · ${weatherLabel(currentCode)}`,
      body: `Humidity ${Math.round(data.current.relative_humidity_2m ?? 0)}%. Wind ${Math.round(data.current.wind_speed_10m ?? 0)} km/h. Live local forecast.`,
      image_url: weatherImage(currentCode),
      source_url: `https://open-meteo.com/en/docs`,
      created_at: data.current.time,
    }),
  ];

  const days = data.daily?.time ?? [];
  days.slice(0, 5).forEach((day, index) => {
    const code = data.daily?.weather_code?.[index] ?? 0;
    const high = Math.round(data.daily?.temperature_2m_max?.[index] ?? 0);
    const low = Math.round(data.daily?.temperature_2m_min?.[index] ?? 0);
    const rain = data.daily?.precipitation_probability_max?.[index] ?? 0;
    const label = new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    cards.push(makeCard({
      id: liveId('weather', `${location.city}-${day}`),
      city: location.city,
      category: 'weather',
      title: `${label}: ${high}° / ${low}° · ${weatherLabel(code)}`,
      body: `Rain chance ${rain}%. ${weatherLabel(code)} expected in ${location.city}.`,
      image_url: weatherImage(code),
      created_at: `${day}T08:00:00.000Z`,
    }));
  });

  return cards;
}

async function fetchIndexQuote(symbol: string, label: string, city: string): Promise<CityNews | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const data = await fetchJson<any>(proxied, 10000);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number') return null;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose;
  const change = prev ? price - prev : 0;
  const pct = prev ? (change / prev) * 100 : 0;
  const sign = change >= 0 ? '+' : '';
  return makeCard({
    id: liveId('rates', symbol),
    city: 'National',
    category: 'rates',
    title: `${label} ${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${sign}${pct.toFixed(2)}%)`,
    body: `Live ${label} index. Previous close ${Number(prev || price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`,
    image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=60',
    source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
  });
}

async function fetchMandiCards(location: DailyLocation): Promise<CityNews[]> {
  const govKey = (process.env.EXPO_PUBLIC_DATA_GOV_IN_KEY || '').trim();
  if (govKey) {
    const gov = await fetchJson<{ records?: Array<{ commodity?: string; modal_price?: string; market?: string; district?: string; arrival_date?: string }> }>(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-9ccd-e8c9c98fd8d3?api-key=${govKey}&format=json&limit=12&filters[district]=${encodeURIComponent(location.city)}`,
    );
    if (gov?.records?.length) {
      return gov.records.slice(0, 8).map(row => makeCard({
        id: liveId('rates', `${row.commodity}-${row.market}`),
        city: location.city,
        category: 'rates',
        title: `${row.commodity}: ₹${row.modal_price}/qtl`,
        body: `${row.market || location.city} mandi. District ${row.district || location.city}.`,
        image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=60',
        created_at: row.arrival_date ? new Date(row.arrival_date).toISOString() : undefined,
      }));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const slug = marketSlug(location.city);
  const veg = await fetchJson<{ data?: Array<{ commodity_name?: string; price?: string; min_price?: string; max_price?: string }> }>(
    `https://vegetablemarketprice.com/api/dataapi/market/${slug}/daypricereport?date=${today}`,
  );
  return (veg?.data ?? []).slice(0, 8).map(row => makeCard({
    id: liveId('rates', `${slug}-${row.commodity_name}`),
    city: location.city,
    category: 'rates',
    title: `${row.commodity_name}: ₹${row.price || row.max_price}/kg`,
    body: `Local mandi range ₹${row.min_price || row.price}–₹${row.max_price || row.price} in ${location.city}.`,
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=60',
  }));
}

async function fetchRatesCards(location: DailyLocation): Promise<CityNews[]> {
  const fx = await fetchJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(
    'https://open.er-api.com/v6/latest/USD',
  );
  const inr = fx?.rates?.INR;
  const eurInr = fx?.rates?.INR && fx?.rates?.EUR ? fx.rates.INR / fx.rates.EUR : null;
  const gbpInr = fx?.rates?.INR && fx?.rates?.GBP ? fx.rates.INR / fx.rates.GBP : null;
  const cards: CityNews[] = [];

  if (inr) {
    cards.push(makeCard({
      id: liveId('rates', 'usd-inr'),
      city: 'National',
      category: 'rates',
      title: `USD/INR ${inr.toFixed(2)}`,
      body: `Live rupee vs US dollar. Updated ${fx?.time_last_update_utc || 'just now'}.`,
      image_url: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=60',
      source_url: 'https://www.exchangerate-api.com',
    }));
  }
  if (eurInr) {
    cards.push(makeCard({
      id: liveId('rates', 'eur-inr'),
      city: 'National',
      category: 'rates',
      title: `EUR/INR ${eurInr.toFixed(2)}`,
      body: 'Live euro to Indian rupee.',
      image_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a7?auto=format&fit=crop&w=800&q=60',
    }));
  }
  if (gbpInr) {
    cards.push(makeCard({
      id: liveId('rates', 'gbp-inr'),
      city: 'National',
      category: 'rates',
      title: `GBP/INR ${gbpInr.toFixed(2)}`,
      body: 'Live pound sterling to Indian rupee.',
      image_url: 'https://images.unsplash.com/photo-1567427013347-c0c786c32620?auto=format&fit=crop&w=800&q=60',
    }));
  }

  const [nifty, sensex] = await Promise.all([
    fetchIndexQuote('^NSEI', 'NIFTY 50', location.city),
    fetchIndexQuote('^BSESN', 'SENSEX', location.city),
  ]);
  if (nifty) cards.push(nifty);
  if (sensex) cards.push(sensex);

  const mandi = await fetchMandiCards(location);
  return [...cards, ...mandi];
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
  return merged.filter(item => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
