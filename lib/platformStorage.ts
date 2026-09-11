// lib/platformStorage.ts — Cross-platform key/value storage (web + Expo Go)

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWebBrowser = () =>
  Platform.OS === 'web'
  && typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined';

/**
 * Unified async storage used by auth session, theme preference, and offline caches.
 * Prefer AsyncStorage on native so Expo Go never depends on DOM APIs.
 */
export const platformStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isWebBrowser()) return window.localStorage.getItem(key);
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('[storage] getItem failed — returning null.', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isWebBrowser()) {
        window.localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('[storage] setItem failed.', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isWebBrowser()) {
        window.localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('[storage] removeItem failed.', error);
    }
  },
};

/** Sync theme read for module init — web only; native defaults until hydrated. */
export function readLocalStorageSync(key: string): string | null {
  try {
    if (!isWebBrowser()) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
