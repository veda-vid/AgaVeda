// stores/feedMediaStore.ts — Global feed video mute state (Posts + Sparks)

import { create } from 'zustand';

type FeedMediaStore = {
  globalMuted: boolean;
  toggleGlobalMute: () => void;
  setGlobalMuted: (muted: boolean) => void;
};

export const useFeedMediaStore = create<FeedMediaStore>((set) => ({
  globalMuted: true,
  toggleGlobalMute: () => set(state => ({ globalMuted: !state.globalMuted })),
  setGlobalMuted: (muted) => set({ globalMuted: muted }),
}));
