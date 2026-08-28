// app/(tabs)/news.tsx — Daily Pinterest masonry + InShorts reader + Save boards
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Share,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useDailyBoardsStore } from '../../stores/dailyBoardsStore';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import {
  getCityNews,
  getReels,
  likeCityNews,
  unlikeCityNews,
} from '../../lib/api';
import {
  applyDailyInteractions,
  detectDailyLocation,
  fetchDailyPublicFeed,
  isLiveDailyItem,
  sortDailyByNewest,
  sparksToDailyItems,
  toggleLiveDailyLike,
} from '../../lib/dailyPublicFeed';
import { DailyMosaic, DAILY_CATEGORIES, unicodeContentStyle, type DailyFilterId } from '../../components/daily/DailyMosaic';
import { PinterestArticleView } from '../../components/daily/PinterestArticleView';
import { SaveToBoardSheet } from '../../components/daily/SaveToBoardSheet';
import { Colors, Fonts } from '../../constants/theme';
import type { CityNews } from '../../types';

export default function NewsScreen() {
  const profile = useAuthStore(s => s.profile);
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const hydrateBoards = useDailyBoardsStore(s => s.hydrate);
  const isSaved = useDailyBoardsStore(s => s.isSaved);
  const getSavedPins = useDailyBoardsStore(s => s.getSavedPins);
  const boards = useDailyBoardsStore(s => s.boards);
  const savedCatalog = useDailyBoardsStore(s => s.items);

  const [items, setItems] = useState<CityNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DailyFilterId>('all');
  const [selected, setSelected] = useState<CityNews | null>(null);
  const [saveTarget, setSaveTarget] = useState<CityNews | null>(null);
  const [detectedCity, setDetectedCity] = useState(profile?.city ?? '');
  const { width } = useWindowDimensions();

  const city = detectedCity || profile?.city || '';
  const contentWidth = Math.min(width - 16, 960);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9be6ad' },
      body: JSON.stringify({
        sessionId: '9be6ad',
        runId: 'pre-fix',
        hypothesisId: 'C',
        location: 'news.tsx:NewsScreen',
        message: 'Daily viewport metrics',
        data: {
          windowWidth: width,
          contentWidth,
          horizontalPadding: 8,
          platform: Platform.OS,
          itemCount: items.length,
          filter,
          loading,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [width, contentWidth, items.length, filter, loading]);
  // #endregion

  useEffect(() => {
    if (profile?.id) void hydrateBoards(profile.id);
  }, [profile?.id, hydrateBoards]);

  const load = useCallback(async (opts?: { initial?: boolean }) => {
    if (!profile?.id) return;
    if (opts?.initial) setLoading(true);
    try {
      const location = await detectDailyLocation(profile);
      setDetectedCity(location.city);
      const [liveItems, storedItems, sparks] = await Promise.all([
        fetchDailyPublicFeed(location).catch(() => [] as CityNews[]),
        getCityNews(location.city, profile.id, 60).catch(() => [] as CityNews[]),
        getReels(followedShopIds.length ? followedShopIds : undefined).catch(() => []),
      ]);
      const sparkItems = sparksToDailyItems(sparks, location.city);
      const seen = new Set<string>();
      const merged = sortDailyByNewest([...sparkItems, ...liveItems, ...storedItems]).filter(item => {
        const key = item.title.trim().toLowerCase();
        if (seen.has(key) || seen.has(item.id)) return false;
        seen.add(key);
        seen.add(item.id);
        return true;
      });
      const nextItems = await applyDailyInteractions(sortDailyByNewest(merged), profile.id);
      setItems(nextItems);
    } catch (error) {
      console.error(error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile, followedShopIds]);

  const refreshDaily = useCallback(async () => {
    await load();
  }, [load]);

  const { refreshControl, scrollHandlers } = useScreenRefresh(refreshDaily);

  useEffect(() => {
    if (!profile) return;
    load({ initial: true });
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesSearch = (item: CityNews) => !query
      || item.title.toLowerCase().includes(query)
      || item.body.toLowerCase().includes(query)
      || item.city.toLowerCase().includes(query);

    if (filter === 'pins') {
      const fromStore = getSavedPins();
      // Prefer live feed copies (fresher likes/rates) when still present
      const byId = new Map(items.map(i => [i.id, i]));
      const pins = fromStore.map(pin => byId.get(pin.id) || pin);
      // Also include anything currently marked saved in feed but missing from catalog
      const storeIds = new Set(pins.map(p => p.id));
      for (const item of items) {
        if (isSaved(item.id) && !storeIds.has(item.id)) pins.push(item);
      }
      return pins.filter(matchesSearch);
    }

    return items.filter(item => {
      const matchesCategory = filter === 'all' ? true : item.category === filter;
      return matchesCategory && matchesSearch(item);
    });
  }, [items, filter, search, getSavedPins, isSaved, boards, savedCatalog]);

  const applyLikeState = (newsId: string, liked: boolean, totalLikes: number) => {
    setItems(prev => prev.map(item => item.id === newsId
      ? { ...item, is_liked: liked, total_likes: totalLikes }
      : item));
    setSelected(prev => (prev && prev.id === newsId
      ? { ...prev, is_liked: liked, total_likes: totalLikes }
      : prev));
  };

  const handleLikeToggle = async (item: CityNews) => {
    if (!profile) return;
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

  const handleShare = async (item: CityNews) => {
    const url = item.source_url || '';
    const message = `${item.title}\n${item.body}\n${url}`.trim();
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: item.title, text: item.body, url: url || undefined });
        return;
      }
      await Share.share({ title: item.title, message });
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        Alert.alert('Link copied', 'Story link copied to clipboard.');
      }
    }
  };

  const handleRepost = async (item: CityNews) => {
    try {
      await Share.share({
        title: `Repost: ${item.title}`,
        message: `🔁 ${item.title}\n${item.body}\n${item.source_url || ''}`.trim(),
      });
    } catch { /* noop */ }
  };

  const handleComment = (item: CityNews) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Comment',
        'Share your take in English or Hindi.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Post',
            onPress: (text?: string) => {
              const note = (text || '').trim();
              if (!note) return;
              void Share.share({
                title: `Comment: ${item.title}`,
                message: `${note}\n\n— on “${item.title}”\n${item.source_url || ''}`.trim(),
              });
            },
          },
        ],
        'plain-text',
      );
      return;
    }
    Alert.alert(
      'Comment',
      'Share your take, or open the full story to join the conversation.',
      [
        {
          text: 'Share take',
          onPress: () => {
            void Share.share({
              title: item.title,
              message: `My take on: ${item.title}\n${item.source_url || ''}`.trim(),
            });
          },
        },
        ...(item.source_url
          ? [{ text: 'Open story', onPress: () => { void Linking.openURL(item.source_url!); } }]
          : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  if (!profile || (loading && !items.length)) {
    return (
      <View style={[s.root, s.loadingRoot]}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={s.loadingHint}>Finding news near you…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <Text style={s.brand}>Daily</Text>
          <Text style={s.sub}>
            {city ? `Today in ${city} + national headlines` : 'Today in your city + national headlines'}
          </Text>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={[s.searchInput, unicodeContentStyle]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search city news, rates, weather…"
              placeholderTextColor={Colors.dim}
            />
          </View>
          <FlatList
            data={DAILY_CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setFilter(item.id)}
                style={[s.filterChip, filter === item.id && s.filterChipActive]}
              >
                <Text style={[s.filterText, filter === item.id && s.filterTextActive]}>
                  {item.emoji} {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={s.filterRail}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        {...scrollHandlers}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.gridContent}
      >
        {filtered.length ? (
          <DailyMosaic
            items={filtered}
            contentWidth={contentWidth}
            onPress={setSelected}
            onLike={handleLikeToggle}
            onShare={handleShare}
            onSave={setSaveTarget}
          />
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>{filter === 'pins' ? '📌' : '📰'}</Text>
            <Text style={s.emptyTitle}>
              {filter === 'pins' ? 'No pins yet' : 'No Daily stories yet'}
            </Text>
            <Text style={s.emptyText}>
              {filter === 'pins'
                ? 'Tap ··· on any card and choose Save.'
                : 'Pull to refresh or try another category.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selected} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        {selected ? (
          <PinterestArticleView
            item={selected}
            saved={isSaved(selected.id)}
            onLikeToggle={() => handleLikeToggle(selected)}
            onShare={() => handleShare(selected)}
            onRepost={() => handleRepost(selected)}
            onComment={() => handleComment(selected)}
            onSave={() => setSaveTarget(selected)}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </Modal>

      <SaveToBoardSheet
        visible={!!saveTarget}
        userId={profile.id}
        item={saveTarget}
        onClose={() => setSaveTarget(null)}
        onSaved={(boardName) => Alert.alert('Saved', `Pinned to “${boardName}”.`)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loadingRoot: { alignItems: 'center', justifyContent: 'center' },
  loadingHint: { color: Colors.sub, marginTop: 12, textAlign: 'center', fontSize: 13 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brand: {
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
    marginTop: 4,
    textAlign: 'center',
  },
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
  gridContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: 100,
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: Colors.sub, fontSize: 16, fontWeight: '700' },
  emptyText: { color: Colors.dim, fontSize: 13, textAlign: 'center' },
});
