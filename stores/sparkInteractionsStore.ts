// stores/sparkInteractionsStore.ts — Global Spark interaction cache (persists across scroll/remount)

import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import {
  toggleSparkLike, toggleSparkRepost,
} from '../lib/api';
import { hapticLight } from '../lib/haptics';
import type { SparkHydrationSeed } from '../lib/sparkUtils';
import { useProfileMediaStore } from './profileMediaStore';

export type SparkInteractionState = {
  isLiked: boolean;
  isReposted: boolean;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  isFollowing: boolean;
};

const DEFAULT_INTERACTION: SparkInteractionState = {
  isLiked: false,
  isReposted: false,
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  isFollowing: false,
};

type SparkInteractionsStore = {
  byId: Record<string, SparkInteractionState>;
  /** Spark ids with optimistic local changes — skip server overwrite until settled */
  dirtyIds: Record<string, true>;
  version: number;
  hydrateFromSparks: (sparks: SparkHydrationSeed[]) => void;
  getInteraction: (sparkId: string, seed?: Partial<SparkHydrationSeed>) => SparkInteractionState;
  toggleLike: (sparkId: string, userId: string | undefined) => Promise<void>;
  toggleRepost: (sparkId: string, userId: string | undefined, shopId: string) => Promise<void>;
  bumpCommentCount: (sparkId: string, delta?: number) => void;
  setFollowing: (sparkId: string, following: boolean) => void;
  reset: () => void;
};

function seedToState(seed?: Partial<SparkHydrationSeed>): SparkInteractionState {
  return {
    isLiked: !!seed?.is_liked,
    isReposted: !!seed?.is_reposted,
    likeCount: seed?.total_likes ?? 0,
    commentCount: seed?.total_comments ?? 0,
    repostCount: seed?.total_reposts ?? 0,
    isFollowing: !!seed?.is_following,
  };
}

function showSparkError(message: string) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([0, 20, 60, 20]);
    }
  } catch { /* noop */ }
  Toast.show({
    type: 'error',
    text1: 'Action failed',
    text2: message,
    visibilityTime: 2800,
  });
}

export const useSparkInteractionsStore = create<SparkInteractionsStore>((set, get) => ({
  byId: {},
  dirtyIds: {},
  version: 0,

  hydrateFromSparks: (sparks) => {
    if (!sparks.length) return;
    set(state => {
      const next = { ...state.byId };
      let changed = false;
      for (const spark of sparks) {
        if (state.dirtyIds[spark.id]) continue;
        const incoming = seedToState(spark);
        const existing = next[spark.id];
        if (
          !existing
          || existing.isLiked !== incoming.isLiked
          || existing.isReposted !== incoming.isReposted
          || existing.likeCount !== incoming.likeCount
          || existing.commentCount !== incoming.commentCount
          || existing.repostCount !== incoming.repostCount
          || existing.isFollowing !== incoming.isFollowing
        ) {
          next[spark.id] = incoming;
          changed = true;
        }
      }
      if (!changed) return state;
      return { ...state, byId: next, version: state.version + 1 };
    });
  },

  getInteraction: (sparkId, seed) => {
    const cached = get().byId[sparkId];
    if (cached) return cached;
    return seedToState(seed);
  },

  toggleLike: async (sparkId, userId) => {
    if (!userId) {
      showSparkError('Sign in to like Sparks.');
      return;
    }
    const prev = get().getInteraction(sparkId);
    const nextLiked = !prev.isLiked;
    const nextCount = Math.max(0, prev.likeCount + (nextLiked ? 1 : -1));

    hapticLight();
    set(state => ({
      dirtyIds: { ...state.dirtyIds, [sparkId]: true },
      byId: {
        ...state.byId,
        [sparkId]: { ...prev, isLiked: nextLiked, likeCount: nextCount },
      },
      version: state.version + 1,
    }));

    try {
      await toggleSparkLike(userId, sparkId, nextLiked);
      set(state => {
        const { [sparkId]: _omit, ...dirtyIds } = state.dirtyIds;
        return { dirtyIds, version: state.version + 1 };
      });
    } catch (e: any) {
      set(state => {
        const { [sparkId]: _omit, ...dirtyIds } = state.dirtyIds;
        return {
          dirtyIds,
          byId: { ...state.byId, [sparkId]: prev },
          version: state.version + 1,
        };
      });
      showSparkError(e?.message || 'Could not update like. Please try again.');
    }
  },

  toggleRepost: async (sparkId, userId, shopId) => {
    if (!userId) {
      showSparkError('Sign in to repost Sparks.');
      return;
    }
    const prev = get().getInteraction(sparkId);
    const nextReposted = !prev.isReposted;
    const nextCount = Math.max(0, prev.repostCount + (nextReposted ? 1 : -1));

    hapticLight();
    set(state => ({
      dirtyIds: { ...state.dirtyIds, [sparkId]: true },
      byId: {
        ...state.byId,
        [sparkId]: { ...prev, isReposted: nextReposted, repostCount: nextCount },
      },
      version: state.version + 1,
    }));

    try {
      await toggleSparkRepost(userId, sparkId, shopId, nextReposted);
      set(state => {
        const { [sparkId]: _omit, ...dirtyIds } = state.dirtyIds;
        return { dirtyIds, version: state.version + 1 };
      });
      useProfileMediaStore.getState().invalidateUserReposts();
    } catch (e: any) {
      set(state => {
        const { [sparkId]: _omit, ...dirtyIds } = state.dirtyIds;
        return {
          dirtyIds,
          byId: { ...state.byId, [sparkId]: prev },
          version: state.version + 1,
        };
      });
      showSparkError(e?.message || 'Could not update repost. Please try again.');
    }
  },

  setFollowing: (sparkId, following) => {
    set(state => {
      const prev = state.byId[sparkId] ?? { ...DEFAULT_INTERACTION };
      return {
        byId: { ...state.byId, [sparkId]: { ...prev, isFollowing: following } },
        version: state.version + 1,
      };
    });
  },

  bumpCommentCount: (sparkId, delta = 1) => {
    set(state => {
      const prev = state.byId[sparkId] ?? { ...DEFAULT_INTERACTION };
      return {
        byId: {
          ...state.byId,
          [sparkId]: {
            ...prev,
            commentCount: Math.max(0, prev.commentCount + delta),
          },
        },
        version: state.version + 1,
      };
    });
  },

  reset: () => set({ byId: {}, dirtyIds: {}, version: 0 }),
}));
