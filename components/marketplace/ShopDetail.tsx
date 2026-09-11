// components/marketplace/ShopDetail.tsx

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Platform,
  Linking, TextInput, Animated, Vibration, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import {
  getShopActionState, getShopStatusDisplay, unicodeMarketplaceStyle,
} from '../../lib/marketplaceUtils';
import { getReviews, addReview, getProductsByShop, getShopById, refreshTargetRating, computeRatingFromReviews } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { categoryMeta, resolveShopMediaUrl } from './marketplaceMedia';
import { FollowButton } from './FollowButton';
import { ProductQuickViewModal } from './ProductQuickViewModal';
import type { Product, Shop } from '../../types';

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
    <View style={pulseStyles.wrap}>
      <Animated.View style={[pulseStyles.ring, { borderColor: color, opacity: pulse }]} />
      <View style={[pulseStyles.core, { backgroundColor: color }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  core: { width: 6, height: 6, borderRadius: 3 },
});

type Props = {
  shop: Shop;
  userId: string;
  isBuyer: boolean;
  followerCount: number;
  now: Date;
  onEditShop: () => void;
  onShopUpdate: (shop: Shop) => void;
  onFollowerDelta: (delta: number) => void;
};

function timeAgo(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function ShopDetail({
  shop: initialShop, userId, isBuyer, followerCount, now, onEditShop, onShopUpdate, onFollowerDelta,
}: Props) {
  const router = useRouter();
  const [shop, setShop] = useState(initialShop);
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const addItem = useCartStore(s => s.addItem);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);
  const status = getShopStatusDisplay(shop, now);
  const actions = getShopActionState(shop, now);
  const phoneNumber = (shop.phone || (shop as Shop & { phone_number?: string }).phone_number || '').trim();

  const handleCall = () => {
    if (!phoneNumber) {
      Alert.alert('Call unavailable', 'This shop has not shared a phone number yet.');
      return;
    }
    void Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleMessage = () => {
    router.push({
      pathname: '/chat/[shopId]',
      params: {
        shopId: shop.id,
        shopName: shop.name,
      },
    } as any);
  };

  useEffect(() => { setShop(initialShop); }, [initialShop]);
  useEffect(() => {
    getReviews(shop.id, 'shop').then(setReviews).catch(console.error);
    getProductsByShop(shop.id).then(setProducts).catch(console.error);
  }, [shop.id]);

  const submitReview = async () => {
    if (!myComment.trim()) return;
    setPosting(true);
    try {
      const review = await addReview({
        reviewer_id: userId, target_id: shop.id, target_type: 'shop',
        rating: myRating, comment: myComment.trim(),
      });
      setReviews(prev => {
        const withoutMine = prev.filter(item => item.reviewer_id !== userId && item.id !== review.id);
        return [review, ...withoutMine];
      });
      const nextList = [
        review,
        ...reviews.filter(item => item.reviewer_id !== userId && item.id !== review.id),
      ];
      const local = computeRatingFromReviews(nextList);
      setShop(prev => ({ ...prev, avg_rating: local.avg_rating, total_reviews: local.total_reviews }));
      onShopUpdate({ ...shop, avg_rating: local.avg_rating, total_reviews: local.total_reviews });
      setMyComment('');
      setSubmitted(true);
      const stats = await refreshTargetRating(shop.id, 'shop');
      const updated = await getShopById(shop.id);
      const merged = {
        ...updated,
        avg_rating: Number(updated.avg_rating) || stats.avg_rating,
        total_reviews: Number(updated.total_reviews) || stats.total_reviews,
      };
      setShop(merged);
      onShopUpdate(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const quickAdd = async (product: Product) => {
    if (!isBuyer) return;
    try {
      if (Platform.OS !== 'web') Vibration.vibrate(12);
      await addItem(userId, product.id, shop.id, 1);
      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2: `Added ${product.title} from ${shop.name}`,
      });
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Could not add item', text2: 'Please try again.' });
    }
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.root}>
        <View style={s.handle} />
        <View style={s.igIdentityRow}>
          <View style={s.igAvatarRing}>
            {logoUri
              ? <Image source={{ uri: logoUri }} style={s.igAvatar} resizeMode="cover" />
              : <Text style={s.igAvatarFallback}>{meta.emoji}</Text>}
          </View>
          <View style={s.igStatsRow}>
            <View style={s.igStat}><Text style={s.igStatVal}>{shop.total_products}</Text><Text style={s.igStatLabel}>posts</Text></View>
            <View style={s.igStat}><Text style={s.igStatVal}>{followerCount}</Text><Text style={s.igStatLabel}>followers</Text></View>
            <View style={s.igStat}><Text style={s.igStatVal}>{Number(shop.avg_rating).toFixed(1)}</Text><Text style={s.igStatLabel}>rating</Text></View>
          </View>
        </View>
        <View style={s.igBioBlock}>
          <Text style={[s.igName, unicodeMarketplaceStyle]}>{shop.name}</Text>
          <Text style={s.igMeta}>{meta.label} · {shop.city}</Text>
          <View style={s.profileActions}>
            <FollowButton shopId={shop.id} shopName={shop.name} onFollowerDelta={onFollowerDelta} />
            <TouchableOpacity style={s.profileActionBtn} onPress={handleMessage} activeOpacity={0.85}>
              <Text style={s.profileActionText}>💬 Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.profileActionBtn, (!phoneNumber || !actions.callEnabled) && s.igActionBtnDisabled]}
              disabled={!phoneNumber || !actions.callEnabled}
              onPress={handleCall}
              activeOpacity={0.85}
            >
              <Text style={[s.profileActionText, (!phoneNumber || !actions.callEnabled) && s.igActionBtnTextDisabled]}>
                📞 Call
              </Text>
            </TouchableOpacity>
          </View>
          <View style={s.igHoursRow}>
            <View style={[s.igOpenPill, status.showPulse && s.igOpenPillLive, { backgroundColor: status.glass.glassBg, borderColor: status.glass.glassBorder }]}>
              {status.showPulse ? <PulseDot color={status.glass.dotColor ?? '#FFFFFF'} /> : null}
              <Text style={[s.igOpenPillText, { color: status.glass.textColor }]}>{status.shortLabel}</Text>
            </View>
            {status.hoursLabel ? <Text style={s.igHoursText}>{status.hoursLabel}</Text> : null}
          </View>
          {status.announcement ? (
            <View style={s.announcementBanner}>
              <Text style={[s.announcementText, unicodeMarketplaceStyle]}>{status.announcement}</Text>
            </View>
          ) : null}
          <Text style={[s.desc, unicodeMarketplaceStyle]}>{shop.description || `Explore what ${shop.name} has for your neighborhood.`}</Text>
          <Text style={[s.igAddress, unicodeMarketplaceStyle]} numberOfLines={2}>{shop.address}</Text>
        </View>
        {(shop.whatsapp || shop.email) ? (
          <View style={s.ctaRow}>
            {shop.whatsapp ? (
              <TouchableOpacity style={s.igActionBtn} onPress={() => Linking.openURL(`https://wa.me/${shop.whatsapp}`)}>
                <Text style={s.igActionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {shop.email ? (
              <TouchableOpacity style={s.igActionBtn} onPress={() => Linking.openURL(`mailto:${shop.email}`)}>
                <Text style={s.igActionBtnText}>Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {shop.owner_id === userId ? (
          <TouchableOpacity style={s.editShopBtn} onPress={onEditShop}>
            <Text style={s.editShopBtnText}>Edit / Update Shop Profile</Text>
          </TouchableOpacity>
        ) : null}
        {products.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Products</Text>
            <Text style={s.sectionHint}>Tap to preview · Long press or + to quick add</Text>
            <View style={s.igGrid}>
              {products.slice(0, 9).map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={s.igGridItem}
                  activeOpacity={0.9}
                  onPress={() => isBuyer && setQuickViewProduct(product)}
                  onLongPress={() => isBuyer && void quickAdd(product)}
                  delayLongPress={320}
                >
                  {product.images?.[0] ? (
                    <Image source={{ uri: product.images[0] }} style={s.igGridImg} resizeMode="cover" />
                  ) : (
                    <View style={s.igGridFallback}><Text style={s.igGridEmoji}>{meta.emoji}</Text></View>
                  )}
                  {isBuyer ? (
                    <>
                      <View style={s.igGridOverlay}>
                        <Text style={s.igGridPrice}>₹{Number(product.discounted_price ?? product.price).toFixed(0)}</Text>
                      </View>
                      <TouchableOpacity
                        style={s.quickAddChip}
                        onPress={() => void quickAdd(product)}
                        hitSlop={8}
                      >
                        <Text style={s.quickAddText}>+</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
        {isBuyer && !submitted ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Leave a Review</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(num => (
                <TouchableOpacity key={num} onPress={() => setMyRating(num)}>
                  <Text style={[s.star, num <= myRating && s.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={myComment}
              onChangeText={setMyComment}
              multiline
              numberOfLines={3}
              placeholder="Share your experience"
              placeholderTextColor={Colors.dim}
              style={[s.reviewInput, unicodeMarketplaceStyle]}
            />
            <TouchableOpacity onPress={() => void submitReview()} disabled={posting} style={s.submitBtn}>
              <Text style={s.submitBtnText}>{posting ? 'Posting…' : 'Submit Review'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {reviews.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recent Reviews</Text>
            {reviews.slice(0, 3).map(review => (
              <View key={review.id} style={s.review}>
                <Text style={s.reviewRating}>{'★'.repeat(review.rating)}</Text>
                <Text style={[s.reviewText, unicodeMarketplaceStyle]}>{review.comment}</Text>
                <Text style={s.reviewMeta}>{review.reviewer?.name ?? 'User'} · {timeAgo(review.created_at)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ProductQuickViewModal
        visible={!!quickViewProduct}
        product={quickViewProduct}
        shop={shop}
        userId={userId}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { paddingBottom: 24 },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 14 },
  igIdentityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12, gap: 16 },
  igAvatarRing: { width: 86, height: 86, borderRadius: 43, borderWidth: 2, borderColor: Colors.border2, overflow: 'hidden', backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  igAvatar: { width: '100%', height: '100%' },
  igAvatarFallback: { fontSize: 36 },
  igStatsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  igStat: { alignItems: 'center' },
  igStatVal: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  igStatLabel: { color: Colors.text, fontSize: 13, marginTop: 2 },
  igBioBlock: { paddingHorizontal: 4, paddingBottom: 4 },
  igName: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  igMeta: { color: Colors.sub, fontSize: 13, marginTop: 2 },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  profileActionBtn: {
    flexGrow: 1,
    minWidth: 108,
    backgroundColor: Colors.card,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border2,
  },
  profileActionText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Fonts.bodySemiBold,
  },
  igHoursRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  igOpenPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  igOpenPillLive: { shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 6, elevation: 3 },
  igOpenPillText: { fontSize: 12, fontWeight: '800' },
  igHoursText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  announcementBanner: { marginTop: 8, backgroundColor: Colors.purple + '18', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.purple + '33' },
  announcementText: { fontSize: 12, color: Colors.text, lineHeight: 17 },
  igAddress: { color: Colors.sub, fontSize: 12, marginTop: 6 },
  desc: { fontSize: 13, color: Colors.text, lineHeight: 19, marginTop: 6 },
  igActionBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: 10, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  igActionBtnDisabled: { opacity: 0.45 },
  igActionBtnText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  igActionBtnTextDisabled: { color: Colors.dim },
  igGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -16, gap: 1 },
  igGridItem: { width: '32.8%', aspectRatio: 1, backgroundColor: Colors.surface, overflow: 'hidden' },
  igGridImg: { width: '100%', height: '100%' },
  igGridFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  igGridEmoji: { fontSize: 28, opacity: 0.5 },
  igGridOverlay: { position: 'absolute', left: 6, bottom: 6, backgroundColor: '#0008', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  igGridPrice: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  quickAddChip: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  quickAddText: { color: Colors.white, fontSize: 16, fontWeight: '900', marginTop: -1 },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  editShopBtn: { marginTop: 14, backgroundColor: Colors.orange + '14', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.orange + '35' },
  editShopBtnText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sectionHint: { color: Colors.dim, fontSize: 11, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  star: { fontSize: 26, color: Colors.border2 },
  starActive: { color: Colors.amber },
  reviewInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 12, color: Colors.text, minHeight: 90, textAlignVertical: 'top', marginBottom: 10 },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: Colors.white, fontWeight: '800' },
  review: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 12, marginBottom: 8 },
  reviewRating: { color: Colors.amber, fontWeight: '800', marginBottom: 4 },
  reviewText: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  reviewMeta: { color: Colors.dim, fontSize: 11, marginTop: 6 },
}));
