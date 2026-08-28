import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Image, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Colors, Fonts, Radius } from '../../constants/theme';
import {
  MUSIC_CATEGORIES,
  fetchMusicByCategory,
  formatTrackDuration,
  searchMusicTracks,
  trackToAudioSelection,
  type MusicCategoryId,
  type MusicTrack,
  type SparkAudioSelection,
} from '../../lib/musicSearch';

const SLATE_900 = '#0F172A';
const SLATE_800 = '#1E293B';
const SLATE_700 = '#334155';
const SLATE_100 = '#F1F5F9';

type MusicSelectorModalProps = {
  visible: boolean;
  cityHint?: string;
  onClose: () => void;
  onSelect: (audio: SparkAudioSelection) => void;
};

export function MusicSelectorModal({
  visible,
  cityHint,
  onClose,
  onSelect,
}: MusicSelectorModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MusicCategoryId>('trending');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);

  const stopPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingId(null);
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch { /* noop */ }
  }, []);

  const loadCategory = useCallback(async (nextCategory: MusicCategoryId) => {
    setLoading(true);
    try {
      const rows = await fetchMusicByCategory(nextCategory, cityHint);
      if (mountedRef.current) setTracks(rows);
    } catch {
      if (mountedRef.current) setTracks([]);
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
      setQuery('');
      setCategory('trending');
      void stopPreview();
      return;
    }
    void loadCategory('trending');
  }, [visible, loadCategory, stopPreview]);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed) {
      void loadCategory(category);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      void searchMusicTracks(trimmed, { limit: 25 })
        .then(rows => { if (mountedRef.current) setTracks(rows); })
        .catch(() => { if (mountedRef.current) setTracks([]); })
        .finally(() => { if (mountedRef.current) setLoading(false); });
    }, 350);

    return () => clearTimeout(timer);
  }, [query, visible, category, loadCategory]);

  const onCategoryPress = async (next: MusicCategoryId) => {
    setCategory(next);
    setQuery('');
    await stopPreview();
    void loadCategory(next);
  };

  const playPreview = async (track: MusicTrack) => {
    if (!track.previewUrl) return;
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
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          void stopPreview();
        }
      });
    } catch { /* noop */ }
  };

  const selectTrack = async (track: MusicTrack) => {
    await stopPreview();
    onSelect(trackToAudioSelection(track));
    onClose();
  };

  const handleClose = () => {
    void stopPreview();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Text style={s.close}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Select Music</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={s.searchShell}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search track, artist, album, or movie"
            placeholderTextColor={SLATE_700}
            style={s.searchInput}
            autoCorrect={false}
          />
          {loading ? <ActivityIndicator size="small" color={Colors.orange} /> : null}
        </View>

        <FlatList
          horizontal
          data={MUSIC_CATEGORIES}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.pill, category === item.id && s.pillActive]}
              onPress={() => void onCategoryPress(item.id)}
              activeOpacity={0.85}
            >
              <Text style={[s.pillText, category === item.id && s.pillTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        <FlatList
          data={tracks}
          keyExtractor={item => item.id}
          contentContainerStyle={tracks.length ? s.listContent : s.listEmpty}
          ListEmptyComponent={
            loading ? null : (
              <Text style={s.emptyText}>No tracks found. Try another search or category.</Text>
            )
          }
          renderItem={({ item }) => {
            const isPlaying = playingId === item.id;
            return (
              <TouchableOpacity
                style={s.trackRow}
                onPress={() => void selectTrack(item)}
                activeOpacity={0.85}
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
                <TouchableOpacity
                  style={[s.previewBtn, isPlaying && s.previewBtnActive]}
                  onPress={() => void playPreview(item)}
                  disabled={!item.previewUrl}
                  activeOpacity={0.85}
                >
                  <Text style={s.previewBtnText}>
                    {!item.previewUrl ? '—' : isPlaying ? '⏸ Pause' : '▶️ Preview'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SLATE_900,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  close: {
    color: SLATE_100,
    fontSize: 15,
    fontWeight: '600',
    width: 56,
  },
  title: {
    color: SLATE_100,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: SLATE_800,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SLATE_700,
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    color: SLATE_100,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  pillsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  pillText: {
    color: SLATE_100,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextActive: { color: Colors.white },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listEmpty: { padding: 32 },
  emptyText: {
    color: Colors.sub,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLATE_800,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: SLATE_800,
  },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artEmoji: { fontSize: 22 },
  trackCopy: { flex: 1, minWidth: 0 },
  trackTitle: {
    color: SLATE_100,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  trackArtist: {
    color: Colors.sub,
    fontSize: 12,
    marginTop: 2,
  },
  trackDuration: {
    color: Colors.dim,
    fontSize: 11,
    marginTop: 2,
  },
  previewBtn: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: SLATE_700,
    backgroundColor: SLATE_800,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewBtnActive: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + '22',
  },
  previewBtnText: {
    color: SLATE_100,
    fontSize: 11,
    fontWeight: '700',
  },
});
