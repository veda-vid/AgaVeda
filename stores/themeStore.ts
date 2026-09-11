// stores/themeStore.ts — Live app theme (Android / iOS / web)

import { create } from 'zustand';
import {
  applyThemePalette,
  getThemeMeta,
  normalizeThemeId,
  ThemePalettes,
  THEME_STORAGE_KEY,
  type AppColors,
  type AppThemeId,
} from '../constants/theme';
import { platformStorage } from '../lib/platformStorage';

type ThemeState = {
  themeId: AppThemeId;
  colors: AppColors;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (themeId: AppThemeId) => Promise<void>;
};

const midnightColors = { ...ThemePalettes.midnight } as AppColors;

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeId: 'midnight',
  colors: midnightColors,
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await platformStorage.getItem(THEME_STORAGE_KEY);
      const themeId = normalizeThemeId(stored);
      applyThemePalette(themeId);
      set({
        themeId,
        colors: { ...ThemePalettes[themeId] } as AppColors,
        hydrated: true,
      });
    } catch {
      applyThemePalette('midnight');
      set({
        themeId: 'midnight',
        colors: midnightColors,
        hydrated: true,
      });
    }
  },

  setTheme: async (nextId) => {
    const themeId = normalizeThemeId(nextId);
    applyThemePalette(themeId);
    set({
      themeId,
      colors: { ...ThemePalettes[themeId] } as AppColors,
      hydrated: true,
    });
    try {
      await platformStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // Preference may not persist this session — UI still updates live
    }
  },
}));

export function useThemeColors(): AppColors {
  return useThemeStore(s => s.colors) ?? midnightColors;
}

export function useThemeId(): AppThemeId {
  return useThemeStore(s => s.themeId) || 'midnight';
}

export function useIsLightTheme(): boolean {
  return useThemeStore(s => getThemeMeta(s.themeId || 'midnight').isLight);
}
