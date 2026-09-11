// app/index.tsx — Root entry controller (prevents Expo Router "Unmatched Route")

import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { VedastyaBrandSplash, VEDASTYA_SPLASH_BG } from '../components/common/VedastyaBrandSplash';

/**
 * Initial route for `/`. While auth resolves, keep the Vedastya brand mark visible
 * (AuthGuard also overlays the same splash for a seamless handoff).
 */
export default function RootIndex() {
  const isInitialized = useAuthStore(s => s.isInitialized);
  const profile = useAuthStore(s => s.profile);

  if (!isInitialized) {
    return (
      <View style={styles.shell} accessibilityLabel="Vedastya is starting">
        <VedastyaBrandSplash />
      </View>
    );
  }

  if (profile) {
    const needsLocation = !profile.city || profile.lat == null || profile.lng == null;
    if (needsLocation) {
      return <Redirect href={{ pathname: '/(auth)/location', params: { role: profile.role } }} />;
    }
    return <Redirect href={'/(tabs)/daily' as any} />;
  }

  return <Redirect href="/(auth)/splash" />;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: VEDASTYA_SPLASH_BG,
  },
});
