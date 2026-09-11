// components/sparks/MuteTapOverlay.tsx — Center-tap mute with glassmorphic badge

import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { hapticLight } from '../../lib/haptics';

type MuteTapOverlayProps = {
  isMuted: boolean;
  onToggleMute: () => void;
  /** Optional double-tap (e.g. like). When set, single-tap mute waits ~280ms. */
  onDoubleTap?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Leave side/bottom chrome tappable — only center region receives taps. */
  insetRight?: number;
  insetBottom?: number;
  insetTop?: number;
  insetLeft?: number;
  disabled?: boolean;
};

/**
 * Transparent center hit-target for mute / unmute.
 * Renders a glassmorphic 🔊 / 🔇 badge that scales up and fades out (600ms).
 */
export function MuteTapOverlay({
  isMuted,
  onToggleMute,
  onDoubleTap,
  style,
  insetRight = 72,
  insetBottom = 140,
  insetTop = 100,
  insetLeft = 0,
  disabled = false,
}: MuteTapOverlayProps) {
  const lastTapRef = useRef(0);
  const [badgeMuted, setBadgeMuted] = useState(isMuted);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  const flashBadge = useCallback((nextMuted: boolean) => {
    setBadgeMuted(nextMuted);
    opacity.value = 1;
    scale.value = 0.7;
    scale.value = withTiming(1.15, { duration: 220, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) });
  }, [opacity, scale]);

  const handleSingleTap = useCallback(() => {
    void hapticLight();
    const next = !isMuted;
    flashBadge(next);
    onToggleMute();
  }, [flashBadge, isMuted, onToggleMute]);

  const onPress = () => {
    if (disabled) return;
    if (!onDoubleTap) {
      handleSingleTap();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current && Date.now() - lastTapRef.current >= 280) {
        lastTapRef.current = 0;
        handleSingleTap();
      }
    }, 290);
  };

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          top: insetTop,
          left: insetLeft,
          right: insetRight,
          bottom: insetBottom,
        },
        style,
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
      />
      <View pointerEvents="none" style={s.badgeWrap}>
        <Animated.View style={[s.badge, badgeStyle]}>
          {Platform.OS !== 'web' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : null}
          <View style={s.badgeTint}>
            <Text style={s.badgeIcon}>{badgeMuted ? '🔇' : '🔊'}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** Imperative helper for parents that already own the Pressable. */
export function useMuteBadgeFlash() {
  const [badgeMuted, setBadgeMuted] = useState(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  const flash = useCallback((nextMuted: boolean) => {
    setBadgeMuted(nextMuted);
    opacity.value = 1;
    scale.value = 0.7;
    scale.value = withTiming(1.15, { duration: 220, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) });
  }, [opacity, scale]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const Badge = (
    <View pointerEvents="none" style={s.badgeWrap}>
      <Animated.View style={[s.badge, badgeStyle]}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : null}
        <View style={s.badgeTint}>
          <Text style={s.badgeIcon}>{badgeMuted ? '🔇' : '🔊'}</Text>
        </View>
      </Animated.View>
    </View>
  );

  return { flash, Badge };
}

const s = StyleSheet.create({
  badgeWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(20,20,28,0.72)' : 'transparent',
  },
  badgeTint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  badgeIcon: {
    fontSize: 28,
  },
});
