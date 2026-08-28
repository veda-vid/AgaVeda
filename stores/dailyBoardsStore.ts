// stores/dailyBoardsStore.ts — Pinterest-style Daily boards (local AsyncStorage)

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CityNews } from '../types';

export type DailyBoard = {
  id: string;
  name: string;
  created_at: string;
  cover_url?: string | null;
  item_ids: string[];
};

type Persisted = {
  boards: DailyBoard[];
  items: Record<string, CityNews>;
};

type DailyBoardsStore = {
  boards: DailyBoard[];
  items: Record<string, CityNews>;
  hydrated: boolean;
  hydrate: (userId: string) => Promise<void>;
  createBoard: (userId: string, name: string) => Promise<DailyBoard>;
  saveToBoard: (userId: string, boardId: string, news: CityNews) => Promise<void>;
  removeFromBoard: (userId: string, boardId: string, newsId: string) => Promise<void>;
  isSaved: (newsId: string) => boolean;
  boardsForItem: (newsId: string) => DailyBoard[];
  /** Unique saved pins across all boards (newest board order). */
  getSavedPins: () => CityNews[];
};

const DEFAULT_BOARDS: Array<{ name: string }> = [
  { name: 'City Events' },
  { name: 'Local Market Deals' },
  { name: 'Rates & Economy' },
];

function storageKey(userId: string) {
  return `daily-boards:v1:${userId}`;
}

async function persist(userId: string, state: Persisted) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

function makeDefaultBoards(): DailyBoard[] {
  const now = new Date().toISOString();
  return DEFAULT_BOARDS.map((b, i) => ({
    id: `board-default-${i}-${b.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: b.name,
    created_at: now,
    cover_url: null,
    item_ids: [],
  }));
}

export const useDailyBoardsStore = create<DailyBoardsStore>((set, get) => ({
  boards: [],
  items: {},
  hydrated: false,

  hydrate: async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        set({
          boards: parsed.boards?.length ? parsed.boards : makeDefaultBoards(),
          items: parsed.items || {},
          hydrated: true,
        });
        return;
      }
      const boards = makeDefaultBoards();
      set({ boards, items: {}, hydrated: true });
      await persist(userId, { boards, items: {} });
    } catch {
      set({ boards: makeDefaultBoards(), items: {}, hydrated: true });
    }
  },

  createBoard: async (userId, name) => {
    const board: DailyBoard = {
      id: `board-${Date.now()}`,
      name: name.trim() || 'New Board',
      created_at: new Date().toISOString(),
      cover_url: null,
      item_ids: [],
    };
    const boards = [board, ...get().boards];
    set({ boards });
    await persist(userId, { boards, items: get().items });
    return board;
  },

  saveToBoard: async (userId, boardId, news) => {
    const items = { ...get().items, [news.id]: news };
    const boards = get().boards.map(b => {
      if (b.id !== boardId) return b;
      if (b.item_ids.includes(news.id)) return { ...b, cover_url: b.cover_url || news.image_url };
      return {
        ...b,
        item_ids: [news.id, ...b.item_ids],
        cover_url: news.image_url || b.cover_url,
      };
    });
    set({ boards, items });
    await persist(userId, { boards, items });
  },

  removeFromBoard: async (userId, boardId, newsId) => {
    const boards = get().boards.map(b => (
      b.id === boardId
        ? { ...b, item_ids: b.item_ids.filter(id => id !== newsId) }
        : b
    ));
    set({ boards });
    await persist(userId, { boards, items: get().items });
  },

  isSaved: (newsId) => get().boards.some(b => b.item_ids.includes(newsId)),

  boardsForItem: (newsId) => get().boards.filter(b => b.item_ids.includes(newsId)),

  getSavedPins: () => {
    const { boards, items } = get();
    const seen = new Set<string>();
    const pins: CityNews[] = [];
    for (const board of boards) {
      for (const id of board.item_ids) {
        if (seen.has(id) || !items[id]) continue;
        seen.add(id);
        pins.push(items[id]);
      }
    }
    return pins;
  },
}));
