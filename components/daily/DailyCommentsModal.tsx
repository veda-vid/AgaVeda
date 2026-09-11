// components/daily/DailyCommentsModal.tsx — Threaded comments bottom sheet for Daily articles

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { addCityNewsComment, getCityNewsComments } from '../../lib/api';
import {
  addLiveDailyComment,
  fetchDailyComments,
  postDailyComment,
} from '../../lib/dailyPublicFeed';
import { formatTimeAgo, unicodeContentStyle } from './dailyShared';
import { useAuthStore } from '../../stores/authStore';
import type { CityNews, CityNewsComment } from '../../types';

type DailyCommentsModalProps = {
  visible: boolean;
  item: CityNews | null;
  userId?: string;
  onClose: () => void;
  onCommentPosted?: (newsId: string, totalComments: number) => void;
};

function CommentRow({ comment }: { comment: CityNewsComment }) {
  const avatar = comment.user?.avatar_url;
  const name = comment.user?.name?.trim() || 'Reader';
  return (
    <View style={s.commentRow}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={s.commentBody}>
        <View style={s.commentMeta}>
          <Text style={[s.commentUser, unicodeContentStyle]} numberOfLines={1}>{name}</Text>
          <Text style={s.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
        </View>
        <Text style={[s.commentText, unicodeContentStyle]}>{comment.text}</Text>
      </View>
    </View>
  );
}

export function DailyCommentsModal({
  visible,
  item,
  userId,
  onClose,
  onCommentPosted,
}: DailyCommentsModalProps) {
  const profile = useAuthStore(s => s.profile);
  const [comments, setComments] = useState<CityNewsComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState('');

  const loadComments = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      setComments(await fetchDailyComments(item.id, userId));
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [item, userId]);

  useEffect(() => {
    if (!visible || !item) {
      setDraft('');
      return;
    }
    void loadComments();
  }, [visible, item, loadComments]);

  const submit = async () => {
    if (!item || !userId || !draft.trim() || posting) return;
    const body = draft.trim();
    const optimistic: CityNewsComment = {
      id: `temp-${Date.now()}`,
      news_id: item.id,
      user_id: userId,
      text: body,
      created_at: new Date().toISOString(),
      user: profile
        ? { ...profile, name: profile.name || 'You' }
        : { id: userId, name: 'You', avatar_url: null } as CityNewsComment['user'],
    };

    setPosting(true);
    setDraft('');
    setComments(prev => [...prev, optimistic]);
    const nextCount = (item.total_comments ?? 0) + 1;
    onCommentPosted?.(item.id, nextCount);

    try {
      const created = await postDailyComment(item.id, userId, body, profile);
      setComments(prev => prev.map(row => (row.id === optimistic.id ? created : row)));
    } catch {
      setComments(prev => prev.filter(row => row.id !== optimistic.id));
      onCommentPosted?.(item.id, item.total_comments ?? 0);
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
          {item ? (
            <Text style={s.subtitle} numberOfLines={1}>{item.title}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={row => row.id}
              style={s.list}
              contentContainerStyle={comments.length ? s.listContent : s.listEmptyWrap}
              ListEmptyComponent={
                <Text style={s.emptyText}>
                  No comments yet. Share your take in English or Hindi.
                </Text>
              }
              renderItem={({ item: row }) => <CommentRow comment={row} />}
            />
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a comment…"
                placeholderTextColor={Colors.dim}
                style={[s.input, unicodeContentStyle]}
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

// Re-export for tests — fetch/post routing lives in dailyPublicFeed
export { getCityNewsComments, addCityNewsComment, addLiveDailyComment };

const s = createDynamicStyles((Colors) => ({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '78%',
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
  },
  subtitle: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
    fontWeight: '600',
  },
  list: { maxHeight: 380 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  listEmptyWrap: { paddingHorizontal: 16, paddingVertical: 24 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border2 },
  avatarLetter: { color: Colors.orange, fontWeight: '900', fontSize: 14 },
  commentBody: { flex: 1, gap: 4 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUser: { color: Colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  commentTime: { color: Colors.dim, fontSize: 11, fontWeight: '600' },
  commentText: { color: Colors.sub, fontSize: 14, lineHeight: 20 },
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
}));
