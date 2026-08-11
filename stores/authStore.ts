// stores/authStore.ts — Global auth state with Zustand (supports demo + Supabase)

import { create } from 'zustand';
import { getAuthSession, getSupabase, isDemoAuthEnabled, signOut as authSignOut } from '../lib/supabase';
import {
  getProfile,
  getFollowedShopIds,
  followShop,
  unfollowShop,
  getNotifications,
  markNotificationsRead,
} from '../lib/api';
import type { Profile, Notification } from '../types';

interface AuthStore {
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  followedShopIds: string[];
  notifications: string[];
  dbNotifications: Notification[];

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => void;
  loadFollows: (userId: string) => Promise<void>;
  toggleFollowedShop: (shopId: string, shopName?: string) => Promise<void>;
  loadNotifications: (userId: string) => Promise<void>;
  addNotification: (message: string) => void;
  clearNotifications: () => Promise<void>;
  signOut: () => Promise<void>;
}

let authListenerAttached = false;

async function loadUserExtras(userId: string, set: (partial: Partial<AuthStore>) => void) {
  if (isDemoAuthEnabled()) {
    set({ followedShopIds: [], dbNotifications: [], notifications: [] });
    return;
  }
  const [ids, notes] = await Promise.all([
    getFollowedShopIds(userId).catch(() => [] as string[]),
    getNotifications(userId).catch(() => [] as Notification[]),
  ]);
  set({
    followedShopIds: ids,
    dbNotifications: notes,
    notifications: notes.map(n => `${n.title}: ${n.body}`),
  });
}

async function applySession(userId: string | undefined, set: (partial: Partial<AuthStore>) => void) {
  if (!userId) {
    set({
      profile: null,
      isLoading: false,
      isInitialized: true,
      followedShopIds: [],
      notifications: [],
      dbNotifications: [],
    });
    return;
  }
  try {
    const profile = await getProfile(userId);
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-debug',hypothesisId:'H2',location:'stores/authStore.ts:applySession:profileLoaded',message:'auth profile loaded',data:{role:profile?.role ?? null,hasCity:!!profile?.city,hasLatLng:profile?.lat != null && profile?.lng != null,lat:profile?.lat ?? null,lng:profile?.lng ?? null,radius_km:profile?.radius_km ?? null,hasAvatarUrl:!!profile?.avatar_url},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'auth-profile-debug',hypothesisId:'H5',location:'stores/authStore.ts:66',message:'profile loaded during auth session apply',data:{hasProfile:true,role:profile.role,hasAvatarUrl:!!profile.avatar_url,hasCity:!!profile.city},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    set({ profile, isLoading: false, isInitialized: true });
    loadUserExtras(userId, set).catch(() => {});
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-debug',hypothesisId:'H2',location:'stores/authStore.ts:applySession:profileMissing',message:'auth profile missing during applySession',data:{hasUserId:!!userId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'auth-profile-debug',hypothesisId:'H5',location:'stores/authStore.ts:70',message:'profile missing during auth session apply',data:{hasProfile:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Authenticated but profile missing — keep session usable for location onboarding
    set({ profile: null, isLoading: false, isInitialized: true });
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  profile: null,
  isLoading: false,
  isInitialized: false,
  followedShopIds: [],
  notifications: [],
  dbNotifications: [],

  initialize: async () => {
    if (get().isInitialized && authListenerAttached) return;
    set({ isLoading: true });
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-init-debug',hypothesisId:'H6',location:'stores/authStore.ts:initialize:start',message:'auth initialize called',data:{isInitialized:get().isInitialized,authListenerAttached},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      if (isDemoAuthEnabled()) {
        authListenerAttached = true;
        const { data } = await getAuthSession();
        // #region agent log
        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-init-debug',hypothesisId:'H6',location:'stores/authStore.ts:initialize:demoAuthSession',message:'demo auth session fetched',data:{hasSession:!!data?.session,hasUser:!!data?.session?.user},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        await applySession(data.session?.user?.id, set);
        return;
      }

      const supabase = getSupabase();
      if (!authListenerAttached) {
        authListenerAttached = true;
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'INITIAL_SESSION') return;
          applySession(session?.user?.id, set);
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-init-debug',hypothesisId:'H6',location:'stores/authStore.ts:initialize:getSession',message:'supabase session fetched',data:{hasSession:!!session,hasUser:!!session?.user,roleHint:session?.user?.user_metadata?.role ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await applySession(session?.user?.id, set);
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'auth-init-debug',hypothesisId:'H6',location:'stores/authStore.ts:initialize:catch',message:'auth initialize threw',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      set({ isLoading: false, isInitialized: true });
    }
  },

  refreshProfile: async () => {
    const { data } = await getAuthSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    const profile = await getProfile(userId);
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'auth-profile-debug',hypothesisId:'H5',location:'stores/authStore.ts:118',message:'profile refreshed explicitly',data:{role:profile.role,hasAvatarUrl:!!profile.avatar_url,hasCity:!!profile.city},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    set({ profile });
    await loadUserExtras(userId, set);
  },

  updateProfile: (updates) => {
    set(state => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    }));
  },

  loadFollows: async (userId) => {
    if (isDemoAuthEnabled()) return;
    const ids = await getFollowedShopIds(userId);
    set({ followedShopIds: ids });
  },

  toggleFollowedShop: async (shopId, shopName) => {
    const { profile, followedShopIds } = get();
    if (!profile) return;
    const exists = followedShopIds.includes(shopId);
    const nextIds = exists
      ? followedShopIds.filter(id => id !== shopId)
      : [...followedShopIds, shopId];

    set(state => ({
      followedShopIds: nextIds,
      notifications: exists
        ? state.notifications.filter(msg => !msg.includes(shopName ?? ''))
        : [shopName ? `You are now following ${shopName}` : 'You started following a shop', ...state.notifications].slice(0, 8),
    }));

    if (isDemoAuthEnabled()) return;

    try {
      if (exists) await unfollowShop(profile.id, shopId);
      else await followShop(profile.id, shopId);
    } catch (e) {
      set({ followedShopIds });
      console.error('Follow toggle failed', e);
    }
  },

  loadNotifications: async (userId) => {
    if (isDemoAuthEnabled()) return;
    const notes = await getNotifications(userId);
    set({
      dbNotifications: notes,
      notifications: notes.map(n => `${n.title}: ${n.body}`),
    });
  },

  addNotification: (message) => {
    set(state => ({ notifications: [message, ...state.notifications].slice(0, 8) }));
  },

  clearNotifications: async () => {
    const { profile } = get();
    set({ notifications: [], dbNotifications: [] });
    if (profile && !isDemoAuthEnabled()) {
      try { await markNotificationsRead(profile.id); } catch {}
    }
  },

  signOut: async () => {
    // Even if Supabase signOut fails (e.g. network), we still want to clear local state
    // so the UI/route guard immediately reflects the logged-out state.
    try {
      await authSignOut();
    } catch (e) {
      console.error('Sign out failed', e);
    } finally {
      set({
        profile: null,
        followedShopIds: [],
        notifications: [],
        dbNotifications: [],
      });
    }
  },
}));
