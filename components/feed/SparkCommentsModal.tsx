import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { createSparkComment, getSparkComments } from '../../lib/api';
import { useSparkInteractionsStore } from '../../stores/sparkInteractionsStore';
import type { SparkComment } from '../../types';

type SparkCommentsModalProps = {
  visible: boolean;
  sparkId: string | null;
  userId?: string;
  onClose: () => void;
};

export function SparkCommentsModal({
  visible,
  sparkId,
  userId,
  onClose,
}: SparkCommentsModalProps) {
  const [comments, setComments] = useState<SparkComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState('');
  const bumpCommentCount = useSparkInteractionsStore(s => s.bumpCommentCount);

  const loadComments = useCallback(async () => {
    if (!sparkId) return;
    setLoading(true);
    try {
      setComments(await getSparkComments(sparkId));
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [sparkId]);

  useEffect(() => {
    if (!visible || !sparkId) {
      setDraft('');
      return;
    }
    void loadComments();
  }, [visible, sparkId, loadComments]);

  const submit = async () => {
    if (!sparkId || !userId || !draft.trim() || posting) return;
    const body = draft.trim();
    const optimistic: SparkComment = {
      id: `temp-${Date.now()}`,
      spark_id: sparkId,
      user_id: userId,
      body,
      text: body,
      created_at: new Date().toISOString(),
      user: { id: userId, name: 'You', avatar_url: null },
    };
    setPosting(true);
    setDraft('');
    setComments(prev => [...prev, optimistic]);
    bumpCommentCount(sparkId, 1);
    try {
      const created = await createSparkComment(userId, sparkId, body);
      setComments(prev => prev.map(row => (row.id === optimistic.id ? created : row)));
    } catch {
      setComments(prev => prev.filter(row => row.id !== optimistic.id));
      bumpCommentCount(sparkId, -1);
      setDraft(body);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Comments</Text>

          {loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              style={s.list}
              contentContainerStyle={comments.length ? s.listContent : s.listEmptyWrap}
              ListEmptyComponent={
                <Text style={s.emptyText}>No comments yet. Start the conversation.</Text>
              }
              renderItem={({ item }) => (
                <View style={s.commentRow}>
                  <Text style={s.commentUser}>{item.user?.name ?? 'User'}</Text>
                  <Text style={s.commentBody}>{item.body ?? item.text}</Text>
                </View>
              )}
            />
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add a comment…"
                placeholderTextColor={Colors.dim}
                style={s.input}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={() => void submit()}
                disabled={!draft.trim() || posting || !userId}
                style={[s.postBtn, (!draft.trim() || posting || !userId) && s.postBtnDisabled]}
              >
                <Text style={s.postBtnText}>{posting ? '…' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '72%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    marginBottom: 8,
  },
  list: { maxHeight: 360 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  listEmptyWrap: { paddingHorizontal: 16, paddingVertical: 24 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14 },
  commentRow: { gap: 2, paddingVertical: 4 },
  commentUser: { color: Colors.text, fontWeight: '800', fontSize: 13 },
  commentBody: { color: Colors.sub, fontSize: 14, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  postBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
});
