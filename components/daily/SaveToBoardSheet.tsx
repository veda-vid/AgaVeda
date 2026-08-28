// components/daily/SaveToBoardSheet.tsx — Pinterest-style Save to Board modal

import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, Platform,
} from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { useDailyBoardsStore } from '../../stores/dailyBoardsStore';
import type { CityNews } from '../../types';

type Props = {
  visible: boolean;
  userId: string;
  item: CityNews | null;
  onClose: () => void;
  onSaved?: (boardName: string) => void;
};

export function SaveToBoardSheet({ visible, userId, item, onClose, onSaved }: Props) {
  const boards = useDailyBoardsStore(s => s.boards);
  const hydrate = useDailyBoardsStore(s => s.hydrate);
  const createBoard = useDailyBoardsStore(s => s.createBoard);
  const saveToBoard = useDailyBoardsStore(s => s.saveToBoard);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && userId) void hydrate(userId);
  }, [visible, userId, hydrate]);

  useEffect(() => {
    if (!visible) {
      setCreating(false);
      setNewName('');
    }
  }, [visible]);

  const handleSave = async (boardId: string, boardName: string) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await saveToBoard(userId, boardId, item);
      onSaved?.(boardName);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const board = await createBoard(userId, newName.trim());
      if (item) await saveToBoard(userId, board.id, item);
      onSaved?.(board.name);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Save to Board</Text>
          {item ? (
            <View style={s.previewRow}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={s.previewImg} />
              ) : (
                <View style={[s.previewImg, s.previewFallback]} />
              )}
              <Text style={s.previewTitle} numberOfLines={2}>{item.title}</Text>
            </View>
          ) : null}

          {creating ? (
            <View style={s.createBox}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Board name (e.g. Chandigarh Local)"
                placeholderTextColor={Colors.dim}
                style={s.input}
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={() => void handleCreate()} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Create & Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCreating(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={s.createRow} onPress={() => setCreating(true)}>
                <View style={s.plusCircle}><Text style={s.plus}>+</Text></View>
                <Text style={s.createLabel}>Create New Board</Text>
              </TouchableOpacity>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {boards.map(board => (
                  <TouchableOpacity
                    key={board.id}
                    style={s.boardRow}
                    onPress={() => void handleSave(board.id, board.name)}
                    disabled={busy}
                  >
                    {board.cover_url ? (
                      <Image source={{ uri: board.cover_url }} style={s.boardThumb} />
                    ) : (
                      <View style={[s.boardThumb, s.boardThumbEmpty]}>
                        <Text style={s.boardThumbIcon}>📌</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.boardName}>{board.name}</Text>
                      <Text style={s.boardMeta}>{board.item_ids.length} pins</Text>
                    </View>
                    <Text style={s.saveChip}>Save</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
    // @ts-expect-error web backdrop
    backdropFilter: Platform.OS === 'web' ? 'blur(8px)' : undefined,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '78%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2,
    alignSelf: 'center', marginTop: 10, marginBottom: 10,
  },
  title: {
    color: Colors.text, fontSize: 18, fontFamily: Fonts.bodySemiBold,
    fontWeight: '800', textAlign: 'center', marginBottom: 12,
  },
  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  previewImg: { width: 56, height: 72, borderRadius: 10, backgroundColor: Colors.card },
  previewFallback: { backgroundColor: Colors.card },
  previewTitle: { flex: 1, color: Colors.sub, fontSize: 13, fontWeight: '600' },
  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: 6,
  },
  plusCircle: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  plus: { color: Colors.orange, fontSize: 28, fontWeight: '300', marginTop: -2 },
  createLabel: { color: Colors.text, fontWeight: '800', fontSize: 15 },
  boardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  boardThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.card },
  boardThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  boardThumbIcon: { fontSize: 18 },
  boardName: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  boardMeta: { color: Colors.dim, fontSize: 11, marginTop: 2 },
  saveChip: {
    color: Colors.white, backgroundColor: Colors.orange, overflow: 'hidden',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, fontWeight: '800', fontSize: 12,
  },
  createBox: { gap: 10, paddingVertical: 8 },
  input: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2,
    color: Colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  primaryText: { color: Colors.white, fontWeight: '800' },
  cancelText: { color: Colors.dim, textAlign: 'center', fontWeight: '600', paddingVertical: 8 },
});
