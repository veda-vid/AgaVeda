// components/sparks/MusicPickerModal.tsx — Reels-style music selector with waveform preview

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Image, Platform, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import { platformStorage } from '../../lib/platformStorage';
import {
  formatTrackDuration,
  trackToAudioSelection,
  type MusicTrack,
  type SparkAudioSelection,
} from '../../lib/musicSearch';
import { fetchTrendingForSparks, searchSparkMusic } from '../../services/musicApi';
import { hapticLight } from '../../lib/haptics';

const SAVED_KEY = 'cityconnect.spark.savedMusic';
const WAVE_BARS = 28;
const { width: WIN_W } = Dimensions.get('window');

type MusicTab = 'trending' | 'saved' | 'search';

type MusicPickerModalProps = {
  visible: boolean;
  cityHint?: string;
  trimStartSec?: number;
  /** When true, parent should open the audio trimmer instead of attaching immediately. */
  requireTrim?: boolean;
  onPickTrack?: (track: MusicTrack) => void;
  onClose: () => void;
  onSelect: (audio: SparkAudioSelection) => void;
};

function hashBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < WAVE_BARS; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    bars.push(0.22 + (h % 78) / 100);
  }
  return bars;
}

function WaveformBar({
  heights,
  progress,
  playing,
}: {
  heights: number[];
  progress: number;
  playing: boolean;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (playing) {
      pulse.value = withRepeat(
        withTiming(1.12, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 160 });
    }
  }, [playing, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse.value }],
  }));

  const filled = Math.floor(progress * heights.length);

  return (
    <Animated.View style={[wf.row, animStyle]}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={[
            wf.bar,
            {
              height: 10 + h * 22,
              backgroundColor: i <= filled ? Colors.orange : 'rgba(255,255,255,0.22)',
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const wf = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 34,
    flex: 1,
  },
  bar: {
    width: Math.max(3, Math.floor((WIN_W - 180) / WAVE_BARS) - 2),
    borderRadius: 2,
    minWidth: 3,
  },
});

export function MusicPickerModal({
  visible,
  cityHint,
  trimStartSec = 0,
  requireTrim = false,
  onPickTrack,
  onClose,
  onSelect,
}: MusicPickerModalProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MusicTab>('trending');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [saved, setSaved] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);

  const stopPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingId(null);
    setProgress(0);
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch { /* noop */ }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const raw = await platformStorage.getItem(SAVED_KEY);
      if (!raw) {
        if (mountedRef.current) setSaved([]);
        return;
      }
      const parsed = JSON.parse(raw) as MusicTrack[];
      if (mountedRef.current) setSaved(Array.isArray(parsed) ? parsed : []);
    } catch {
      if (mountedRef.current) setSaved([]);
    }
  }, []);

  const persistSaved = useCallback(async (next: MusicTrack[]) => {
    setSaved(next);
    await platformStorage.setItem(SAVED_KEY, JSON.stringify(next.slice(0, 40)));
  }, []);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchTrendingForSparks(cityHint);
      if (mountedRef.current) setTracks(rows);
    } catch {
      if (mountedRef.current) {
        setTracks([]);
        Toast.show({
          type: 'error',
          text1: 'Music unavailable',
          text2: 'Check your connection and try again.',
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [cityHint]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopPreview();
    };
  }, [stopPreview]);

  useEffect(() => {
    if (!visible) {
      setTab('trending');
      setQuery('');
      void stopPreview();
      return;
    }
    void loadSaved();
    void loadTrending();
  }, [visible, loadSaved, loadTrending, stopPreview]);

  useEffect(() => {
    if (!visible || tab !== 'search') return;
    const trimmed = query.trim();
    if (!trimmed) {
      setTracks([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void searchSparkMusic(trimmed, { limit: 25, bollywoodBias: true })
        .then(rows => { if (mountedRef.current) setTracks(rows); })
        .catch(() => { if (mountedRef.current) setTracks([]); })
        .finally(() => { if (mountedRef.current) setLoading(false); });
    }, 320);
    return () => clearTimeout(timer);
  }, [query, visible, tab]);

  const listData = useMemo(() => {
    if (tab === 'saved') return saved;
    return tracks;
  }, [tab, saved, tracks]);

  const playPreview = async (track: MusicTrack) => {
    if (!track.previewUrl) {
      Toast.show({
        type: 'info',
        text1: 'Preview unavailable',
        text2: 'You can still attach this track.',
      });
      return;
    }
    if (playingId === track.id) {
      await stopPreview();
      return;
    }
    await stopPreview();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setPlayingId(track.id);
      setProgress(0);
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        if (status.durationMillis && status.durationMillis > 0) {
          setProgress(status.positionMillis / status.durationMillis);
        }
        if (status.didJustFinish) void stopPreview();
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Playback failed',
        text2: 'Could not play this preview.',
      });
    }
  };

  const toggleSave = async (track: MusicTrack) => {
    void hapticLight();
    const exists = saved.some(t => t.id === track.id);
    const next = exists
      ? saved.filter(t => t.id !== track.id)
      : [track, ...saved.filter(t => t.id !== track.id)];
    await persistSaved(next);
    Toast.show({
      type: 'success',
      text1: exists ? 'Removed from Saved' : 'Saved',
      text2: track.title,
    });
  };

  const selectTrack = async (track: MusicTrack) => {
    await stopPreview();
    if (!saved.some(t => t.id === track.id)) {
      await persistSaved([track, ...saved].slice(0, 40));
    }
    if (requireTrim && onPickTrack) {
      onPickTrack(track);
      onClose();
      return;
    }
    onSelect(trackToAudioSelection(track, trimStartSec));
    onClose();
  };

  const handleClose = () => {
    void stopPreview();
    onClose();
  };

  const tabs: Array<{ id: MusicTab; label: string }> = [
    { id: 'trending', label: '🔥 Trending' },
    { id: 'saved', label: '🎧 Saved' },
    { id: 'search', label: '🔍 Search' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.root, { paddingTop: Math.max(insets.top, 16) }]}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : null}

        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Add Audio</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={s.tabRow}>
          {tabs.map(item => {
            const active = tab === item.id;
            return (
              <SpringPressable
                key={item.id}
                style={[s.tab, active && s.tabActive]}
                onPress={() => {
                  setTab(item.id);
                  void stopPreview();
                  if (item.id === 'trending') void loadTrending();
                  if (item.id === 'saved') void loadSaved();
                }}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{item.label}</Text>
              </SpringPressable>
            );
          })}
        </View>

        {tab === 'search' ? (
          <GlassSurface style={s.searchShell} radius={14} intensity={24}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search track, artist, or album"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.searchInput}
              autoCorrect={false}
              autoFocus
            />
            {loading ? <ActivityIndicator size="small" color={Colors.orange} /> : null}
          </GlassSurface>
        ) : null}

        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          contentContainerStyle={listData.length ? s.listContent : s.listEmpty}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
            ) : (
              <Text style={s.emptyText}>
                {tab === 'saved'
                  ? 'No saved tracks yet. Preview a song and tap the bookmark.'
                  : tab === 'search'
                    ? 'Search for a track to get started.'
                    : 'No trending tracks right now.'}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const isPlaying = playingId === item.id;
            const isSaved = saved.some(t => t.id === item.id);
            const heights = hashBars(item.id + item.title);
            return (
              <GlassSurface style={s.trackCard} radius={16} intensity={22}>
                <TouchableOpacity
                  style={s.trackMain}
                  onPress={() => void selectTrack(item)}
                  activeOpacity={0.88}
                >
                  {item.albumArt ? (
                    <Image source={{ uri: item.albumArt }} style={s.art} />
                  ) : (
                    <View style={[s.art, s.artFallback]}>
                      <Text style={s.artEmoji}>🎵</Text>
                    </View>
                  )}
                  <View style={s.trackCopy}>
                    <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.trackArtist} numberOfLines={1}>{item.artist}</Text>
                    <Text style={s.trackDuration}>{formatTrackDuration(item.durationMs)}</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.waveRow}>
                  <WaveformBar heights={heights} progress={isPlaying ? progress : 0} playing={isPlaying} />
                  <TouchableOpacity
                    style={[s.playBtn, isPlaying && s.playBtnActive]}
                    onPress={() => void playPreview(item)}
                    disabled={!item.previewUrl}
                    activeOpacity={0.85}
                  >
                    <Text style={s.playBtnText}>
                      {!item.previewUrl ? '—' : isPlaying ? '⏸' : '▶️'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.saveBtn}
                    onPress={() => void toggleSave(item)}
                    hitSlop={8}
                  >
                    <Text style={s.saveBtnText}>{isSaved ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                </View>
              </GlassSurface>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: '#07070C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  cancel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
    width: 56,
  },
  title: {
    color: Colors.white,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  tabText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: { color: Colors.white },
  searchShell: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  listEmpty: { padding: 32 },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
  },
  trackCard: {
    padding: 12,
    marginBottom: 10,
  },
  trackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  art: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artEmoji: { fontSize: 22 },
  trackCopy: { flex: 1, minWidth: 0 },
  trackTitle: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  trackArtist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  trackDuration: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  playBtnActive: {
    backgroundColor: Colors.orange + '33',
    borderColor: Colors.orange,
  },
  playBtnText: { fontSize: 13 },
  saveBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: Colors.amber,
    fontSize: 18,
  },
}));
