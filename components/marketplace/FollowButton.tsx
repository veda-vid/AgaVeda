// components/marketplace/FollowButton.tsx

import { useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';

type FollowButtonProps = {
  shopId: string;
  shopName: string;
  compact?: boolean;
  onFollowerDelta?: (delta: number) => void;
};

export function FollowButton({ shopId, shopName, compact, onFollowerDelta }: FollowButtonProps) {
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const toggleFollowedShop = useAuthStore(s => s.toggleFollowedShop);
  const following = followedShopIds.includes(shopId);
  const scale = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;

  const animate = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, friction: 6, tension: 200 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }),
      ]),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.25, duration: 120, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4, tension: 180 }),
      ]),
    ]).start();
  };

  const onPress = () => {
    animate();
    onFollowerDelta?.(following ? -1 : 1);
    void toggleFollowedShop(shopId, shopName);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        s.btn,
        compact && s.btnCompact,
        following ? s.btnFollowing : s.btnFollow,
      ]}
    >
      <Animated.Text style={[s.icon, following && s.iconFollowing, { transform: [{ scale: pop }] }]}>
        {following ? '✓' : '+'}
      </Animated.Text>
      <Animated.Text style={[s.label, following && s.labelFollowing, { transform: [{ scale }] }]}>
        {following ? 'Unfollow' : 'Follow'}
      </Animated.Text>
    </TouchableOpacity>
  );
}

const s = createDynamicStyles((Colors) => ({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  btnCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  btnFollow: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  btnFollowing: {
    backgroundColor: Colors.card,
    borderColor: Colors.border2,
  },
  icon: { color: Colors.white, fontSize: 14, fontWeight: '900' },
  iconFollowing: { color: Colors.orange },
  label: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.bodySemiBold,
  },
  labelFollowing: { color: Colors.text },
}));
