// stores/profileMediaStore.ts — Invalidate profile reposts / videos after Spark actions

import { create } from 'zustand';

type ProfileMediaStore = {
  /** Bumps when reposts or sparks collections should refetch */
  repostsRevision: number;
  sparksRevision: number;
  invalidateUserReposts: () => void;
  invalidateUserSparks: () => void;
  invalidateAll: () => void;
  reset: () => void;
};

export const useProfileMediaStore = create<ProfileMediaStore>((set) => ({
  repostsRevision: 0,
  sparksRevision: 0,
  invalidateUserReposts: () => set(s => ({ repostsRevision: s.repostsRevision + 1 })),
  invalidateUserSparks: () => set(s => ({ sparksRevision: s.sparksRevision + 1 })),
  invalidateAll: () => set(s => ({
    repostsRevision: s.repostsRevision + 1,
    sparksRevision: s.sparksRevision + 1,
  })),
  reset: () => set({ repostsRevision: 0, sparksRevision: 0 }),
}));
