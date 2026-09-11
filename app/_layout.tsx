// app/_layout.tsx — Root layout with auth guard + Vedastya branded boot splash

import { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import { useAuthStore } from '../stores/authStore';
import { Colors, createDynamicStyles } from '../constants/theme';
import { VedastyaBrandSplash } from '../components/common/VedastyaBrandSplash';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { ThemeProvider } from '../components/common/ThemeProvider';
import { VideoOptimizeHost } from '../components/media/VideoOptimizeHost';
import { BOOT_TIMEOUT_MS } from '../lib/bootGuards';
import { ensureAgentDebugFlushHook } from '../lib/agentDebugLog';

/** Soft-load splash module so a missing native module never freezes boot. */
async function hideNativeSplash() {
  try {
    const SplashScreen = await import('expo-splash-screen');
    await SplashScreen.hideAsync();
  } catch {
    // Non-fatal in Expo Go / web
  }
}

try {
  // Keep native splash until JS hands off to VedastyaBrandSplash.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SplashScreen = require('expo-splash-screen');
  SplashScreen.preventAutoHideAsync?.().catch?.(() => {});
} catch {
  // Module unavailable — continue without native splash control
}

function AuthGuard({
  children,
  fontsReady,
}: {
  children: React.ReactNode;
  fontsReady: boolean;
}) {
  const profile = useAuthStore(s => s.profile);
  const isInitialized = useAuthStore(s => s.isInitialized);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const lastNav = useRef<string>('');
  const [showSplash, setShowSplash] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const splashDismissed = useRef(false);

  useEffect(() => {
    ensureAgentDebugFlushHook();
  }, []);

  const isCallbackRoute =
    (segments as string[]).includes('callback')
    || (pathname ?? '').includes('/callback')
    || (pathname ?? '').endsWith('callback');
  const inAuthRoutes =
    (segments as string[]).includes('splash') ||
    (segments as string[]).includes('role') ||
    (segments as string[]).includes('login') ||
    (segments as string[]).includes('location') ||
    (segments as string[]).includes('reset') ||
    (segments as string[]).includes('callback');

  const dismissBrandSplash = (reason: string) => {
    if (splashDismissed.current) return;
    splashDismissed.current = true;
    console.log(`[boot] Dismissing Vedastya splash (${reason}).`);
    void hideNativeSplash();
    setFadingOut(true);
    setTimeout(() => setShowSplash(false), 420);
  };

  // Hard UI guard: force open within 3s even if auth/fonts/network stall.
  useEffect(() => {
    if (isCallbackRoute) {
      splashDismissed.current = true;
      setShowSplash(false);
      void hideNativeSplash();
      return undefined;
    }

    void hideNativeSplash();

    const timer = setTimeout(() => {
      if (!useAuthStore.getState().isInitialized) {
        console.warn('[boot] Hard timeout reached — continuing without a resolved session.');
        useAuthStore.setState({ isLoading: false, isInitialized: true });
      }
      dismissBrandSplash('hard-timeout');
    }, BOOT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isCallbackRoute]);

  // Cross-fade once auth is ready and fonts have loaded (or timed out via hard guard).
  useEffect(() => {
    if (!isInitialized || !fontsReady || isCallbackRoute || !showSplash) return undefined;
    dismissBrandSplash('auth-and-fonts-ready');
    return undefined;
  }, [isInitialized, fontsReady, isCallbackRoute, showSplash]);

  useEffect(() => {
    if (!isInitialized || isCallbackRoute) return;

    const currentSegs = segments as string[];
    const authScreen = currentSegs.find(s =>
      ['splash', 'role', 'login', 'location', 'reset', 'callback'].includes(s),
    );
    const needsLocation = !!profile && (!profile.city || profile.lat == null || profile.lng == null);

    let target: string | null = null;
    if (!profile && !inAuthRoutes) {
      target = '/(auth)/splash';
    } else if (profile && needsLocation && inAuthRoutes && authScreen !== 'location') {
      if (authScreen !== 'reset') {
        target = `/location?role=${profile.role}`;
      }
    } else if (profile && !needsLocation && inAuthRoutes && authScreen !== 'callback' && authScreen !== 'reset') {
      target = '/(tabs)/daily';
    }

    if (target && target !== lastNav.current) {
      lastNav.current = target;
      try {
        if (target.startsWith('/location')) {
          const role = profile?.role ?? 'buyer';
          router.replace({ pathname: '/location', params: { role } } as any);
        } else {
          router.replace(target as any);
        }
      } catch (error) {
        console.warn('[boot] Navigation failed — staying on current screen.', error);
      }
    }
  }, [profile, isInitialized, segments, isCallbackRoute, inAuthRoutes, router]);

  return (
    <View style={styles.shell}>
      {children}
      {showSplash && !isCallbackRoute ? (
        <VedastyaBrandSplash fadingOut={fadingOut} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [toastReady, setToastReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });

  // Never block startup indefinitely on font download failures.
  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn('[boot] Font loading failed — continuing with system fonts.', fontError);
    }
  }, [fontError]);

  const fontsReady = fontsLoaded || fontsTimedOut || !!fontError;

  // Mount toast after first paint — avoids hydration noise; package is statically imported.
  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (!cancelled) setToastReady(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootGuard = setTimeout(() => {
      if (!cancelled && !useAuthStore.getState().isInitialized) {
        console.warn('[boot] Root initialize timeout — opening main UI.');
        useAuthStore.setState({ isLoading: false, isInitialized: true });
      }
      void hideNativeSplash();
    }, BOOT_TIMEOUT_MS);

    (async () => {
      try {
        await initialize();
      } catch (error) {
        console.warn('[boot] Root initialize failed — continuing to main UI.', error);
        if (!cancelled) {
          useAuthStore.setState({ isLoading: false, isInitialized: true });
        }
      } finally {
        clearTimeout(bootGuard);
        if (!cancelled && !useAuthStore.getState().isInitialized) {
          useAuthStore.setState({ isLoading: false, isInitialized: true });
        }
        void hideNativeSplash();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(bootGuard);
      void hideNativeSplash();
    };
  }, [initialize]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppErrorBoundary
            onError={() => {
              void hideNativeSplash();
            }}
            fallbackTitle="Vedastya could not finish loading"
            fallbackMessage="A device feature failed to start. Tap Try again, or reopen the app."
          >
            <AuthGuard fontsReady={fontsReady}>
              <AppErrorBoundary
                onError={() => {
                  void hideNativeSplash();
                }}
                fallbackTitle="This screen needs a moment"
                fallbackMessage="Something went wrong on this tab. Tap Try again to reload it."
              >
                <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                  <Stack.Screen name="seller/upload" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="seller/shop" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="seller/enquiries" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="pro/settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="chat/[shopId]" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="shop/[id]" options={{ animation: 'slide_from_right' }} />
                </Stack>
              </AppErrorBoundary>
            </AuthGuard>
          </AppErrorBoundary>
          {toastReady ? <Toast /> : null}
          <VideoOptimizeHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = createDynamicStyles((Colors) => ({
  shell: { flex: 1, backgroundColor: Colors.bg },
}));
