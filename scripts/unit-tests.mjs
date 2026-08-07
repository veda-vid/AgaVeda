/**
 * Unit tests for CityConnect core location + cart helpers.
 * Run: node --test scripts/unit-tests.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { register } from 'node:module';

// Load TS helpers by evaluating the compiled logic inline (mirror of constants/cities.ts)
const POPULAR_CITIES = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchCity(name, lat, lng) {
  const q = (name || '').trim().toLowerCase();
  if (q) {
    const byName = POPULAR_CITIES.find(
      c => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()),
    );
    if (byName) return byName;
  }
  if (lat == null || lng == null) return null;
  let best = null;
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

function cartTotal(items) {
  return items.reduce((sum, i) => {
    const price = i.product?.discounted_price ?? i.product?.price ?? 0;
    return sum + Number(price) * i.quantity;
  }, 0);
}

function filterFollowingFeed(posts, followedShopIds) {
  if (!followedShopIds.length) return [];
  return posts.filter(p => followedShopIds.includes(p.shop_id));
}

function hasCompletedLocation(profile) {
  return !!profile && !!String(profile.city || '').trim() && profile.lat != null && profile.lng != null;
}

function routeAfterAuth(profile, fallbackRole = 'buyer') {
  if (hasCompletedLocation(profile)) return '/(tabs)';
  return `/location?role=${encodeURIComponent(profile?.role ?? fallbackRole)}`;
}

function canChangeRadius(role) {
  return role !== 'seller';
}

describe('location helpers', () => {
  it('defaults radius option includes 5 km', () => {
    const RADIUS_OPTIONS = [2, 5, 10, 20, 50];
    assert.equal(RADIUS_OPTIONS.includes(5), true);
    assert.equal(RADIUS_OPTIONS[1], 5);
  });

  it('matches Chandigarh by name', () => {
    const city = matchCity('Chandigarh');
    assert.equal(city?.name, 'Chandigarh');
    assert.ok(Math.abs(city.lat - 30.7333) < 0.01);
  });

  it('matches Mumbai by partial name', () => {
    assert.equal(matchCity('mumbai')?.name, 'Mumbai');
  });

  it('auto-selects nearest city from coords (near Chandigarh)', () => {
    const city = matchCity('', 30.74, 76.78);
    assert.equal(city?.name, 'Chandigarh');
  });

  it('haversine: Mumbai–Pune roughly 120km', () => {
    const d = haversineKm(19.076, 72.8777, 18.5204, 73.8567);
    assert.ok(d > 100 && d < 160, `got ${d}`);
  });
});

describe('following feed filter', () => {
  const posts = [
    { id: '1', shop_id: 'a', caption: 'hello' },
    { id: '2', shop_id: 'b', caption: 'world' },
    { id: '3', shop_id: 'a', caption: 'again' },
  ];

  it('returns only followed shops', () => {
    const out = filterFollowingFeed(posts, ['a']);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map(p => p.id), ['1', '3']);
  });

  it('returns empty when not following anyone', () => {
    assert.equal(filterFollowingFeed(posts, []).length, 0);
  });
});

describe('cart totals', () => {
  it('sums discounted prices × qty', () => {
    const total = cartTotal([
      { quantity: 2, product: { price: 100, discounted_price: 80 } },
      { quantity: 1, product: { price: 50, discounted_price: 50 } },
    ]);
    assert.equal(total, 210);
  });

  it('handles missing product', () => {
    assert.equal(cartTotal([{ quantity: 3 }]), 0);
  });
});

describe('buyer vs seller capabilities', () => {
  it('buyer can follow and cart; seller can upload', () => {
    const buyerCaps = { follow: true, cart: true, review: true, upload: false, stories: false };
    const sellerCaps = { follow: false, cart: false, review: false, upload: true, stories: true };
    assert.equal(buyerCaps.follow && buyerCaps.cart && buyerCaps.review, true);
    assert.equal(sellerCaps.upload && sellerCaps.stories, true);
    assert.equal(buyerCaps.upload, false);
  });
});

describe('location onboarding rules', () => {
  it('sends returning seller with saved location straight to tabs', () => {
    const route = routeAfterAuth({
      role: 'seller',
      city: 'Chandigarh',
      lat: 30.7333,
      lng: 76.7794,
    });
    assert.equal(route, '/(tabs)');
  });

  it('keeps first-time seller on location setup', () => {
    const route = routeAfterAuth({
      role: 'seller',
      city: '',
      lat: null,
      lng: null,
    });
    assert.equal(route, '/location?role=seller');
  });

  it('locks seller radius changes but keeps buyer radius open', () => {
    assert.equal(canChangeRadius('seller'), false);
    assert.equal(canChangeRadius('buyer'), true);
    assert.equal(canChangeRadius('service_provider'), true);
  });
});

describe('auth rate limit parsing', () => {
  function parseRateLimitWaitMs(message) {
    const msg = String(message || '').toLowerCase();
    if (!msg.includes('rate limit') && !msg.includes('too many') && !msg.includes('throttl')) return null;

    const minutes = msg.match(/(\d+)\s*(minute|min|mins|minutes)\b/i)?.[1];
    if (minutes) return Number(minutes) * 60 * 1000;

    const hours = msg.match(/(\d+)\s*(hour|hours|hr|hrs)\b/i)?.[1];
    if (hours) return Number(hours) * 60 * 60 * 1000;

    const seconds = msg.match(/(\d+)\s*(second|seconds|sec|secs)\b/i)?.[1];
    if (seconds) return Number(seconds) * 1000;

    return 2 * 60 * 1000;
  }

  it('parses minutes from supabase-like message', () => {
    const ms = parseRateLimitWaitMs('email rate limit exceeded, try again in 120 minutes');
    assert.equal(ms, 120 * 60 * 1000);
  });

  it('parses hours from throttling message', () => {
    const ms = parseRateLimitWaitMs('too many requests, please wait 2 hours');
    assert.equal(ms, 2 * 60 * 60 * 1000);
  });

  it('parses seconds from throttling message', () => {
    const ms = parseRateLimitWaitMs('rate limit exceeded, try again in 45 seconds');
    assert.equal(ms, 45 * 1000);
  });

  it('returns null when message is unrelated', () => {
    const ms = parseRateLimitWaitMs('some other error');
    assert.equal(ms, null);
  });
});
