// app/(tabs)/news.tsx — Daily news explore grid + detail viewer
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  Image,
  Linking,
  ScrollView,
  useWindowDimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { addCityNewsComment, getCityNews, getCityNewsComments, likeCityNews, unlikeCityNews } from '../../lib/api';
import {
  addLiveDailyComment,
  applyDailyInteractions,
  detectDailyLocation,
  fetchDailyPublicFeed,
  getLiveDailyComments,
  isLiveDailyItem,
  toggleLiveDailyLike,
} from '../../lib/dailyPublicFeed';
import { Colors, Fonts } from '../../constants/theme';
import type { CityNews, CityNewsCategory, CityNewsComment } from '../../types';

const CATEGORIES: Array<{ id: 'all' | CityNewsCategory; label: string; emoji: string }> = [
  { id: 'all', label: 'All', emoji: '📰' },
  { id: 'general', label: 'Top', emoji: '🔥' },
  { id: 'alerts', label: 'Alerts', emoji: '🚨' },
  { id: 'event', label: 'Events', emoji: '📍' },
  { id: 'weather', label: 'Weather', emoji: '⛅' },
  { id: 'rates', label: 'Rates', emoji: '💹' },
];

function categoryMeta(category: CityNewsCategory) {
  return CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '📰' };
}

function formatTimeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatStoryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function NewsTile({
  item,
  width,
  onPress,
  onLike,
  onShare,
}: {
  item: CityNews;
  width: number;
  onPress: (item: CityNews) => void;
  onLike: (item: CityNews) => void;
  onShare: (item: CityNews) => void;
}) {
  const meta = categoryMeta(item.category);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.92}
      style={[s.tile, { width, height: width * 1.28 }]}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={s.tileImage} resizeMode="cover" />
      ) : (
        <View style={s.tileFallback}>
          <Text style={s.tileFallbackEmoji}>{meta.emoji}</Text>
        </View>
      )}
      <View style={s.tileOverlay} />
      <View style={s.tileBadge}>
        <Text style={s.tileBadgeText}>{meta.emoji} {meta.label}</Text>
      </View>
      <View style={s.tileFooter}>
        <Text style={s.tileTitle} numberOfLines={2}>{item.title}</Text>
        <View style={s.tileMetaRow}>
          <TouchableOpacity onPress={() => onLike(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.tileMetaText}>{item.is_liked ? '❤️' : '♥'} {item.total_likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onPress(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.tileMetaText}>💬 {item.total_comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.tileMetaText}>⤴ Share</Text>
          </TouchableOpacity>
          <Text style={s.tileMetaText}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function NewsViewer({
  item,
  comments,
  commentsLoading,
  commentText,
  setCommentText,
  onLikeToggle,
  onSubmitComment,
  onShare,
  onClose,
}: {
  item: CityNews;
  comments: CityNewsComment[];
  commentsLoading: boolean;
  commentText: string;
  setCommentText: (value: string) => void;
  onLikeToggle: () => void;
  onSubmitComment: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const meta = categoryMeta(item.category);

  return (
    <View style={v.root}>
      <View style={v.header}>
        <TouchableOpacity onPress={onClose} style={v.closeBtn}>
          <Text style={v.closeText}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={v.headerTitle}>Daily</Text>
          <Text style={v.headerSub}>{meta.label} · {formatStoryDate(item.created_at)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={v.content}>
        <View style={v.heroCard}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={v.heroImage} resizeMode="cover" />
          ) : (
            <View style={v.heroFallback}>
              <Text style={v.heroFallbackEmoji}>{meta.emoji}</Text>
            </View>
          )}
        </View>

        <View style={v.actionRow}>
          <TouchableOpacity onPress={onLikeToggle}>
            <Text style={[v.actionIcon, item.is_liked && v.actionIconActive]}>{item.is_liked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <Text style={v.actionIcon}>💬</Text>
          <TouchableOpacity onPress={onShare}>
            <Text style={v.actionIcon}>⤴</Text>
          </TouchableOpacity>
        </View>

        <Text style={v.likesText}>{item.total_likes} likes</Text>
        <Text style={v.storyTitle}>{item.title}</Text>
        <Text style={v.storyBody}>{item.body}</Text>

        {item.source_url ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.source_url!)}>
            <Text style={v.sourceLink}>Read source</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={v.commentsTitle}>Comments</Text>
        {commentsLoading ? (
          <ActivityIndicator color={Colors.orange} style={{ marginVertical: 12 }} />
        ) : comments.length ? (
          comments.map(comment => (
            <View key={comment.id} style={v.commentCard}>
              <Text style={v.commentAuthor}>{comment.user?.name ?? 'User'}</Text>
              <Text style={v.commentText}>{comment.text}</Text>
              <Text style={v.commentMeta}>{formatTimeAgo(comment.created_at)} ago</Text>
            </View>
          ))
        ) : (
          <Text style={v.emptyComments}>No comments yet. Start the conversation.</Text>
        )}
      </ScrollView>

      <View style={v.commentComposer}>
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Add a comment..."
          placeholderTextColor={Colors.dim}
          style={v.commentInput}
        />
        <TouchableOpacity onPress={onSubmitComment} style={v.sendBtn}>
          <Text style={v.sendBtnText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NewsScreen() {
  const profile = useAuthStore(s => s.profile);
  const [items, setItems] = useState<CityNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | CityNewsCategory>('all');
  const [selected, setSelected] = useState<CityNews | null>(null);
  const [comments, setComments] = useState<CityNewsComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [detectedCity, setDetectedCity] = useState(profile?.city ?? '');
  const { width } = useWindowDimensions();

  const city = detectedCity || profile?.city || '';
  const columns = width >= 1000 ? 4 : 3;
  const gap = 2;
  const tileWidth = Math.floor((width - 32 - gap * (columns - 1)) / columns);

  const load = async (reset: boolean) => {
    if (!profile?.id) return;
    if (!reset) setRefreshing(true);
    try {
      const location = await detectDailyLocation(profile);
      setDetectedCity(location.city);
      const [liveItems, storedItems] = await Promise.all([
        fetchDailyPublicFeed(location).catch(() => [] as CityNews[]),
        getCityNews(location.city, profile.id, 60).catch(() => [] as CityNews[]),
      ]);
      const seen = new Set<string>();
      const merged = [...liveItems, ...storedItems].filter(item => {
        const key = item.title.trim().toLowerCase();
        if (seen.has(key) || seen.has(item.id)) return false;
        seen.add(key);
        seen.add(item.id);
        return true;
      });
      const nextItems = await applyDailyInteractions(merged, profile.id);
      setItems(nextItems);
    } catch (error) {
      console.error(error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!selected || !profile?.id) return;
    setCommentsLoading(true);
    const request = isLiveDailyItem(selected.id)
      ? getLiveDailyComments(profile.id, selected.id)
      : getCityNewsComments(selected.id);
    request
      .then(setComments)
      .catch(error => {
        console.error(error);
        setComments([]);
      })
      .finally(() => setCommentsLoading(false));
  }, [selected?.id, profile?.id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      const matchesCategory = filter === 'all' ? true : item.category === filter;
      const matchesSearch = !query
        || item.title.toLowerCase().includes(query)
        || item.body.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [items, filter, search]);

  const updateSelectedFromItems = (nextItems: CityNews[]) => {
    if (!selected) return;
    const nextSelected = nextItems.find(item => item.id === selected.id) ?? null;
    setSelected(nextSelected);
  };

  const applyLikeState = (newsId: string, liked: boolean, totalLikes: number) => {
    const nextItems = items.map(item => item.id === newsId
      ? { ...item, is_liked: liked, total_likes: totalLikes }
      : item);
    setItems(nextItems);
    updateSelectedFromItems(nextItems);
  };

  const handleLikeToggle = async (item = selected) => {
    if (!profile || !item) return;
    const currentlyLiked = !!item.is_liked;
    applyLikeState(item.id, !currentlyLiked, Math.max(0, item.total_likes + (currentlyLiked ? -1 : 1)));
    try {
      if (isLiveDailyItem(item.id)) {
        await toggleLiveDailyLike(profile.id, item);
      } else if (currentlyLiked) {
        await unlikeCityNews(profile.id, item.id);
      } else {
        await likeCityNews(profile.id, item.id);
      }
    } catch (error) {
      console.error(error);
      applyLikeState(item.id, currentlyLiked, item.total_likes);
    }
  };

  const handleShare = async (item = selected) => {
    if (!item) return;
    try {
      await Share.share({
        title: item.title,
        message: `${item.title}\n${item.body}\n${item.source_url || ''}`.trim(),
      });
    } catch {}
  };

  const handleSubmitComment = async () => {
    if (!profile || !selected || !commentText.trim()) return;
    try {
      const comment = isLiveDailyItem(selected.id)
        ? await addLiveDailyComment(profile.id, selected.id, commentText.trim(), profile)
        : await addCityNewsComment(profile.id, selected.id, commentText.trim());
      const nextItems = items.map(item => item.id === selected.id
        ? { ...item, total_comments: item.total_comments + 1 }
        : item);
      setItems(nextItems);
      updateSelectedFromItems(nextItems);
      setComments(prev => [...prev, comment]);
      setCommentText('');
    } catch (error) {
      console.error(error);
    }
  };

  if (!profile || loading) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <Text style={s.brand}>Daily</Text>
          <Text style={s.sub}>{city ? `Today in ${city} + national headlines` : 'Daily news'}</Text>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search Daily news"
              placeholderTextColor={Colors.dim}
            />
          </View>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setFilter(item.id)}
                style={[s.filterChip, filter === item.id && s.filterChipActive]}
              >
                <Text style={[s.filterText, filter === item.id && s.filterTextActive]}>{item.emoji} {item.label}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={s.filterRail}
          />
        </View>
      </SafeAreaView>

      <FlatList
        data={filtered}
        key={`news-grid-${columns}`}
        numColumns={columns}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NewsTile
            item={item}
            width={tileWidth}
            onPress={setSelected}
            onLike={handleLikeToggle}
            onShare={handleShare}
          />
        )}
        columnWrapperStyle={s.gridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={Colors.orange} />}
        contentContainerStyle={s.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>📰</Text>
            <Text style={s.emptyTitle}>No Daily stories yet</Text>
            <Text style={s.emptyText}>Pull to refresh or adjust the category filter.</Text>
          </View>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={s.viewerOverlay}>
          {selected ? (
            <NewsViewer
              item={selected}
              comments={comments}
              commentsLoading={commentsLoading}
              commentText={commentText}
              setCommentText={setCommentText}
              onLikeToggle={() => handleLikeToggle(selected)}
              onSubmitComment={handleSubmitComment}
              onShare={() => handleShare(selected)}
              onClose={() => {
                setSelected(null);
                setComments([]);
                setCommentText('');
              }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  brand: { fontSize: 28, fontFamily: Fonts.displayXBold, fontWeight: '900', color: Colors.orange, letterSpacing: -0.4, textAlign: 'center' },
  sub: { fontSize: 13, fontFamily: Fonts.bodySemiBold, color: Colors.sub, marginTop: 4, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, color: Colors.sub, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 12 },
  filterRail: { paddingBottom: 4, paddingRight: 12 },
  filterChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { color: Colors.sub, fontWeight: '700', fontSize: 12 },
  filterTextActive: { color: Colors.white },
  gridContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 100 },
  gridRow: { gap: 2, marginBottom: 2 },
  tile: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    position: 'relative',
  },
  tileImage: { width: '100%', height: '100%', position: 'absolute' },
  tileFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  tileFallbackEmoji: { fontSize: 48 },
  tileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000028' },
  tileBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00000088',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tileBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  tileFooter: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  tileTitle: { color: Colors.white, fontSize: 12, fontWeight: '800', lineHeight: 16, marginBottom: 6 },
  tileMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tileMetaText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: Colors.sub, fontSize: 16, fontWeight: '700' },
  emptyText: { color: Colors.dim, fontSize: 13 },
  viewerOverlay: { flex: 1, backgroundColor: Colors.bg },
});

const v = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  headerSub: { color: Colors.sub, fontSize: 12, marginTop: 3 },
  content: { padding: 16, paddingBottom: 120 },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    marginBottom: 16,
    minHeight: 300,
  },
  heroImage: { width: '100%', height: 300 },
  heroFallback: { height: 300, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  heroFallbackEmoji: { fontSize: 72 },
  actionRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  actionIcon: { fontSize: 26, color: Colors.text },
  actionIconActive: { color: Colors.red },
  likesText: { color: Colors.text, fontWeight: '700', marginBottom: 10 },
  storyTitle: { fontSize: 24, color: Colors.text, fontWeight: '900', lineHeight: 30, marginBottom: 12 },
  storyBody: { color: Colors.sub, fontSize: 14, lineHeight: 22, marginBottom: 14 },
  sourceLink: { color: Colors.orange, fontWeight: '800', fontSize: 14, marginBottom: 18 },
  commentsTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  commentCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  commentAuthor: { color: Colors.text, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  commentText: { color: Colors.sub, fontSize: 13, lineHeight: 18 },
  commentMeta: { color: Colors.dim, fontSize: 11, marginTop: 6 },
  emptyComments: { color: Colors.dim, fontSize: 13, marginBottom: 12 },
  commentComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: Colors.text,
  },
  sendBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
});
