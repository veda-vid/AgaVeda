// lib/demoAuth.ts — Local signup/login when Supabase is not configured
// Stores users + session in browser localStorage / memory (web-first for localhost).

import type { Profile, UserRole } from '../types';

const STORAGE_KEY = 'cityconnect_demo_auth_v1';

type DemoUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  username: string;
  role: UserRole;
  phone?: string;
  created_at: string;
};

type DemoSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    phone?: string;
    user_metadata: Record<string, string>;
  };
};

type DemoDB = {
  users: DemoUser[];
  profiles: Record<string, Profile>;
  session: DemoSession | null;
};

const mem: { db: DemoDB | null } = { db: null };

function emptyDb(): DemoDB {
  return { users: [], profiles: {}, session: null };
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadDb(): DemoDB {
  if (mem.db) return mem.db;
  if (canUseLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        mem.db = JSON.parse(raw) as DemoDB;
        return mem.db;
      }
    } catch {
      // ignore corrupt storage
    }
  }
  mem.db = emptyDb();
  return mem.db;
}

function saveDb(db: DemoDB) {
  mem.db = db;
  if (canUseLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

function uid() {
  return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeSession(user: DemoUser): DemoSession {
  return {
    access_token: `demo_access_${user.id}`,
    refresh_token: `demo_refresh_${user.id}`,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      user_metadata: {
        full_name: user.fullName,
        username: user.username,
        role: user.role,
      },
    },
  };
}

function ensureProfile(user: DemoUser, db: DemoDB): Profile {
  const existing = db.profiles[user.id];
  if (existing) return existing;
  const now = new Date().toISOString();
  const profile: Profile = {
    id: user.id,
    name: user.fullName || user.username || user.email.split('@')[0],
    phone: user.phone ?? null,
    email: user.email,
    avatar_url: null,
    role: user.role,
    city: '',
    lat: null,
    lng: null,
    radius_km: 5,
    is_verified: false,
    created_at: now,
    updated_at: now,
  };
  db.profiles[user.id] = profile;
  return profile;
}

export const demoSignUp = async (input: {
  email: string;
  password: string;
  fullName: string;
  username: string;
  phone?: string;
  role?: string;
}) => {
  const db = loadDb();
  const email = input.email.trim().toLowerCase();
  if (db.users.some(u => u.email === email)) {
    return { data: { user: null, session: null }, error: { message: 'User already registered' } as any };
  }

  const user: DemoUser = {
    id: uid(),
    email,
    password: input.password,
    fullName: input.fullName.trim(),
    username: (input.username || email.split('@')[0]).trim().toLowerCase(),
    role: (input.role as UserRole) || 'buyer',
    phone: input.phone,
    created_at: new Date().toISOString(),
  };

  db.users.push(user);
  ensureProfile(user, db);
  db.session = makeSession(user);
  saveDb(db);

  return { data: { user: db.session.user, session: db.session }, error: null as any };
};

export const demoSignIn = async (email: string, password: string) => {
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  const user = db.users.find(u => u.email === normalized);
  if (!user || user.password !== password) {
    return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } as any };
  }
  ensureProfile(user, db);
  db.session = makeSession(user);
  saveDb(db);
  return { data: { user: db.session.user, session: db.session }, error: null as any };
};

export const demoSendPasswordReset = async (email: string) => {
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  const exists = db.users.some(u => u.email === normalized);
  if (!exists) {
    // Same UX as real providers: don't reveal whether email exists
    return { data: {}, error: null as any };
  }
  return { data: { sent: true }, error: null as any };
};

export const demoGetSession = async () => {
  const db = loadDb();
  return { data: { session: db.session }, error: null as any };
};

export const demoGetUser = async () => {
  const db = loadDb();
  return { data: { user: db.session?.user ?? null }, error: null as any };
};

export const demoSignOut = async () => {
  const db = loadDb();
  db.session = null;
  saveDb(db);
};

export const demoGetProfile = async (userId: string): Promise<Profile> => {
  const db = loadDb();
  const profile = db.profiles[userId];
  if (!profile) throw new Error('Profile not found');
  return profile;
};

export const demoUpsertProfile = async (profile: Partial<Profile> & { id: string }): Promise<Profile> => {
  const db = loadDb();
  const prev = db.profiles[profile.id];
  const now = new Date().toISOString();
  const next: Profile = {
    id: profile.id,
    name: profile.name ?? prev?.name ?? '',
    phone: profile.phone ?? prev?.phone ?? null,
    email: profile.email ?? prev?.email ?? null,
    avatar_url: profile.avatar_url ?? prev?.avatar_url ?? null,
    role: (profile.role as UserRole) ?? prev?.role ?? 'buyer',
    city: profile.city ?? prev?.city ?? '',
    lat: profile.lat ?? prev?.lat ?? null,
    lng: profile.lng ?? prev?.lng ?? null,
    radius_km: profile.radius_km ?? prev?.radius_km ?? 5,
    is_verified: profile.is_verified ?? prev?.is_verified ?? false,
    created_at: prev?.created_at ?? now,
    updated_at: now,
  };
  db.profiles[profile.id] = next;
  saveDb(db);
  return next;
};

/** Test helper (Node): wipe in-memory demo DB */
export const __resetDemoAuthForTests = () => {
  mem.db = emptyDb();
};
