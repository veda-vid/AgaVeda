// stores/postInteractionsStore.ts — Optimistic post interaction cache for feed scroll persistence

import { create } from 'zustand';
import { likePost, unlikePost, repostPost, unrepostPost, savePost, unsavePost } from '../lib/api';
import { useProfileMediaStore } from './profileMediaStore';

export type PostInteractionSeed = {
  id: string;
  is_liked?: boolean;
  is_saved?: boolean;
  is_reposted?: boolean;
  total_likes?: number;
  total_reposts?: number;
  total_comments?: number;
};

export type PostInteractionState = {
  isLiked: boolean;
  isSaved: boolean;
  isReposted: boolean;
  likeCount: number;
  repostCount: number;
  commentCount: number;
};

const DEFAULT: PostInteractionState = {
  isLiked: false,
  isSaved: false,
  isReposted: false,
  likeCount: 0,
  repostCount: 0,
  commentCount: 0,
};

type PostInteractionsStore = {
  byId: Record<string, PostInteractionState>;
  dirtyIds: Record<string, true>;
  inFlightIds: Record<string, true>;
  isRefreshing: boolean;
  version: number;
  hydrateFromPosts: (posts: PostInteractionSeed[]) => void;
  getInteraction: (postId: string, seed?: Partial<PostInteractionSeed>) => PostInteractionState;
  setRefreshing: (refreshing: boolean) => void;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  toggleSave: (postId: string, userId: string) => Promise<void>;
  toggleRepost: (postId: string, userId: string, shopId: string) => Promise<void>;
  bumpCommentCount: (postId: string, delta?: number) => void;
  addCommentOptimistic: (postId: string, delta?: number) => void;
  reset: () => void;
};

function seedToState(seed?: Partial<PostInteractionSeed>): PostInteractionState {
  return {
    isLiked: !!seed?.is_liked,
    isSaved: !!seed?.is_saved,
    isReposted: !!seed?.is_reposted,
    likeCount: seed?.total_likes ?? 0,
    repostCount: seed?.total_reposts ?? 0,
    commentCount: seed?.total_comments ?? 0,
  };
}

function matchesServerState(local: PostInteractionState, incoming: PostInteractionState) {
  return (
    local.isLiked === incoming.isLiked
    && local.isSaved === incoming.isSaved
    && local.isReposted === incoming.isReposted
    && local.likeCount === incoming.likeCount
    && local.repostCount === incoming.repostCount
    && local.commentCount === incoming.commentCount
  );
}

export const usePostInteractionsStore = create<PostInteractionsStore>((set, get) => ({
  byId: {},
  dirtyIds: {},
  inFlightIds: {},
  isRefreshing: false,
  version: 0,

  hydrateFromPosts: (posts) => {
    if (!posts.length) return;
    set(state => {
      const next = { ...state.byId };
      const nextDirty = { ...state.dirtyIds };
      let changed = false;

      for (const post of posts) {
        const incoming = seedToState(post);
        const existing = next[post.id];
        const isProtected = !!state.dirtyIds[post.id]
          || !!state.inFlightIds[post.id]
          || (state.isRefreshing && !!existing);

        if (isProtected) {
          if (existing && matchesServerState(existing, incoming)) {
            delete nextDirty[post.id];
          }
          continue;
        }

        if (
          !existing
          || existing.isLiked !== incoming.isLiked
          || existing.isSaved !== incoming.isSaved
          || existing.isReposted !== incoming.isReposted
          || existing.likeCount !== incoming.likeCount
          || existing.repostCount !== incoming.repostCount
          || existing.commentCount !== incoming.commentCount
        ) {
          next[post.id] = incoming;
          changed = true;
        }
      }

      return changed || Object.keys(nextDirty).length !== Object.keys(state.dirtyIds).length
        ? { byId: next, dirtyIds: nextDirty, version: state.version + 1 }
        : state;
    });
  },

  getInteraction: (postId, seed) => {
    const cached = get().byId[postId];
    if (cached) return cached;
    return seedToState(seed);
  },

  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),

  toggleLike: async (postId, userId) => {
    const current = get().getInteraction(postId);
    const nextLiked = !current.isLiked;
    const nextCount = Math.max(0, current.likeCount + (nextLiked ? 1 : -1));
    set(state => ({
      byId: {
        ...state.byId,
        [postId]: { ...current, isLiked: nextLiked, likeCount: nextCount },
      },
      dirtyIds: { ...state.dirtyIds, [postId]: true },
      inFlightIds: { ...state.inFlightIds, [postId]: true },
      version: state.version + 1,
    }));
    try {
      if (nextLiked) await likePost(userId, postId);
      else await unlikePost(userId, postId);
    } catch {
      set(state => ({
        byId: { ...state.byId, [postId]: current },
        version: state.version + 1,
      }));
    } finally {
      set(state => {
        const inFlight = { ...state.inFlightIds };
        delete inFlight[postId];
        return { inFlightIds: inFlight };
      });
    }
  },

  toggleSave: async (postId, userId) => {
    const current = get().getInteraction(postId);
    const nextSaved = !current.isSaved;
    set(state => ({
      byId: {
        ...state.byId,
        [postId]: { ...current, isSaved: nextSaved },
      },
      dirtyIds: { ...state.dirtyIds, [postId]: true },
      inFlightIds: { ...state.inFlightIds, [postId]: true },
      version: state.version + 1,
    }));
    try {
      if (nextSaved) await savePost(userId, postId);
      else await unsavePost(userId, postId);
    } catch {
      set(state => ({
        byId: { ...state.byId, [postId]: current },
        version: state.version + 1,
      }));
    } finally {
      set(state => {
        const inFlight = { ...state.inFlightIds };
        delete inFlight[postId];
        return { inFlightIds: inFlight };
      });
    }
  },

  toggleRepost: async (postId, userId, shopId) => {
    const current = get().getInteraction(postId);
    const nextReposted = !current.isReposted;
    const nextCount = Math.max(0, current.repostCount + (nextReposted ? 1 : -1));
    set(state => ({
      byId: {
        ...state.byId,
        [postId]: { ...current, isReposted: nextReposted, repostCount: nextCount },
      },
      dirtyIds: { ...state.dirtyIds, [postId]: true },
      inFlightIds: { ...state.inFlightIds, [postId]: true },
      version: state.version + 1,
    }));
    try {
      if (nextReposted) await repostPost(userId, postId, shopId, null);
      else await unrepostPost(userId, postId);
      useProfileMediaStore.getState().invalidateUserReposts();
    } catch {
      set(state => ({
        byId: { ...state.byId, [postId]: current },
        version: state.version + 1,
      }));
      throw new Error('Could not update repost');
    } finally {
      set(state => {
        const inFlight = { ...state.inFlightIds };
        delete inFlight[postId];
        return { inFlightIds: inFlight };
      });
    }
  },

  bumpCommentCount: (postId, delta = 1) => {
    set(state => {
      const current = state.byId[postId] ?? DEFAULT;
      return {
        byId: {
          ...state.byId,
          [postId]: { ...current, commentCount: Math.max(0, current.commentCount + delta) },
        },
        version: state.version + 1,
      };
    });
  },

  addCommentOptimistic: (postId, delta = 1) => {
    set(state => {
      const current = state.byId[postId] ?? DEFAULT;
      return {
        byId: {
          ...state.byId,
          [postId]: { ...current, commentCount: Math.max(0, current.commentCount + delta) },
        },
        dirtyIds: { ...state.dirtyIds, [postId]: true },
        version: state.version + 1,
      };
    });
  },

  reset: () => set({
    byId: {},
    dirtyIds: {},
    inFlightIds: {},
    isRefreshing: false,
    version: 0,
  }),
}));
