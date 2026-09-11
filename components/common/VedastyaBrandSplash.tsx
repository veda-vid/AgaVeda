// components/common/VedastyaBrandSplash.tsx — Premium Vedastya launch brand screen

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VEDASTYA_TAGLINE } from './VedastyaWordmark';

export const VEDASTYA_SPLASH_BG = '#0F172A';
export const VEDASTYA_BRAND_ORANGE = '#FF6B00';
export const VEDASTYA_BRAND_GOLD = '#F59E0B';
export const VEDASTYA_BOOT_TIMEOUT_MS = 3000;

type Props = {
  /** Soft fade-out when boot finishes. */
  fadingOut?: boolean;
  subtitle?: string;
};

/**
 * Stylish Vedastya brand mark for cold start / onboarding.
 * Scale + fade for the wordmark (800ms); subtle pulse on the subtitle.
 */
export function VedastyaBrandSplash({
  fadingOut = false,
  subtitle = VEDASTYA_TAGLINE,
}: Props) {
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.88);
  const glowOpacity = useSharedValue(0.28);
  const subtitleOpacity = useSharedValue(0);
  const shellOpacity = useSharedValue(1);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    subtitleOpacity.value = withDelay(
      320,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [glowOpacity, markOpacity, markScale, subtitleOpacity]);

  useEffect(() => {
    shellOpacity.value = withTiming(fadingOut ? 0 : 1, {
      duration: fadingOut ? 420 : 0,
      easing: Easing.out(Easing.quad),
    });
  }, [fadingOut, shellOpacity]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
  }));

  return (
    <Animated.View style={[styles.root, shellStyle]} accessibilityLabel="Vedastya loading">
      <View style={styles.bg} />

      {/* Soft radial ambient glow — orange / gold */}
      <Animated.View style={[styles.glowOuter, glowStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,107,0,0.28)', 'rgba(245,158,11,0.12)', 'transparent']}
          start={{ x: 0.5, y: 0.35 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glowFill}
        />
      </Animated.View>
      <View style={styles.glowCore} pointerEvents="none">
        <LinearGradient
          colors={['rgba(245,158,11,0.22)', 'rgba(255,107,0,0.08)', 'transparent']}
          style={styles.glowFill}
        />
      </View>

      <Animated.View style={[styles.markBlock, markStyle]}>
        <Text style={styles.brand}>
          Veda
          <Text style={styles.brandAccent}>stya</Text>
        </Text>
        <LinearGradient
          colors={[VEDASTYA_BRAND_ORANGE, VEDASTYA_BRAND_GOLD, VEDASTYA_BRAND_ORANGE]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.accentLine}
        />
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VEDASTYA_SPLASH_BG,
    zIndex: 9999,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: VEDASTYA_SPLASH_BG,
  },
  glowOuter: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    overflow: 'hidden',
  },
  glowCore: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    opacity: 0.85,
  },
  glowFill: {
    width: '100%',
    height: '100%',
  },
  markBlock: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  brand: {
    color: '#F8FAFC',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.2,
    textAlign: 'center',
    fontFamily: 'Syne_800ExtraBold',
    textShadowColor: 'rgba(255, 107, 0, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  brandAccent: {
    color: VEDASTYA_BRAND_ORANGE,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.2,
    fontFamily: 'Syne_800ExtraBold',
  },
  accentLine: {
    marginTop: 14,
    width: 56,
    height: 2.5,
    borderRadius: 99,
  },
  subtitle: {
    marginTop: 14,
    color: '#D4A574',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
});
