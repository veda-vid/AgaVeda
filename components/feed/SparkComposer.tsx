import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Platform, Alert, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { getProductsByShop } from '../../lib/api';
import type { Product } from '../../types';
import { MediaSourceSheet } from '../media/MediaSourceSheet';
import { CameraCapture, type CapturedMedia } from '../media/CameraCapture';
import { FeedVideo } from '../feed/FeedVideo';
import { SparkLocationPicker } from '../feed/SparkLocationPicker';
import { MusicSelectorModal } from '../feed/MusicSelectorModal';
import type { SparkAudioSelection } from '../../lib/musicSearch';

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

  useEffect(() => {
    if (!visible) {
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
      return;
    }
    setLocation(defaultLocation);
    setSheetOpen(true);
    setStep('source');
  }, [visible, defaultLocation]);

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
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo library access to choose media.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        allowsEditing: true,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets[0]) {
        if (!media) onClose();
        return;
      }
      const asset = result.assets[0];
      const next: CapturedMedia = {
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        durationMs: asset.duration ? asset.duration * 1000 : undefined,
      };
      setMedia(next);
      if (next.durationMs) setTrimEnd(Math.min(15, Math.round(next.durationMs / 1000)));
      setStep('details');
    } catch (e: any) {
      Alert.alert('Gallery error', e?.message || 'Could not open gallery.');
      if (!media) onClose();
    }
  };

  const onSourceSelect = (choice: 'camera' | 'gallery' | 'record') => {
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
  };

  const publish = async () => {
    if (!media) {
      Alert.alert('Add media', 'Record or choose a video/photo for your Spark.');
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
    });
  };

  const handleClose = () => {
    if (posting) return;
    setCameraOpen(false);
    setSheetOpen(false);
    onClose();
  };

  return (
    <>
      <MediaSourceSheet
        visible={visible && sheetOpen && !cameraOpen && step === 'source'}
        title="Create Spark"
        allowRecord
        onClose={handleClose}
        onSelect={onSourceSelect}
      />

      <CameraCapture
        visible={visible && cameraOpen}
        mode={cameraMode}
        onClose={() => {
          setCameraOpen(false);
          if (!media) handleClose();
          else setStep('details');
        }}
        onCapture={onCaptured}
      />

      <Modal
        transparent
        visible={visible && step === 'details' && !!media && !cameraOpen}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <TouchableOpacity onPress={handleClose} disabled={posting}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.title}>Create Spark</Text>
              <TouchableOpacity onPress={() => { setSheetOpen(true); setStep('source'); }} disabled={posting}>
                <Text style={s.retake}>Retake</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.preview}>
                {media?.type === 'video' ? (
                  <FeedVideo uri={media.uri} active muted loop style={s.previewMedia} />
                ) : media ? (
                  <Image source={{ uri: media.uri }} style={s.previewMedia} resizeMode="cover" />
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
                    <Text style={s.audioBannerSub}>Attached to this Spark</Text>
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
                <Text style={s.productEmpty}>Add products to your shop to tag them in Sparks.</Text>
              )}

              <TouchableOpacity
                style={[s.publishBtn, posting && s.publishDisabled]}
                onPress={() => void publish()}
                disabled={posting}
              >
                {posting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.publishText}>Publish Spark</Text>}
              </TouchableOpacity>
              <Pressable onPress={() => { setSheetOpen(true); setStep('source'); }} style={s.changeMedia}>
                <Text style={s.changeMediaText}>Choose different media</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <MusicSelectorModal
        visible={musicModalOpen}
        cityHint={location || defaultLocation}
        onClose={() => setMusicModalOpen(false)}
        onSelect={setSelectedAudio}
      />
    </>
  );
}

const s = StyleSheet.create({
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
});
