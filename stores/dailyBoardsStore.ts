// stores/dailyBoardsStore.ts — Pinterest-style Daily boards (AsyncStorage + Supabase)

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createDailyBoardRemote,
  fetchDailyBoardsRemote,
  removeDailyPinEverywhereRemote,
  removeDailyPinRemote,
  upsertDailyPinRemote,
} from '../lib/api';
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
  syncing: boolean;
  hydrate: (userId: string) => Promise<void>;
  syncFromRemote: (userId: string) => Promise<void>;
  createBoard: (userId: string, name: string) => Promise<DailyBoard>;
  saveToBoard: (userId: string, boardId: string, news: CityNews) => Promise<void>;
  removeFromBoard: (userId: string, boardId: string, newsId: string) => Promise<void>;
  togglePin: (userId: string, news: CityNews) => Promise<boolean>;
  isSaved: (newsId: string) => boolean;
  boardsForItem: (newsId: string) => DailyBoard[];
  getSavedPins: () => CityNews[];
};

const DEFAULT_BOARDS: Array<{ name: string }> = [
  { name: 'City Events' },
  { name: 'Local Market Deals' },
  { name: 'Rates & Economy' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id: string) {
  return UUID_RE.test(id);
}

function storageKey(userId: string) {
  return `daily-boards:v3:${userId}`;
}

async function persistLocal(userId: string, state: Persisted) {
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

function mapRemoteToLocal(remote: Awaited<ReturnType<typeof fetchDailyBoardsRemote>>): Persisted {
  const items: Record<string, CityNews> = {};
  const boards: DailyBoard[] = remote.map(board => {
    const pins = board.daily_pins ?? [];
    const itemIds: string[] = [];
    for (const pin of pins) {
      itemIds.push(pin.news_id);
      if (pin.item_snapshot && typeof pin.item_snapshot === 'object') {
        items[pin.news_id] = pin.item_snapshot as CityNews;
      }
    }
    return {
      id: board.id,
      name: board.name,
      created_at: board.created_at,
      cover_url: board.cover_url,
      item_ids: itemIds,
    };
  });
  return { boards, items };
}

function applyPinToBoards(
  boards: DailyBoard[],
  boardId: string,
  news: CityNews,
  add: boolean,
): DailyBoard[] {
  return boards.map(b => {
    if (b.id !== boardId) return b;
    const has = b.item_ids.includes(news.id);
    if (add) {
      if (has) return { ...b, cover_url: b.cover_url || news.image_url };
      return {
        ...b,
        item_ids: [news.id, ...b.item_ids],
        cover_url: news.image_url || b.cover_url,
      };
    }
    return {
      ...b,
      item_ids: b.item_ids.filter(id => id !== news.id),
    };
  });
}

/** Ensure a board has a real UUID before writing pins remotely. */
async function ensureRemoteBoard(
  userId: string,
  board: DailyBoard,
): Promise<DailyBoard> {
  if (isUuid(board.id)) return board;
  const remote = await createDailyBoardRemote(userId, board.name);
  const next: DailyBoard = {
    id: remote.id,
    name: remote.name,
    created_at: remote.created_at,
    cover_url: board.cover_url ?? remote.cover_url,
    item_ids: board.item_ids,
  };
  const boards = getBoardsReplacingId(useDailyBoardsStore.getState().boards, board.id, next);
  const items = useDailyBoardsStore.getState().items;
  useDailyBoardsStore.setState({ boards });
  await persistLocal(userId, { boards, items });
  return next;
}

function getBoardsReplacingId(boards: DailyBoard[], oldId: string, next: DailyBoard) {
  const withoutDupName = boards.filter(b => b.id !== oldId && b.id !== next.id);
  return [next, ...withoutDupName];
}

export const useDailyBoardsStore = create<DailyBoardsStore>((set, get) => ({
  boards: [],
  items: {},
  hydrated: false,
  syncing: false,

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
      } else {
        const boards = makeDefaultBoards();
        set({ boards, items: {}, hydrated: true });
        await persistLocal(userId, { boards, items: {} });
      }
    } catch {
      set({ boards: makeDefaultBoards(), items: {}, hydrated: true });
    }
    void get().syncFromRemote(userId);
  },

  syncFromRemote: async (userId: string) => {
    set({ syncing: true });
    try {
      const local = get();
      let remote = await fetchDailyBoardsRemote(userId);

      if (!remote.length) {
        // Create remote boards and migrate any local placeholder pins by board name.
        const created = [];
        for (const localBoard of (local.boards.length ? local.boards : makeDefaultBoards())) {
          const row = await createDailyBoardRemote(userId, localBoard.name);
          for (const newsId of localBoard.item_ids) {
            const snap = local.items[newsId];
            if (snap) {
              try {
                await upsertDailyPinRemote(userId, row.id, newsId, snap);
              } catch { /* continue */ }
            }
          }
          created.push({ ...row, daily_pins: [] as any[] });
        }
        remote = await fetchDailyBoardsRemote(userId);
        if (!remote.length) remote = created;
      }

      const mapped = mapRemoteToLocal(remote);
      // Keep local snapshots that remote didn't return yet.
      const items = { ...local.items, ...mapped.items };
      set({ boards: mapped.boards.length ? mapped.boards : local.boards, items });
      await persistLocal(userId, {
        boards: mapped.boards.length ? mapped.boards : local.boards,
        items,
      });
    } catch {
      // Keep local cache when offline
    } finally {
      set({ syncing: false });
    }
  },

  createBoard: async (userId, name) => {
    const localBoard: DailyBoard = {
      id: `board-${Date.now()}`,
      name: name.trim() || 'New Board',
      created_at: new Date().toISOString(),
      cover_url: null,
      item_ids: [],
    };

    let board = localBoard;
    try {
      const remote = await createDailyBoardRemote(userId, name);
      board = {
        id: remote.id,
        name: remote.name,
        created_at: remote.created_at,
        cover_url: remote.cover_url,
        item_ids: [],
      };
    } catch { /* offline — keep local id */ }

    const boards = [board, ...get().boards];
    const snapshot = { boards, items: get().items };
    set({ boards });
    await persistLocal(userId, snapshot);
    return board;
  },

  saveToBoard: async (userId, boardId, news) => {
    let board = get().boards.find(b => b.id === boardId);
    if (!board) throw new Error('Board not found');
    try {
      board = await ensureRemoteBoard(userId, board);
    } catch {
      // Offline — still pin locally with placeholder id
    }

    const targetId = board.id;
    const items = { ...get().items, [news.id]: news };
    const boards = applyPinToBoards(get().boards, targetId, news, true);
    set({ boards, items });
    await persistLocal(userId, { boards, items });

    if (!isUuid(targetId)) return;

    try {
      await upsertDailyPinRemote(userId, targetId, news.id, news);
      const cover = news.image_url;
      if (cover) {
        set({
          boards: get().boards.map(b => (
            b.id === targetId ? { ...b, cover_url: cover } : b
          )),
        });
      }
    } catch { /* local pin already applied */ }
  },

  removeFromBoard: async (userId, boardId, newsId) => {
    const boards = get().boards.map(b => (
      b.id === boardId
        ? { ...b, item_ids: b.item_ids.filter(id => id !== newsId) }
        : b
    ));
    const stillSaved = boards.some(b => b.item_ids.includes(newsId));
    const items = { ...get().items };
    if (!stillSaved) delete items[newsId];
    set({ boards, items });
    await persistLocal(userId, { boards, items });

    if (!isUuid(boardId)) return;
    try {
      await removeDailyPinRemote(userId, boardId, newsId);
    } catch { /* noop */ }
  },

  togglePin: async (userId, news) => {
    if (!get().hydrated) {
      await get().hydrate(userId);
    }

    const saved = get().isSaved(news.id);
    if (saved) {
      const boards = get().boards.map(b => ({
        ...b,
        item_ids: b.item_ids.filter(id => id !== news.id),
      }));
      const items = { ...get().items };
      delete items[news.id];
      set({ boards, items });
      await persistLocal(userId, { boards, items });
      try {
        await removeDailyPinEverywhereRemote(userId, news.id);
      } catch { /* noop */ }
      return false;
    }

    let target = get().boards[0];
    if (!target) {
      target = await get().createBoard(userId, DEFAULT_BOARDS[0].name);
    }
    try {
      target = await ensureRemoteBoard(userId, target);
    } catch {
      // Offline pin still works locally
    }

    const items = { ...get().items, [news.id]: news };
    const boards = applyPinToBoards(get().boards, target.id, news, true);
    set({ boards, items });
    await persistLocal(userId, { boards, items });

    if (isUuid(target.id)) {
      try {
        await upsertDailyPinRemote(userId, target.id, news.id, news);
      } catch { /* noop */ }
    }
    return true;
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
