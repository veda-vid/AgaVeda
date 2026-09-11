import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { agentDebugLog } from '../../lib/agentDebugLog';

export type MediaSourceChoice = 'camera' | 'gallery' | 'record';

type MediaSourceSheetProps = {
  visible: boolean;
  title?: string;
  /** Show "Open Camera / Record Video" for Moments */
  allowRecord?: boolean;
  cameraLabel?: string;
  galleryLabel?: string;
  recordLabel?: string;
  /** Render sheet content without its own Modal (parent already hosts a Modal/overlay). */
  embedded?: boolean;
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
  embedded = false,
  onClose,
  onSelect,
}: MediaSourceSheetProps) {
  // Ignore backdrop dismiss for a short window after open — Android often
  // delivers the opening tap to the new Modal backdrop (touch bleed).
  const dismissReadyAtRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      dismissReadyAtRef.current = 0;
      return;
    }
    dismissReadyAtRef.current = Date.now() + 450;
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H6',
      location: 'MediaSourceSheet.tsx:visible',
      message: 'MediaSourceSheet became visible',
      data: { title, allowRecord, embedded },
      runId: 'publish-debug',
    });
    // #endregion
  }, [visible, title, allowRecord, embedded]);

  if (!visible) return null;

  const safeClose = (reason: string) => {
    if (Date.now() < dismissReadyAtRef.current && reason === 'backdrop') {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H6',
        location: 'MediaSourceSheet.tsx:blockedBackdrop',
        message: 'Blocked premature backdrop dismiss',
        data: { title, embedded },
        runId: 'publish-debug',
      });
      // #endregion
      return;
    }
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H6',
      location: 'MediaSourceSheet.tsx:close',
      message: 'MediaSourceSheet close',
      data: { title, reason, embedded },
      runId: 'publish-debug',
    });
    // #endregion
    onClose();
  };

  const select = (choice: MediaSourceChoice) => {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H7',
      location: 'MediaSourceSheet.tsx:select',
      message: 'Media source selected',
      data: { title, choice, embedded },
      runId: 'publish-debug',
    });
    // #endregion
    onSelect(choice);
  };

  const sheet = (
    <View style={s.sheet}>
      <View style={s.handle} />
      <Text style={s.title}>{title}</Text>
      {allowRecord ? (
        <Pressable
          style={s.option}
          onPress={() => select('record')}
          accessibilityRole="button"
        >
          <Text style={s.optionIcon}>🎬</Text>
          <View style={s.optionCopy}>
            <Text style={s.optionTitle}>{recordLabel}</Text>
            <Text style={s.optionSub}>Record a short vertical Moment clip</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          style={s.option}
          onPress={() => select('camera')}
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
        onPress={() => select('gallery')}
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
          onPress={() => select('camera')}
          accessibilityRole="button"
        >
          <Text style={s.optionIcon}>📷</Text>
          <View style={s.optionCopy}>
            <Text style={s.optionTitle}>Take Photo</Text>
            <Text style={s.optionSub}>Capture a still for your Moment</Text>
          </View>
        </Pressable>
      )}
      <Pressable style={s.cancel} onPress={() => safeClose('cancel')} accessibilityRole="button">
        <Text style={s.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );

  if (embedded) {
    return (
      <View style={s.embeddedRoot} pointerEvents="box-none">
        <Pressable
          style={s.embeddedBackdrop}
          onPress={() => safeClose('backdrop')}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        {sheet}
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => safeClose('androidBack')}
    >
      {/* Backdrop and sheet are siblings so sheet taps never hit the dismiss Pressable */}
      <View style={s.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => safeClose('backdrop')}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        {sheet}
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: '#000A',
    justifyContent: 'flex-end',
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  embeddedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000A',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    zIndex: 21,
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
}));
