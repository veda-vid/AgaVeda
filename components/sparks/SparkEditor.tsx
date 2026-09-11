// components/sparks/SparkEditor.tsx — Full-screen 9:16 Spark creation studio

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Dimensions, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Switch, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown, FadeInRight, SlideInRight, SlideOutRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import type { CapturedMedia } from '../media/CameraCapture';
import type { Product } from '../../types';
import { agentDebugLog } from '../../lib/agentDebugLog';
import { ErrorBoundary } from '../common/ErrorBoundary';
import type { SparkAudioSelection } from '../../lib/musicSearch';
import {
  formatHashtagChip,
  runSparkAiEnhance,
  type AiCaptionOption,
} from '../../lib/sparkAiEngine';
import { clampVolumePct } from '../../lib/sparkAudioSync';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import Toast from 'react-native-toast-message';
import { MuteTapOverlay } from './MuteTapOverlay';
import { FeedVideo } from '../feed/FeedVideo';
import { useSparkBackgroundAudio } from '../../hooks/useSparkBackgroundAudio';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

export type SparkFilterId = 'none' | 'vintage' | 'glow' | 'cinematic' | 'contrast';
export type SparkFrameId = 'none' | 'classic' | 'film' | 'neon';
export type SparkSpeed = 0.5 | 1 | 2;
export type SparkTextStyle = 'caption' | 'sticker' | 'headline';

export type SparkTextOverlay = {
  id: string;
  text: string;
  style: SparkTextStyle;
};

export type SparkEditorState = {
  trimStart: number;
  trimEnd: number;
  speed: SparkSpeed;
  filter: SparkFilterId;
  frame: SparkFrameId;
  textOverlays: SparkTextOverlay[];
  selectedProductId: string | null;
  audio: SparkAudioSelection | null;
  videoVolumePct: number;
  musicVolumePct: number;
};

type ToolId = 'audio' | 'trim' | 'frames' | 'text' | 'product' | null;

type SparkEditorProps = {
  media: CapturedMedia;
  state: SparkEditorState;
  products: Product[];
  productsLoading?: boolean;
  locationHint?: string;
  onChange: (patch: Partial<SparkEditorState>) => void;
  onClose: () => void;
  onNext: () => void;
  onOpenMusic: () => void;
  onApplyAiCaption?: (caption: string, tags: string[]) => void;
};

const FILTERS: Array<{ id: SparkFilterId; label: string; tint: string }> = [
  { id: 'none', label: 'Original', tint: 'transparent' },
  { id: 'vintage', label: 'Vintage', tint: 'rgba(180,120,40,0.28)' },
  { id: 'glow', label: 'Glow', tint: 'rgba(255,200,120,0.18)' },
  { id: 'cinematic', label: 'Cinematic', tint: 'rgba(20,40,90,0.32)' },
  { id: 'contrast', label: 'High Contrast', tint: 'rgba(0,0,0,0.22)' },
];

const FRAMES: Array<{ id: SparkFrameId; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'classic', label: 'Classic' },
  { id: 'film', label: 'Film' },
  { id: 'neon', label: 'Neon' },
];

const SPEEDS: SparkSpeed[] = [0.5, 1, 2];

const TOOLS: Array<{ id: Exclude<ToolId, null>; icon: string; label: string }> = [
  { id: 'audio', icon: '🎵', label: 'Audio' },
  { id: 'trim', icon: '✂️', label: 'Trim' },
  { id: 'frames', icon: '🖼️', label: 'Frames' },
  { id: 'text', icon: '📝', label: 'Text' },
  { id: 'product', icon: '🏷️', label: 'Tag' },
];

function filterTint(id: SparkFilterId) {
  return FILTERS.find(f => f.id === id)?.tint ?? 'transparent';
}

function frameStyle(id: SparkFrameId) {
  switch (id) {
    case 'classic':
      return { borderWidth: 10, borderColor: '#F5F0EB' };
    case 'film':
      return { borderWidth: 14, borderColor: '#0A0A0A', borderStyle: 'solid' as const };
    case 'neon':
      return { borderWidth: 3, borderColor: Colors.orange };
    default:
      return { borderWidth: 0, borderColor: 'transparent' };
  }
}

function textOverlayStyle(style: SparkTextStyle) {
  switch (style) {
    case 'headline':
      return {
        fontSize: 28,
        fontFamily: Fonts.display,
        fontWeight: '800' as const,
        color: Colors.white,
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
      };
    case 'sticker':
      return {
        fontSize: 18,
        fontWeight: '800' as const,
        color: Colors.black,
        backgroundColor: Colors.amber,
        overflow: 'hidden' as const,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
      };
    default:
      return {
        fontSize: 16,
        fontWeight: '700' as const,
        color: Colors.white,
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        overflow: 'hidden' as const,
      };
  }
}

function VolumeScrubber({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (pct: number) => void;
  disabled?: boolean;
}) {
  const [trackW, setTrackW] = useState(1);
  return (
    <View style={[vol.row, disabled && { opacity: 0.4 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <TouchableOpacity
        style={vol.step}
        onPress={() => onChange(Math.max(0, value - 5))}
        hitSlop={8}
      >
        <Text style={vol.stepText}>−</Text>
      </TouchableOpacity>
      <View
        style={vol.track}
        onLayout={e => setTrackW(Math.max(1, e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => {
          const pct = Math.round((e.nativeEvent.locationX / trackW) * 100);
          onChange(clampVolumePct(pct));
        }}
        onResponderMove={e => {
          const pct = Math.round((e.nativeEvent.locationX / trackW) * 100);
          onChange(clampVolumePct(pct));
        }}
      >
        <View style={[vol.fill, { width: `${clampVolumePct(value)}%` }]} />
        <View style={[vol.thumb, { left: `${clampVolumePct(value)}%` }]} />
      </View>
      <TouchableOpacity
        style={vol.step}
        onPress={() => onChange(Math.min(100, value + 5))}
        hitSlop={8}
      >
        <Text style={vol.stepText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const vol = createDynamicStyles((Colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  track: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.orange,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.orange,
  },
}));

export function SparkEditor({
  media,
  state,
  products,
  productsLoading,
  locationHint,
  onChange,
  onClose,
  onNext,
  onOpenMusic,
  onApplyAiCaption,
}: SparkEditorProps) {
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolId>(null);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCaptions, setAiCaptions] = useState<AiCaptionOption[]>([]);
  const [aiHashtags, setAiHashtags] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState('');
  const [textStyle, setTextStyle] = useState<SparkTextStyle>('caption');
  const [isMuted, setIsMuted] = useState(false);

  const durationSec = useMemo(() => {
    if (!media.durationMs) return 15;
    return Math.max(1, Math.round(media.durationMs / 1000));
  }, [media.durationMs]);

  const selectedProduct = products.find(p => p.id === state.selectedProductId) ?? null;
  const muteOriginal = state.videoVolumePct <= 0;
  const audioStartTime = state.audio?.audio_start_time ?? state.trimStart;

  // Image Moments still latch music (no FeedVideo) — play the bg track alone.
  useSparkBackgroundAudio({
    audioUrl: media.type === 'image' ? (state.audio?.audio_url ?? null) : null,
    audioStartTime,
    musicVolumePct: state.musicVolumePct,
    active: media.type === 'image' && previewPlaying && !!state.audio?.audio_url,
    muted: isMuted,
    shouldMount: media.type === 'image' && !!state.audio?.audio_url,
  });

  useEffect(() => {
    setPreviewPlaying(true);
    setPreviewFailed(false);
    setIsMuted(false);
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H14',
      location: 'SparkEditor.tsx:mountMedia',
      message: 'SparkEditor media ready',
      data: {
        type: media.type,
        uriScheme: String(media.uri || '').split(':')[0] || null,
        hasDuration: !!media.durationMs,
      },
      runId: 'publish-debug',
    });
    // #endregion
  }, [media.uri, media.type, media.durationMs, state.audio?.audio_track_id]);

  const openTool = (id: Exclude<ToolId, null>) => {
    void hapticLight();
    setActiveTool(prev => (prev === id ? null : id));
  };

  const setVideoVolume = (pct: number) => {
    onChange({ videoVolumePct: clampVolumePct(pct) });
  };

  const setMusicVolume = (pct: number) => {
    onChange({ musicVolumePct: clampVolumePct(pct) });
  };

  const toggleMuteOriginal = (enabled: boolean) => {
    if (enabled) {
      onChange({ videoVolumePct: 0, musicVolumePct: Math.max(state.musicVolumePct, 100) });
      return;
    }
    onChange({ videoVolumePct: state.videoVolumePct <= 0 ? 50 : state.videoVolumePct });
  };

  const runAiMagic = async () => {
    void hapticSuccess();
    setAiOpen(true);
    setAiLoading(true);
    try {
      const result = await runSparkAiEnhance(
        {
          location: locationHint,
          productTitle: selectedProduct?.title,
          audioTitle: state.audio?.audio_title,
          audioArtist: state.audio?.audio_artist,
          cityHint: locationHint,
        },
        { video: state.videoVolumePct, music: state.musicVolumePct },
      );
      setAiCaptions(result.captions);
      setAiHashtags(result.hashtags);
      if (result.audioDusted) {
        onChange({
          videoVolumePct: result.audioBalance.video,
          musicVolumePct: result.audioBalance.music,
        });
        Toast.show({
          type: 'success',
          text1: 'Audio Duster applied',
          text2: 'Music ducked so dialogue stays clear.',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'AI Magic unavailable',
        text2: 'Please try again in a moment.',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const applyCaption = (option: AiCaptionOption) => {
    onApplyAiCaption?.(option.text, aiHashtags);
    Toast.show({
      type: 'success',
      text1: 'Caption applied',
      text2: option.label,
    });
    setAiOpen(false);
  };

  const addTextOverlay = () => {
    const text = textDraft.trim();
    if (!text) return;
    const next: SparkTextOverlay = {
      id: `t_${Date.now()}`,
      text: text.normalize('NFC'),
      style: textStyle,
    };
    onChange({ textOverlays: [...state.textOverlays, next].slice(-6) });
    setTextDraft('');
    void hapticLight();
  };

  const trimSpan = Math.max(1, state.trimEnd - state.trimStart);
  const startPct = state.trimStart / durationSec;
  const endPct = state.trimEnd / durationSec;

  return (
    <ErrorBoundary
      fallbackTitle="Editor hit a snag"
      fallbackMessage="Your media is still selected. Tap Retry Editor or close and try again."
      refreshLabel="Retry Editor"
      onRefresh={() => setPreviewFailed(false)}
    >
    <View style={s.root}>
      {/* 9:16 full-bleed canvas */}
      <View style={[s.canvas, frameStyle(state.frame)]}>
        {media.type === 'video' ? (
          previewFailed ? (
            <View style={s.previewFallback}>
              <Text style={s.previewFallbackEmoji}>🎬</Text>
              <Text style={s.previewFallbackTitle}>Video selected</Text>
              <Text style={s.previewFallbackBody}>
                Preview unavailable on this device — tap Continue to publish anyway.
              </Text>
            </View>
          ) : (
            <FeedVideo
              key={`spark-preview-${media.uri}-${state.audio?.audio_track_id ?? 'none'}-${Math.round(audioStartTime * 10)}`}
              uri={media.uri}
              active={previewPlaying}
              preload
              muted={isMuted}
              loop
              style={s.video}
              backgroundAudioUrl={state.audio?.audio_url ?? null}
              audioStartTime={audioStartTime}
              videoVolumePct={state.videoVolumePct}
              musicVolumePct={state.musicVolumePct}
              onReady={() => {
                // #region agent log
                agentDebugLog({
                  hypothesisId: 'H14',
                  location: 'SparkEditor.tsx:videoReady',
                  message: 'Spark editor video ready (music latched)',
                  data: {
                    uriScheme: String(media.uri || '').split(':')[0] || null,
                    hasAudio: !!state.audio?.audio_url,
                    audioStart: audioStartTime,
                  },
                  runId: 'publish-debug',
                });
                // #endregion
              }}
              onError={() => {
                setPreviewFailed(true);
                // #region agent log
                agentDebugLog({
                  hypothesisId: 'H14',
                  location: 'SparkEditor.tsx:videoError',
                  message: 'Spark editor video failed — showing fallback',
                  data: { uriScheme: String(media.uri || '').split(':')[0] || null },
                  runId: 'publish-debug',
                });
                // #endregion
              }}
            />
          )
        ) : (
          <Image source={{ uri: media.uri }} style={s.video} resizeMode="cover" />
        )}
        {media.type === 'video' && !previewFailed ? (
          <MuteTapOverlay
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(m => !m)}
            insetRight={78}
            insetTop={insets.top + 72}
            insetBottom={insets.bottom + 90}
          />
        ) : null}
        <View pointerEvents="none" style={[s.filterOverlay, { backgroundColor: filterTint(state.filter) }]} />
        {state.frame === 'film' ? (
          <View pointerEvents="none" style={s.filmBars}>
            <View style={s.filmBar} />
            <View style={s.filmBar} />
          </View>
        ) : null}

        {state.textOverlays.map((overlay, idx) => (
          <Animated.View
            key={overlay.id}
            entering={FadeInDown.delay(idx * 40)}
            style={[s.textLayer, { top: 28 + idx * 54 }]}
            pointerEvents="none"
          >
            <Text style={textOverlayStyle(overlay.style)}>{overlay.text}</Text>
          </Animated.View>
        ))}

        {/* Instagram-style music chip — tap to change; empty → Add music CTA */}
        {state.audio ? (
          <TouchableOpacity
            style={[s.audioChip, { top: insets.top + 58 }]}
            activeOpacity={0.88}
            onPress={() => {
              void hapticLight();
              onOpenMusic();
            }}
          >
            <Text style={s.audioChipText} numberOfLines={1}>
              🎵 {state.audio.audio_title} · {state.audio.audio_artist}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.addMusicCta, { top: insets.top + 58 }]}
            activeOpacity={0.9}
            onPress={() => {
              void hapticLight();
              onOpenMusic();
            }}
          >
            <Text style={s.addMusicCtaText}>🎵 Add music</Text>
          </TouchableOpacity>
        )}

        {selectedProduct ? (
          <View style={[s.productTag, { bottom: insets.bottom + 28 }]} pointerEvents="none">
            <Text style={s.productTagText} numberOfLines={1}>🏷️ {selectedProduct.title}</Text>
          </View>
        ) : null}
      </View>

      {/* Top floating bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <SpringPressable onPress={onClose} style={s.topIconBtn}>
          <GlassSurface radius={22} intensity={36} style={s.glassBtn}>
            <Text style={s.topIconText}>✕</Text>
          </GlassSurface>
        </SpringPressable>

        <SpringPressable onPress={() => void runAiMagic()} style={s.aiPillWrap}>
          <GlassSurface radius={22} intensity={40} style={s.aiPill}>
            <Text style={s.aiPillText}>✨ AI Magic</Text>
          </GlassSurface>
        </SpringPressable>

        <SpringPressable
          onPress={() => {
            void hapticLight();
            // #region agent log
            agentDebugLog({
              hypothesisId: 'H14',
              location: 'SparkEditor.tsx:onNext',
              message: 'Spark editor Continue tapped',
              data: { type: media.type, previewFailed },
              runId: 'publish-debug',
            });
            // #endregion
            onNext();
          }}
          style={s.continueBtn}
        >
          <GlassSurface radius={22} intensity={40} style={s.continueInner}>
            <Text style={s.continueText}>Next</Text>
            <Text style={s.nextIcon}>→</Text>
          </GlassSurface>
        </SpringPressable>
      </View>

      {/* Right tool sidebar */}
      <Animated.View
        entering={FadeInRight.delay(80)}
        style={[s.sidebar, { top: insets.top + 110 }]}
      >
        {TOOLS.map(tool => {
          const active = activeTool === tool.id || (tool.id === 'audio' && !!state.audio);
          return (
            <SpringPressable
              key={tool.id}
              onPress={() => openTool(tool.id)}
              style={s.toolWrap}
            >
              <GlassSurface
                radius={18}
                intensity={active ? 50 : 28}
                style={[s.toolBtn, active && s.toolBtnActive]}
              >
                <Text style={s.toolIcon}>{tool.icon}</Text>
                <Text style={s.toolLabel}>{tool.label}</Text>
              </GlassSurface>
            </SpringPressable>
          );
        })}
      </Animated.View>

      {/* Play / pause */}
      <TouchableOpacity
        style={[s.playFab, { bottom: insets.bottom + 28 }]}
        onPress={() => setPreviewPlaying(p => !p)}
        activeOpacity={0.85}
      >
        <GlassSurface radius={24} intensity={40} style={s.playFabInner}>
          <Text style={s.playFabText}>{previewPlaying ? '⏸' : '▶️'}</Text>
        </GlassSurface>
      </TouchableOpacity>

      {/* Tool panels */}
      {activeTool === 'audio' ? (
        <Animated.View entering={SlideInRight} exiting={SlideOutRight} style={[s.panel, { bottom: insets.bottom + 16 }]}>
          <GlassSurface radius={20} intensity={45} style={s.panelInner}>
            <Text style={s.panelTitle}>Audio Mix</Text>
            <Text style={s.panelHint}>
              Balance original video sound with your background track.
            </Text>

            <View style={s.muteRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.muteLabel}>Mute Original Video Sound</Text>
                <Text style={s.muteSub}>
                  Sets original audio to 0% while keeping the background track at full volume.
                </Text>
              </View>
              <Switch
                value={muteOriginal}
                onValueChange={toggleMuteOriginal}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: Colors.orange }}
                thumbColor={Colors.white}
              />
            </View>

            <Text style={s.sliderLabel}>Original Audio · {state.videoVolumePct}%</Text>
            <VolumeScrubber
              value={state.videoVolumePct}
              onChange={setVideoVolume}
              disabled={muteOriginal}
            />

            <Text style={[s.sliderLabel, { marginTop: 12 }]}>
              Background Track · {state.musicVolumePct}%
            </Text>
            <VolumeScrubber
              value={state.musicVolumePct}
              onChange={setMusicVolume}
            />

            <View style={s.audioActions}>
              <TouchableOpacity
                style={s.addMusicBtn}
                onPress={() => {
                  void hapticLight();
                  onOpenMusic();
                }}
              >
                <Text style={s.addMusicBtnText}>
                  {state.audio ? 'Change music' : 'Add music'}
                </Text>
              </TouchableOpacity>
              {state.audio ? (
                <TouchableOpacity onPress={() => onChange({ audio: null })}>
                  <Text style={s.clearText}>Remove track</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {state.audio ? (
              <Text style={s.panelHint} numberOfLines={2}>
                ♪ {state.audio.audio_title} · starts at {Math.round(audioStartTime)}s
              </Text>
            ) : null}
          </GlassSurface>
        </Animated.View>
      ) : null}

      {activeTool === 'trim' ? (
        <Animated.View entering={SlideInRight} exiting={SlideOutRight} style={[s.panel, { bottom: insets.bottom + 16 }]}>
          <GlassSurface radius={20} intensity={45} style={s.panelInner}>
            <Text style={s.panelTitle}>Trim & Speed</Text>
            <Text style={s.panelHint}>
              {state.trimStart}s – {state.trimEnd}s · {trimSpan}s clip · {state.speed}x
            </Text>
            <View style={s.timelineTrack}>
              <View style={[s.timelineFill, { left: `${startPct * 100}%`, width: `${(endPct - startPct) * 100}%` }]} />
            </View>
            <View style={s.trimRow}>
              <TouchableOpacity style={s.chip} onPress={() => onChange({ trimStart: Math.max(0, state.trimStart - 1) })}>
                <Text style={s.chipText}>− Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chip} onPress={() => onChange({ trimStart: Math.min(state.trimEnd - 1, state.trimStart + 1) })}>
                <Text style={s.chipText}>+ Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chip} onPress={() => onChange({ trimEnd: Math.max(state.trimStart + 1, state.trimEnd - 1) })}>
                <Text style={s.chipText}>− End</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chip} onPress={() => onChange({ trimEnd: Math.min(durationSec, state.trimEnd + 1) })}>
                <Text style={s.chipText}>+ End</Text>
              </TouchableOpacity>
            </View>
            <View style={s.speedRow}>
              {SPEEDS.map(speed => (
                <TouchableOpacity
                  key={speed}
                  style={[s.speedChip, state.speed === speed && s.speedChipActive]}
                  onPress={() => onChange({ speed })}
                >
                  <Text style={[s.speedText, state.speed === speed && s.speedTextActive]}>{speed}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassSurface>
        </Animated.View>
      ) : null}

      {activeTool === 'frames' ? (
        <Animated.View entering={SlideInRight} exiting={SlideOutRight} style={[s.panel, { bottom: insets.bottom + 16 }]}>
          <GlassSurface radius={20} intensity={45} style={s.panelInner}>
            <Text style={s.panelTitle}>Frames & Filters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[s.filterChip, state.filter === f.id && s.filterChipActive]}
                  onPress={() => onChange({ filter: f.id })}
                >
                  <View style={[s.filterSwatch, { backgroundColor: f.tint === 'transparent' ? '#333' : f.tint }]} />
                  <Text style={s.filterLabel}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.frameRow}>
              {FRAMES.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[s.frameChip, state.frame === f.id && s.frameChipActive]}
                  onPress={() => onChange({ frame: f.id })}
                >
                  <Text style={[s.frameText, state.frame === f.id && s.frameTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassSurface>
        </Animated.View>
      ) : null}

      {activeTool === 'text' ? (
        <Animated.View entering={SlideInRight} exiting={SlideOutRight} style={[s.panel, { bottom: insets.bottom + 16 }]}>
          <GlassSurface radius={20} intensity={45} style={s.panelInner}>
            <Text style={s.panelTitle}>Text Overlay</Text>
            <View style={s.styleRow}>
              {(['caption', 'sticker', 'headline'] as SparkTextStyle[]).map(st => (
                <TouchableOpacity
                  key={st}
                  style={[s.styleChip, textStyle === st && s.styleChipActive]}
                  onPress={() => setTextStyle(st)}
                >
                  <Text style={[s.styleText, textStyle === st && s.styleTextActive]}>
                    {st === 'caption' ? 'Caption' : st === 'sticker' ? 'Sticker' : 'Headline'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Add a caption or sticker…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.textInput}
              maxLength={80}
            />
            <View style={s.textActions}>
              <TouchableOpacity style={s.addTextBtn} onPress={addTextOverlay}>
                <Text style={s.addTextBtnText}>Add to canvas</Text>
              </TouchableOpacity>
              {state.textOverlays.length ? (
                <TouchableOpacity onPress={() => onChange({ textOverlays: [] })}>
                  <Text style={s.clearText}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </GlassSurface>
        </Animated.View>
      ) : null}

      {activeTool === 'product' ? (
        <Animated.View entering={SlideInRight} exiting={SlideOutRight} style={[s.panel, { bottom: insets.bottom + 16 }]}>
          <GlassSurface radius={20} intensity={45} style={s.panelInner}>
            <Text style={s.panelTitle}>Product Tag</Text>
            {productsLoading ? (
              <ActivityIndicator color={Colors.orange} />
            ) : products.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.productRow}>
                <TouchableOpacity
                  style={[s.productChip, !state.selectedProductId && s.productChipActive]}
                  onPress={() => onChange({ selectedProductId: null })}
                >
                  <Text style={s.productChipText}>None</Text>
                </TouchableOpacity>
                {products.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.productChip, state.selectedProductId === p.id && s.productChipActive]}
                    onPress={() => onChange({ selectedProductId: p.id })}
                  >
                    <Text style={s.productChipText} numberOfLines={1}>{p.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={s.panelHint}>Add products to your shop to tag them here.</Text>
            )}
          </GlassSurface>
        </Animated.View>
      ) : null}

      {/* AI Magic drawer */}
      {aiOpen ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.aiBackdrop}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setAiOpen(false)} />
          <Animated.View entering={FadeInDown} style={[s.aiSheet, { paddingBottom: insets.bottom + 16 }]}>
            {Platform.OS !== 'web' ? (
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            ) : null}
            <View style={s.aiSheetInner}>
              <View style={s.aiHandle} />
              <Text style={s.aiTitle}>✨ AI Magic</Text>
              <Text style={s.aiSub}>Captions, hashtags, and audio ducking in one tap.</Text>

              {aiLoading ? (
                <ActivityIndicator color={Colors.orange} style={{ marginVertical: 28 }} />
              ) : (
                <>
                  <Text style={s.aiSection}>Caption options</Text>
                  {aiCaptions.map(opt => (
                    <TouchableOpacity key={opt.id} style={s.captionCard} onPress={() => applyCaption(opt)}>
                      <Text style={s.captionLabel}>{opt.label}</Text>
                      <Text style={s.captionBody}>{opt.text}</Text>
                    </TouchableOpacity>
                  ))}

                  <Text style={s.aiSection}>Smart hashtags</Text>
                  <View style={s.hashRow}>
                    {aiHashtags.map(tag => (
                      <View key={tag} style={s.hashChip}>
                        <Text style={s.hashText}>{formatHashtagChip(tag)}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.aiDusterNote}>
                    Audio Duster {state.musicVolumePct < 50 ? 'is active' : 'ready'} — music ducks when dialogue is present.
                  </Text>
                </>
              )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
    </ErrorBoundary>
  );
}

export function createDefaultEditorState(durationMs?: number): SparkEditorState {
  const durationSec = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : 15;
  return {
    trimStart: 0,
    trimEnd: Math.min(15, durationSec),
    speed: 1,
    filter: 'none',
    frame: 'none',
    textOverlays: [],
    selectedProductId: null,
    audio: null,
    videoVolumePct: 0,
    musicVolumePct: 100,
  };
}

const s = createDynamicStyles((Colors) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 20,
  },
  canvas: {
    width: WIN_W,
    height: WIN_H,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#14141C',
    gap: 8,
  },
  previewFallbackEmoji: { fontSize: 36 },
  previewFallbackTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Fonts.bodySemiBold,
  },
  previewFallbackBody: {
    color: Colors.sub,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  continueBtn: { maxWidth: 160 },
  continueInner: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.orange,
  },
  continueText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  filmBars: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  filmBar: {
    height: 48,
    backgroundColor: '#000',
  },
  textLayer: {
    position: 'absolute',
    left: 20,
    right: 72,
  },
  audioChip: {
    position: 'absolute',
    left: 16,
    maxWidth: WIN_W * 0.62,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  audioChipText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  addMusicCta: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  addMusicCtaText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  productTag: {
    position: 'absolute',
    left: 16,
    maxWidth: WIN_W * 0.7,
    backgroundColor: 'rgba(255,87,34,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productTagText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 30,
  },
  topIconBtn: {},
  glassBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: 'rgba(255,87,34,0.35)',
  },
  nextIcon: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  aiPillWrap: { flexShrink: 1 },
  aiPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  aiPillText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sidebar: {
    position: 'absolute',
    right: 10,
    zIndex: 30,
    gap: 10,
  },
  toolWrap: {},
  toolBtn: {
    width: 58,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  toolBtnActive: {
    borderColor: Colors.orange,
  },
  toolIcon: { fontSize: 18 },
  toolLabel: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  playFab: {
    position: 'absolute',
    left: 16,
    zIndex: 25,
  },
  playFabInner: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFabText: { fontSize: 16 },
  panel: {
    position: 'absolute',
    left: 12,
    right: 78,
    zIndex: 35,
  },
  panelInner: {
    padding: 14,
  },
  panelTitle: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    marginBottom: 4,
  },
  panelHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginBottom: 10,
  },
  timelineTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  timelineFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: Colors.orange,
    borderRadius: 4,
  },
  trimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  speedRow: { flexDirection: 'row', gap: 8 },
  speedChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  speedChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  speedText: { color: 'rgba(255,255,255,0.7)', fontWeight: '800' },
  speedTextActive: { color: Colors.white },
  filterRow: { gap: 10, paddingVertical: 4 },
  filterChip: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  filterChipActive: { opacity: 1 },
  filterSwatch: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterLabel: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  frameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  frameChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  frameChipActive: { backgroundColor: Colors.orange },
  frameText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  frameTextActive: { color: Colors.white },
  styleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  styleChipActive: { backgroundColor: Colors.orange },
  styleText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  styleTextActive: { color: Colors.white },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  textActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addTextBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addTextBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  clearText: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingVertical: 4,
  },
  muteLabel: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  muteSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  sliderLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  audioActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
  },
  addMusicBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addMusicBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  productRow: { gap: 8 },
  productChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    maxWidth: 160,
  },
  productChipActive: { backgroundColor: Colors.orange },
  productChipText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  aiBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  aiSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'web' ? '#12121A' : 'transparent',
    maxHeight: WIN_H * 0.72,
  },
  aiSheetInner: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  aiHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  aiSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  aiSection: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },
  captionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    marginBottom: 8,
  },
  captionLabel: {
    color: Colors.orange,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  captionBody: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
  hashRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  hashChip: {
    backgroundColor: 'rgba(255,87,34,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hashText: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  aiDusterNote: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
}));
