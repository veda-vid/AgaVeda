// components/common/ThemeProvider.tsx — Hydrate + apply live themes with matching StatusBar

import { type ReactNode, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, getThemeMeta } from '../../constants/theme';
import { useThemeStore } from '../../stores/themeStore';

type Props = {
  children: ReactNode;
};

/**
 * Loads the saved theme before showing the tree, then remounts only when the
 * user switches themes so createDynamicStyles getters pick up new colors.
 */
export function ThemeProvider({ children }: Props) {
  const themeId = useThemeStore(s => s.themeId) || 'midnight';
  const colors = useThemeStore(s => s.colors) || Colors;
  const hydrated = useThemeStore(s => s.hydrated);
  const hydrate = useThemeStore(s => s.hydrate);
  const [bootstrapped, setBootstrapped] = useState(false);
  const meta = getThemeMeta(themeId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await hydrate();
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
  }, [hydrate]);

  if (!bootstrapped && !hydrated) {
    return (
      <View style={[s.root, s.boot, { backgroundColor: Colors.bg }]}>
        <StatusBar style={meta.statusBar} backgroundColor={Colors.bg} />
        <ActivityIndicator color={Colors.orange} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={meta.statusBar} backgroundColor={colors.bg} />
      <View key={themeId} style={s.root}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  boot: { alignItems: 'center', justifyContent: 'center' },
});
