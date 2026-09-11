// components/feed/TopRatedShopsCarousel.tsx — Following-feed discovery fallback

import { View, Text, Image, ScrollView } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { resolveFeedMediaUrl } from './feedUtils';
import { FollowButton } from '../marketplace/FollowButton';
import { SpringPressable } from '../ui/modernSurfaces';
import { DEFAULT_AVATAR } from '../../lib/feedSafe';
import type { Shop } from '../../types';

type Props = {
  city: string;
  shops: Shop[];
  onOpenShop: (shop: Shop) => void;
  onSwitchNearby?: () => void;
};

export function TopRatedShopsCarousel({
  city,
  shops,
  onOpenShop,
  onSwitchNearby,
}: Props) {
  if (!shops.length) return null;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>DISCOVER</Text>
          <Text style={s.title}>Top Rated Local Shops in {city || 'Your City'}</Text>
        </View>
        {onSwitchNearby ? (
          <SpringPressable pressedScale={0.96} onPress={onSwitchNearby}>
            <Text style={s.link}>Nearby feed →</Text>
          </SpringPressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rail}
      >
        {shops.map(shop => {
          const logo = resolveFeedMediaUrl(shop.logo_url) || DEFAULT_AVATAR;
          return (
            <View key={shop.id} style={s.card}>
              <SpringPressable pressedScale={0.97} onPress={() => onOpenShop(shop)}>
                <Image source={{ uri: logo }} style={s.logo} />
                <Text style={s.name} numberOfLines={1}>{shop.name}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  ⭐ {(Number(shop.avg_rating) || 0).toFixed(1)}
                  {shop.distance_km != null ? ` · ${Number(shop.distance_km).toFixed(1)} km` : ''}
                </Text>
              </SpringPressable>
              <FollowButton shopId={shop.id} shopName={shop.name} compact />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  link: { color: Colors.orange, fontWeight: '800', fontSize: 12, marginTop: 4 },
  rail: { paddingHorizontal: 12, gap: 10 },
  card: {
    width: 148,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 10,
    gap: 8,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.card,
    alignSelf: 'center',
  },
  name: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  meta: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.sub,
    fontWeight: '600',
    marginBottom: 2,
  },
}));
