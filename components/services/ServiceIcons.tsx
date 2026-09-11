// components/services/ServiceIcons.tsx — Shared Pros tab icons and micro-components

import { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { getPresenceDisplay } from '../../lib/prosUtils';
import type { ServiceProvider } from '../../types';

export function CategoryIcon({ id, size = 16, color }: { id: string; size?: number; color: string }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24' as const };
  switch (id) {
    case 'plumber':
      return (
        <Svg {...props}>
          <Path d="M14.7 6.3a5 5 0 0 0-7.1 7.1l-2.6 2.6 1.4 1.4 2.6-2.6a5 5 0 0 0 7.1-7.1Zm-6.2 6.2a3 3 0 1 1 4.2-4.2 3 3 0 0 1-4.2 4.2Z" fill={color} />
        </Svg>
      );
    case 'electrician':
      return (
        <Svg {...props}>
          <Path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" fill={color} />
        </Svg>
      );
    case 'ac_technician':
      return (
        <Svg {...props}>
          <Path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx="12" cy="12" r="3" fill={color} />
        </Svg>
      );
    case 'painter':
      return (
        <Svg {...props}>
          <Path d="M5 20c0-3 3-4 5-6 2 0 4 1 6-1 2-2 1-5-1-7s-5-3-7-1c-2 2-1 5 1 7-2 2-5 3-5 6H5Z" fill={color} />
        </Svg>
      );
    case 'cleaning':
      return (
        <Svg {...props}>
          <Path d="M12 2 9.8 7.4 4 8.3l4.4 3.8L7.2 18 12 15.2 16.8 18l-1.2-5.9L20 8.3l-5.8-.9L12 2Z" fill={color} />
        </Svg>
      );
    case 'gardening':
      return (
        <Svg {...props}>
          <Path d="M12 21V11c0-5 7-7 7-7s-1 8-7 8c0-6-7-8-7-8s7 2 7 7v10Z" fill={color} />
        </Svg>
      );
    case 'security':
      return (
        <Svg {...props}>
          <Path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4Z" fill={color} />
        </Svg>
      );
    case 'carpenter':
      return (
        <Svg {...props}>
          <Path d="M8 3 5 6l3 3-4 4 2 2 4-4 3 3 3-3-7-8Zm8.5 9.5-2 2 6 6 2-2-6-6Z" fill={color} />
        </Svg>
      );
    case 'pest_control':
      return (
        <Svg {...props}>
          <Path d="M12 7a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0v-6a4 4 0 0 1 4-4Zm-7 5h3M16 12h3M7 8l2 2M17 8l-2 2M7 18l2-2M17 18l-2-2M12 4V2" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'all':
      return (
        <Svg {...props}>
          <Path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill={color} />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <Path d="M4 8h16l-1.5 11H5.5L4 8Zm4-4h8l1 4H7l1-4Z" fill={color} />
        </Svg>
      );
  }
}

export function IconSearch({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} />
      <Path d="M16 16l5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconPhone({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7.1 3.6c.4-.5 1.1-.6 1.6-.3l2.5 1.1c.5.2.8.8.7 1.3l-.5 2.4c-.1.4-.3.7-.7.9l-1.5.8a12.2 12.2 0 0 0 5.4 5.4l.8-1.5c.2-.4.5-.6.9-.7l2.4-.5c.6-.1 1.1.2 1.3.7l1.1 2.5c.3.6.2 1.2-.3 1.6l-1.3 1.2c-.5.4-1.1.6-1.8.6C11.6 19.1 4.9 12.4 4.9 4.9c0-.7.2-1.3.6-1.8l1.6-1.3Z" fill={color} />
    </Svg>
  );
}

export function IconStar({ color, size = 16, filled = true }: { color: string; size?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.2 14.6 9l6.2.6-4.7 4.1 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.6 9.4 9 12 3.2Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPin({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Zm0-9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill={color} />
    </Svg>
  );
}

export function IconBriefcase({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h5a2 2 0 0 1 2 2v3H2V8a2 2 0 0 1 2-2h5Zm-7 7h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z" fill={color} />
    </Svg>
  );
}

export function IconClock({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.2 1.9-.8 1.4L11 13V7h2v5.4Z" fill={color} />
    </Svg>
  );
}

export function IconChat({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V5Z" fill={color} />
    </Svg>
  );
}

export function VerifiedMark({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="8" fill={Colors.orange} />
      <Path d="M4.4 8.2 6.7 10.4 11.6 5.6" stroke={Colors.white} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PresenceBadge({ svc }: { svc: ServiceProvider }) {
  const presence = getPresenceDisplay(svc);
  return (
    <View style={[iconS.availBadge, { backgroundColor: `${presence.color}22` }]}>
      <View style={[iconS.availDot, { backgroundColor: presence.dotColor }]} />
      <Text style={[iconS.availText, { color: presence.color }]} numberOfLines={1}>
        {presence.label}
      </Text>
    </View>
  );
}

export function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <IconStar key={n} size={size} color={n <= filled ? Colors.amber : Colors.border2} />
      ))}
      <Text style={iconS.starValue}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export function ScalePressable({
  children, onPress, style, containerStyle, pressedScale = 0.97, hoverScale = 1.02, disabled, haptic = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  containerStyle?: object;
  pressedScale?: number;
  hoverScale?: number;
  disabled?: boolean;
  haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    Animated.spring(scale, { toValue: value, useNativeDriver: true, friction: 8, tension: 160 }).start();
  };
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (haptic) {
          void import('../../lib/haptics').then(m => m.hapticLight()).catch(() => {});
        }
        onPress?.();
      }}
      onPressIn={() => animate(pressedScale)}
      onPressOut={() => animate(1)}
      onHoverIn={() => animate(hoverScale)}
      onHoverOut={() => animate(1)}
      style={[containerStyle, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

const iconS = createDynamicStyles((Colors) => ({
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 10, fontFamily: Fonts.bodySemiBold, fontWeight: '700', letterSpacing: 0.2 },
  starValue: { color: Colors.sub, fontSize: 12, fontFamily: Fonts.bodySemiBold, marginLeft: 2 },
}));
