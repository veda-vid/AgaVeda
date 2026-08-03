// app/(auth)/callback.tsx — OAuth callback landing page

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/theme';

export default function OAuthCallbackScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { profile, isInitialized } = useAuthStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [callbackType, setCallbackType] = useState<string | null>(null);

  useEffect(() => {
    const initializeCallback = async () => {
      try {
        const supabase = getSupabase();

        if (Platform.OS === 'web') {
          const params = new URLSearchParams(window.location.search);
          // Supabase recovery links can use either `token_hash` or `token`
          // depending on the OAuth/PKCE path.
          const tokenHash = params.get('token_hash') ?? params.get('token');
          const type = params.get('type');

          if (tokenHash && type) {
            setCallbackType(type);
            try {
              await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: type as any,
              });
            } catch {
              // Even if verification fails, we still route to /reset for recovery UX.
              // The /reset screen will handle session-related errors if needed.
            }

            // IMPORTANT: password recovery should always land on /reset,
            // independently of authStore initialization timing.
            if (type === 'recovery') {
              router.replace('/reset' as any);
              return;
            }
          } else {
            await supabase.auth.getSession();
          }
        } else {
          const url = await Linking.getInitialURL();
          if (!url) return;

          const query = url.includes('#')
            ? url.slice(url.indexOf('#') + 1)
            : url.includes('?')
              ? url.slice(url.indexOf('?') + 1)
              : '';

          const params = new URLSearchParams(query);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const token_hash = params.get('token_hash');
          const type = params.get('type');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
          } else if (token_hash && type) {
            setCallbackType(type);
            try {
              await supabase.auth.verifyOtp({
                token_hash,
                type: type as any,
              });
            } catch {
              // Route to /reset regardless for recovery UX.
            }

            if (type === 'recovery') {
              router.replace('/reset' as any);
              return;
            }
          }
        }
      } catch {
        // Ignore if the callback URL has already been parsed or there is no active session.
      } finally {
        setReady(true);
      }
    };

    initializeCallback();
  }, []);

  useEffect(() => {
    if (!isInitialized || !ready) return;

    if (callbackType === 'recovery') {
      router.replace('/reset' as any);
      return;
    }

    const destination = profile
      ? '/'
      : `/location${role ? `?role=${encodeURIComponent(role)}` : ''}`;

    router.replace(destination as any);
  }, [isInitialized, profile, role, ready, callbackType]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={Colors.orange} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
});
