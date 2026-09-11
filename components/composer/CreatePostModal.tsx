// components/composer/CreatePostModal.tsx — Shop / profile text update composer

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import { agentDebugLog } from '../../lib/agentDebugLog';

const TEXT_CARD_BACKGROUNDS = [
  { id: 'sunset', color: '#E94F37' },
  { id: 'berry', color: '#7B2CBF' },
  { id: 'ocean', color: '#146C94' },
  { id: 'midnight', color: '#172554' },
  { id: 'forest', color: '#146B55' },
  { id: 'rose', color: '#BE185D' },
  { id: 'amber', color: '#C2410C' },
  { id: 'slate', color: '#334155' },
] as const;

const TEXT_CARD_COLORS = [
  { id: 'white', color: '#FFFFFF' },
  { id: 'ink', color: '#111827' },
  { id: 'sun', color: '#FDE047' },
  { id: 'mint', color: '#A7F3D0' },
  { id: 'blush', color: '#FBCFE8' },
] as const;

type FontStyleId = 'classic' | 'bold' | 'elegant' | 'typewriter';

export type CreatePostPayload = {
  text: string;
  fontStyle: FontStyleId;
  background: string;
  textColor: string;
};

type CreatePostModalProps = {
  visible: boolean;
  isServiceProvider?: boolean;
  onClose: () => void;
  /** Called immediately — parent should dismiss and run background publish. */
  onPublish: (payload: CreatePostPayload) => void;
};

function getTextFontStyle(id: FontStyleId) {
  switch (id) {
    case 'bold':
      return { fontWeight: '900' as const, fontSize: 28 };
    case 'elegant':
      return { fontFamily: Fonts.display, fontSize: 26, fontWeight: '600' as const };
    case 'typewriter':
      return { fontFamily: Fonts.body, fontSize: 22, letterSpacing: 1.2 };
    default:
      return { fontFamily: Fonts.bodySemiBold, fontSize: 24, fontWeight: '700' as const };
  }
}

export function CreatePostModal({
  visible,
  isServiceProvider = false,
  onClose,
  onPublish,
}: CreatePostModalProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [background, setBackground] = useState<string>('sunset');
  const [textColor, setTextColor] = useState<string>('white');
  const [fontStyle, setFontStyle] = useState<FontStyleId>('classic');

  useEffect(() => {
    if (!visible) {
      setText('');
      setBackground('sunset');
      setTextColor('white');
      setFontStyle('classic');
    }
  }, [visible]);

  const bg = TEXT_CARD_BACKGROUNDS.find(b => b.id === background)?.color ?? '#E94F37';
  const fg = TEXT_CARD_COLORS.find(c => c.id === textColor)?.color ?? '#FFFFFF';

  const handlePublish = () => {
    const trimmed = text.trim();
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H5',
      location: 'CreatePostModal.tsx:handlePublish',
      message: 'Text post Publish tapped',
      data: { textLen: trimmed.length, isServiceProvider },
      runId: 'publish-debug',
    });
    // #endregion
    if (!trimmed) {
      Alert.alert(
        'Add a short update',
        isServiceProvider
          ? 'Write something about your service before posting.'
          : 'Write something about your shop before posting.',
      );
      return;
    }
    onPublish({
      text: trimmed,
      fontStyle,
      background,
      textColor,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <GlassSurface
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          radius={24}
          overflow="visible"
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.handle} />
            <Text style={s.title}>
              {isServiceProvider ? 'Share profile update' : 'Share shop update'}
            </Text>

            <View style={[s.preview, { backgroundColor: bg }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                maxLength={280}
                placeholder="What’s new?"
                placeholderTextColor={`${fg}99`}
                style={[s.input, getTextFontStyle(fontStyle), { color: fg }]}
              />
              <Text style={[s.count, { color: fg }]}>{text.length}/280</Text>
            </View>

            <Text style={s.label}>BACKGROUND</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
              {TEXT_CARD_BACKGROUNDS.map(option => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setBackground(option.id)}
                  style={[
                    s.swatch,
                    { backgroundColor: option.color },
                    background === option.id && s.selected,
                  ]}
                />
              ))}
            </ScrollView>

            <Text style={s.label}>FONT STYLE</Text>
            <View style={s.styleRow}>
              {([
                ['classic', 'Aa'],
                ['bold', 'B'],
                ['elegant', 'Ag'],
                ['typewriter', 'Tt'],
              ] as const).map(([id, glyph]) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setFontStyle(id)}
                  style={[s.styleChip, fontStyle === id && s.styleChipActive]}
                >
                  <Text style={[s.styleGlyph, fontStyle === id && s.styleGlyphActive]}>{glyph}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>TEXT COLOR</Text>
            <View style={s.row}>
              {TEXT_CARD_COLORS.map(option => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setTextColor(option.id)}
                  style={[
                    s.swatch,
                    { backgroundColor: option.color, borderColor: '#333' },
                    textColor === option.id && s.selected,
                  ]}
                />
              ))}
            </View>

            <View style={s.actions}>
              <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <SpringPressable onPress={handlePublish} style={s.publishWrap}>
                <View style={s.publishBtn}>
                  <Text style={s.publishText}>Publish</Text>
                </View>
              </SpringPressable>
            </View>
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    marginBottom: 14,
  },
  preview: {
    borderRadius: 18,
    minHeight: 160,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  label: {
    color: Colors.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    paddingRight: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: Colors.orange,
  },
  styleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  styleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  styleChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  styleGlyph: {
    color: Colors.sub,
    fontWeight: '800',
    fontSize: 16,
  },
  styleGlyphActive: { color: Colors.white },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cancelText: {
    color: Colors.sub,
    fontWeight: '700',
  },
  publishWrap: { flex: 1 },
  publishBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
}));
