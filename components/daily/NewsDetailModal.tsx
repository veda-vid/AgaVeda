// components/daily/NewsDetailModal.tsx — Full-screen City Veda article reader

import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinterestArticleView } from './PinterestArticleView';
import { Colors, createDynamicStyles } from '../../constants/theme';
import type { CityNews } from '../../types';

type Props = {
  visible: boolean;
  item: CityNews | null;
  saved?: boolean;
  onClose: () => void;
  onLikeToggle?: () => void;
  onShare?: () => void;
  onRepost?: () => void;
  onComment?: () => void;
  onSave?: () => void;
  onTogglePin?: () => void;
};

export function NewsDetailModal({
  visible,
  item,
  saved,
  onClose,
  onLikeToggle,
  onShare,
  onRepost,
  onComment,
  onSave,
  onTogglePin,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[s.root, { paddingTop: insets.top }]}>
        {item ? (
          <PinterestArticleView
            item={item}
            saved={saved}
            onClose={onClose}
            onLikeToggle={onLikeToggle ?? (() => {})}
            onShare={onShare ?? (() => {})}
            onRepost={onRepost ?? (() => {})}
            onComment={onComment ?? (() => {})}
            onSave={onSave ?? (() => {})}
            onTogglePin={onTogglePin}
          />
        ) : (
          <Pressable style={s.empty} onPress={onClose} />
        )}
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  empty: {
    ...StyleSheet.absoluteFillObject,
  },
}));
