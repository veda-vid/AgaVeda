// components/marketplace/MarketplaceDeals.tsx — Featured deals / announcements carousel

import { useEffect, useRef } from 'react';
import {
  View, Text, Image, Pressable, Platform, Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { hexAlpha, resolveShopMediaUrl } from './marketplaceMedia';
import type { Ad, Shop } from '../../types';

export type MarketplaceDealItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  cta?: string;
  shopId?: string;
  kind: 'ad' | 'announcement';
};

type Props = {
  deals: MarketplaceDealItem[];
  onPressDeal?: (deal: MarketplaceDealItem) => void;
};

export function buildDealsFromAdsAndShops(ads: Ad[], shops: Shop[]): MarketplaceDealItem[] {
  const fromAds: MarketplaceDealItem[] = (ads ?? []).map(ad => ({
    id: `ad-${ad.id}`,
    title: ad.title,
    subtitle: ad.description || ad.shop?.name,
    imageUrl: ad.image_url || ad.shop?.logo_url,
    cta: ad.cta_text || 'View deal',
    shopId: ad.shop_id,
    kind: 'ad' as const,
  }));

  const fromShops: MarketplaceDealItem[] = shops
    .filter(shop => !!shop.status_message?.trim())
    .slice(0, 8)
    .map(shop => ({
      id: `ann-${shop.id}`,
      title: shop.status_message!.trim(),
      subtitle: shop.name,
      imageUrl: shop.cover_url || shop.logo_url,
      cta: 'View shop',
      shopId: shop.id,
      kind: 'announcement' as const,
    }));

  const merged = [...fromAds];
  for (const item of fromShops) {
    if (merged.length >= 10) break;
    if (!merged.some(d => d.shopId === item.shopId && d.kind === 'announcement')) {
      merged.push(item);
    }
  }
  return merged;
}

function DealCard({
  deal,
  onPress,
}: {
  deal: MarketplaceDealItem;
  onPress?: (deal: MarketplaceDealItem) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const uri = resolveShopMediaUrl(deal.imageUrl);

  return (
    <Pressable
      onPress={() => onPress?.(deal)}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 160 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 160 }).start()}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
    >
      <Animated.View style={[s.card, { transform: [{ scale }] }]}>
        {uri ? (
          <Image source={{ uri }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={s.imageFallback}>
            <Text style={s.fallbackEmoji}>{deal.kind === 'ad' ? '🔥' : '📢'}</Text>
          </View>
        )}
        <View style={s.overlay} />
        <View style={s.body}>
          <Text style={s.kind}>
            {deal.kind === 'ad' ? 'Flash deal' : 'Shop update'}
          </Text>
          <Text style={s.title} numberOfLines={2}>{deal.title}</Text>
          {deal.subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>{deal.subtitle}</Text>
          ) : null}
          <Text style={s.cta}>{deal.cta || 'View'} →</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function MarketplaceDeals({ deals, onPressDeal }: Props) {
  const impressed = useRef(new Set<string>());

  useEffect(() => {
    // Soft impression hook for ads — fire-and-forget if tracker exists
    for (const deal of deals) {
      if (deal.kind !== 'ad' || impressed.current.has(deal.id)) continue;
      impressed.current.add(deal.id);
      const adId = deal.id.replace(/^ad-/, '');
      void import('../../lib/api')
        .then(m => m.trackAdImpression?.(adId))
        .catch(() => {});
    }
  }, [deals]);

  if (!deals.length) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.sectionTitle}>Featured deals</Text>
      <View style={s.listWrap}>
        <FlashList
          data={deals}
          horizontal
          estimatedItemSize={220}
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <DealCard deal={item} onPress={onPressDeal} />
          )}
        />
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { marginTop: 12, marginBottom: 4 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listWrap: { height: 148 },
  listContent: { paddingRight: 8 },
  card: {
    width: 220,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  image: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object), width: '100%', height: '100%' },
  imageFallback: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexAlpha(Colors.orange, '22'),
  },
  fallbackEmoji: { fontSize: 36 },
  overlay: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    gap: 2,
  },
  kind: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    color: hexAlpha('#FFFFFF', 'CC'),
    fontWeight: '600',
  },
  cta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
}));
