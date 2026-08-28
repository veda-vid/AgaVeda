// app/(tabs)/shops.tsx — Marketplace: local shop discovery
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, ActivityIndicator,
  Linking, ScrollView, StyleSheet, Animated, Pressable, Modal, Platform,
  Image, KeyboardAvoidingView, useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import {
  getShopsNearby, getReviews, addReview, getProductsByShop, getShopById,
  getProductTitlesByShopIds, getOrCreateShopConversation, getShopMessages,
  sendShopMessage, touchShopActivity,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { getSupabaseConfig } from '../../lib/config';
import {
  formatDistanceKm, getShopActionState, getShopCategoryLabel, getShopStatusDisplay,
  type ShopStatusDisplay,
} from '../../lib/marketplaceUtils';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { Colors, Fonts, SHOP_CATEGORIES, Shadow } from '../../constants/theme';
import type { Shop, ShopMessage } from '../../types';

const MARKETPLACE_RADIUS = [2, 5, 10] as const;
const { url: SUPABASE_URL } = getSupabaseConfig();

function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function resolveShopMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!SUPABASE_URL) return value;
  const base = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\//, '')}`;
}

function categoryMeta(category: string) {
  return SHOP_CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '🏪' };
}

function IconSearch({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} />
      <Path d="M16 16l5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconPhone({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.1 3.6c.4-.5 1.1-.6 1.6-.3l2.5 1.1c.5.2.8.8.7 1.3l-.5 2.4c-.1.4-.3.7-.7.9l-1.5.8a12.2 12.2 0 0 0 5.4 5.4l.8-1.5c.2-.4.5-.6.9-.7l2.4-.5c.6-.1 1.1.2 1.3.7l1.1 2.5c.3.6.2 1.2-.3 1.6l-1.3 1.2c-.5.4-1.1.6-1.8.6C11.6 19.1 4.9 12.4 4.9 4.9c0-.7.2-1.3.6-1.8l1.6-1.3Z"
        fill={color}
      />
    </Svg>
  );
}

function IconChat({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V5Z" fill={color} />
    </Svg>
  );
}

function ScalePressable({
  children, onPress, style, containerStyle, pressedScale = 0.97, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  containerStyle?: object;
  pressedScale?: number;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 8, tension: 160 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => !disabled && animate(pressedScale)}
      onPressOut={() => animate(1)}
      style={[containerStyle, Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as object) : null]}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
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
        {
          backgroundColor: status.glass.glassBg,
          borderColor: status.glass.glassBorder,
        },
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

function MarketplaceCard({
  shop, width, onSelect, onCall, onChat, now,
}: {
  shop: Shop;
  width?: number;
  onSelect: (s: Shop) => void;
  onCall: (s: Shop) => void;
  onChat: (s: Shop) => void;
  now: Date;
}) {
  const coverUri = resolveShopMediaUrl(shop.cover_url || shop.logo_url);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);
  const status = getShopStatusDisplay(shop, now);
  const actions = getShopActionState(shop, now);
  const isClosed = status.cardDimmed;
  const isOpenActions = actions.usePrimaryActions;
  const showSubline = status.subline && status.subline !== `🕒 ${status.hoursLabel}`;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[
      s.cardWrap,
      width ? { width } : null,
      { transform: [{ scale }] },
      isClosed && s.cardWrapDimmed,
    ]}>
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
                style={[
                  s.cover,
                  isClosed && s.coverDimmed,
                  Platform.OS === 'web' && isClosed ? ({ filter: 'grayscale(45%)' } as object) : null,
                ]}
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
                <Text style={s.distanceText}>{formatDistanceKm(shop.distance_km)}</Text>
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
              <Text style={[s.shopName, isClosed && s.shopNameDimmed]} numberOfLines={1}>{shop.name}</Text>
              {shop.is_verified ? <Text style={s.verifiedDot}>●</Text> : null}
            </View>
            {status.hoursLabel ? (
              <Text style={[s.hoursPrimary, isClosed && s.hoursPrimaryDimmed]}>{status.hoursLabel}</Text>
            ) : null}
            <Text style={s.categoryLine}>{meta.emoji} {getShopCategoryLabel(shop.category)}</Text>
            <Text style={s.ratingLine}>
              ★ {Number(shop.avg_rating).toFixed(1)}
              <Text style={s.reviewCount}> ({shop.total_reviews})</Text>
            </Text>
            {showSubline ? (
              <Text style={[s.hoursLine, isClosed && s.hoursLineDimmed]}>{status.subline}</Text>
            ) : null}
            {status.announcement ? (
              <View style={s.announcementBanner}>
                <Text style={s.announcementText} numberOfLines={2}>{status.announcement}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={s.actions}>
        <ScalePressable
          containerStyle={s.actionFlex}
          style={[
            isOpenActions ? s.callBtn : s.actionOutline,
            isOpenActions && s.actionLift,
          ]}
          disabled={!actions.callEnabled}
          onPress={() => actions.callEnabled && onCall(shop)}
        >
          <IconPhone color={actions.callEnabled ? Colors.white : Colors.dim} />
          <Text style={[isOpenActions ? s.callText : s.actionOutlineText, !actions.callEnabled && s.actionTextMuted]}>
            {actions.callLabel}
          </Text>
        </ScalePressable>
        <ScalePressable
          containerStyle={s.actionFlex}
          style={[
            actions.chatEnabled ? s.chatBtn : s.actionOutline,
            actions.chatEnabled && s.actionLift,
          ]}
          disabled={!actions.chatEnabled && !actions.inquiryEnabled}
          onPress={() => (actions.chatEnabled || actions.inquiryEnabled) && onChat(shop)}
        >
          <IconChat color={actions.chatEnabled ? Colors.blue : (actions.inquiryEnabled ? Colors.sub : Colors.dim)} />
          <Text style={[
            actions.chatEnabled ? s.chatText : s.actionOutlineText,
            !actions.chatEnabled && !actions.inquiryEnabled && s.actionTextMuted,
          ]}>
            {actions.chatLabel}
          </Text>
        </ScalePressable>
      </View>
    </Animated.View>
  );
}

function ShopChatDrawer({ shop, userId, onClose }: { shop: Shop; userId: string; onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ShopMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrCreateShopConversation(userId, shop)
      .then(async conv => {
        if (cancelled) return;
        setConversationId(conv.id);
        setMessages(await getShopMessages(conv.id));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shop.id, userId]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`shop-chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'shop_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as ShopMessage;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const handleSend = async () => {
    if (!conversationId || !text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendShopMessage(conversationId, userId, text);
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      setText('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={c.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={c.backdrop} onPress={onClose} />
        <View style={c.sheet}>
          <View style={c.handle} />
          <View style={c.header}>
            <View style={{ flex: 1 }}>
              <Text style={c.title}>{shop.name}</Text>
              <Text style={c.sub}>{getShopCategoryLabel(shop.category)}</Text>
            </View>
            <Pressable onPress={onClose} style={c.closeBtn}><Text style={c.closeText}>✕</Text></Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={messages}
              keyExtractor={m => m.id}
              style={c.messageList}
              contentContainerStyle={c.messageContent}
              renderItem={({ item }) => {
                const mine = item.sender_id === userId;
                return (
                  <View style={[c.bubble, mine ? c.bubbleMine : c.bubbleTheirs]}>
                    <Text style={[c.bubbleText, mine && c.bubbleTextMine]}>{item.body}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={c.emptyChat}>Ask about products, hours, or delivery.</Text>}
            />
          )}
          <View style={c.composer}>
            <TextInput
              style={c.composerInput}
              value={text}
              onChangeText={setText}
              placeholder="Message this shop…"
              placeholderTextColor={Colors.dim}
              multiline
            />
            <Pressable onPress={handleSend} disabled={!text.trim() || sending} style={[c.sendBtn, (!text.trim() || sending) && c.sendBtnDisabled]}>
              <Text style={c.sendBtnText}>{sending ? '…' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ShopDetail({
  shop: initialShop, userId, isBuyer, onEditShop, onShopUpdate, now,
}: {
  shop: Shop;
  userId: string;
  isBuyer: boolean;
  onEditShop: () => void;
  onShopUpdate: (shop: Shop) => void;
  now: Date;
}) {
  const [shop, setShop] = useState(initialShop);
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addItem } = useCartStore();
  const { addNotification } = useAuthStore();
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);
  const status = getShopStatusDisplay(shop, now);
  const actions = getShopActionState(shop, now);

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
      setReviews(prev => [review, ...prev]);
      setMyComment('');
      setSubmitted(true);
      const updated = await getShopById(shop.id);
      setShop(updated);
      onShopUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const addProduct = async (productId: string) => {
    try {
      await addItem(userId, productId, shop.id, 1);
      addNotification(`Added from ${shop.name}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={d.root}>
      <View style={d.handle} />
      <View style={d.igIdentityRow}>
        <View style={d.igAvatarRing}>
          {logoUri
            ? <Image source={{ uri: logoUri }} style={d.igAvatar} resizeMode="cover" />
            : <Text style={d.igAvatarFallback}>{meta.emoji}</Text>}
        </View>
        <View style={d.igStatsRow}>
          <View style={d.igStat}><Text style={d.igStatVal}>{shop.total_products}</Text><Text style={d.igStatLabel}>posts</Text></View>
          <View style={d.igStat}><Text style={d.igStatVal}>{shop.total_followers}</Text><Text style={d.igStatLabel}>followers</Text></View>
          <View style={d.igStat}><Text style={d.igStatVal}>{Number(shop.avg_rating).toFixed(1)}</Text><Text style={d.igStatLabel}>rating</Text></View>
        </View>
      </View>
      <View style={d.igBioBlock}>
        <Text style={d.igName}>{shop.name}</Text>
        <Text style={d.igMeta}>{meta.label} · {shop.city}</Text>
        <View style={d.igHoursRow}>
          <View
            style={[
              d.igOpenPill,
              status.showPulse && d.igOpenPillLive,
              {
                backgroundColor: status.glass.glassBg,
                borderColor: status.glass.glassBorder,
              },
              Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object) : null,
            ]}
          >
            {status.showPulse ? <PulseDot color={status.glass.dotColor ?? '#FFFFFF'} /> : null}
            <Text style={[d.igOpenPillText, { color: status.glass.textColor }]}>{status.shortLabel}</Text>
          </View>
          {status.hoursLabel ? <Text style={d.igHoursText}>{status.hoursLabel}</Text> : null}
          {status.subline && status.subline !== `🕒 ${status.hoursLabel}` ? (
            <Text style={d.igHoursSub}>{status.subline}</Text>
          ) : null}
        </View>
        {status.announcement ? (
          <View style={s.announcementBanner}><Text style={s.announcementText}>{status.announcement}</Text></View>
        ) : null}
        <Text style={d.desc}>{shop.description || `Explore what ${shop.name} has for your neighborhood.`}</Text>
        <Text style={d.igAddress} numberOfLines={2}>{shop.address}</Text>
      </View>
      <View style={d.ctaRow}>
        <TouchableOpacity
          style={[d.igActionBtn, !actions.callEnabled && d.igActionBtnDisabled]}
          disabled={!actions.callEnabled}
          onPress={() => actions.callEnabled && Linking.openURL(`tel:${shop.phone}`)}
        >
          <Text style={[d.igActionBtnText, !actions.callEnabled && d.igActionBtnTextDisabled]}>
            📞 {actions.callLabel}
          </Text>
        </TouchableOpacity>
        {shop.whatsapp ? (
          <TouchableOpacity style={d.igActionBtn} onPress={() => Linking.openURL(`https://wa.me/${shop.whatsapp}`)}>
            <Text style={d.igActionBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={d.igActionBtn} onPress={() => Linking.openURL(`mailto:${shop.email}`)}>
            <Text style={d.igActionBtnText}>Email</Text>
          </TouchableOpacity>
        )}
      </View>
      {shop.owner_id === userId ? (
        <TouchableOpacity style={d.editShopBtn} onPress={onEditShop}>
          <Text style={d.editShopBtnText}>Edit / Update Shop Profile</Text>
        </TouchableOpacity>
      ) : null}
      {products.length > 0 ? (
        <View style={d.section}>
          <View style={d.igGrid}>
            {products.slice(0, 9).map((product: any) => (
              <TouchableOpacity key={product.id} style={d.igGridItem} activeOpacity={0.9} onPress={() => isBuyer ? addProduct(product.id) : undefined}>
                {product.images?.[0] ? (
                  <Image source={{ uri: product.images[0] }} style={d.igGridImg} resizeMode="cover" />
                ) : (
                  <View style={d.igGridFallback}><Text style={d.igGridEmoji}>{meta.emoji}</Text></View>
                )}
                {isBuyer ? (
                  <View style={d.igGridOverlay}>
                    <Text style={d.igGridPrice}>₹{Number(product.discounted_price ?? product.price).toFixed(0)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      {isBuyer && !submitted ? (
        <View style={d.section}>
          <Text style={d.sectionTitle}>Leave a Review</Text>
          <View style={d.starsRow}>
            {[1, 2, 3, 4, 5].map(num => (
              <TouchableOpacity key={num} onPress={() => setMyRating(num)}>
                <Text style={[d.star, num <= myRating && d.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={myComment} onChangeText={setMyComment} multiline numberOfLines={3}
            placeholder="Share your experience" placeholderTextColor={Colors.dim} style={d.reviewInput} />
          <TouchableOpacity onPress={submitReview} disabled={posting} style={d.submitBtn}>
            <Text style={d.submitBtnText}>{posting ? 'Posting...' : 'Submit Review'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {reviews.length > 0 ? (
        <View style={d.section}>
          <Text style={d.sectionTitle}>Recent Reviews</Text>
          {reviews.slice(0, 3).map(review => (
            <View key={review.id} style={d.review}>
              <Text style={d.reviewRating}>{'★'.repeat(review.rating)}</Text>
              <Text style={d.reviewText}>{review.comment}</Text>
              <Text style={d.reviewMeta}>{review.reviewer?.name ?? 'User'} · {timeAgo(review.created_at)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function ShopsScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const [shops, setShops] = useState<Shop[]>([]);
  const [productIndex, setProductIndex] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [chatShop, setChatShop] = useState<Shop | null>(null);
  const [hoursTick, setHoursTick] = useState(() => new Date());
  const { width } = useWindowDimensions();
  const isBuyer = profile?.role === 'buyer';
  const { category } = useLocalSearchParams<{ category?: string }>();
  const columns = width >= 1100 ? 3 : width >= 680 ? 2 : 1;
  const gap = 12;
  const cardWidth = columns > 1 ? (width - 32 - gap * (columns - 1)) / columns : width - 32;
  const hasLocation = profile?.lat != null && profile?.lng != null;

  useEffect(() => {
    if (profile?.radius_km && MARKETPLACE_RADIUS.includes(profile.radius_km as typeof MARKETPLACE_RADIUS[number])) {
      setRadiusKm(profile.radius_km);
    }
  }, [profile?.radius_km]);

  useEffect(() => {
    if (!category) return;
    const isValid = SHOP_CATEGORIES.some(item => item.id === category);
    if (category === 'all' || !isValid) setFilter('all');
    else setFilter(category);
  }, [category]);

  const loadShops = useCallback(async (isRefresh = false) => {
    if (!profile || !hasLocation) {
      setShops([]);
      setProductIndex({});
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    try {
      const data = await getShopsNearby(
        profile.lat!,
        profile.lng!,
        radiusKm,
        filter === 'all' ? undefined : filter,
      );
      setShops(data ?? []);
      const titles = await getProductTitlesByShopIds((data ?? []).map(s => s.id));
      setProductIndex(titles);
    } catch (e) {
      console.error(e);
      setShops([]);
      setProductIndex({});
    } finally {
      setLoading(false);
    }
  }, [profile, hasLocation, radiusKm, filter]);

  const refreshShops = useCallback(async () => {
    setHoursTick(new Date());
    await loadShops(true);
  }, [loadShops]);

  const { refreshControl, scrollHandlers } = useScreenRefresh(refreshShops);

  useEffect(() => { loadShops(); }, [loadShops]);

  useEffect(() => {
    if (profile?.role === 'seller') {
      touchShopActivity(profile.id).catch(() => {});
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    const channelId = `marketplace-shops-${profile?.id ?? 'anon'}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops' }, payload => {
        const row = payload.new as Shop;
        setShops(prev => prev.map(s => (s.id === row.id ? { ...s, ...row } : s)));
        setSelected(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setChatShop(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        setHoursTick(new Date());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(shop => {
      const meta = categoryMeta(shop.category);
      const products = productIndex[shop.id] ?? [];
      return (
        shop.name.toLowerCase().includes(q) ||
        shop.category.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        (shop.status_message ?? '').toLowerCase().includes(q) ||
        products.some(title => title.toLowerCase().includes(q))
      );
    });
  }, [shops, search, productIndex]);

  const handleShopUpdate = (updated: Shop) => {
    setShops(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
    setSelected(prev => (prev?.id === updated.id ? updated : prev));
  };

  const locationSub = profile?.city && hasLocation ? `Near ${profile.city} · ` : '';

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <Text style={s.brand}>Marketplace</Text>
          <Text style={s.sub}>{locationSub}Discover local shops around you</Text>

          <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
            <IconSearch color={searchFocused ? Colors.orange : Colors.dim} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search shops, categories, or products"
              placeholderTextColor={Colors.dim}
            />
            {search.trim() ? <Text style={s.resultCount}>{filtered.length}</Text> : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.radiusRail}>
            {MARKETPLACE_RADIUS.map(km => (
              <ScalePressable
                key={km}
                style={[s.radiusChip, radiusKm === km && s.radiusChipActive]}
                onPress={() => setRadiusKm(km)}
              >
                <Text style={[s.radiusText, radiusKm === km && s.radiusTextActive]}>Within {km} km</Text>
              </ScalePressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRail}>
            {[{ id: 'all', label: 'All', emoji: '🏬' }, ...SHOP_CATEGORIES].map(item => {
              const active = filter === item.id;
              return (
                <ScalePressable
                  key={item.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setFilter(item.id)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{item.emoji} {item.label}</Text>
                </ScalePressable>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {!hasLocation ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📍</Text>
          <Text style={s.emptyTitle}>Location required</Text>
          <Text style={s.emptyText}>Set your city and GPS in Profile to browse nearby shops.</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          key={`marketplace-${columns}`}
          data={filtered}
          numColumns={columns}
          keyExtractor={item => item.id}
          columnWrapperStyle={columns > 1 ? s.gridRow : undefined}
          {...scrollHandlers}
          renderItem={({ item }) => (
            <View style={{ marginBottom: gap, marginHorizontal: columns === 1 ? 16 : 0 }}>
              <MarketplaceCard
                shop={item}
                width={cardWidth}
                now={hoursTick}
                onSelect={setSelected}
                onCall={shop => Linking.openURL(`tel:${shop.phone}`)}
                onChat={setChatShop}
              />
            </View>
          )}
          refreshControl={refreshControl}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🏪</Text>
              <Text style={s.emptyTitle}>{search.trim() ? 'No matching shops' : 'No shops nearby'}</Text>
              <Text style={s.emptyText}>
                {search.trim()
                  ? 'Try a different search term or widen your radius.'
                  : 'Try another category or increase your search radius.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            {selected && profile ? (
              <ShopDetail
                shop={selected}
                userId={profile.id}
                isBuyer={!!isBuyer}
                now={hoursTick}
                onShopUpdate={handleShopUpdate}
                onEditShop={() => { setSelected(null); router.push('/seller/shop' as any); }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {chatShop && profile ? (
        <ShopChatDrawer shop={chatShop} userId={profile.id} onClose={() => setChatShop(null)} />
      ) : null}
    </View>
  );
}

function timeAgo(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brand: {
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: '#00000022',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
    marginTop: 4,
    textAlign: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: hexAlpha(Colors.card, 'EE'),
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 12,
    ...Shadow.sm,
  },
  searchWrapFocused: {
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, fontFamily: Fonts.body, paddingVertical: 12 },
  resultCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: hexAlpha(Colors.orange, '22'),
    color: Colors.orange,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 26,
    overflow: 'hidden',
  },
  radiusRail: { paddingBottom: 8, paddingRight: 8 },
  radiusChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  radiusChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  radiusText: { fontSize: 11, fontFamily: Fonts.bodySemiBold, color: Colors.sub, fontWeight: '700' },
  radiusTextActive: { color: Colors.white },
  chipRail: { paddingBottom: 6, paddingRight: 8 },
  chip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  chipText: { fontSize: 11, fontFamily: Fonts.bodySemiBold, color: Colors.sub, fontWeight: '700' },
  chipTextActive: { color: Colors.white },
  listContent: { paddingTop: 14, paddingBottom: 100 },
  gridRow: { paddingHorizontal: 16, gap: 12 },
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
  cardClosed: {
    borderColor: hexAlpha('#64748B', '44'),
    backgroundColor: hexAlpha(Colors.card, 'E8'),
  },
  media: { height: 148, backgroundColor: Colors.surface, position: 'relative' },
  cover: { width: '100%', height: '100%', position: 'absolute' },
  coverDimmed: { opacity: 0.68 },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: hexAlpha('#0F172A', '28'),
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    gap: 6,
  },
  coverFallbackEmoji: { fontSize: 44 },
  coverFallbackLabel: { color: Colors.sub, fontSize: 12, fontFamily: Fonts.bodySemiBold },
  mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000035' },
  mediaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 10,
    gap: 8,
  },
  distanceBadge: {
    backgroundColor: hexAlpha('#000000', 'AA'),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  distanceText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  glassBadgeAnchor: {
    position: 'absolute',
    top: 10,
    right: 10,
    maxWidth: '72%',
    zIndex: 2,
  },
  glassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  glassBadgeGlow: {
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  glassBadgeText: { fontSize: 10, fontWeight: '800', flexShrink: 1, letterSpacing: 0.2 },
  pulseWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  pulseCore: { width: 6, height: 6, borderRadius: 3 },
  logoRow: { position: 'absolute', left: 12, bottom: -22 },
  logoShell: {
    width: 56,
    height: 56,
    borderRadius: 16,
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
  body: { paddingHorizontal: 14, paddingTop: 30, paddingBottom: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopName: { flex: 1, fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '800', color: Colors.text },
  shopNameDimmed: { color: Colors.sub },
  verifiedDot: { color: Colors.orange, fontSize: 10 },
  hoursPrimary: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    marginTop: 1,
  },
  hoursPrimaryDimmed: { color: Colors.dim },
  categoryLine: { fontSize: 12, color: Colors.sub, fontFamily: Fonts.body },
  ratingLine: { fontSize: 12, color: Colors.amber, fontWeight: '700' },
  reviewCount: { color: Colors.dim, fontWeight: '500' },
  hoursLine: { fontSize: 11, color: Colors.sub, fontFamily: Fonts.bodySemiBold, marginTop: 2 },
  hoursLineDimmed: { color: Colors.dim },
  announcementBanner: {
    marginTop: 8,
    backgroundColor: hexAlpha(Colors.purple, '18'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.purple, '33'),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  announcementText: { fontSize: 12, color: Colors.text, fontFamily: Fonts.body, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  actionFlex: { flex: 1 },
  callBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 10,
  },
  callText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 12 },
  actionLift: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionOutline: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: hexAlpha(Colors.card, 'CC'),
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border2,
  },
  actionOutlineText: {
    color: Colors.sub,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 12,
  },
  actionTextMuted: { color: Colors.dim },
  chatBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: hexAlpha(Colors.blue, '14'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.blue, '44'),
    borderRadius: 12,
    paddingVertical: 10,
  },
  chatBtnDisabled: { backgroundColor: Colors.surface, borderColor: Colors.border2, opacity: 0.75 },
  chatText: { color: Colors.blue, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 12 },
  chatTextDisabled: { color: Colors.dim },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  emptyText: { color: Colors.dim, fontSize: 13, fontFamily: Fonts.body, textAlign: 'center', lineHeight: 19 },
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 16,
  },
});

const c = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '55%',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 18, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 12, fontFamily: Fonts.body, color: Colors.sub, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: Colors.sub, fontSize: 14, fontWeight: '700' },
  messageList: { flex: 1, maxHeight: 360 },
  messageContent: { paddingVertical: 8, gap: 8 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.orange, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, fontFamily: Fonts.body, color: Colors.text, lineHeight: 19 },
  bubbleTextMine: { color: Colors.white },
  emptyChat: { textAlign: 'center', color: Colors.dim, fontSize: 13, fontFamily: Fonts.body, paddingVertical: 24 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  composerInput: { flex: 1, backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: 14, fontFamily: Fonts.body, maxHeight: 96 },
  sendBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 13 },
});

const d = StyleSheet.create({
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
  igHoursRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  igOpenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  igOpenPillLive: {
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  igOpenPillText: { fontSize: 12, fontWeight: '800' },
  igHoursText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  igHoursSub: { color: Colors.sub, fontSize: 12, fontWeight: '600', width: '100%' },
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
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  editShopBtn: { marginTop: 14, backgroundColor: Colors.orange + '14', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.orange + '35' },
  editShopBtnText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 10 },
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
});
