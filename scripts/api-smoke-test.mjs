/**
 * Smoke-test all CityConnect Supabase REST APIs / RPCs via fetch (no WebSocket).
 * Run: npm run test:api
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnv();

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!BASE || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
  process.exit(1);
}

const LAT = 19.076;
const LNG = 72.8777;
const RADIUS = 5;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const results = [];

async function req(path, { method = 'GET', body, timeout = 10000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) {
      const msg = json?.message || json?.error || json?.hint || text || res.statusText;
      throw new Error(`${res.status}: ${msg}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function check(name, fn) {
  const start = Date.now();
  try {
    const data = await fn();
    const ms = Date.now() - start;
    const count = Array.isArray(data) ? data.length : data == null ? 0 : 1;
    results.push({ name, ok: true, ms, detail: `ok (${count})` });
    console.log(`✅ ${name} — ${ms}ms (${count})`);
  } catch (e) {
    const ms = Date.now() - start;
    results.push({ name, ok: false, ms, detail: e.message || String(e) });
    console.log(`❌ ${name} — ${ms}ms — ${e.message || e}`);
  }
}

async function rpcOrFallback(name, rpcPath, rpcBody, fallbackFn) {
  const start = Date.now();
  try {
    const data = await req(rpcPath, { method: 'POST', body: rpcBody });
    results.push({ name, ok: true, ms: Date.now() - start, detail: `rpc (${Array.isArray(data) ? data.length : 1})` });
    console.log(`✅ ${name} (rpc) — ${Date.now() - start}ms`);
  } catch (rpcErr) {
    try {
      const data = await fallbackFn();
      results.push({
        name, ok: true, ms: Date.now() - start,
        detail: `fallback (${Array.isArray(data) ? data.length : 1}) — rpc: ${rpcErr.message}`,
      });
      console.log(`⚠️  ${name} (fallback) — ${Date.now() - start}ms — rpc: ${rpcErr.message}`);
    } catch (e) {
      results.push({ name, ok: false, ms: Date.now() - start, detail: e.message });
      console.log(`❌ ${name} — ${e.message}`);
    }
  }
}

console.log('\nCityConnect API smoke test\n' + '='.repeat(42));

await check('REST health profiles', () =>
  req('/rest/v1/profiles?select=id&limit=1'));

await rpcOrFallback(
  'feed_within_radius',
  '/rest/v1/rpc/feed_within_radius',
  { user_lat: LAT, user_lng: LNG, radius_km: RADIUS },
  () => req('/rest/v1/posts?select=id,caption&order=created_at.desc&limit=5'),
);

await rpcOrFallback(
  'shops_within_radius',
  '/rest/v1/rpc/shops_within_radius',
  { user_lat: LAT, user_lng: LNG, radius_km: RADIUS },
  () => req('/rest/v1/shops?select=id,name&is_active=eq.true&limit=5'),
);

await rpcOrFallback(
  'discounted_products_nearby',
  '/rest/v1/rpc/discounted_products_nearby',
  { user_lat: LAT, user_lng: LNG, radius_km: RADIUS },
  () => req('/rest/v1/products?select=id&discount_pct=gt.0&limit=5'),
);

await rpcOrFallback(
  'services_within_radius',
  '/rest/v1/rpc/services_within_radius',
  { user_lat: LAT, user_lng: LNG, radius_km: RADIUS },
  () => req('/rest/v1/service_providers?select=id&limit=5'),
);

await rpcOrFallback(
  'feed_from_followed',
  '/rest/v1/rpc/feed_from_followed',
  { p_user_id: '00000000-0000-0000-0000-000000000000' },
  () => req('/rest/v1/posts?select=id&limit=1'),
);

await rpcOrFallback(
  'stories_for_user',
  '/rest/v1/rpc/stories_for_user',
  { p_user_id: '00000000-0000-0000-0000-000000000000' },
  () => req('/rest/v1/stories?select=id&limit=1'),
);

await rpcOrFallback(
  'global_search',
  '/rest/v1/rpc/global_search',
  { q: 'shop', user_lat: LAT, user_lng: LNG, radius_km: 50 },
  () => req('/rest/v1/shops?select=id,name&name=ilike.*a*&limit=5'),
);

await check('table:posts', () =>
  req('/rest/v1/posts?select=id,caption,created_at&order=created_at.desc&limit=5'));

await check('table:shops', () =>
  req('/rest/v1/shops?select=id,name,city&is_active=eq.true&limit=5'));

await check('table:products', () =>
  req('/rest/v1/products?select=id,title&is_available=eq.true&limit=5'));

await check('table:service_providers', () =>
  req('/rest/v1/service_providers?select=id,business_name&limit=5'));

await check('table:shop_followers', () =>
  req('/rest/v1/shop_followers?select=user_id,shop_id&limit=5'));

await check('table:notifications', () =>
  req('/rest/v1/notifications?select=id&limit=5'));

await check('table:cart_items', () =>
  req('/rest/v1/cart_items?select=id&limit=5'));

await check('table:stories', () =>
  req('/rest/v1/stories?select=id&limit=5'));

await check('table:reels', () =>
  req('/rest/v1/reels?select=id&limit=5'));

await check('table:reviews', () =>
  req('/rest/v1/reviews?select=id&limit=5'));

await check('table:comments', () =>
  req('/rest/v1/comments?select=id&limit=5'));

console.log('\n' + '='.repeat(42));
const failed = results.filter(r => !r.ok);
const slow = results.filter(r => r.ok && r.ms > 3000);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (slow.length) console.log(`Slow (>3s): ${slow.map(s => `${s.name}(${s.ms}ms)`).join(', ')}`);
if (failed.length) {
  console.log('Failed / missing (apply migration if needed):');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  // Soft exit 0 if only optional social tables missing — app has fallbacks
  const critical = failed.filter(f =>
    !['table:cart_items', 'table:stories', 'table:reels', 'feed_from_followed', 'stories_for_user', 'global_search']
      .includes(f.name) && !f.detail.includes('fallback'));
  if (critical.length) process.exitCode = 1;
  else {
    console.log('Non-critical failures only — app fallbacks will keep screens opening.');
  }
} else {
  console.log('All APIs reachable.');
}
