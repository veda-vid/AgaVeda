import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { hapticLight } from '../../lib/haptics';
import { getThemeMeta, CurrentThemeId } from '../../constants/theme';

function glassTokens() {
  const light = getThemeMeta(CurrentThemeId).isLight;
  return {
    bg: light ? 'rgba(44, 36, 27, 0.05)' : 'rgba(255, 255, 255, 0.04)',
    border: light ? 'rgba(44, 36, 27, 0.10)' : 'rgba(255, 255, 255, 0.08)',
    cardRadius: 18,
    chipRadius: 24,
    blurTint: light ? 'light' as const : 'dark' as const,
  };
}

export const GLASS = {
  get bg() { return glassTokens().bg; },
  get border() { return glassTokens().border; },
  cardRadius: 18,
  chipRadius: 24,
} as const;

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  overflow?: 'hidden' | 'visible';
};

export function GlassSurface({
  children,
  style,
  radius = GLASS.cardRadius,
  intensity = 28,
  overflow = 'hidden',
}: GlassSurfaceProps) {
  const tokens = glassTokens();
  // Shell owns border/radius/margins only. Never inherit flexDirection/gap/padding —
  // those belong on the inner tint. Applying flexDirection:'row' to the shell
  // (BlurView + tint as siblings) collapses children into a blank rounded box.
  const shell = [
    s.glassShell,
    { borderRadius: radius, borderColor: tokens.border, backgroundColor: tokens.bg, overflow },
    style,
    s.glassShellLayoutReset,
  ];

  if (Platform.OS === 'web') {
    return (
      <View style={[s.glassShell, { borderRadius: radius, borderColor: tokens.border, backgroundColor: tokens.bg, overflow }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={shell}>
      <BlurView
        intensity={intensity}
        tint={tokens.blurTint}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[s.glassTint, { borderRadius: radius }, style, s.glassTintReset]}>
        {children}
      </View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SpringPressableProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
  haptic?: boolean;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'tab' | 'none';
};

export function SpringPressable({
  children,
  onPress,
  style,
  contentStyle,
  pressedScale = 0.97,
  haptic = true,
  disabled,
  accessibilityRole = 'button',
}: SpringPressableProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      style={[style, animStyle]}
      onPress={() => {
        if (haptic) void hapticLight();
        onPress?.();
      }}
      onPressIn={() => {
        scale.value = withSpring(pressedScale, { damping: 14, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 320 });
      }}
    >
      <View style={contentStyle}>{children}</View>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  glassShell: {
    borderWidth: 1,
  },
  /** Keep shell as a simple positioned chrome box (BlurView + tint stack). */
  glassShellLayoutReset: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  glassTint: {
    backgroundColor: 'transparent',
  },
  /** Avoid double borders/backgrounds/margins when mirroring `style` onto the tint layer */
  glassTintReset: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginHorizontal: 0,
    marginVertical: 0,
  },
});
