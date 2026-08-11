// app/(tabs)/shops.tsx — Shops discovery screen
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { getShopsNearby, getReviews, addReview, getProductsByShop } from '../../lib/api';
import { getSupabaseConfig } from '../../lib/config';
import { Colors, Fonts, SHOP_CATEGORIES } from '../../constants/theme';
import type { Shop } from '../../types';

const { url: SUPABASE_URL } = getSupabaseConfig();

function resolveShopMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!SUPABASE_URL) return value;
  const normalizedBase = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${normalizedBase}${value}`;
  return `${normalizedBase}/${value.replace(/^\//, '')}`;
}

function categoryMeta(category: string) {
  return SHOP_CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '🏪' };
}

function formatDistance(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Nearby';
  return `${value.toFixed(1)} km away`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function normalizeWebsiteUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function normalizeInstagramUrl(value?: string | null) {
  if (!value) return null;
  const handle = value.replace(/^@/, '');
  return `https://instagram.com/${handle}`;
}

function ShopTile({
  shop,
  onSelect,
  onCall,
  onFollow,
  following,
  followBusy,
  isBuyer,
  width,
}: {
  shop: Shop;
  onSelect: (shop: Shop) => void;
  onCall: (shop: Shop) => void;
  onFollow: (shop: Shop) => void;
  following: boolean;
  followBusy: boolean;
  isBuyer: boolean;
  width?: number;
}) {
  const coverUri = resolveShopMediaUrl(shop.cover_url || shop.logo_url);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);

  return (
    <TouchableOpacity
      onPress={() => onSelect(shop)}
      activeOpacity={0.9}
      style={[s.tileCard, width ? { width } : null]}
    >
      <View style={s.tileMedia}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={s.tileCover} resizeMode="cover" />
        ) : (
          <View style={s.tileFallback}>
            <Text style={s.tileFallbackEmoji}>{meta.emoji}</Text>
          </View>
        )}
        <View style={s.tileOverlay} />
        <View style={s.tileTopRow}>
          <View style={s.categoryBadge}>
            <Text style={s.categoryBadgeText}>{meta.emoji} {meta.label}</Text>
          </View>
          <View style={[s.openBadge, { backgroundColor: shop.is_open ? '#0B7A33DD' : '#6B7280DD' }]}>
            <Text style={s.openBadgeText}>{shop.is_open ? 'Open' : 'Closed'}</Text>
          </View>
        </View>
      </View>

      <View style={s.tileBody}>
        <View style={s.tileHeaderRow}>
          <View style={s.logoShell}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={s.logoImage} resizeMode="cover" />
            ) : (
              <Text style={s.logoFallback}>{meta.emoji}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.tileName} numberOfLines={1}>{shop.name}</Text>
              {shop.is_verified ? <Text style={s.verifiedBadge}>●</Text> : null}
            </View>
            <Text style={s.tileMeta}>{formatDistance(shop.distance_km)} · {shop.total_products} items</Text>
            <Text style={s.tileRating}>★ {shop.avg_rating.toFixed(1)} <Text style={s.tileRatingCount}>({shop.total_reviews})</Text></Text>
          </View>
        </View>

        <Text style={s.tileDescription} numberOfLines={2}>
          {shop.description || `Explore ${meta.label.toLowerCase()} offerings in ${shop.city}.`}
        </Text>
        <Text style={s.tileAddress} numberOfLines={1}>{shop.address}</Text>

        <View style={s.tileActions}>
          <TouchableOpacity onPress={() => onSelect(shop)} style={s.tilePrimaryBtn}>
            <Text style={s.tilePrimaryText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onCall(shop)} style={s.tileSecondaryBtn}>
            <Text style={s.tileSecondaryText}>Call</Text>
          </TouchableOpacity>
          {isBuyer ? (
            <TouchableOpacity
              onPress={() => onFollow(shop)}
              style={[s.tileSecondaryBtn, following ? s.followingBtn : null]}
              disabled={followBusy}
            >
              <Text style={[s.tileSecondaryText, following ? s.followingText : null]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FeaturedShop({
  shop,
  onSelect,
  onCall,
}: {
  shop: Shop;
  onSelect: (shop: Shop) => void;
  onCall: (shop: Shop) => void;
}) {
  const coverUri = resolveShopMediaUrl(shop.cover_url || shop.logo_url);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);

  return (
    <TouchableOpacity onPress={() => onSelect(shop)} activeOpacity={0.92} style={s.featuredCard}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={s.featuredCover} resizeMode="cover" />
      ) : (
        <View style={s.featuredFallback}>
          <Text style={s.featuredFallbackEmoji}>{meta.emoji}</Text>
        </View>
      )}
      <View style={s.featuredOverlay} />
      <View style={s.featuredContent}>
        <Text style={s.featuredEyebrow}>Featured Near You</Text>
        <Text style={s.featuredName}>{shop.name}</Text>
        <Text style={s.featuredMeta}>{meta.label} · {formatDistance(shop.distance_km)} · ★ {shop.avg_rating.toFixed(1)}</Text>
        <Text style={s.featuredDescription} numberOfLines={2}>
          {shop.description || `Explore top ${meta.label.toLowerCase()} finds around ${shop.city}.`}
        </Text>
        <View style={s.featuredFooter}>
          <View style={s.featuredLogoRing}>
            {logoUri ? <Image source={{ uri: logoUri }} style={s.featuredLogo} resizeMode="cover" /> : <Text style={s.logoFallback}>{meta.emoji}</Text>}
          </View>
          <TouchableOpacity onPress={() => onCall(shop)} style={s.featuredCallBtn}>
            <Text style={s.featuredCallText}>Call Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ShopDetail({
  shop,
  userId,
  isBuyer,
  onEditShop,
}: {
  shop: Shop;
  userId: string;
  isBuyer: boolean;
  onEditShop: () => void;
}) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addItem } = useCartStore();
  const { addNotification } = useAuthStore();
  const coverUri = resolveShopMediaUrl(shop.cover_url || shop.logo_url);
  const logoUri = resolveShopMediaUrl(shop.logo_url);
  const meta = categoryMeta(shop.category);

  useEffect(() => {
    getReviews(shop.id, 'shop').then(setReviews).catch(console.error);
    getProductsByShop(shop.id).then(setProducts).catch(console.error);
  }, [shop.id]);

  const submitReview = async () => {
    if (!myComment.trim()) return;
    setPosting(true);
    try {
      const review = await addReview({
        reviewer_id: userId,
        target_id: shop.id,
        target_type: 'shop',
        rating: myRating,
        comment: myComment.trim(),
      });
      setReviews(prev => [review, ...prev]);
      setMyComment('');
      setSubmitted(true);
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
      <View style={d.hero}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={d.heroCover} resizeMode="cover" />
        ) : (
          <View style={d.heroFallback}>
            <Text style={d.heroFallbackEmoji}>{meta.emoji}</Text>
          </View>
        )}
        <View style={d.heroOverlay} />
        <View style={d.heroContent}>
          <View style={d.heroLogoWrap}>
            {logoUri ? <Image source={{ uri: logoUri }} style={d.heroLogo} resizeMode="cover" /> : <Text style={d.heroLogoFallback}>{meta.emoji}</Text>}
          </View>
          <Text style={d.shopName}>{shop.name}</Text>
          <Text style={d.heroMeta}>{meta.label} · {shop.city} · {shop.is_open ? 'Open now' : 'Closed'}</Text>
        </View>
      </View>

      <Text style={d.desc}>{shop.description || `Explore what ${shop.name} has for your neighborhood.`}</Text>
      <View style={d.statsRow}>
        {[
          [shop.total_products.toString(), 'Products'],
          [shop.total_followers.toString(), 'Followers'],
          [shop.avg_rating.toFixed(1), 'Rating'],
        ].map(([value, label]) => (
          <View key={label} style={d.stat}>
            <Text style={d.statVal}>{value}</Text>
            <Text style={d.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={d.infoBlock}>
        <Text style={d.infoText}>Address: {shop.address}</Text>
        <Text style={d.infoText}>Phone: {shop.phone}</Text>
        <Text style={d.infoText}>Email: {shop.email}</Text>
        <Text style={d.infoText}>Opens: {formatDateTime(shop.open_time)}</Text>
        <Text style={d.infoText}>Closes: {formatDateTime(shop.close_time)}</Text>
      </View>

      <View style={d.ctaRow}>
        <TouchableOpacity style={d.ctaPrimary} onPress={() => Linking.openURL(`tel:${shop.phone}`)}>
          <Text style={d.ctaPrimaryText}>Call Shop</Text>
        </TouchableOpacity>
        {shop.whatsapp ? (
          <TouchableOpacity
            style={d.ctaSecondary}
            onPress={() => Linking.openURL(`https://wa.me/${shop.whatsapp}`)}
          >
            <Text style={d.ctaSecondaryText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {shop.owner_id === userId ? (
        <TouchableOpacity style={d.editShopBtn} onPress={onEditShop}>
          <Text style={d.editShopBtnText}>Edit / Update Shop Profile</Text>
        </TouchableOpacity>
      ) : null}

      {(shop.website || shop.instagram) ? (
        <View style={d.linkRow}>
          {shop.website ? (
            <TouchableOpacity style={d.linkChip} onPress={() => Linking.openURL(normalizeWebsiteUrl(shop.website)!)}>
              <Text style={d.linkChipText}>Website</Text>
            </TouchableOpacity>
          ) : null}
          {shop.instagram ? (
            <TouchableOpacity style={d.linkChip} onPress={() => Linking.openURL(normalizeInstagramUrl(shop.instagram)!)}>
              <Text style={d.linkChipText}>Instagram</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {isBuyer && products.length > 0 ? (
        <View style={d.section}>
          <Text style={d.sectionTitle}>Popular Products</Text>
          {products.slice(0, 6).map((product: any) => (
            <View key={product.id} style={d.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={d.productTitle}>{product.title}</Text>
                <Text style={d.productPrice}>₹{Number(product.discounted_price ?? product.price).toFixed(0)}</Text>
              </View>
              <TouchableOpacity style={d.addBtn} onPress={() => addProduct(product.id)}>
                <Text style={d.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
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
          <TextInput
            value={myComment}
            onChangeText={setMyComment}
            multiline
            numberOfLines={3}
            placeholder="Share your experience"
            placeholderTextColor={Colors.dim}
            style={d.reviewInput}
          />
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
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const toggleFollowedShop = useAuthStore(s => s.toggleFollowedShop);
  const [shops, setShops] = useState<Shop[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [busyFollowId, setBusyFollowId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isBuyer = profile?.role === 'buyer';
  const { category } = useLocalSearchParams<{ category?: string }>();
  const columns = width >= 1180 ? 3 : width >= 720 ? 2 : 1;
  const gap = 14;
  const cardWidth = columns > 1 ? (width - 32 - (gap * (columns - 1))) / columns : width - 32;

  useEffect(() => {
    if (!category) return;
    const isValid = SHOP_CATEGORIES.some(item => item.id === category);
    if (category === 'all' || !isValid) setFilter('all');
    else setFilter(category);
  }, [category]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    getShopsNearby(
      profile.lat ?? 19.076,
      profile.lng ?? 72.877,
      profile.radius_km ?? 5,
      filter === 'all' ? undefined : filter,
    )
      .then(data => {
        if (!cancelled) setShops(data ?? []);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setShops([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, filter]);

  const onRefresh = () => {
    if (!profile) return;
    setRefreshing(true);
    getShopsNearby(
      profile.lat ?? 19.076,
      profile.lng ?? 72.877,
      profile.radius_km ?? 5,
      filter === 'all' ? undefined : filter,
    )
      .then(setShops)
      .catch(console.error)
      .finally(() => setRefreshing(false));
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shops;
    return shops.filter(shop =>
      shop.name.toLowerCase().includes(query) ||
      shop.category.toLowerCase().includes(query) ||
      shop.city.toLowerCase().includes(query) ||
      shop.address.toLowerCase().includes(query),
    );
  }, [shops, search]);

  const featuredShop = filtered[0] ?? null;
  const gridShops = filtered.slice(featuredShop ? 1 : 0);

  const handleCall = (shop: Shop) => {
    Linking.openURL(`tel:${shop.phone}`);
  };

  const handleFollow = async (shop: Shop) => {
    if (!isBuyer || busyFollowId === shop.id) return;
    setBusyFollowId(shop.id);
    try {
      await toggleFollowedShop(shop.id, shop.name);
    } catch (error) {
      console.error(error);
    } finally {
      setBusyFollowId(null);
    }
  };

  return (
    <View style={s.root}>
      <FlatList
        key={`shops-grid-${columns}`}
        data={gridShops}
        keyExtractor={item => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? s.columnWrap : undefined}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 14, marginHorizontal: columns === 1 ? 16 : 0 }}>
            <ShopTile
              shop={item}
              onSelect={setSelected}
              onCall={handleCall}
              onFollow={handleFollow}
              following={followedShopIds.includes(item.id)}
              followBusy={busyFollowId === item.id}
              isBuyer={!!isBuyer}
              width={cardWidth}
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <Text style={s.title}>Neighbourhood Retailers</Text>
            <Text style={s.subtitle}>
              Search, discover, and revisit the best shops around {profile?.city || 'your area'} with an image-first browsing flow.
            </Text>

            <View style={s.searchWrap}>
              <Text style={s.searchIcon}>⌕</Text>
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search shops, categories, or areas"
                placeholderTextColor={Colors.dim}
              />
              <Text style={s.searchPill}>{filtered.length}</Text>
            </View>

            <FlatList
              data={[{ id: 'all', label: 'All', emoji: '🏬' }, ...SHOP_CATEGORIES]}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setFilter(item.id)}
                  style={[s.filterChip, filter === item.id && s.filterActive]}
                >
                  <Text style={[s.filterText, filter === item.id && s.filterTextActive]}>
                    {(item as any).emoji} {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={s.filtersContent}
            />

            {featuredShop ? (
              <>
                <Text style={s.sectionTitle}>Spotlight</Text>
                <FeaturedShop shop={featuredShop} onSelect={setSelected} onCall={handleCall} />
                {gridShops.length ? <Text style={s.sectionTitle}>More Shops</Text> : null}
              </>
            ) : null}

            {!loading && !filtered.length ? (
              <View style={s.emptyState}>
                <Text style={s.emptyTitle}>No shops found</Text>
                <Text style={s.emptyText}>
                  Try another category or search phrase to discover more local businesses nearby.
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
          ) : null
        }
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} style={s.overlay} onPress={() => setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            {selected && (
              <ShopDetail
                shop={selected}
                userId={profile!.id}
                isBuyer={!!isBuyer}
                onEditShop={() => {
                  setSelected(null);
                  router.push('/seller/shop' as any);
                }}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  listContent: { paddingBottom: 110 },
  headerBlock: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 20, alignItems: 'center' },
  title: {
    fontSize: 22,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: { color: Colors.sub, fontSize: 14, lineHeight: 21, marginBottom: 18, textAlign: 'center', maxWidth: 680 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
    width: '100%',
  },
  searchIcon: { fontSize: 18, color: Colors.sub, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  searchPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.orange + '18',
    color: Colors.orange,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    paddingTop: 4,
    overflow: 'hidden',
  },
  filtersContent: { paddingBottom: 6, paddingRight: 6 },
  filterChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  filterActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.sub },
  filterTextActive: { color: Colors.white },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 18, marginBottom: 12, alignSelf: 'flex-start' },
  featuredCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 260,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  featuredCover: { width: '100%', height: 260, position: 'absolute' },
  featuredFallback: { width: '100%', height: 260, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  featuredFallbackEmoji: { fontSize: 72 },
  featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  featuredContent: { minHeight: 260, padding: 22, justifyContent: 'flex-end' },
  featuredEyebrow: { color: '#FDE8D6', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  featuredName: { color: Colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  featuredMeta: { color: '#FFF5EE', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  featuredDescription: { color: '#FFF2EA', fontSize: 13, lineHeight: 19, maxWidth: 560 },
  featuredFooter: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredLogoRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF55',
    overflow: 'hidden',
  },
  featuredLogo: { width: '100%', height: '100%' },
  featuredCallBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  featuredCallText: { color: Colors.text, fontWeight: '800', fontSize: 13 },
  columnWrap: { paddingHorizontal: 16, gap: 14 },
  tileCard: {
    backgroundColor: Colors.card,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  tileMedia: { height: 168, backgroundColor: Colors.surface },
  tileCover: { width: '100%', height: '100%', position: 'absolute' },
  tileFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileFallbackEmoji: { fontSize: 56 },
  tileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000030' },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  categoryBadge: {
    backgroundColor: '#FFFFFFE6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryBadgeText: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  openBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  openBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  tileBody: { padding: 14 },
  tileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -34, marginBottom: 10 },
  logoShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: '100%', height: '100%' },
  logoFallback: { fontSize: 28 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tileName: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '800' },
  verifiedBadge: { color: Colors.orange, fontSize: 12 },
  tileMeta: { color: Colors.sub, fontSize: 12, marginBottom: 4 },
  tileRating: { color: Colors.amber, fontSize: 12, fontWeight: '700' },
  tileRatingCount: { color: Colors.dim, fontWeight: '500' },
  tileDescription: { color: Colors.sub, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  tileAddress: { color: Colors.dim, fontSize: 12, marginBottom: 14 },
  tileActions: { flexDirection: 'row', gap: 8 },
  tilePrimaryBtn: {
    flex: 1,
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tilePrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  tileSecondaryBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  tileSecondaryText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  followingBtn: { borderColor: Colors.orange + '44', backgroundColor: Colors.orange + '12' },
  followingText: { color: Colors.orange },
  emptyState: {
    marginTop: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 20,
    padding: 18,
  },
  emptyTitle: { color: Colors.text, fontWeight: '800', fontSize: 16, marginBottom: 6 },
  emptyText: { color: Colors.sub, fontSize: 13, lineHeight: 19 },
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
});

const d = StyleSheet.create({
  root: { paddingBottom: 24 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 240,
    backgroundColor: Colors.card,
    marginBottom: 16,
  },
  heroCover: { width: '100%', height: 240, position: 'absolute' },
  heroFallback: { width: '100%', height: 240, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  heroFallbackEmoji: { fontSize: 72 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055' },
  heroContent: { minHeight: 240, justifyContent: 'flex-end', padding: 18 },
  heroLogoWrap: {
    width: 74,
    height: 74,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF22',
    borderWidth: 2,
    borderColor: '#FFFFFF66',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: { width: '100%', height: '100%' },
  heroLogoFallback: { fontSize: 32 },
  shopName: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  heroMeta: { fontSize: 13, color: '#FFF3EB', fontWeight: '600' },
  desc: { fontSize: 14, color: Colors.sub, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: '800', color: Colors.orange },
  statLabel: { fontSize: 11, color: Colors.sub, marginTop: 4 },
  infoBlock: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    marginTop: 16,
  },
  infoText: { color: Colors.text, fontSize: 13, lineHeight: 19 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ctaPrimary: {
    flex: 1,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  ctaSecondary: {
    flex: 1,
    backgroundColor: Colors.orange + '12',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.orange + '35',
  },
  ctaSecondaryText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  editShopBtn: {
    marginTop: 14,
    backgroundColor: Colors.orange + '14',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.orange + '35',
  },
  editShopBtnText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  linkChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  linkChipText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  productTitle: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  productPrice: { color: Colors.amber, fontWeight: '700', marginTop: 4 },
  addBtn: {
    backgroundColor: Colors.orange + '14',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.orange + '35',
  },
  addBtnText: { color: Colors.orange, fontWeight: '800', fontSize: 12 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  star: { fontSize: 26, color: Colors.border2 },
  starActive: { color: Colors.amber },
  reviewInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    padding: 12,
    color: Colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: '800' },
  review: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    padding: 12,
    gap: 5,
    marginBottom: 8,
  },
  reviewRating: { fontSize: 12, color: Colors.amber },
  reviewText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  reviewMeta: { fontSize: 11, color: Colors.dim },
});
