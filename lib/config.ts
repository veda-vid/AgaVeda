// lib/config.ts — runtime config + demo-mode detection

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawAnon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const looksPlaceholder =
  !rawUrl ||
  !rawAnon ||
  rawUrl.includes('YOUR_PROJECT_REF') ||
  rawUrl.includes('xxxxx.supabase') ||
  rawAnon.includes('YOUR_ANON_KEY') ||
  rawAnon === 'eyJ...' ||
  rawAnon.length < 20;

/** True when no real Supabase project is configured */
export const isDemoAuthEnabled = (): boolean => {
  if (process.env.EXPO_PUBLIC_DEMO_AUTH === '1' || process.env.EXPO_PUBLIC_DEMO_AUTH === 'true') {
    return true;
  }
  return looksPlaceholder;
};

export const getSupabaseConfig = () => ({
  url: rawUrl,
  anonKey: rawAnon,
  isDemo: isDemoAuthEnabled(),
});

export const friendlyAuthNetworkError = (err: unknown): string => {
  const msg = String((err as any)?.message || err || '');
  if (/failed to fetch|network request failed|fetch failed|load failed/i.test(msg)) {
    if (isDemoAuthEnabled()) {
      return 'Local demo auth is enabled, but something went wrong. Refresh and try again.';
    }
    return 'Cannot reach Supabase (Failed to fetch). Set real EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart Expo.';
  }
  return msg || 'Authentication failed.';
};
