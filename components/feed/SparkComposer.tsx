import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Platform, Alert, Pressable, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { getProductsByShop } from '../../lib/api';
import type { Product } from '../../types';
import { MediaSourceSheet } from '../media/MediaSourceSheet';
import { CameraCapture, type CapturedMedia } from '../media/CameraCapture';
import { FeedVideo } from '../feed/FeedVideo';
import { SparkLocationPicker } from '../feed/SparkLocationPicker';
import { MusicSelectorModal } from '../feed/MusicSelectorModal';
import type { SparkAudioSelection } from '../../lib/musicSearch';
import { clampVolumePct, DEFAULT_SPARK_VOLUME_BALANCE } from '../../lib/sparkAudioSync';
import { agentDebugLog, flushAgentDebugLogs, persistAgentDebugLogs } from '../../lib/agentDebugLog';

type SparkComposerProps = {
  visible: boolean;
  posting?: boolean;
  defaultLocation?: string;
  shopId?: string | null;
  onClose: () => void;
  onPublish: (payload: {
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
    audio_start_time?: number | null;
    audio_volume_balance?: { video: number; music: number } | null;
  }) => Promise<void> | void;
};

type Step = 'source' | 'capture' | 'details';

export function SparkComposer({
  visible,
  posting = false,
  defaultLocation = '',
  shopId = null,
  onClose,
  onPublish,
}: SparkComposerProps) {
  const [step, setStep] = useState<Step>('source');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('video');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [media, setMedia] = useState<CapturedMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<SparkAudioSelection | null>(null);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [videoVolumePct, setVideoVolumePct] = useState(DEFAULT_SPARK_VOLUME_BALANCE.video);
  const [musicVolumePct, setMusicVolumePct] = useState(DEFAULT_SPARK_VOLUME_BALANCE.music);

  const [pickingGallery, setPickingGallery] = useState(false);
  const wasVisibleRef = useRef(false);
  const loggedDetailsRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      setStep('source');
      setSheetOpen(false);
      setCameraOpen(false);
      setMedia(null);
      setCaption('');
      setTags('');
      setLocation(defaultLocation);
      setTrimStart(0);
      setTrimEnd(15);
      setSelectedProductId(null);
      setSelectedAudio(null);
      setMusicModalOpen(false);
      setPreviewPlaying(false);
      setVideoVolumePct(DEFAULT_SPARK_VOLUME_BALANCE.video);
      setMusicVolumePct(DEFAULT_SPARK_VOLUME_BALANCE.music);
      setPickingGallery(false);
      loggedDetailsRef.current = false;
      // #region agent log
      agentDebugLog({hypothesisId:'H1',location:'SparkComposer.tsx:visibleFalse',message:'Composer hidden/reset',data:{shopId}});
      // #endregion
      return;
    }
    // Only reset to source sheet on open transition — not when defaultLocation changes mid-pick
    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      loggedDetailsRef.current = false;
      setLocation(defaultLocation);
      setSheetOpen(true);
      setStep('source');
      // #region agent log
      agentDebugLog({hypothesisId:'H1',location:'SparkComposer.tsx:visibleTrue',message:'Composer opened — source sheet should show',data:{shopId,defaultLocation,sheetOpenWillBe:true}});
      // #endregion
    }
  }, [visible, defaultLocation, shopId]);

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

  const durationSec = useMemo(() => {
    if (!media?.durationMs) return null;
    return Math.max(1, Math.round(media.durationMs / 1000));
  }, [media]);

  const pickFromGallery = async () => {
    if (pickingGallery) return;
    setPickingGallery(true);
    try {
      if (Platform.OS !== 'web') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        let status = current.status;
        const canAskAgain = (current as { canAskAgain?: boolean }).canAskAgain !== false;
        // #region agent log
        agentDebugLog({hypothesisId:'H6',location:'SparkComposer.tsx:galleryPerm',message:'Gallery permission status',data:{status,canAskAgain},runId:'post-fix'});
        // #endregion

        // Permanently denied — requesting again hangs / no-ops on Android; send user to Settings
        if (status !== 'granted' && !canAskAgain) {
          // #region agent log
          agentDebugLog({hypothesisId:'H6',location:'SparkComposer.tsx:galleryPermBlocked',message:'Gallery permission permanently denied',data:{status,canAskAgain:false},runId:'post-fix'});
          // #endregion
          Alert.alert(
            'Photo library blocked',
            'Vedastya cannot access your videos. Enable Photos / Media permission in Settings, or record a Moment with the camera instead.',
            [
              { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
              { text: 'Use Camera', style: 'default', onPress: () => {
                setCameraMode('video');
                setCameraOpen(true);
                setStep('capture');
              } },
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
          // #region agent log
          agentDebugLog({hypothesisId:'H6',location:'SparkComposer.tsx:galleryPermRequested',message:'Gallery permission after request',data:{status},runId:'post-fix'});
          // #endregion
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

      // #region agent log
      agentDebugLog({hypothesisId:'H7',location:'SparkComposer.tsx:galleryLaunch',message:'launchImageLibraryAsync starting',data:{platform:Platform.OS,allowsEditing:false},runId:'post-fix'});
      // #endregion
      await persistAgentDebugLogs();
      // Prefer All on Android — Videos-only picker hangs / fails in some Expo Go builds
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: Platform.OS === 'android'
          ? ImagePicker.MediaTypeOptions.All
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      // #region agent log
      agentDebugLog({hypothesisId:'H7',location:'SparkComposer.tsx:galleryResult',message:'launchImageLibraryAsync returned',data:{canceled:!!result.canceled,assetCount:result.assets?.length??0,assetType:result.assets?.[0]?.type??null},runId:'post-fix'});
      // #endregion
      void flushAgentDebugLogs();

      if (result.canceled || !result.assets[0]) {
        setSheetOpen(true);
        setStep('source');
        return;
      }

      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(asset.uri);
      if (!isVideo) {
        Alert.alert(
          'Video required',
          'Moments need a short video clip (not a photo). Pick a video from your gallery, or use Record Video.',
        );
        setSheetOpen(true);
        setStep('source');
        return;
      }
      const next: CapturedMedia = {
        uri: asset.uri,
        type: 'video',
        durationMs: asset.duration ? asset.duration * 1000 : undefined,
      };
      setMedia(next);
      if (next.durationMs) setTrimEnd(Math.min(15, Math.round(next.durationMs / 1000)));
      setSheetOpen(false);
      setCameraOpen(false);
      setStep('details');
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H12',
        location: 'SparkComposer.tsx:detailsAfterGallery',
        message: 'Advanced to details after gallery pick (overlay)',
        data: { hasDuration: !!next.durationMs, uriScheme: next.uri.split(':')[0] ?? null },
        runId: 'post-fix',
      });
      // #endregion
      void flushAgentDebugLogs();
    } catch (e: any) {
      // #region agent log
      agentDebugLog({hypothesisId:'H7',location:'SparkComposer.tsx:galleryError',message:'gallery picker threw',data:{errorMessage:e?.message??String(e)},runId:'post-fix'});
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
    // #region agent log
    agentDebugLog({hypothesisId:'H13',location:'SparkComposer.tsx:onSourceSelect',message:'Source choice selected',data:{choice},runId:'post-fix'});
    // #endregion
    setSheetOpen(false);
    if (choice === 'gallery') {
      void pickFromGallery();
      return;
    }
    setCameraMode(choice === 'record' ? 'video' : 'photo');
    setCameraOpen(true);
    setStep('capture');
  };

  const onCaptured = (captured: CapturedMedia) => {
    setCameraOpen(false);
    setMedia(captured);
    if (captured.durationMs) setTrimEnd(Math.min(15, Math.round(captured.durationMs / 1000)));
    setStep('details');
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H12',
      location: 'SparkComposer.tsx:detailsAfterCamera',
      message: 'Advanced to details after camera capture (in-shell)',
      data: { type: captured.type },
      runId: 'post-fix',
    });
    // #endregion
  };

  useEffect(() => {
    setSelectedAudio(prev => (prev ? { ...prev, audio_start_time: trimStart } : prev));
  }, [trimStart]);

  const handleSelectAudio = (audio: SparkAudioSelection) => {
    setSelectedAudio({
      ...audio,
      audio_start_time: trimStart,
      audio_volume_balance: { video: videoVolumePct, music: musicVolumePct },
    });
    setPreviewPlaying(true);
  };

  const publish = async () => {
    if (!media) {
      Alert.alert('Add media', 'Record or choose a video/photo for your Moment.');
      return;
    }
    const tagList = tags.trim().split(/[\s,]+/).filter(Boolean).map(t => t.replace(/^#/, ''));
    await onPublish({
      media,
      caption: caption.trim(),
      tags: tagList,
      location: location.trim(),
      coverUri: media.type === 'image' ? media.uri : null,
      productId: selectedProductId,
      audio_track_id: selectedAudio?.audio_track_id ?? null,
      audio_title: selectedAudio?.audio_title ?? null,
      audio_artist: selectedAudio?.audio_artist ?? null,
      audio_url: selectedAudio?.audio_url ?? null,
      audio_start_time: selectedAudio?.audio_start_time ?? trimStart,
      audio_volume_balance: { video: videoVolumePct, music: musicVolumePct },
    });
  };

  const handleClose = () => {
    // #region agent log
    agentDebugLog({hypothesisId:'H3',location:'SparkComposer.tsx:handleClose',message:'Composer handleClose called',data:{posting,step,sheetOpen,cameraOpen,hasMedia:!!media}});
    // #endregion
    if (posting) return;
    setCameraOpen(false);
    setSheetOpen(false);
    onClose();
  };

  // #region agent log
  if (visible && step === 'details' && media && !loggedDetailsRef.current) {
    loggedDetailsRef.current = true;
    agentDebugLog({
      hypothesisId: 'H12',
      location: 'SparkComposer.tsx:detailsRender',
      message: 'Details overlay rendering',
      data: { mediaType: media.type, posting },
      runId: 'post-fix',
    });
  }
  // #endregion

  return (
    <>
      {/* Native Modal for source — embedded View sheet was not receiving taps on Android */}
      <MediaSourceSheet
        visible={!!visible && sheetOpen && !cameraOpen && step === 'source'}
        title="Create Moment"
        allowRecord
        onClose={handleClose}
        onSelect={onSourceSelect}
      />

      {visible && step === 'source' && !sheetOpen && pickingGallery ? (
        <View style={s.overlay} pointerEvents="auto">
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.handle} />
              <ActivityIndicator color={Colors.orange} style={{ marginVertical: 28 }} />
              <Text style={[s.title, { marginBottom: 24 }]}>Opening gallery…</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Details as View overlay — avoids 2nd Modal after ImagePicker on Android */}
      {visible && step === 'details' && !!media && !cameraOpen ? (
        <View style={s.overlay} pointerEvents="auto" accessibilityViewIsModal>
          <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <TouchableOpacity onPress={handleClose} disabled={posting}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.title}>Create Moment</Text>
              <TouchableOpacity onPress={() => { setSheetOpen(true); setStep('source'); }} disabled={posting}>
                <Text style={s.retake}>Retake</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.preview}>
                {media?.type === 'video' ? (
                  <FeedVideo
                    uri={media.uri}
                    active={previewPlaying}
                    muted={false}
                    loop
                    backgroundAudioUrl={selectedAudio?.audio_url}
                    audioStartTime={trimStart}
                    videoVolumePct={videoVolumePct}
                    musicVolumePct={musicVolumePct}
                    style={s.previewMedia}
                  />
                ) : media ? (
                  <Image source={{ uri: media.uri }} style={s.previewMedia} resizeMode="cover" />
                ) : null}
                {media?.type === 'video' ? (
                  <TouchableOpacity
                    style={s.previewPlayBtn}
                    onPress={() => setPreviewPlaying(p => !p)}
                    activeOpacity={0.88}
                  >
                    <Text style={s.previewPlayBtnText}>
                      {previewPlaying ? '⏸ Pause preview' : '▶️ Play preview'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <View style={s.previewBadge}>
                  <Text style={s.previewBadgeText}>
                    {media?.type === 'video' ? 'Video preview' : 'Cover / photo'}
                  </Text>
                </View>
              </View>

              {media?.type === 'video' ? (
                <View style={s.trimCard}>
                  <Text style={s.sectionLabel}>Trim window</Text>
                  <Text style={s.trimHint}>
                    Showing {trimStart}s – {trimEnd}s
                    {durationSec ? ` of ~${durationSec}s` : ''}
                  </Text>
                  <View style={s.trimRow}>
                    <TouchableOpacity
                      style={s.trimChip}
                      onPress={() => setTrimStart(v => Math.max(0, v - 1))}
                    >
                      <Text style={s.trimChipText}>− Start</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.trimChip}
                      onPress={() => setTrimStart(v => Math.min(trimEnd - 1, v + 1))}
                    >
                      <Text style={s.trimChipText}>+ Start</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.trimChip}
                      onPress={() => setTrimEnd(v => Math.max(trimStart + 1, v - 1))}
                    >
                      <Text style={s.trimChipText}>− End</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.trimChip}
                      onPress={() => setTrimEnd(v => v + 1)}
                    >
                      <Text style={s.trimChipText}>+ End</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.trimNote}>
                    Full clip uploads now; trim markers are saved with your caption for later editor polish.
                  </Text>
                </View>
              ) : null}

              {media?.type === 'video' && selectedAudio?.audio_url ? (
                <View style={s.mixerCard}>
                  <Text style={s.sectionLabel}>Audio mix</Text>
                  <VolumeMixerRow
                    label="Original video sound"
                    value={videoVolumePct}
                    onChange={setVideoVolumePct}
                    disabled={posting}
                  />
                  <VolumeMixerRow
                    label="Background music"
                    value={musicVolumePct}
                    onChange={setMusicVolumePct}
                    disabled={posting}
                  />
                  <Text style={s.trimNote}>
                    Preview plays video and music together. Video sound is ducked when music is attached.
                  </Text>
                </View>
              ) : null}

              <Text style={s.sectionLabel}>Caption</Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption…"
                placeholderTextColor={Colors.dim}
                style={s.input}
                multiline
                maxLength={400}
              />

              <Text style={s.sectionLabel}>Tags</Text>
              <TextInput
                value={tags}
                onChangeText={setTags}
                placeholder="fashion sale local"
                placeholderTextColor={Colors.dim}
                style={[s.input, s.inputSingle]}
              />

              <Text style={s.sectionLabel}>Location</Text>
              <SparkLocationPicker
                value={location}
                onChange={setLocation}
                autoDetectOnMount={step === 'details'}
                disabled={posting}
              />

              <Text style={s.sectionLabel}>Music / Audio</Text>
              {selectedAudio ? (
                <View style={s.audioBanner}>
                  <Text style={s.audioBannerIcon}>🎵</Text>
                  <View style={s.audioBannerCopy}>
                    <Text style={s.audioBannerTitle} numberOfLines={1}>
                      {selectedAudio.audio_title} • {selectedAudio.audio_artist}
                    </Text>
                    <Text style={s.audioBannerSub}>Attached to this Moment</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedAudio(null)}
                    disabled={posting}
                    hitSlop={8}
                  >
                    <Text style={s.audioRemove}>Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMusicModalOpen(true)}
                    disabled={posting}
                    hitSlop={8}
                  >
                    <Text style={s.audioChange}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.musicSelectBtn}
                  onPress={() => setMusicModalOpen(true)}
                  disabled={posting}
                  activeOpacity={0.88}
                >
                  <Text style={s.musicSelectBtnText}>🎵 Select Music / Audio</Text>
                  <Text style={s.musicSelectBtnSub}>Add a trending track like Reels or Shorts</Text>
                </TouchableOpacity>
              )}

              <Text style={s.sectionLabel}>Link product from shop (optional)</Text>
              {productsLoading ? (
                <ActivityIndicator color={Colors.orange} style={{ marginBottom: 12 }} />
              ) : products.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.productRow}>
                  <TouchableOpacity
                    style={[s.productChip, !selectedProductId && s.productChipActive]}
                    onPress={() => setSelectedProductId(null)}
                  >
                    <Text style={[s.productChipText, !selectedProductId && s.productChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {products.map(product => (
                    <TouchableOpacity
                      key={product.id}
                      style={[s.productChip, selectedProductId === product.id && s.productChipActive]}
                      onPress={() => setSelectedProductId(product.id)}
                    >
                      <Text
                        style={[s.productChipText, selectedProductId === product.id && s.productChipTextActive]}
                        numberOfLines={1}
                      >
                        {product.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={s.productEmpty}>Add products to your shop to tag them in Moments.</Text>
              )}

              <TouchableOpacity
                style={[s.publishBtn, posting && s.publishDisabled]}
                onPress={() => void publish()}
                disabled={posting}
              >
                {posting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.publishText}>Publish Moment</Text>}
              </TouchableOpacity>
              <Pressable onPress={() => { setSheetOpen(true); setStep('source'); }} style={s.changeMedia}>
                <Text style={s.changeMediaText}>Choose different media</Text>
              </Pressable>
            </ScrollView>
          </View>
          </View>
        </View>
      ) : null}

      <CameraCapture
        visible={!!visible && cameraOpen}
        mode={cameraMode}
        onClose={() => {
          setCameraOpen(false);
          if (!media) handleClose();
          else setStep('details');
        }}
        onCapture={onCaptured}
      />

      <MusicSelectorModal
        visible={musicModalOpen}
        cityHint={location || defaultLocation}
        trimStartSec={trimStart}
        onClose={() => setMusicModalOpen(false)}
        onSelect={handleSelectAudio}
      />
    </>
  );
}

function VolumeMixerRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.mixerRow}>
      <Text style={s.mixerLabel}>{label}</Text>
      <View style={s.mixerControls}>
        <TouchableOpacity
          style={s.mixerBtn}
          disabled={disabled}
          onPress={() => onChange(clampVolumePct(value - 10))}
        >
          <Text style={s.mixerBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.mixerValue}>{value}%</Text>
        <TouchableOpacity
          style={s.mixerBtn}
          disabled={disabled}
          onPress={() => onChange(clampVolumePct(value + 10))}
        >
          <Text style={s.mixerBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: { flex: 1, backgroundColor: '#000B', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  cancel: { color: Colors.dim, fontWeight: '600' },
  retake: { color: Colors.orange, fontWeight: '700' },
  preview: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 360,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.black,
    alignSelf: 'center',
    marginBottom: 14,
  },
  previewMedia: { width: '100%', height: '100%' },
  previewPlayBtn: {
    position: 'absolute',
    top: '44%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 3,
  },
  previewPlayBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  mixerCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  mixerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mixerLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  mixerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixerBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  mixerValue: {
    minWidth: 42,
    textAlign: 'center',
    color: Colors.orange,
    fontSize: 13,
    fontWeight: '800',
  },
  previewBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  sectionLabel: {
    color: Colors.sub,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    color: Colors.text,
    padding: 12,
    minHeight: 84,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontSize: 14,
  },
  inputSingle: { minHeight: 46 },
  trimCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  trimHint: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  trimRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trimChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  trimChipText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  trimNote: { color: Colors.dim, fontSize: 11, lineHeight: 16 },
  publishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  publishDisabled: { opacity: 0.6 },
  publishText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  changeMedia: { alignItems: 'center', paddingVertical: 14 },
  changeMediaText: { color: Colors.sub, fontWeight: '600' },
  productRow: { marginBottom: 12 },
  productChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    marginRight: 8,
    maxWidth: 180,
  },
  productChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  productChipText: {
    color: Colors.sub,
    fontSize: 12,
    fontWeight: '700',
  },
  productChipTextActive: { color: Colors.white },
  productEmpty: {
    color: Colors.dim,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  musicSelectBtn: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  musicSelectBtnText: {
    color: '#F1F5F9',
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  musicSelectBtnSub: {
    color: Colors.sub,
    fontSize: 12,
    marginTop: 4,
  },
  audioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  audioBannerIcon: { fontSize: 18 },
  audioBannerCopy: { flex: 1, minWidth: 120 },
  audioBannerTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  audioBannerSub: {
    color: Colors.dim,
    fontSize: 11,
    marginTop: 2,
  },
  audioRemove: {
    color: Colors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  audioChange: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
}));
