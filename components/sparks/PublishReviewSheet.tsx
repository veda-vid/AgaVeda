// components/sparks/PublishReviewSheet.tsx — Simple sticky Share (Android-safe)

import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Dimensions, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator, Image, Switch,
  KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { SparkLocationPicker } from '../feed/SparkLocationPicker';
import type { CapturedMedia } from '../media/CameraCapture';
import type { Product } from '../../types';
import type { SparkAudioSelection } from '../../lib/musicSearch';
import { formatHashtagChip } from '../../lib/sparkAiEngine';
import type { SparkEditorState } from './SparkEditor';
import { hapticLight } from '../../lib/haptics';
import { agentDebugLog } from '../../lib/agentDebugLog';

const { height: WIN_H } = Dimensions.get('window');

type PublishReviewSheetProps = {
  visible: boolean;
  media: CapturedMedia;
  editor: SparkEditorState;
  caption: string;
  tags: string[];
  location: string;
  coverUri: string | null;
  products: Product[];
  productsLoading?: boolean;
  posting?: boolean;
  suggestedHashtags?: string[];
  alsoShareToStory: boolean;
  onChangeCaption: (value: string) => void;
  onChangeTags: (tags: string[]) => void;
  onChangeLocation: (value: string) => void;
  onChangeProduct: (productId: string | null) => void;
  onChangeAlsoShareToStory: (value: boolean) => void;
  onBack: () => void;
  onPublish: () => void;
};

export function PublishReviewSheet({
  visible,
  media,
  editor,
  caption,
  tags,
  location,
  coverUri,
  products,
  productsLoading,
  posting,
  suggestedHashtags = [],
  alsoShareToStory,
  onChangeCaption,
  onChangeTags,
  onChangeLocation,
  onChangeProduct,
  onChangeAlsoShareToStory,
  onBack,
  onPublish,
}: PublishReviewSheetProps) {
  const insets = useSafeAreaInsets();
  const [tagInput, setTagInput] = useState(tags.map(t => `#${t}`).join(' '));

  useEffect(() => {
    setTagInput(tags.map(t => (t.startsWith('#') ? t : `#${t}`)).join(' '));
  }, [tags]);

  const selectedProduct = products.find(p => p.id === editor.selectedProductId) ?? null;
  const audio: SparkAudioSelection | null = editor.audio;
  const thumbUri = coverUri || media.uri;

  const syncTagsFromInput = (raw: string) => {
    setTagInput(raw);
    const parsed = raw
      .split(/[\s,]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean);
    onChangeTags(parsed);
  };

  const toggleSuggested = (tag: string) => {
    const clean = tag.replace(/^#/, '');
    const next = tags.includes(clean)
      ? tags.filter(t => t !== clean)
      : [...tags, clean].slice(0, 12);
    onChangeTags(next);
  };

  const handleShare = () => {
    if (posting) return;
    Keyboard.dismiss();
    void hapticLight();
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H7',
      location: 'PublishReviewSheet.tsx:handleShare',
      message: 'Share Moment button pressed',
      data: {
        alsoShareToStory,
        hasAudio: !!audio?.audio_url,
        mediaType: media.type,
        captionLen: caption.trim().length,
      },
      runId: 'publish-debug',
    });
    // #endregion
    onPublish();
  };

  if (!visible) return null;

  return (
    <View style={s.root} pointerEvents="box-none">
      <View style={s.scrim} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.kav}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.handle} />

          <View style={s.headerRow}>
            <TouchableOpacity onPress={onBack} disabled={!!posting} hitSlop={12}>
              <Text style={s.back}>← Edit</Text>
            </TouchableOpacity>
            <Text style={s.title}>New Moment</Text>
            <View style={{ width: 56 }} />
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={s.heroRow}>
              <Image source={{ uri: thumbUri }} style={s.coverThumb} />
              <TextInput
                value={caption}
                onChangeText={onChangeCaption}
                placeholder="Write a caption…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={s.captionInput}
                multiline
                maxLength={400}
                editable={!posting}
              />
            </View>

            {(suggestedHashtags.length > 0 || tags.length > 0) ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.suggestRow}
                keyboardShouldPersistTaps="handled"
              >
                {(suggestedHashtags.length ? suggestedHashtags : tags).map(tag => {
                  const clean = tag.replace(/^#/, '');
                  const active = tags.includes(clean);
                  return (
                    <TouchableOpacity
                      key={clean}
                      style={[s.suggestChip, active && s.suggestChipActive]}
                      onPress={() => toggleSuggested(clean)}
                      disabled={!!posting}
                    >
                      <Text style={[s.suggestText, active && s.suggestTextActive]}>
                        {formatHashtagChip(clean)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <TextInput
              value={tagInput}
              onChangeText={syncTagsFromInput}
              placeholder="#tags (optional)"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.tagsInput}
              autoCorrect={false}
              editable={!posting}
            />

            {/* Share destinations */}
            <View style={s.shareCard}>
              <View style={s.shareRow}>
                <View style={s.shareLeft}>
                  <Text style={s.shareIcon}>✨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.shareTitle}>Moments</Text>
                    <Text style={s.shareSub}>Always shared</Text>
                  </View>
                </View>
                <Text style={s.shareOn}>On</Text>
              </View>
              <View style={s.shareDivider} />
              <View style={s.shareRow}>
                <View style={s.shareLeft}>
                  <Text style={s.shareIcon}>⭕</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.shareTitle}>Also add to Story</Text>
                    <Text style={s.shareSub}>Visible 24 hours</Text>
                  </View>
                </View>
                <Switch
                  value={alsoShareToStory}
                  onValueChange={onChangeAlsoShareToStory}
                  disabled={!!posting}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: Colors.orange }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>

            <View style={s.metaRow}>
              <Text style={s.metaLabel}>🎵</Text>
              <Text style={s.metaValue} numberOfLines={1}>
                {audio ? `${audio.audio_title} · ${audio.audio_artist}` : 'Original sound'}
              </Text>
            </View>

            <View style={s.locationBlock}>
              <Text style={s.sectionLabel}>📍 Location</Text>
              <SparkLocationPicker
                value={location}
                onChange={onChangeLocation}
                autoDetectOnMount={visible}
                disabled={!!posting}
              />
            </View>

            {products.length > 0 ? (
              <View style={s.productBlock}>
                <Text style={s.sectionLabel}>🏷️ Tag product</Text>
                {productsLoading ? (
                  <ActivityIndicator size="small" color={Colors.orange} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      style={[s.miniChip, !editor.selectedProductId && s.miniChipActive]}
                      onPress={() => onChangeProduct(null)}
                    >
                      <Text style={s.miniChipText}>None</Text>
                    </TouchableOpacity>
                    {products.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.miniChip, editor.selectedProductId === p.id && s.miniChipActive]}
                        onPress={() => onChangeProduct(p.id)}
                      >
                        <Text style={s.miniChipText} numberOfLines={1}>{p.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {selectedProduct ? (
                  <Text style={s.metaValue} numberOfLines={1}>{selectedProduct.title}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Spacer so sticky button never covers last field */}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Sticky Share — outside ScrollView so it always receives taps */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={!!posting}
            activeOpacity={0.88}
            style={[s.publishBtn, posting && s.publishDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Share Moment"
          >
            {posting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.publishText}>
                {alsoShareToStory ? 'Share Moment + Story' : 'Share Moment'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  kav: {
    width: '100%',
    justifyContent: 'flex-end',
    maxHeight: WIN_H * 0.92,
  },
  sheet: {
    backgroundColor: '#141420',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: WIN_H * 0.92,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  back: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 14,
    width: 56,
  },
  title: {
    color: Colors.white,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  scroll: {
    flexGrow: 0,
    maxHeight: WIN_H * 0.58,
  },
  scrollContent: {
    paddingBottom: 12,
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  coverThumb: {
    width: 72,
    height: 108,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  captionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: Colors.white,
    padding: 12,
    minHeight: 108,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  suggestRow: { gap: 8 },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestChipActive: {
    backgroundColor: Colors.orange + '33',
    borderColor: Colors.orange,
  },
  suggestText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestTextActive: { color: Colors.orange },
  tagsInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  shareCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 10,
  },
  shareLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  shareIcon: { fontSize: 18 },
  shareTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  shareSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  shareOn: {
    color: Colors.orange,
    fontWeight: '800',
    fontSize: 13,
  },
  shareDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaLabel: { fontSize: 14 },
  metaValue: {
    flex: 1,
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  locationBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
  },
  productBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 6,
    maxWidth: 120,
  },
  miniChipActive: {
    backgroundColor: Colors.orange,
  },
  miniChipText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  publishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 54,
    justifyContent: 'center',
    zIndex: 20,
    elevation: 8,
  },
  publishDisabled: { opacity: 0.65 },
  publishText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 17,
  },
}));
