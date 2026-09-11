// components/marketplace/MarketplaceCard.tsx — Premium shop discovery card

import { useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, Platform, Animated, Pressable,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Fonts, Shadow, createDynamicStyles } from '../../constants/theme';
import {
  formatDistanceKm, getShopActionState, getShopCategoryLabel, getShopStatusDisplay,
  unicodeMarketplaceStyle, type ShopStatusDisplay,
} from '../../lib/marketplaceUtils';
import { categoryMeta, hexAlpha, resolveShopMediaUrl } from './marketplaceMedia';
import { FollowButton } from './FollowButton';
import type { Shop } from '../../types';

export type ProductPreviewThumb = {
  id: string;
  title: string;
  image_url: string | null;
  price: number;
};

function IconPhone({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.1 3.6c.4-.5 1.1-.6 1.6-.3l2.5 1.1c.5.2.8.8.7 1.3l-.5 2.4c-.1.4-.3.7-.7.9l-1.5.8a12.2 12.2 0 0 0 5.4 5.4l.8-1.5c.2-.4.5-.6.9-.7l2.4-.5c.6-.1 1.1.2 1.3.7l1.1 2.5c.3.6.2 1.2-.3 1.6l-1.3 1.2c-.5.4-1.1.6-1.8.6C11.6 19.1 4.9 12.4 4.9 4.9c0-.7.2-1.3.6-1.8l1.6-1.3Z"
        fill={color}
      />
    </Svg>
  );
}

function IconChat({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V5Z" fill={color} />
    </Svg>
  );
}

function IconBag({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7l5-2 6 2 5-2v12l-5 2-6-2-5 2V7Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 5v12M15 7v12" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function PulseDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={s.pulseWrap}>
      <Animated.View style={[s.pulseRing, { borderColor: color, opacity: pulse }]} />
      <View style={[s.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

function GlassStatusBadge({ status }: { status: ShopStatusDisplay }) {
  const webGlass = Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as object)
    : null;

  return (
    <View
      style={[
        s.glassBadge,
        { backgroundColor: status.glass.glassBg, borderColor: status.glass.glassBorder },
        status.showPulse && s.glassBadgeGlow,
        webGlass,
      ]}
    >
      {status.showPulse ? <PulseDot color={status.glass.dotColor ?? '#FFFFFF'} /> : null}
      <Text style={[s.glassBadgeText, { color: status.glass.textColor }]} numberOfLines={1}>
        {status.shortLabel}
      </Text>
    </View>
  );
}

function ScalePressable({
  children, onPress, style, containerStyle, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  containerStyle?: object;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 8, tension: 160 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => !disabled && animate(0.97)}
      onPressOut={() => animate(1)}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export type MarketplaceCardProps = {
  shop: Shop;
  width?: number;
  followerCount: number;
  now: Date;
  currentUserId?: string;
  productPreviews?: ProductPreviewThumb[];
  onSelect: (s: Shop) => void;
  onCall: (s: Shop) => void;
  onChat: (s: Shop) => void;
  onEditShop?: (s: Shop) => void;
  onFollowerDelta: (shopId: string, delta: number) => void;
};

export function MarketplaceCard({
  shop,
  width,
  followerCount,
  onSelect,
  onCall,
  onChat,
  onEditShop,
  onFollowerDelta,
  now,
  currentUserId,
  productPreviews = [],
}: MarketplaceCardProps) {
  const coverUri = resolveShopMediaUrl(shop.cover_url || shop.logo_url);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);
  const status = getShopStatusDisplay(shop, now);
  const actions = getShopActionState(shop, now);
  const isClosed = status.cardDimmed;
  const isOpenActions = actions.usePrimaryActions;
  const isOwner = !!currentUserId && shop.owner_id === currentUserId;
  const distanceLabel = formatDistanceKm(shop.distance_km);
  const scale = useRef(new Animated.Value(1)).current;
  const thumbs = productPreviews.slice(0, 3);

  return (
    <Animated.View style={[s.cardWrap, width ? { width } : null, { transform: [{ scale }] }, isClosed && s.cardWrapDimmed]}>
      <Pressable
        onPress={() => onSelect(shop)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, friction: 7, tension: 150 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 150 }).start()}
        style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
      >
        <View style={[s.card, isClosed && s.cardClosed]}>
          <View style={s.media}>
            {coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={[s.cover, isClosed && s.coverDimmed, Platform.OS === 'web' && isClosed ? ({ filter: 'grayscale(45%)' } as object) : null]}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.coverFallback, isClosed && s.coverDimmed]}>
                <Text style={s.coverFallbackEmoji}>{meta.emoji}</Text>
                <Text style={s.coverFallbackLabel}>{meta.label}</Text>
              </View>
            )}
            {isClosed ? <View style={s.closedOverlay} /> : null}
            <View style={s.mediaOverlay} />
            <View style={s.mediaTop}>
              <View style={s.distanceBadge}>
                <Text style={s.distanceText}>
                  {distanceLabel === 'Nearby' ? 'Nearby' : `${distanceLabel} away`}
                </Text>
              </View>
            </View>
            <View style={s.glassBadgeAnchor}>
              <GlassStatusBadge status={status} />
            </View>
            <View style={s.logoRow}>
              <View style={[s.logoShell, isClosed && s.logoShellDimmed]}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={s.logoImg} resizeMode="cover" />
                ) : (
                  <Text style={s.logoEmoji}>{meta.emoji}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={s.body}>
            <View style={s.titleRow}>
              <Text style={[s.shopName, unicodeMarketplaceStyle, isClosed && s.shopNameDimmed]} numberOfLines={1}>
                {shop.name}
              </Text>
              {shop.is_verified ? (
                <View style={s.verifiedPill}>
                  <Text style={s.verifiedText}>✅ Verified</Text>
                </View>
              ) : null}
            </View>

            <Text style={s.categoryLine}>{meta.emoji} {getShopCategoryLabel(shop.category)}</Text>

            <View style={s.metricsRow}>
              <Text style={s.ratingLine}>
                ⭐ {Number(shop.avg_rating || 0).toFixed(1)}
                <Text style={s.reviewCount}>
                  {' · '}
                  {Number(shop.total_reviews) || 0}
                  {' '}
                  {Number(shop.total_reviews) === 1 ? 'review' : 'reviews'}
                </Text>
              </Text>
              <Text style={s.followerCount}>{followerCount} followers</Text>
            </View>

            {thumbs.length > 0 ? (
              <View style={s.productStrip}>
                {thumbs.map(p => {
                  const img = resolveShopMediaUrl(p.image_url);
                  return (
                    <View key={p.id} style={s.productThumb}>
                      {img ? (
                        <Image source={{ uri: img }} style={s.productImg} resizeMode="cover" />
                      ) : (
                        <View style={s.productFallback}>
                          <Text style={s.productFallbackText}>🛍️</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                <Text style={s.productHint}>Top products</Text>
              </View>
            ) : null}

            {status.announcement ? (
              <View style={s.announcementBanner}>
                <Text style={[s.announcementText, unicodeMarketplaceStyle]} numberOfLines={2}>
                  {status.announcement}
                </Text>
              </View>
            ) : null}

            {!isOwner ? (
              <View style={s.followRow}>
                <FollowButton
                  shopId={shop.id}
                  shopName={shop.name}
                  compact
                  onFollowerDelta={delta => onFollowerDelta(shop.id, delta)}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {isOwner ? (
        <View style={s.actions}>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={s.editBtn}
            onPress={() => onEditShop?.(shop)}
          >
            <Text style={s.editBtnText}>✏️ Edit My Shop</Text>
          </ScalePressable>
        </View>
      ) : (
        <View style={s.actions}>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={[actions.chatEnabled ? s.chatBtn : s.actionOutline, actions.chatEnabled && s.actionLift]}
            disabled={!actions.chatEnabled && !actions.inquiryEnabled}
            onPress={() => (actions.chatEnabled || actions.inquiryEnabled) && onChat(shop)}
          >
            <IconChat color={actions.chatEnabled ? Colors.blue : (actions.inquiryEnabled ? Colors.sub : Colors.dim)} />
            <Text style={[actions.chatEnabled ? s.chatText : s.actionOutlineText, !actions.chatEnabled && !actions.inquiryEnabled && s.actionTextMuted]}>
              💬 Message
            </Text>
          </ScalePressable>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={[isOpenActions ? s.callBtn : s.actionOutline, isOpenActions && s.actionLift]}
            disabled={!actions.callEnabled}
            onPress={() => actions.callEnabled && onCall(shop)}
          >
            <IconPhone color={actions.callEnabled ? Colors.white : Colors.dim} />
            <Text style={[isOpenActions ? s.callText : s.actionOutlineText, !actions.callEnabled && s.actionTextMuted]}>
              📞 Call
            </Text>
          </ScalePressable>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={[s.viewBtn, s.actionLift]}
            onPress={() => onSelect(shop)}
          >
            <IconBag color={Colors.white} />
            <Text style={s.viewText}>🛍️ View Shop</Text>
          </ScalePressable>
        </View>
      )}
    </Animated.View>
  );
}

const s = createDynamicStyles((Colors) => ({
  cardWrap: { gap: 8 },
  cardWrapDimmed: { opacity: 0.8 },
  card: {
    backgroundColor: hexAlpha(Colors.card, 'F2'),
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
    ...Shadow.md,
  },
  cardClosed: { borderColor: hexAlpha('#64748B', '44'), backgroundColor: hexAlpha(Colors.card, 'E8') },
  media: { height: 148, backgroundColor: Colors.surface, position: 'relative' },
  cover: { width: '100%', height: '100%', position: 'absolute' },
  coverDimmed: { opacity: 0.68 },
  closedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: hexAlpha('#0F172A', '28') },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, gap: 6 },
  coverFallbackEmoji: { fontSize: 44 },
  coverFallbackLabel: { color: Colors.sub, fontSize: 12, fontFamily: Fonts.bodySemiBold },
  mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000035' },
  mediaTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  distanceBadge: { backgroundColor: hexAlpha('#000000', 'AA'), borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  distanceText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  glassBadgeAnchor: { position: 'absolute', top: 10, right: 10, maxWidth: '72%', zIndex: 2 },
  glassBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, ...Shadow.sm },
  glassBadgeGlow: { shadowColor: '#10B981', shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  glassBadgeText: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
  pulseWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  pulseCore: { width: 6, height: 6, borderRadius: 3 },
  logoRow: { position: 'absolute', left: 12, bottom: -22 },
  logoShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 2.5,
    borderColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  logoShellDimmed: { opacity: 0.8 },
  logoImg: { width: '100%', height: '100%' },
  logoEmoji: { fontSize: 26 },
  body: { paddingHorizontal: 14, paddingTop: 30, paddingBottom: 12, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopName: { flex: 1, fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '800', color: Colors.text },
  shopNameDimmed: { color: Colors.sub },
  verifiedPill: {
    backgroundColor: hexAlpha(Colors.orange, '18'),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: { fontSize: 10, fontWeight: '800', color: Colors.orange },
  categoryLine: { fontSize: 12, color: Colors.sub, fontFamily: Fonts.body },
  metricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingLine: { fontSize: 12, color: Colors.amber, fontWeight: '700', flexShrink: 1 },
  reviewCount: { color: Colors.dim, fontWeight: '500' },
  followerCount: { color: Colors.sub, fontWeight: '600', fontSize: 11 },
  productStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  productImg: { width: '100%', height: '100%' },
  productFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  productFallbackText: { fontSize: 16 },
  productHint: { fontSize: 11, color: Colors.dim, fontWeight: '600', marginLeft: 2 },
  announcementBanner: {
    marginTop: 6,
    backgroundColor: hexAlpha(Colors.orange, '14'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.orange, '33'),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  announcementText: { fontSize: 12, color: Colors.text, fontFamily: Fonts.body, lineHeight: 17 },
  followRow: { marginTop: 6, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  actionFlex: { flex: 1 },
  callBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: hexAlpha('#10B981', 'EE'),
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: hexAlpha('#FFFFFF', '33'),
  },
  callText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 11 },
  actionLift: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  actionOutline: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: hexAlpha(Colors.card, 'CC'),
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border2,
  },
  actionOutlineText: { color: Colors.sub, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 11 },
  actionTextMuted: { color: Colors.dim },
  chatBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: hexAlpha(Colors.blue, '18'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.blue, '44'),
    borderRadius: 12,
    paddingVertical: 10,
  },
  chatText: { color: Colors.blue, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 11 },
  viewBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 10,
  },
  viewText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 11 },
  editBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 13,
  },
  editBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 14 },
}));
