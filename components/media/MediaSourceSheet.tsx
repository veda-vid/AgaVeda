import { Modal, Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';

export type MediaSourceChoice = 'camera' | 'gallery' | 'record';

type MediaSourceSheetProps = {
  visible: boolean;
  title?: string;
  /** Show "Open Camera / Record Video" for Sparks */
  allowRecord?: boolean;
  cameraLabel?: string;
  galleryLabel?: string;
  recordLabel?: string;
  onClose: () => void;
  onSelect: (choice: MediaSourceChoice) => void;
};

export function MediaSourceSheet({
  visible,
  title = 'Add media',
  allowRecord = false,
  cameraLabel = 'Take Photo',
  galleryLabel = 'Choose from Gallery',
  recordLabel = 'Open Camera / Record Video',
  onClose,
  onSelect,
}: MediaSourceSheetProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>
          {allowRecord ? (
            <Pressable
              style={s.option}
              onPress={() => onSelect('record')}
              accessibilityRole="button"
            >
              <Text style={s.optionIcon}>🎬</Text>
              <View style={s.optionCopy}>
                <Text style={s.optionTitle}>{recordLabel}</Text>
                <Text style={s.optionSub}>Record a short vertical Spark clip</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={s.option}
              onPress={() => onSelect('camera')}
              accessibilityRole="button"
            >
              <Text style={s.optionIcon}>📷</Text>
              <View style={s.optionCopy}>
                <Text style={s.optionTitle}>{cameraLabel}</Text>
                <Text style={s.optionSub}>Open live camera capture</Text>
              </View>
            </Pressable>
          )}
          <Pressable
            style={s.option}
            onPress={() => onSelect('gallery')}
            accessibilityRole="button"
          >
            <Text style={s.optionIcon}>🖼️</Text>
            <View style={s.optionCopy}>
              <Text style={s.optionTitle}>{galleryLabel}</Text>
              <Text style={s.optionSub}>Pick an existing photo or video</Text>
            </View>
          </Pressable>
          {!allowRecord ? null : (
            <Pressable
              style={s.option}
              onPress={() => onSelect('camera')}
              accessibilityRole="button"
            >
              <Text style={s.optionIcon}>📷</Text>
              <View style={s.optionCopy}>
                <Text style={s.optionTitle}>Take Photo</Text>
                <Text style={s.optionSub}>Capture a still for your Spark</Text>
              </View>
            </Pressable>
          )}
          <Pressable style={s.cancel} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000A',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
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
  title: {
    textAlign: 'center',
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  optionIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  optionSub: {
    color: Colors.dim,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  cancel: { paddingVertical: 16, alignItems: 'center' },
  cancelText: { color: Colors.dim, fontSize: 15, fontWeight: '600' },
});
