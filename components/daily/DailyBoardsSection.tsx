// components/daily/DailyBoardsSection.tsx — Profile Saved Boards (Pinterest-style)

import { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Modal, ScrollView, useWindowDimensions,
} from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { hapticLight } from '../../lib/haptics';
import { unicodeProsStyle } from '../../lib/profileUtils';
import { useDailyBoardsStore, type DailyBoard } from '../../stores/dailyBoardsStore';
import type { CityNews } from '../../types';

type Props = {
  userId: string;
  onOpenItem?: (item: CityNews) => void;
};

export function DailyBoardsSection({ userId, onOpenItem }: Props) {
  const { width } = useWindowDimensions();
  const hydrate = useDailyBoardsStore(s => s.hydrate);
  const boards = useDailyBoardsStore(s => s.boards);
  const items = useDailyBoardsStore(s => s.items);
  const [active, setActive] = useState<DailyBoard | null>(null);

  useEffect(() => {
    if (userId) void hydrate(userId);
  }, [userId, hydrate]);

  const colW = Math.min(160, Math.floor((width - 48) / 2) - 6);

  const openBoard = (board: DailyBoard) => {
    void hapticLight();
    setActive(board);
  };

  const openPin = (item: CityNews) => {
    void hapticLight();
    onOpenItem?.(item);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Saved Boards</Text>
      <Text style={s.sub}>Daily pins · City news, rates & events</Text>
      <View style={s.grid}>
        {boards.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No boards yet</Text>
            <Text style={s.emptyBody}>Pin a Daily story to create your first board.</Text>
          </View>
        ) : boards.map(board => {
          const cover = board.cover_url || (board.item_ids[0] ? items[board.item_ids[0]]?.image_url : null);
          return (
            <TouchableOpacity
              key={board.id}
              style={[s.boardCard, { width: colW }]}
              onPress={() => openBoard(board)}
              activeOpacity={0.9}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={s.cover} />
              ) : (
                <View style={[s.cover, s.coverEmpty]}>
                  <Text style={s.coverEmoji}>📌</Text>
                </View>
              )}
              <Text style={[s.name, unicodeProsStyle]} numberOfLines={1}>{board.name}</Text>
              <Text style={s.meta}>{board.item_ids.length} pins</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setActive(null)}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, unicodeProsStyle]}>{active?.name}</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            {(active?.item_ids || []).map(id => {
              const item = items[id];
              if (!item) return null;
              return (
                <TouchableOpacity
                  key={id}
                  style={s.pinRow}
                  onPress={() => openPin(item)}
                  activeOpacity={0.85}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={s.pinThumb} />
                  ) : (
                    <View style={[s.pinThumb, s.coverEmpty]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pinTitle, unicodeProsStyle]} numberOfLines={2}>{item.title}</Text>
                    <Text style={s.pinMeta}>{item.city} · {item.category}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!active?.item_ids.length ? (
              <Text style={s.empty}>No pins yet — save stories from Daily with +.</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, width: '100%' },
  heading: { color: Colors.text, fontSize: 18, fontFamily: Fonts.bodySemiBold, fontWeight: '800' },
  sub: { color: Colors.dim, fontSize: 12, marginTop: 2, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  boardCard: { marginBottom: 4 },
  emptyBox: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 4,
    color: Colors.dim,
    fontSize: 12,
    textAlign: 'center',
  },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: Colors.card },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 28 },
  name: { color: Colors.text, fontWeight: '800', fontSize: 13, marginTop: 8 },
  meta: { color: Colors.dim, fontSize: 11, marginTop: 2 },
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  close: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  modalBody: { padding: 16, gap: 10 },
  pinRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  pinThumb: { width: 56, height: 72, borderRadius: 10, backgroundColor: Colors.surface },
  pinTitle: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  pinMeta: { color: Colors.dim, fontSize: 11, marginTop: 4 },
  empty: { color: Colors.dim, textAlign: 'center', marginTop: 40 },
}));
