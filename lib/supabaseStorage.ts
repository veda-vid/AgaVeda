// lib/supabaseStorage.ts — Hybrid auth storage (AsyncStorage for session JSON; SecureStore only for tiny tokens)

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** iOS SecureStore soft limit — values above this warn or fail. */
export const SECURE_STORE_MAX_BYTES = 2048;

const isWebBrowser = () =>
  Platform.OS === 'web'
  && typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined';

function byteLength(value: string): number {
  try {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  } catch {
    // fall through
  }
  return value.length;
}

async function asyncGet(key: string): Promise<string | null> {
  try {
    if (isWebBrowser()) return window.localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn('[auth-storage] AsyncStorage getItem failed.', error);
    return null;
  }
}

async function asyncSet(key: string, value: string): Promise<void> {
  try {
    if (isWebBrowser()) {
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.warn('[auth-storage] AsyncStorage setItem failed. Session may not persist.', error);
  }
}

async function asyncRemove(key: string): Promise<void> {
  try {
    if (isWebBrowser()) {
      window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('[auth-storage] AsyncStorage removeItem failed.', error);
  }
}

const secureKey = (key: string) => `ss:${key}`;

/**
 * Supabase auth storage adapter for Expo Go / iOS / Android / Web.
 *
 * - Session JSON and other payloads always go to AsyncStorage (no 2048-byte limit).
 * - SecureStore is used only for optional small string mirrors under the size limit.
 * - Migration: reads fall back across AsyncStorage → SecureStore legacy keys.
 */
export const supabaseAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const fromAsync = await asyncGet(key);
      if (fromAsync != null) return fromAsync;

      if (Platform.OS === 'web') return null;

      try {
        const SecureStore = await import('expo-secure-store');
        const legacy = await SecureStore.getItemAsync(key);
        if (legacy != null) {
          // Migrate oversized SecureStore sessions into AsyncStorage once.
          await asyncSet(key, legacy);
          if (byteLength(legacy) > SECURE_STORE_MAX_BYTES) {
            await SecureStore.deleteItemAsync(key).catch(() => {});
            console.log('[auth-storage] Migrated large session from SecureStore to AsyncStorage.');
          }
          return legacy;
        }
        return await SecureStore.getItemAsync(secureKey(key));
      } catch {
        return null;
      }
    } catch (error) {
      console.warn('[auth-storage] getItem failed — continuing without cached session.', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Always persist the full session in AsyncStorage (safe for large JWTs / user metadata).
      await asyncSet(key, value);

      if (Platform.OS === 'web') return;

      const size = byteLength(value);
      if (size > SECURE_STORE_MAX_BYTES) {
        // Remove any legacy SecureStore copy so iOS never warns again.
        try {
          const SecureStore = await import('expo-secure-store');
          await SecureStore.deleteItemAsync(key).catch(() => {});
          await SecureStore.deleteItemAsync(secureKey(key)).catch(() => {});
        } catch {
          // ignore
        }
        return;
      }

      // Optional small-token mirror for short secrets only.
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(secureKey(key), value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      } catch (error) {
        console.warn('[auth-storage] SecureStore mirror skipped.', error);
      }
    } catch (error) {
      console.warn('[auth-storage] setItem failed. Session may not persist this launch.', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await asyncRemove(key);
      if (Platform.OS === 'web') return;
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(key).catch(() => {});
        await SecureStore.deleteItemAsync(secureKey(key)).catch(() => {});
      } catch {
        // ignore
      }
    } catch (error) {
      console.warn('[auth-storage] removeItem failed.', error);
    }
  },
};
