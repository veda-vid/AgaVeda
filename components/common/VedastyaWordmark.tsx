// components/common/VedastyaWordmark.tsx — Premium brand mark + tagline

import { View, Text, StyleSheet, Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';

export const VEDASTYA_TAGLINE = 'Veda of your City';

type Size = 'sm' | 'md' | 'lg' | 'hero';

type Props = {
  /** Show the brand tagline under the wordmark. Default true. */
  showTagline?: boolean;
  /** Optional override for the tagline copy. */
  tagline?: string;
  /** Visual scale for header vs splash/login. */
  size?: Size;
  /** Center-align (default) or left-align. */
  align?: 'center' | 'left';
  /** Hide the gold accent underline. */
  hideAccent?: boolean;
  style?: StyleProp<ViewStyle>;
  brandStyle?: StyleProp<TextStyle>;
  taglineStyle?: StyleProp<TextStyle>;
};

const SIZE = {
  sm: { brand: 22, tagline: 10, accentW: 28, accentH: 1.5, gap: 4, tracking: -0.6 },
  md: { brand: 28, tagline: 11, accentW: 36, accentH: 2, gap: 5, tracking: -0.8 },
  lg: { brand: 34, tagline: 12, accentW: 44, accentH: 2, gap: 6, tracking: -1.0 },
  hero: { brand: 46, tagline: 14, accentW: 56, accentH: 2.5, gap: 8, tracking: -1.2 },
} as const;

/**
 * Stylish Vedastya logo lockup — modern Syne ExtraBold wordmark,
 * warm gradient accent, and the official tagline.
 */
export function VedastyaWordmark({
  showTagline = true,
  tagline = VEDASTYA_TAGLINE,
  size = 'md',
  align = 'center',
  hideAccent = false,
  style,
  brandStyle,
  taglineStyle,
}: Props) {
  const spec = SIZE[size];
  const centered = align === 'center';

  return (
    <View
      style={[s.lockup, centered && s.lockupCenter, style]}
      accessibilityRole="header"
      accessibilityLabel={`Vedastya. ${tagline}`}
    >
      <Text
        style={[
          s.brand,
          {
            fontSize: spec.brand,
            letterSpacing: spec.tracking,
            lineHeight: Math.round(spec.brand * 1.12),
          },
          !centered && s.brandLeft,
          brandStyle,
        ]}
        numberOfLines={1}
      >
        Veda
        <Text style={s.brandAccent}>stya</Text>
      </Text>

      {!hideAccent ? (
        <LinearGradient
          colors={[Colors.orange, Colors.amber, Colors.orange]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            s.accent,
            {
              width: spec.accentW,
              height: spec.accentH,
              marginTop: spec.gap,
              alignSelf: centered ? 'center' : 'flex-start',
            },
          ]}
        />
      ) : null}

      {showTagline ? (
        <Text
          style={[
            s.tagline,
            {
              fontSize: spec.tagline,
              marginTop: hideAccent ? spec.gap : spec.gap + 2,
              letterSpacing: size === 'hero' || size === 'lg' ? 1.4 : 1.1,
            },
            !centered && s.taglineLeft,
            taglineStyle,
          ]}
          numberOfLines={1}
        >
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  lockup: {
    maxWidth: '100%',
  },
  lockupCenter: {
    alignItems: 'center',
  },
  brand: {
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    ...(Platform.OS === 'ios'
      ? {
          textShadowColor: 'rgba(255, 87, 34, 0.22)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 10,
        }
      : {
          // Android elevation-style glow via soft shadow color
          textShadowColor: 'rgba(255, 87, 34, 0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 8,
        }),
  },
  brandLeft: { textAlign: 'left' },
  brandAccent: {
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
  },
  accent: {
    borderRadius: 99,
  },
  tagline: {
    fontFamily: Fonts.bodyMedium,
    fontWeight: '600',
    color: Colors.sub,
    textAlign: 'center',
    textTransform: 'none',
  },
  taglineLeft: { textAlign: 'left' },
}));
