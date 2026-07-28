// lib/supabase.ts — Secure Supabase client (+ local demo auth fallback)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { friendlyAuthNetworkError, getSupabaseConfig, isDemoAuthEnabled } from './config';
import {
  demoGetSession,
  demoGetUser,
  demoSendPasswordReset,
  demoSignIn,
  demoSignOut,
  demoSignUp,
} from './demoAuth';

const { url: supabaseUrl, anonKey: supabaseAnon } = getSupabaseConfig();
const authProxyUrl = process.env.EXPO_PUBLIC_AUTH_PROXY_URL || 'http://localhost:3001';

if (!isDemoAuthEnabled() && (!supabaseUrl || !supabaseAnon)) {
  throw new Error('Missing Supabase environment variables. Check .env.local');
}

const isBrowserRuntime = () => typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNativeRuntime = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

const SecureAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isBrowserRuntime()) return window.localStorage.getItem(key);
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isBrowserRuntime()) { window.localStorage.setItem(key, value); return; }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  removeItem: async (key: string): Promise<void> => {
    if (isBrowserRuntime()) { window.localStorage.removeItem(key); return; }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

const getRedirectUrl = (role?: string, path = 'callback') => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(`${window.location.origin}/${path}`);
    if (role) url.searchParams.set('role', role);
    return url.toString();
  }

  let url = Linking.createURL(path);
  if (role) url += `${url.includes('?') ? '&' : '?'}role=${encodeURIComponent(role)}`;
  return url;
};

const realtimeConfig = { params: { eventsPerSecond: 10 } };
const isClientRuntime = isBrowserRuntime() || isNativeRuntime;
let supabaseClient: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (supabaseClient) return supabaseClient;
  if (!isClientRuntime) {
    throw new Error('Supabase client must be initialized in a browser or React Native runtime.');
  }

  const url = isDemoAuthEnabled() ? 'https://demo.supabase.local' : supabaseUrl;
  const key = isDemoAuthEnabled() ? 'demo-anon-key' : supabaseAnon;

  supabaseClient = createClient(url, key, {
    auth: {
      storage: SecureAdapter,
      autoRefreshToken: !isDemoAuthEnabled(),
      persistSession: !isDemoAuthEnabled(),
      detectSessionInUrl: isBrowserRuntime() && !isDemoAuthEnabled(),
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-App-Name': 'CityConnect',
        'X-App-Version': Constants.expoConfig?.version ?? '1.0.0',
      },
    },
    db: { schema: 'public' },
    realtime: realtimeConfig as any,
  });

  return supabaseClient;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => (getSupabase() as any)[prop],
  set: (_target, prop, value) => { (getSupabase() as any)[prop] = value; return true; },
});

export const signInWithGoogle = async (role?: string) => {
  if (isDemoAuthEnabled()) {
    return {
      data: { provider: 'google', url: null },
      error: { message: 'Social login needs a real Supabase project. Use email signup in local demo mode.' } as any,
    };
  }
  return getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl(role),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
};

export const signInWithApple = async (role?: string) => {
  if (isDemoAuthEnabled()) {
    return {
      data: { provider: 'apple', url: null },
      error: { message: 'Social login needs a real Supabase project. Use email signup in local demo mode.' } as any,
    };
  }
  return getSupabase().auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: getRedirectUrl(role) },
  });
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  const normalized = email.trim().toLowerCase();
  if (isDemoAuthEnabled()) return demoSignIn(normalized, password);
  try {
    return await getSupabase().auth.signInWithPassword({ email: normalized, password });
  } catch (err) {
    return { data: { user: null, session: null }, error: { message: friendlyAuthNetworkError(err) } as any };
  }
};

export const signUpWithEmailPassword = async ({
  email,
  password,
  fullName,
  username,
  phone,
  role,
}: {
  email: string;
  password: string;
  fullName: string;
  username: string;
  phone?: string;
  role?: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (isDemoAuthEnabled()) {
    return demoSignUp({ email: normalizedEmail, password, fullName, username, phone, role });
  }

  try {
    const direct = await getSupabase().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getRedirectUrl(role),
        data: {
          full_name: fullName,
          username,
          phone: phone ?? '',
          role: role ?? 'buyer',
        },
      },
    });

    if (!direct.error && direct.data?.session) return direct;

    if (!direct.error && direct.data?.user && !direct.data.session) {
      const signedIn = await getSupabase().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (!signedIn.error && signedIn.data?.session) return signedIn;
      return direct;
    }

    if (process.env.EXPO_PUBLIC_AUTH_PROXY_URL) {
      try {
        const response = await fetch(`${authProxyUrl}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            fullName,
            username,
            phone: phone ?? '',
            role,
          }),
        });
        if (response.ok) {
          const signedIn = await getSupabase().auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (!signedIn.error) return signedIn;
        }
      } catch {
        // ignore
      }
    }

    return direct;
  } catch (err) {
    return { data: { user: null, session: null }, error: { message: friendlyAuthNetworkError(err) } as any };
  }
};

export const sendPasswordResetEmail = async (email: string) => {
  if (isDemoAuthEnabled()) return demoSendPasswordReset(email);
  try {
    return await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getRedirectUrl(undefined),
    });
  } catch (err) {
    return { data: {}, error: { message: friendlyAuthNetworkError(err) } as any };
  }
};

export const updateCurrentUserPassword = async (password: string) => {
  if (isDemoAuthEnabled()) {
    return {
      data: { user: null },
      error: { message: 'In local demo mode, create a new password by signing up again or contact support once Supabase is connected.' } as any,
    };
  }
  return getSupabase().auth.updateUser({ password });
};

export const sendPhoneOtp = async (phone: string) => {
  if (isDemoAuthEnabled()) {
    return { data: {}, error: { message: 'Phone OTP needs Twilio + real Supabase. Use email signup in demo mode.' } as any };
  }
  return getSupabase().auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
};

export const verifyPhoneOtp = async (phone: string, token: string) => {
  if (isDemoAuthEnabled()) {
    return { data: { user: null, session: null }, error: { message: 'Phone OTP unavailable in demo mode.' } as any };
  }
  return getSupabase().auth.verifyOtp({ phone, token, type: 'sms' });
};

export const signOut = async () => {
  if (isDemoAuthEnabled()) {
    await demoSignOut();
    return;
  }
  await getSupabase().auth.signOut();
};

export const getCurrentUser = async () => {
  if (isDemoAuthEnabled()) {
    const { data } = await demoGetUser();
    return data.user;
  }
  const { data: { user }, error } = await getSupabase().auth.getUser();
  if (error) throw error;
  return user;
};

export const getAuthSession = async () => {
  if (isDemoAuthEnabled()) return demoGetSession();
  return getSupabase().auth.getSession();
};

export { isDemoAuthEnabled };
