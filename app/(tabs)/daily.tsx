// app/(tabs)/daily.tsx — City Veda hyper-local dashboard
// Role-agnostic: identical UI + data for buyer, seller, and service_provider.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, FlatList, Share, Platform,
  RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useDailyBoardsStore } from '../../stores/dailyBoardsStore';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import {
  CITY_PICKER_OPTIONS,
  detectCityForDaily,
  fetchCityVedaDashboard,
  peekCityVedaDashboard,
  type CityEvent,
  type CityVedaDashboard,
} from '../../services/dailyApi';
import { CityTickerHeader } from '../../components/daily/CityTickerHeader';
import { MandiRatesWidget } from '../../components/daily/MandiRatesWidget';
import { LocalNewsFeed } from '../../components/daily/LocalNewsFeed';
import { CityEventsSection } from '../../components/daily/CityEventsSection';
import { DailyBoardsSection } from '../../components/daily/DailyBoardsSection';
import { NewsDetailModal } from '../../components/daily/NewsDetailModal';
import { DailyCommentsModal } from '../../components/daily/DailyCommentsModal';
import { SaveToBoardSheet } from '../../components/daily/SaveToBoardSheet';
import { formatCityDisplay } from '../../components/daily/dailyShared';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { softBoot } from '../../lib/bootGuards';
import {
  isLiveDailyItem,
  toggleLiveDailyLike,
} from '../../lib/dailyPublicFeed';
import { likeCityNews, unlikeCityNews } from '../../lib/api';
import type { CityNews } from '../../types';
import Toast from 'react-native-toast-message';

export default function DailyScreen() {
  // Do not branch this screen on profile.role — City Veda is shared for all accounts.
  const profile = useAuthStore(s => s.profile);
  const hydrateBoards = useDailyBoardsStore(s => s.hydrate);
  const boardsHydrated = useDailyBoardsStore(s => s.hydrated);
  const isSaved = useDailyBoardsStore(s => s.isSaved);
  const togglePin = useDailyBoardsStore(s => s.togglePin);

  const [city, setCity] = useState(profile?.city || '');
  const [cityOverride, setCityOverride] = useState(false);
  const [dash, setDash] = useState<CityVedaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [detectingCity, setDetectingCity] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [selected, setSelected] = useState<CityNews | null>(null);
  const [commentItem, setCommentItem] = useState<CityNews | null>(null);
  const [saveTarget, setSaveTarget] = useState<CityNews | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (profile?.id) void hydrateBoards(profile.id);
  }, [profile?.id, hydrateBoards]);

  // Keep Daily city in sync with profile unless the user picked a desk override.
  useEffect(() => {
    if (!profile?.city || cityOverride) return;
    setCity(profile.city);
  }, [profile?.city, cityOverride]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (city || cityOverride) return;
      setDetectingCity(true);
      const detected = await softBoot(
        detectCityForDaily(profile),
        profile?.city || 'Delhi',
        'daily.detect',
      );
      if (alive && detected) setCity(detected);
      if (alive) setDetectingCity(false);
    })();
    return () => { alive = false; };
  }, [profile, city, cityOverride]);

  const load = useCallback(async (opts?: { force?: boolean; initial?: boolean }) => {
    if (!city) return;
    if (opts?.initial) setLoading(true);
    try {
      if (opts?.initial) {
        const cached = await peekCityVedaDashboard(city);
        if (cached && !cancelledRef.current) {
          setDash(cached);
          setLoading(false);
        }
      }
      const next = await fetchCityVedaDashboard(city, profile, { force: opts?.force ?? true });
      if (!cancelledRef.current) setDash(next);
    } catch (error) {
      if (__DEV__) console.log('[daily] City Veda load failed', error);
      if (opts?.initial && !cancelledRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Could not load Daily',
          text2: 'Pull to refresh or try another city.',
        });
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [city, profile]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!city) return undefined;
    void load({ initial: true, force: true });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when city desk changes
  }, [city]);

  const refresh = useCallback(async () => {
    await load({ force: true });
  }, [load]);

  const { refreshing, onRefresh } = useScreenRefresh(refresh);

  const applyLikeState = (newsId: string, liked: boolean, totalLikes: number) => {
    setDash(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        news: prev.news.map(item => item.id === newsId
          ? { ...item, is_liked: liked, total_likes: totalLikes }
          : item),
      };
    });
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
    } catch {
      applyLikeState(item.id, currentlyLiked, item.total_likes);
    }
  };

  const handleShare = async (item: CityNews) => {
    const url = item.source_url || '';
    const message = `${item.title}\n${item.body}\n${url}`.trim();
    try {
      await Share.share({ title: item.title, message });
    } catch { /* noop */ }
  };

  const handleRepost = async (item: CityNews) => {
    try {
      await Share.share({
        title: `Repost: ${item.title}`,
        message: `🔁 ${item.title}\n${item.body}\n${item.source_url || ''}`.trim(),
      });
    } catch { /* noop */ }
  };

  const handleTogglePin = async (item: CityNews) => {
    if (!profile?.id) return;
    if (!boardsHydrated) {
      Toast.show({
        type: 'info',
        text1: 'Boards loading',
        text2: 'Please wait a moment, then pin again.',
      });
      await hydrateBoards(profile.id);
    }
    try {
      const nowSaved = await togglePin(profile.id, item);
      Toast.show({
        type: 'success',
        text1: nowSaved ? 'Pinned' : 'Pin removed',
        text2: nowSaved ? 'Added to your saved boards.' : 'Removed from your boards.',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not update pin',
        text2: 'Please try again in a moment.',
      });
    }
  };

  const handleUseGpsCity = async () => {
    setDetectingCity(true);
    try {
      const detected = await detectCityForDaily(profile);
      if (detected) {
        setCityOverride(true);
        setCity(detected);
        setShowCityPicker(false);
        Toast.show({
          type: 'success',
          text1: 'Location updated',
          text2: `Daily desk set to ${formatCityDisplay(detected)}.`,
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not detect location',
        text2: 'Allow location access or pick a city manually.',
      });
    } finally {
      setDetectingCity(false);
    }
  };

  const cityLabel = formatCityDisplay(dash?.city || city);

  const pickerData = useMemo(() => {
    const set = new Set(CITY_PICKER_OPTIONS);
    if (cityLabel) set.add(cityLabel);
    if (profile?.city) set.add(formatCityDisplay(profile.city));
    return Array.from(set);
  }, [cityLabel, profile?.city]);

  if (!profile) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.hint}>Sign in to open your City Veda Daily.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <CityTickerHeader
        city={cityLabel}
        chips={dash?.ticker ?? []}
        loading={loading || detectingCity}
        onPressCity={() => setShowCityPicker(true)}
      />

      {loading && !dash ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={s.hint}>Loading City Veda for {cityLabel || 'your city'}…</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.orange}
              colors={[Colors.orange]}
            />
          )}
        >
          <MandiRatesWidget board={dash?.mandi ?? null} loading={loading} />

          <CityEventsSection
            city={cityLabel}
            events={dash?.events ?? []}
            loading={loading}
            onEventsChange={(events: CityEvent[]) => {
              setDash(prev => (prev ? { ...prev, events } : prev));
            }}
          />

          <LocalNewsFeed
            city={cityLabel}
            items={dash?.news ?? []}
            loading={loading}
            onPressItem={setSelected}
          />

          <DailyBoardsSection
            userId={profile.id}
            onOpenItem={setSelected}
          />

          <View style={s.footerPad} />
        </ScrollView>
      )}

      <NewsDetailModal
        visible={!!selected}
        item={selected}
        saved={selected ? isSaved(selected.id) : false}
        onClose={() => setSelected(null)}
        onLikeToggle={() => { if (selected) void handleLikeToggle(selected); }}
        onShare={() => { if (selected) void handleShare(selected); }}
        onRepost={() => { if (selected) void handleRepost(selected); }}
        onComment={() => { if (selected) setCommentItem(selected); }}
        onSave={() => { if (selected) setSaveTarget(selected); }}
        onTogglePin={() => { if (selected) void handleTogglePin(selected); }}
      />

      <DailyCommentsModal
        visible={!!commentItem}
        item={commentItem}
        userId={profile.id}
        onClose={() => setCommentItem(null)}
        onCommentPosted={(newsId, totalComments) => {
          setDash(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              news: prev.news.map(item => item.id === newsId
                ? { ...item, total_comments: totalComments }
                : item),
            };
          });
        }}
      />

      <SaveToBoardSheet
        visible={!!saveTarget}
        userId={profile.id}
        item={saveTarget}
        onClose={() => setSaveTarget(null)}
        onSaved={(boardName) => {
          Toast.show({
            type: 'success',
            text1: 'Saved',
            text2: `Pinned to “${boardName}”.`,
          });
        }}
      />

      <Modal
        visible={showCityPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <Pressable style={s.pickerBackdrop} onPress={() => setShowCityPicker(false)}>
          <Pressable style={s.pickerSheet} onPress={() => {}}>
            <Text style={s.pickerTitle}>Daily desk city</Text>
            <Text style={s.pickerSub}>
              Shared for buyers, sellers & service pros. Fuel, mandi, news and events update for this desk.
            </Text>

            <Pressable
              style={s.gpsBtn}
              onPress={() => { void handleUseGpsCity(); }}
              disabled={detectingCity}
            >
              {detectingCity ? (
                <ActivityIndicator color={Colors.orange} />
              ) : (
                <Text style={s.gpsBtnText}>📍 Use my GPS area</Text>
              )}
            </Pressable>

            {profile.city ? (
              <Pressable
                style={s.profileCityBtn}
                onPress={() => {
                  setCityOverride(false);
                  setCity(profile.city!);
                  setShowCityPicker(false);
                }}
              >
                <Text style={s.profileCityText}>
                  Reset to profile city · {formatCityDisplay(profile.city)}
                </Text>
              </Pressable>
            ) : null}

            <FlatList
              data={pickerData}
              keyExtractor={item => item}
              style={s.pickerList}
              renderItem={({ item }) => {
                const active = formatCityDisplay(item) === cityLabel;
                return (
                  <Pressable
                    style={[s.pickerRow, active && s.pickerRowActive]}
                    onPress={() => {
                      setCityOverride(true);
                      setShowCityPicker(false);
                      setCity(item);
                    }}
                  >
                    <Text style={[s.pickerRowText, active && s.pickerRowTextActive]}>
                      📍 {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: Colors.sub,
    fontSize: 13,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  footerPad: { height: 28 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    maxHeight: '78%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  pickerSub: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: Colors.sub,
    textAlign: 'center',
  },
  gpsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.orange,
    marginBottom: 8,
    minHeight: 46,
  },
  gpsBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.orange,
  },
  profileCityBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  profileCityText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.sub,
  },
  pickerList: { maxHeight: 360 },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: Colors.card,
  },
  pickerRowActive: {
    borderWidth: 1,
    borderColor: Colors.orange,
  },
  pickerRowText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  pickerRowTextActive: { color: Colors.orange },
}));
