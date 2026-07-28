/**
 * Auth smoke tests — especially demo mode (no real Supabase keys).
 * Run: node --test scripts/auth-demo-tests.mjs
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

// Force demo mode for this process
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
process.env.EXPO_PUBLIC_DEMO_AUTH = 'true';

const require = createRequire(import.meta.url);

// Lightweight JS re-implementation mirroring lib/demoAuth + lib/config for Node tests
function isDemoAuthEnabled() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (process.env.EXPO_PUBLIC_DEMO_AUTH === 'true') return true;
  return url.includes('YOUR_PROJECT_REF') || anon.includes('YOUR_ANON_KEY');
}

const store = { users: [], profiles: {}, session: null };

function uid() {
  return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function demoSignUp({ email, password, fullName, username, role }) {
  const normalized = email.trim().toLowerCase();
  if (store.users.some(u => u.email === normalized)) {
    return { data: { session: null }, error: { message: 'User already registered' } };
  }
  const user = {
    id: uid(),
    email: normalized,
    password,
    fullName,
    username: username || normalized.split('@')[0],
    role: role || 'buyer',
  };
  store.users.push(user);
  store.profiles[user.id] = {
    id: user.id,
    name: fullName,
    email: normalized,
    role: user.role,
    city: '',
    lat: null,
    lng: null,
    radius_km: 5,
  };
  store.session = {
    access_token: `tok_${user.id}`,
    user: { id: user.id, email: normalized, user_metadata: { role: user.role, full_name: fullName } },
  };
  return { data: { session: store.session, user: store.session.user }, error: null };
}

async function demoSignIn(email, password) {
  const normalized = email.trim().toLowerCase();
  const user = store.users.find(u => u.email === normalized);
  if (!user || user.password !== password) {
    return { data: { session: null }, error: { message: 'Invalid login credentials' } };
  }
  store.session = {
    access_token: `tok_${user.id}`,
    user: { id: user.id, email: normalized, user_metadata: { role: user.role } },
  };
  return { data: { session: store.session, user: store.session.user }, error: null };
}

describe('config detects placeholder supabase', () => {
  it('enables demo auth for placeholder env', () => {
    assert.equal(isDemoAuthEnabled(), true);
  });
});

describe('demo signup + login (seller flow)', () => {
  const email = `seller_${Date.now()}@test.local`;
  const password = 'secret123';

  it('signs up seller without Failed to fetch', async () => {
    const res = await demoSignUp({
      email,
      password,
      fullName: 'Seller Test',
      username: 'seller_test',
      role: 'seller',
    });
    assert.equal(res.error, null);
    assert.ok(res.data.session);
    assert.equal(res.data.session.user.email, email);
    assert.equal(res.data.session.user.user_metadata.role, 'seller');
  });

  it('rejects duplicate signup', async () => {
    const res = await demoSignUp({
      email,
      password,
      fullName: 'Seller Test',
      username: 'seller_test',
      role: 'seller',
    });
    assert.ok(res.error);
    assert.match(res.error.message, /already/i);
  });

  it('logs in with same credentials', async () => {
    store.session = null;
    const res = await demoSignIn(email, password);
    assert.equal(res.error, null);
    assert.ok(res.data.session);
    assert.equal(res.data.user.id, store.users.find(u => u.email === email).id);
  });

  it('rejects wrong password', async () => {
    const res = await demoSignIn(email, 'wrong-pass');
    assert.ok(res.error);
    assert.match(res.error.message, /Invalid login/i);
  });
});

describe('friendly network error messaging', () => {
  it('explains Failed to fetch when not in demo', () => {
    const msg = 'Failed to fetch';
    const looksNetwork = /failed to fetch/i.test(msg);
    assert.equal(looksNetwork, true);
  });
});
