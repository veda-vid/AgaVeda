// components/sparks/AudioCutterModal.tsx — Interactive music segment trimmer

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Platform,
  Dimensions, PanResponder, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import {
  formatTrackDuration,
  trackToAudioSelection,
  type MusicTrack,
  type SparkAudioSelection,
} from '../../lib/musicSearch';
import {
  MUSIC_TRIM_WINDOW_SEC,
  clampMusicWindow,
  type MusicWindowSec,
} from '../../services/musicApi';
import { hapticLight } from '../../lib/haptics';

const { width: WIN_W } = Dimensions.get('window');
const WAVE_BARS = 48;
const TRACK_PAD = 20;
const TRACK_W = WIN_W - TRACK_PAD * 2;

type WindowPreset = 15 | 30;

type AudioCutterModalProps = {
  visible: boolean;
  track: MusicTrack | null;
  /** Preferred selection length (defaults to 15s). */
  defaultWindowSec?: WindowPreset;
  /** Existing start offset when re-trimming. */
  initialStartSec?: number;
  onClose: () => void;
  onConfirm: (audio: SparkAudioSelection) => void;
};

function hashBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < WAVE_BARS; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    bars.push(0.18 + (h % 82) / 100);
  }
  return bars;
}

function formatSec(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function AudioCutterModal({
  visible,
  track,
  defaultWindowSec = MUSIC_TRIM_WINDOW_SEC as WindowPreset,
  initialStartSec = 0,
  onClose,
  onConfirm,
}: AudioCutterModalProps) {
  const insets = useSafeAreaInsets();
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const [windowSec, setWindowSec] = useState<WindowPreset>(
    defaultWindowSec === 30 ? 30 : 15,
  );
  const [startSec, setStartSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const trackWidthRef = useRef(TRACK_W);
  const durationSec = useMemo(() => {
    if (!track?.durationMs) return 30;
    return Math.max(1, track.durationMs / 1000);
  }, [track?.durationMs]);

  const bars = useMemo(
    () => (track ? hashBars(track.id + track.title) : []),
    [track],
  );

  const selection: MusicWindowSec = useMemo(
    () => clampMusicWindow(startSec, windowSec, durationSec),
    [startSec, windowSec, durationSec],
  );

  const stopSound = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlaying(false);
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopSound();
    };
  }, [stopSound]);

  useEffect(() => {
    if (!visible || !track) {
      void stopSound();
      return;
    }
    const preferredWindow = defaultWindowSec === 30 ? 30 : 15;
    const clamped = clampMusicWindow(initialStartSec, preferredWindow, durationSec);
    setWindowSec(clamped.windowSec <= 15 ? 15 : 30);
    setStartSec(clamped.startSec);
    setPlayheadSec(clamped.startSec);
  }, [visible, track?.id, initialStartSec, durationSec, defaultWindowSec, stopSound, track]);

  const playSegment = async () => {
    if (!track?.previewUrl) {
      Toast.show({
        type: 'info',
        text1: 'Preview unavailable',
        text2: 'You can still use this segment.',
      });
      return;
    }
    if (playing) {
      await stopSound();
      return;
    }
    setLoading(true);
    try {
      await stopSound();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        {
          shouldPlay: true,
          positionMillis: Math.round(selection.startSec * 1000),
          volume: 1,
        },
      );
      soundRef.current = sound;
      if (mountedRef.current) {
        setPlaying(true);
        setPlayheadSec(selection.startSec);
      }
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        const pos = (status.positionMillis ?? 0) / 1000;
        if (mountedRef.current) setPlayheadSec(pos);
        if (pos >= selection.endSec - 0.05 || status.didJustFinish) {
          void stopSound();
          if (mountedRef.current) setPlayheadSec(selection.startSec);
        }
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Playback failed',
        text2: 'Could not preview this segment.',
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const setStartFromRatio = (ratio: number) => {
    const maxStart = Math.max(0, durationSec - selection.windowSec);
    const next = Math.max(0, Math.min(maxStart, ratio * durationSec));
    setStartSec(next);
    setPlayheadSec(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const x = evt.nativeEvent.locationX;
        setStartFromRatio(x / Math.max(1, trackWidthRef.current));
        void hapticLight();
      },
      onPanResponderMove: evt => {
        const x = evt.nativeEvent.locationX;
        setStartFromRatio(x / Math.max(1, trackWidthRef.current));
      },
    }),
  ).current;

  const handleConfirm = async () => {
    if (!track) return;
    await stopSound();
    void hapticLight();
    const audio = trackToAudioSelection(track, selection.startSec);
    onConfirm({
      ...audio,
      audio_start_time: selection.startSec,
      audio_duration_sec: selection.windowSec,
    });
  };

  const handleClose = () => {
    void stopSound();
    onClose();
  };

  const leftPct = (selection.startSec / durationSec) * 100;
  const widthPct = (selection.windowSec / durationSec) * 100;
  const playheadPct = Math.min(100, Math.max(0, (playheadSec / durationSec) * 100));

  return (
    <Modal visible={visible && !!track} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.root, { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom + 16 }]}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={44} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : null}

        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Trim Audio</Text>
          <View style={{ width: 56 }} />
        </View>

        {track ? (
          <Animated.View entering={FadeIn} style={s.body}>
            <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
            <Text style={s.trackArtist} numberOfLines={1}>
              {track.artist} · {formatTrackDuration(track.durationMs)}
            </Text>

            <GlassSurface radius={18} intensity={30} style={s.card}>
              <Text style={s.cardTitle}>Select a segment</Text>
              <Text style={s.cardHint}>
                Drag the window to pick the exact verse, chorus, or drop. Playback stays in sync with your video loop.
              </Text>

              <View style={s.presetRow}>
                {([15, 30] as WindowPreset[]).map(preset => {
                  const active = windowSec === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[s.presetChip, active && s.presetChipActive]}
                      disabled={durationSec < 2}
                      onPress={() => {
                        const next = clampMusicWindow(startSec, preset, durationSec);
                        setWindowSec(preset);
                        setStartSec(next.startSec);
                        void hapticLight();
                      }}
                    >
                      <Text style={[s.presetText, active && s.presetTextActive]}>
                        {preset}s window
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View
                style={s.waveTrack}
                onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
                {...pan.panHandlers}
              >
                <View style={s.waveRow}>
                  {bars.map((h, i) => {
                    const barStart = (i / WAVE_BARS) * durationSec;
                    const inSel = barStart >= selection.startSec && barStart < selection.endSec;
                    return (
                      <View
                        key={i}
                        style={[
                          s.bar,
                          {
                            height: 14 + h * 36,
                            backgroundColor: inSel ? Colors.orange : 'rgba(255,255,255,0.18)',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <View
                  pointerEvents="none"
                  style={[s.selection, { left: `${leftPct}%`, width: `${widthPct}%` }]}
                />
                <View
                  pointerEvents="none"
                  style={[s.playhead, { left: `${playheadPct}%` }]}
                />
              </View>

              <View style={s.timeRow}>
                <Text style={s.timeText}>{formatSec(selection.startSec)}</Text>
                <Text style={s.timeMid}>
                  {formatSec(selection.startSec)} – {formatSec(selection.endSec)}
                </Text>
                <Text style={s.timeText}>{formatSec(durationSec)}</Text>
              </View>

              <TouchableOpacity
                style={s.previewBtn}
                onPress={() => void playSegment()}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.previewBtnText}>
                    {playing ? '⏸ Pause preview' : '▶️ Preview segment'}
                  </Text>
                )}
              </TouchableOpacity>
            </GlassSurface>

            <SpringPressable onPress={() => void handleConfirm()} style={s.confirmWrap}>
              <View style={s.confirmBtn}>
                <Text style={s.confirmText}>Use this segment</Text>
              </View>
            </SpringPressable>
          </Animated.View>
        ) : null}
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
    marginBottom: 18,
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
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  trackTitle: {
    color: Colors.white,
    fontSize: 20,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  trackArtist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  card: {
    padding: 16,
  },
  cardTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  presetChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  presetText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '800',
  },
  presetTextActive: { color: Colors.white },
  waveTrack: {
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 54,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: Colors.white,
    borderRadius: 8,
    backgroundColor: 'rgba(255,87,34,0.12)',
  },
  playhead: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 2,
    marginLeft: -1,
    backgroundColor: Colors.white,
    borderRadius: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
  },
  timeMid: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  previewBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minHeight: 46,
  },
  previewBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmWrap: {
    marginTop: 18,
  },
  confirmBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
}));
