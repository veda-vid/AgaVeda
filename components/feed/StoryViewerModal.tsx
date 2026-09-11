// components/feed/StoryViewerModal.tsx — Instagram-style Stories (image + video)
// v2: index-based viewer; parent must keep `viewStory` binding for Hermes Fast Refresh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, Modal, Pressable, StyleSheet, Dimensions, StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { softDeleteStory } from '../../lib/api';
import { useSparkBackgroundAudio } from '../../hooks/useSparkBackgroundAudio';
import { parseSparkVolumeBalance } from '../../lib/sparkAudioSync';
import { FeedVideo } from './FeedVideo';
import { isVideoMedia, resolveFeedMediaUrl, timeAgo } from './feedUtils';
import type { Story } from '../../types';

const { width: W, height: H } = Dimensions.get('window');
const IMAGE_STORY_MS = 5000;
const VIDEO_STORY_FALLBACK_MS = 15000;

type Props = {
  visible: boolean;
  stories: Story[];
  startIndex?: number;
  currentUserId?: string | null;
  onClose: () => void;
  /** Called after a successful soft-delete so the parent can drop it from local state. */
  onDeleted?: (storyId: string) => void;
};

function storyThumb(story: Story) {
  const media = resolveFeedMediaUrl(story.media_url);
  const video = isVideoMedia(media, story.media_type);
  if (!video && media) return media;
  return resolveFeedMediaUrl(story.shop_logo) || media;
}

export function StoryViewerModal({
  visible,
  stories,
  startIndex = 0,
  currentUserId,
  onClose,
  onDeleted,
}: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);

  const safeStories = useMemo(
    () => (stories ?? []).filter(s => !!s?.id && !!s?.media_url && !s?.deleted_at),
    [stories],
  );
  const story = safeStories[Math.min(Math.max(0, index), Math.max(0, safeStories.length - 1))] ?? null;
  const mediaUri = resolveFeedMediaUrl(story?.media_url);
  const isVideo = !!(story && isVideoMedia(mediaUri, story.media_type));
  const durationMs = isVideo ? VIDEO_STORY_FALLBACK_MS : IMAGE_STORY_MS;
  const isOwnStory = !!(story?.author_id && currentUserId && story.author_id === currentUserId);
  const audioUrl = typeof story?.audio_url === 'string' ? (story.audio_url.trim() || null) : null;
  const audioBalance = parseSparkVolumeBalance(story?.audio_volume_balance);
  const audioStart = Number(story?.audio_start_time ?? 0) || 0;

  // Image stories with latched music (video uses FeedVideo's own latch).
  useSparkBackgroundAudio({
    audioUrl: !isVideo ? audioUrl : null,
    audioStartTime: audioStart,
    musicVolumePct: audioBalance.music,
    active: visible && !paused && !deleting && !isVideo && !!audioUrl,
    muted,
    shouldMount: visible && !isVideo && !!audioUrl,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    if (index >= safeStories.length - 1) {
      // Never call parent setState inside a setState updater — that crashes RN.
      onClose();
      return;
    }
    setIndex(prev => prev + 1);
  }, [index, onClose, safeStories.length]);

  const goPrev = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    setIndex(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Only re-seed when the modal opens — not when the list shrinks after a delete.
    setIndex(Math.min(Math.max(0, startIndex), Math.max(0, safeStories.length - 1)));
    setProgress(0);
    elapsedRef.current = 0;
    setPaused(false);
    setDeleting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open only
  }, [visible]);

  useEffect(() => {
    clearTimer();
    if (!visible || !story || paused || deleting || safeStories.length === 0) return;

    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startedAtRef.current);
      startedAtRef.current = Date.now();
      elapsedRef.current = elapsed;
      const pct = Math.min(1, elapsed / durationMs);
      setProgress(pct);
      if (pct >= 1) {
        clearTimer();
        goNext();
      }
    }, 50);

    return clearTimer;
  }, [visible, story?.id, paused, deleting, durationMs, clearTimer, goNext, safeStories.length]);

  // After parent removes a deleted story, clamp index / close if empty.
  useEffect(() => {
    if (!visible) return;
    if (safeStories.length === 0) {
      onClose();
      return;
    }
    if (index > safeStories.length - 1) {
      setIndex(safeStories.length - 1);
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [visible, safeStories.length, index, onClose]);

  const onHoldIn = () => {
    elapsedRef.current += Date.now() - startedAtRef.current;
    setPaused(true);
  };
  const onHoldOut = () => {
    startedAtRef.current = Date.now();
    setPaused(false);
  };

  const confirmDelete = useCallback(() => {
    if (!story?.id || !currentUserId || !isOwnStory || deleting) return;
    setPaused(true);
    Alert.alert(
      'Delete story?',
      'This story will be removed from your ring. You can’t undo this.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            startedAtRef.current = Date.now();
            setPaused(false);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await softDeleteStory(story.id, currentUserId);
                onDeleted?.(story.id);
                setProgress(0);
                elapsedRef.current = 0;
              } catch (e: any) {
                Alert.alert('Could not delete', e?.message || 'Please try again.');
                startedAtRef.current = Date.now();
                setPaused(false);
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [story?.id, currentUserId, isOwnStory, deleting, onDeleted]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={s.root}>
        {story && mediaUri ? (
          isVideo ? (
            <FeedVideo
              uri={mediaUri}
              active={!paused && !deleting}
              muted={muted}
              loop={false}
              backgroundAudioUrl={audioUrl}
              audioStartTime={audioStart}
              videoVolumePct={audioUrl ? audioBalance.video : 100}
              musicVolumePct={audioUrl ? audioBalance.music : 0}
              style={s.media}
              onEnded={goNext}
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={s.media} resizeMode="cover" />
          )
        ) : (
          <View style={[s.media, s.mediaFallback]}>
            <Text style={s.fallbackText}>Story unavailable</Text>
          </View>
        )}

        <View style={[s.topChrome, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={s.progressRow}>
            {safeStories.map((item, i) => {
              const fill = i < index ? 1 : i === index ? progress : 0;
              return (
                <View key={item.id} style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${fill * 100}%` }]} />
                </View>
              );
            })}
          </View>

          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <View style={s.avatar}>
                {story && storyThumb(story) ? (
                  <Image source={{ uri: storyThumb(story)! }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarEmoji}>🏪</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.shopName} numberOfLines={1}>
                  {story?.shop_name ?? 'Shop'}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {timeAgo(story?.created_at)}
                  {isVideo ? ' · Video' : ' · Photo'}
                </Text>
              </View>
            </View>
            {isOwnStory ? (
              <Pressable
                onPress={confirmDelete}
                style={s.iconBtn}
                hitSlop={10}
                disabled={deleting}
                accessibilityLabel="Delete story"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.iconBtnText}>🗑️</Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setMuted(m => !m)}
              style={s.iconBtn}
              hitSlop={10}
            >
              <Text style={s.iconBtnText}>{muted ? '🔇' : '🔊'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={s.iconBtn} hitSlop={10}>
              <Text style={s.iconBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Tap zones: left = prev, right = next; hold = pause */}
        <View style={s.tapLayer} pointerEvents="box-none">
          <Pressable
            style={s.tapLeft}
            onPress={goPrev}
            onLongPress={onHoldIn}
            onPressOut={onHoldOut}
            delayLongPress={160}
          />
          <Pressable
            style={s.tapRight}
            onPress={goNext}
            onLongPress={onHoldIn}
            onPressOut={onHoldOut}
            delayLongPress={160}
          />
        </View>

        {story?.caption?.trim() ? (
          <View style={[s.captionWrap, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} pointerEvents="none">
            <Text style={s.caption}>{story.caption.trim()}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Prefer still/logo for ring previews — never feed mp4 URLs into Image. */
export function resolveStoryRingThumb(story: Story) {
  return storyThumb(story);
}

export function isStoryVideo(story: Story) {
  return isVideoMedia(resolveFeedMediaUrl(story.media_url), story.media_type);
}

const s = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    width: W,
    height: H,
    backgroundColor: '#000',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
    backgroundColor: '#000',
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
  },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 16 },
  shopName: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  meta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    marginTop: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iconBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 3,
  },
  tapLeft: { width: '32%', height: '100%' },
  tapRight: { flex: 1, height: '100%' },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    paddingHorizontal: 16,
    paddingTop: 40,
    backgroundColor: Platform.OS === 'web'
      ? 'rgba(0,0,0,0.45)'
      : 'transparent',
  },
  caption: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
}));
