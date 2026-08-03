// app/_layout.tsx — Root layout with auth guard (no redirect loops)

import { useEffect, useRef } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../constants/theme';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile);
  const isInitialized = useAuthStore(s => s.isInitialized);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const lastNav = useRef<string>('');

  const isCallbackRoute = (segments as string[]).includes('callback') || (pathname ?? '').endsWith('/callback');
  const inAuthRoutes =
    (segments as string[]).includes('splash') ||
    (segments as string[]).includes('role') ||
    (segments as string[]).includes('login') ||
    (segments as string[]).includes('location') ||
    (segments as string[]).includes('reset') ||
    (segments as string[]).includes('callback');

  useEffect(() => {
    if (!isInitialized || isCallbackRoute) return;

    const currentSegs = segments as string[];
    const authScreen = currentSegs.find(s => ['splash', 'role', 'login', 'location', 'reset', 'callback'].includes(s));
    const needsLocation = !!profile && (!profile.city || profile.lat == null || profile.lng == null);

    let target: string | null = null;
    if (!profile && !inAuthRoutes) {
      target = '/splash';
    } else if (profile && needsLocation && authScreen !== 'location') {
      target = `/location?role=${profile.role}`;
    } else if (profile && !needsLocation && inAuthRoutes && authScreen !== 'callback' && authScreen !== 'reset') {
      // Completed onboarding — enter main app tabs
      target = '/(tabs)';
    }

    if (target && target !== lastNav.current) {
      lastNav.current = target;
      if (target.startsWith('/location')) {
        const role = profile?.role ?? 'buyer';
        router.replace({ pathname: '/location', params: { role } } as any);
      } else {
        router.replace(target as any);
      }
    }
  }, [profile, isInitialized, segments, isCallbackRoute, inAuthRoutes, router]);

  if (!isInitialized && !isCallbackRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="seller/upload" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="seller/shop" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </AuthGuard>
      <Toast />
    </GestureHandlerRootView>
  );
}
