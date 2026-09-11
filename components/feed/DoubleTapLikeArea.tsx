// Transparent double-tap target: likes + Instagram-style heart flash.
// Optional single-tap (e.g. mute) waits ~280ms so it does not fire on double-tap.

import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const DOUBLE_TAP_MS = 280;

type DoubleTapLikeAreaProps = {
  onDoubleTapLike?: () => void;
  /** Fires on single tap after the double-tap window (mute, etc.). */
  onSingleTap?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** When true, only the overlay captures presses (children stay non-interactive). */
  overlay?: boolean;
};

export function DoubleTapLikeArea({
  onDoubleTapLike,
  onSingleTap,
  disabled = false,
  style,
  children,
  overlay = false,
}: DoubleTapLikeAreaProps) {
  const lastTap = useRef(0);
  const [heartVisible, setHeartVisible] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;

  const flashHeart = () => {
    setHeartVisible(true);
    heartScale.setValue(0.4);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heartScale, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setHeartVisible(false));
  };

  const onPress = () => {
    if (disabled) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      flashHeart();
      onDoubleTapLike?.();
      return;
    }
    lastTap.current = now;
    if (!onSingleTap) return;
    setTimeout(() => {
      if (lastTap.current && Date.now() - lastTap.current >= DOUBLE_TAP_MS) {
        lastTap.current = 0;
        onSingleTap();
      }
    }, DOUBLE_TAP_MS + 10);
  };

  const heart = heartVisible ? (
    <Animated.View pointerEvents="none" style={[s.heartOverlay, { transform: [{ scale: heartScale }] }]}>
      <View style={s.heartBubble}>
        <Animated.Text style={s.heartEmoji}>❤️</Animated.Text>
      </View>
    </Animated.View>
  ) : null;

  if (overlay) {
    return (
      <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Double tap to like"
        />
        {heart}
      </View>
    );
  }

  return (
    <Pressable style={style} onPress={onPress} disabled={disabled}>
      {children}
      {heart}
    </Pressable>
  );
}

const s = StyleSheet.create({
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  heartBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: {
    fontSize: 52,
  },
});
