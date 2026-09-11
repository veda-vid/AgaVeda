// app/(auth)/callback.tsx — OAuth callback landing page

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors, createDynamicStyles } from '../../constants/theme';

function hasCompletedLocation(profile: { city?: string; lat?: number | null; lng?: number | null } | null | undefined) {
  return !!profile && !!profile.city?.trim() && profile.lat != null && profile.lng != null;
}

export default function OAuthCallbackScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { profile, isInitialized, refreshProfile } = useAuthStore();
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
            // Password recovery links can arrive as OTP-style (`token_hash`)
            // or as OAuth/PKCE-style (`token=pkce_...`).
            // If it looks like PKCE, let Supabase parse the session from the URL
            // instead of calling verifyOtp (which would error with "email_link invalid/expired").
            if (type === 'recovery' && tokenHash.startsWith('pkce_')) {
              try { await supabase.auth.getSession(); } catch {}
            } else {
              try {
                await supabase.auth.verifyOtp({
                  token_hash: tokenHash,
                  type: type as any,
                });
              } catch {
                // We'll still route to /reset for recovery UX.
                // If the session isn't established, /reset will show a clearer error.
              }
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

    const roleHint = Array.isArray(role) ? role[0] : role;
    void (async () => {
      try { await refreshProfile(roleHint); } catch {}
      const nextProfile = useAuthStore.getState().profile;
      const destination = hasCompletedLocation(nextProfile)
        ? '/(tabs)'
        : `/location?role=${encodeURIComponent(roleHint ?? nextProfile?.role ?? 'buyer')}`;
      router.replace(destination as any);
    })();
  }, [isInitialized, profile, role, ready, callbackType, refreshProfile, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={Colors.orange} size="large" />
    </View>
  );
}

const styles = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
}));
