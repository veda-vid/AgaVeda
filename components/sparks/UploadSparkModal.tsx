// components/sparks/UploadSparkModal.tsx — Luxury full-screen Spark creation studio

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Alert, ActivityIndicator, Linking, InteractionManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { getProductsByShop } from '../../lib/api';
import type { Product } from '../../types';
import { MediaSourceSheet } from '../media/MediaSourceSheet';
import { CameraCapture, type CapturedMedia } from '../media/CameraCapture';
import {
  SparkEditor,
  createDefaultEditorState,
  type SparkEditorState,
} from './SparkEditor';
import { PublishReviewSheet } from './PublishReviewSheet';
import { MusicPickerModal } from './MusicPickerModal';
import { AudioCutterModal } from './AudioCutterModal';
import type { MusicTrack, SparkAudioSelection } from '../../lib/musicSearch';
import { attachTrackToSpark } from '../../services/musicApi';
import { suggestSmartHashtags } from '../../lib/sparkAiEngine';
import { agentDebugLog } from '../../lib/agentDebugLog';

type Step = 'source' | 'capture' | 'edit' | 'review';

export type SparkPublishPayload = {
  media: CapturedMedia;
  caption: string;
  tags: string[];
  location: string;
  coverUri?: string | null;
  productId?: string | null;
  audio_track_id?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  audio_url?: string | null;
  music_track_url?: string | null;
  audio_start_time?: number | null;
  audio_volume_balance?: { video: number; music: number } | null;
  user_id?: string | null;
  seller_id?: string | null;
  /** Instagram-style: also post the same media as a 24h Story. */
  also_share_to_story?: boolean;
};

export type UploadSparkModalProps = {
  visible: boolean;
  posting?: boolean;
  defaultLocation?: string;
  shopId?: string | null;
  serviceProviderId?: string | null;
  userId?: string | null;
  onClose: () => void;
  /** Parent should dismiss modal immediately and upload in background. */
  onPublish: (payload: SparkPublishPayload) => Promise<void> | void;
};

/**
 * Seller/pro Spark upload entry — full-screen Reels/Shorts-style creation studio.
 * Gallery permissions: get → request → Videos picker with guaranteed finally reset.
 */
export function UploadSparkModal({
  visible,
  posting = false,
  defaultLocation = '',
  shopId = null,
  serviceProviderId = null,
  userId = null,
  onClose,
  onPublish,
}: UploadSparkModalProps) {
  const [step, setStep] = useState<Step>('source');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('video');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [media, setMedia] = useState<CapturedMedia | null>(null);
  const [editor, setEditor] = useState<SparkEditorState>(createDefaultEditorState());
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState(defaultLocation);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [alsoShareToStory, setAlsoShareToStory] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [cutterTrack, setCutterTrack] = useState<MusicTrack | null>(null);
  const [pickingGallery, setPickingGallery] = useState(false);
  const [shellKey, setShellKey] = useState(0);
  const wasVisibleRef = useRef(false);

  const patchEditor = useCallback((patch: Partial<SparkEditorState>) => {
    setEditor(prev => ({ ...prev, ...patch }));
  }, []);

  const resetAll = useCallback(() => {
    setStep('source');
    setSheetOpen(false);
    setCameraOpen(false);
    setMedia(null);
    setEditor(createDefaultEditorState());
    setCaption('');
    setTags([]);
    setLocation(defaultLocation);
    setCoverUri(null);
    setSuggestedHashtags([]);
    setAlsoShareToStory(false);
    setSharing(false);
    setMusicModalOpen(false);
    setCutterTrack(null);
    setPickingGallery(false);
  }, [defaultLocation]);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      resetAll();
      return;
    }
    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      setLocation(defaultLocation);
      setStep('source');
      // Defer sheet open so the opening tap cannot dismiss it (Android touch bleed)
      const task = InteractionManager.runAfterInteractions(() => {
        setSheetOpen(true);
      });
      return () => {
        task.cancel?.();
      };
    }
  }, [visible, defaultLocation, resetAll]);

  useEffect(() => {
    if (!visible || !shopId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    void getProductsByShop(shopId)
      .then(rows => { if (!cancelled) setProducts(rows); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, shopId]);

  const enterStudio = (next: CapturedMedia) => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H9',
      location: 'UploadSparkModal.tsx:enterStudio',
      message: 'Entering Moment editor with media',
      data: {
        type: next.type,
        uriScheme: String(next.uri || '').split(':')[0] || null,
        hasDuration: !!next.durationMs,
      },
      runId: 'publish-debug',
    });
    // #endregion
    setMedia(next);
    setEditor(createDefaultEditorState(next.durationMs));
    setCoverUri(next.uri);
    setSheetOpen(false);
    setCameraOpen(false);
    setStep('edit');
    setShellKey(k => k + 1);
    setSuggestedHashtags(
      suggestSmartHashtags({
        location: location || defaultLocation,
        cityHint: defaultLocation,
      }),
    );
  };

  const pickFromGallery = async () => {
    if (pickingGallery) return;
    setPickingGallery(true);
    setSheetOpen(false);
    try {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H9',
        location: 'UploadSparkModal.tsx:pickFromGallery:start',
        message: 'Gallery picker starting',
        data: { platform: Platform.OS },
        runId: 'publish-debug',
      });
      // #endregion
      try {
        const { persistAgentDebugLogs } = await import('../../lib/agentDebugLog');
        await persistAgentDebugLogs();
      } catch { /* ignore */ }

      if (Platform.OS !== 'web') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        let status = current.status;
        const canAskAgain = (current as { canAskAgain?: boolean }).canAskAgain !== false;

        if (status !== 'granted' && !canAskAgain) {
          Alert.alert(
            'Photo library blocked',
            'Vedastya cannot access your videos. Enable Photos / Media permission in Settings, or record a Moment with the camera instead.',
            [
              { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
              {
                text: 'Use Camera',
                onPress: () => {
                  setCameraMode('video');
                  setCameraOpen(true);
                  setStep('capture');
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ],
          );
          setSheetOpen(true);
          setStep('source');
          return;
        }

        if (status !== 'granted') {
          const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted') {
          Alert.alert(
            'Photo library access needed',
            'Allow Vedastya to access your videos so you can upload a Moment from your gallery, or record with the camera instead.',
            [
              { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
              { text: 'OK', style: 'cancel' },
            ],
          );
          setSheetOpen(true);
          setStep('source');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
        videoMaxDuration: 60,
        // Prefer smaller exports so Moments stay under storage caps
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });

      // #region agent log
      agentDebugLog({
        hypothesisId: 'H9',
        location: 'UploadSparkModal.tsx:pickFromGallery:result',
        message: 'Gallery picker returned',
        data: {
          canceled: !!result.canceled,
          assetCount: result.assets?.length ?? 0,
          assetType: result.assets?.[0]?.type ?? null,
          uriScheme: result.assets?.[0]?.uri ? String(result.assets[0].uri).split(':')[0] : null,
        },
        runId: 'publish-debug',
      });
      // #endregion

      if (result.canceled || !result.assets[0]) {
        setSheetOpen(true);
        setStep('source');
        return;
      }

      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(asset.uri);
      // Allow still images too (product photos) — editor shows Image instead of video player
      const next: CapturedMedia = {
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        durationMs: asset.duration ? asset.duration * 1000 : undefined,
      };
      enterStudio(next);
    } catch (e: any) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H9',
        location: 'UploadSparkModal.tsx:pickFromGallery:error',
        message: 'Gallery picker failed',
        data: { errorMessage: e?.message ?? String(e) },
        runId: 'publish-debug',
      });
      // #endregion
      Alert.alert(
        'Could not open gallery',
        e?.message || 'Please try again, or record a Moment with the camera instead.',
      );
      setSheetOpen(true);
      setStep('source');
    } finally {
      setPickingGallery(false);
    }
  };

  const onSourceSelect = (choice: 'camera' | 'gallery' | 'record') => {
    if (choice === 'gallery') {
      void pickFromGallery();
      return;
    }
    setSheetOpen(false);
    setCameraMode(choice === 'record' ? 'video' : 'photo');
    setCameraOpen(true);
    setStep('capture');
  };

  // Recover from empty black overlay after Android gallery returns / activity recreation
  useEffect(() => {
    if (!visible) return;
    if (step !== 'source') return;
    if (sheetOpen || pickingGallery || cameraOpen || media) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setSheetOpen(true);
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H9',
        location: 'UploadSparkModal.tsx:recoverEmptyStudio',
        message: 'Reopened source sheet to escape blank overlay',
        data: {},
        runId: 'publish-debug',
      });
      // #endregion
    });
    return () => { task.cancel?.(); };
  }, [visible, step, sheetOpen, pickingGallery, cameraOpen, media]);

  const onCaptured = (captured: CapturedMedia) => {
    enterStudio(captured);
  };

  const applyAudioSelection = (audio: SparkAudioSelection) => {
    const track: MusicTrack = {
      id: audio.audio_track_id,
      title: audio.audio_title,
      artist: audio.audio_artist,
      albumArt: null,
      previewUrl: audio.audio_url,
      durationMs: (audio.audio_duration_sec ?? 30) * 1000,
    };
    const start = audio.audio_start_time ?? 0;
    const span = Math.max(1, editor.trimEnd - editor.trimStart);
    const attached = attachTrackToSpark(
      track,
      { startSec: start, endSec: start + span },
      {
        video: editor.audio ? editor.videoVolumePct : 0,
        music: editor.audio ? editor.musicVolumePct : 100,
      },
    );
    patchEditor({
      audio: {
        ...attached,
        audio_start_time: start,
        audio_duration_sec: audio.audio_duration_sec ?? span,
      },
      videoVolumePct: editor.audio ? editor.videoVolumePct : 0,
      musicVolumePct: editor.audio ? editor.musicVolumePct : 100,
    });
  };

  const handlePickTrack = (track: MusicTrack) => {
    setMusicModalOpen(false);
    setCutterTrack(track);
  };

  const handleCutterConfirm = (audio: SparkAudioSelection) => {
    setCutterTrack(null);
    applyAudioSelection(audio);
    Toast.show({
      type: 'success',
      text1: 'Track latched',
      text2: `${audio.audio_title} plays with your Moment from ${Math.round(audio.audio_start_time ?? 0)}s`,
    });
  };

  const handleApplyAiCaption = (nextCaption: string, nextTags: string[]) => {
    setCaption(nextCaption);
    setTags(nextTags);
    setSuggestedHashtags(nextTags);
  };

  const publish = () => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H7',
      location: 'UploadSparkModal.tsx:publish',
      message: 'Moment Publish tapped in review sheet',
      data: {
        hasMedia: !!media,
        mediaType: media?.type ?? null,
        uriScheme: media?.uri ? String(media.uri).split(':')[0] : null,
        hasAudio: !!(editor.audio?.audio_url),
        alsoShareToStory,
        sharing,
      },
      runId: 'publish-debug',
    });
    // #endregion
    if (!media) {
      Alert.alert('Add media', 'Record or choose a video for your Moment.');
      return;
    }
    if (sharing) return;
    setSharing(true);

    const audioUrl = editor.audio?.audio_url ?? null;
    const audioStart = editor.audio?.audio_start_time ?? editor.trimStart;
    const balance = {
      video: editor.videoVolumePct,
      music: editor.musicVolumePct,
    };

    Toast.show({
      type: 'info',
      text1: 'Posting Moment…',
      text2: alsoShareToStory
        ? 'Optimizing video, then sharing to Moments + Story'
        : 'Optimizing video if needed, then uploading',
    });

    // Fire-and-forget: parent dismisses immediately and uploads in background
    try {
      const result = onPublish({
        media,
        caption: caption.trim().normalize('NFC'),
        tags: tags.map(t => t.replace(/^#/, '').normalize('NFC')),
        location: location.trim().normalize('NFC'),
        coverUri: coverUri ?? media.uri,
        productId: editor.selectedProductId,
        audio_track_id: editor.audio?.audio_track_id ?? null,
        audio_title: editor.audio?.audio_title ?? null,
        audio_artist: editor.audio?.audio_artist ?? null,
        audio_url: audioUrl,
        music_track_url: audioUrl,
        audio_start_time: audioStart,
        audio_volume_balance: balance,
        user_id: userId,
        seller_id: shopId ?? serviceProviderId,
        also_share_to_story: alsoShareToStory,
      });
      void Promise.resolve(result).catch((e: any) => {
        setSharing(false);
        Toast.show({
          type: 'error',
          text1: 'Publish failed',
          text2: e?.message || 'Could not upload your Moment. Please try again.',
        });
      });
    } catch (e: any) {
      setSharing(false);
      Toast.show({
        type: 'error',
        text1: 'Publish failed',
        text2: e?.message || 'Could not upload your Moment. Please try again.',
      });
    }
  };

  const handleClose = () => {
    if (posting) return;
    setCameraOpen(false);
    setSheetOpen(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <View
      key={`spark-studio-${shellKey}`}
      style={s.overlay}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      <MediaSourceSheet
        visible={sheetOpen && !cameraOpen && step === 'source'}
        title="Create Moment"
        allowRecord
        embedded
        onClose={handleClose}
        onSelect={onSourceSelect}
      />

      {step === 'source' && !sheetOpen && pickingGallery ? (
        <View style={s.backdrop}>
          <View style={s.loadingSheet}>
            <View style={s.handle} />
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 28 }} />
            <Text style={s.loadingTitle}>Opening gallery…</Text>
          </View>
        </View>
      ) : null}

      {step === 'edit' && media ? (
        <SparkEditor
          media={media}
          state={editor}
          products={products}
          productsLoading={productsLoading}
          locationHint={location || defaultLocation}
          onChange={patchEditor}
          onClose={handleClose}
          onNext={() => {
            setSuggestedHashtags(
              suggestSmartHashtags({
                location: location || defaultLocation,
                productTitle: products.find(p => p.id === editor.selectedProductId)?.title,
                audioTitle: editor.audio?.audio_title,
                cityHint: defaultLocation,
              }),
            );
            setStep('review');
          }}
          onOpenMusic={() => setMusicModalOpen(true)}
          onApplyAiCaption={handleApplyAiCaption}
        />
      ) : null}

      {step === 'review' && media ? (
        <PublishReviewSheet
          visible
          media={media}
          editor={editor}
          caption={caption}
          tags={tags}
          location={location}
          coverUri={coverUri}
          products={products}
          productsLoading={productsLoading}
          posting={sharing}
          suggestedHashtags={suggestedHashtags}
          alsoShareToStory={alsoShareToStory}
          onChangeCaption={setCaption}
          onChangeTags={setTags}
          onChangeLocation={setLocation}
          onChangeProduct={id => patchEditor({ selectedProductId: id })}
          onChangeAlsoShareToStory={setAlsoShareToStory}
          onBack={() => setStep('edit')}
          onPublish={publish}
        />
      ) : null}

      <CameraCapture
        visible={cameraOpen}
        mode={cameraMode}
        onClose={() => {
          setCameraOpen(false);
          if (!media) handleClose();
          else setStep('edit');
        }}
        onCapture={onCaptured}
      />

      <MusicPickerModal
        visible={musicModalOpen}
        cityHint={location || defaultLocation}
        trimStartSec={editor.trimStart}
        requireTrim
        onPickTrack={handlePickTrack}
        onClose={() => setMusicModalOpen(false)}
        onSelect={applyAudioSelection}
      />

      <AudioCutterModal
        visible={!!cutterTrack}
        track={cutterTrack}
        defaultWindowSec={15}
        initialStartSec={0}
        onClose={() => setCutterTrack(null)}
        onConfirm={handleCutterConfirm}
      />
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000B',
    justifyContent: 'flex-end',
  },
  loadingSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
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
  loadingTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    marginBottom: 16,
  },
}));
