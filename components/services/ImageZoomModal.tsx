import { Modal, Pressable, Image, StyleSheet, View, Text } from 'react-native';
import { Colors, createDynamicStyles } from '../../constants/theme';

type ImageZoomModalProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

export function ImageZoomModal({ visible, uri, onClose }: ImageZoomModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={s.toolbar}>
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Text style={s.closeText}>✕ Close</Text>
          </Pressable>
        </View>
        {uri ? (
          <Image source={{ uri }} style={s.image} resizeMode="contain" />
        ) : null}
      </Pressable>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  toolbar: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 2,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  closeText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  image: { width: '100%', height: '80%' },
}));
