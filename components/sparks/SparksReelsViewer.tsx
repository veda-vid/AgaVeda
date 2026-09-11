// components/sparks/SparksReelsViewer.tsx — Full-screen Instagram Reels style Sparks overlay
// Mute: center-tap toggles sound via SparksFeed (animated 🔊/🔇 badge); sidebar mute also works.
// Double-tap likes; side actions stay outside the center hit region.

import { useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SparksFeed, type SparkItem } from '../feed/SparksFeed';
import { Colors, createDynamicStyles } from '../../constants/theme';

const WINDOW_H = Dimensions.get('window').height;

type SparksReelsViewerProps = {
  visible: boolean;
  sparks: SparkItem[];
  onClose: () => void;
  /** Optional starting index when opening from a specific Spark. */
  initialIndex?: number;
  canCreate?: boolean;
  onCreateSpark?: () => void;
  onDeleted?: (sparkId: string) => void;
};

/**
 * Edge-to-edge 9:16 Sparks viewer. Hides home chrome; floating ← returns to seller/home feed.
 * Seller/pro get a top-right + to create a Spark without leaving Reels.
 * Audio: single-tap center mute with glassmorphic badge; dual-mix from spark.audio_volume_balance.
 */
export function SparksReelsViewer({
  visible,
  sparks,
  onClose,
  canCreate = false,
  onCreateSpark,
  onDeleted,
}: SparksReelsViewerProps) {
  const pageHeight = useMemo(() => Math.round(WINDOW_H), []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <View style={[styles.root, { height: pageHeight }]}>
        <SparksFeed
          sparks={sparks}
          immersive
          pageHeightOverride={pageHeight}
          onRequestClose={onClose}
          canCreate={canCreate}
          onCreateSpark={onCreateSpark}
          onDeleted={onDeleted}
        />
      </View>
    </Modal>
  );
}

const styles = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.black,
    ...Platform.select({
      android: { paddingTop: 0 },
      default: {},
    }),
  },
}));

export type { SparkItem };
