// hooks/useThemedStyles.ts — Recreate StyleSheets when the active theme changes

import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { Colors, type AppColors } from '../constants/theme';
import { useThemeStore } from '../stores/themeStore';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build theme-aware styles. Pass a factory that reads from the `C` palette
 * (or the live `Colors` object) so text/background stay contrast-safe.
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (C: AppColors) => T | NamedStyles<T>,
): T {
  const themeId = useThemeStore(s => s.themeId);
  return useMemo(
    () => StyleSheet.create(factory(Colors) as T),
    // themeId is the intentional dependency; Colors is mutated in sync with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeId],
  );
}
