// app/(auth)/splash.tsx — Onboarding splash using Vedastya brand mark
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VedastyaBrandSplash } from '../../components/common/VedastyaBrandSplash';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/(auth)/role'), 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.root}>
      <VedastyaBrandSplash />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
});
