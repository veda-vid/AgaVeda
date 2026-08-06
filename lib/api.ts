// lib/api.ts — All database query functions

import { supabase } from './supabase';
import { withTimeout, softFail } from './withTimeout';
import { isDemoAuthEnabled } from './config';
import type {
  Profile, Shop, Product, Post, ServiceProvider, Review, Comment, Ad,
  Story, Reel, CartItem, SearchResult, Notification,
} from '../types';

const PAGE = 10;
const API_MS = 8000;

// ─── PROFILES ────────────────────────────────────────────────────────

export const getProfile = async (userId: string): Promise<Profile> => {
  if (isDemoAuthEnabled()) {
    const { demoGetProfile } = await import('./demoAuth');
    return demoGetProfile(userId);
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
};

export const upsertProfile = async (profile: Partial<Profile> & { id: string }) => {
  if (isDemoAuthEnabled()) {
    const { demoUpsertProfile } = await import('./demoAuth');
    return demoUpsertProfile(profile);
  }
  // Prefer update (RLS allows own UPDATE). Fall back to insert/upsert if row missing.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ ...profile, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select()
    .maybeSingle();

  if (!updateError && updated) return updated;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── SHOPS ────────────────────────────────────────────────────────────

export const getShopsNearby = async (lat: number, lng: number, radiusKm: number, category?: string) => {
  try {
    let query = supabase
      .rpc('shops_within_radius', { user_lat: lat, user_lng: lng, radius_km: radiusKm })
      .eq('is_active', true);
    if (category && category !== 'all') query = query.eq('category', category);
    const { data, error } = await withTimeout(query.order('distance_km', { ascending: true }).limit(50), API_MS, 'shops');
    if (error) throw error;
    return data as Shop[];
  } catch {
    // Fallback: plain table query (no geo) so UI still opens
    let q = supabase.from('shops').select('*').eq('is_active', true).limit(50);
    if (category && category !== 'all') q = q.eq('category', category);
    const { data, error } = await withTimeout(q.order('created_at', { ascending: false }), API_MS, 'shops-fallback');
    if (error) throw error;
    return (data ?? []) as Shop[];
  }
};

export const getShopById = async (shopId: string): Promise<Shop> => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();
  if (error) throw error;
  return data;
};

export const createShop = async (shop: Omit<Shop, 'id' | 'created_at' | 'updated_at' | 'avg_rating' | 'total_reviews' | 'total_followers' | 'total_products'>) => {
  const { data, error } = await supabase
    .from('shops')
    .insert(shop)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateShop = async (shopId: string, updates: Partial<Shop>) => {
  const { data, error } = await supabase
    .from('shops')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', shopId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const followShop = async (userId: string, shopId: string) => {
  const { error } = await supabase
    .from('shop_followers')
    .upsert({ user_id: userId, shop_id: shopId }, { onConflict: 'user_id,shop_id' });
  if (error) throw error;
};

export const unfollowShop = async (userId: string, shopId: string) => {
  const { error } = await supabase
    .from('shop_followers')
    .delete()
    .eq('user_id', userId)
    .eq('shop_id', shopId);
  if (error) throw error;
};

export const getFollowedShopIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('shop_followers').select('shop_id').eq('user_id', userId),
      5000,
      'follows',
    );
    if (error) throw error;
    return (data ?? []).map((r: { shop_id: string }) => r.shop_id);
  } catch {
    return [];
  }
};

export const getShopByOwner = async (ownerId: string): Promise<Shop | null> => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────

export const getProductsByShop = async (shopId: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_available', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Product[];
};

export const getDiscountedProducts = async (lat: number, lng: number, radiusKm: number) => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .rpc('discounted_products_nearby', { user_lat: lat, user_lng: lng, radius_km: radiusKm })
        .gt('discount_pct', 0)
        .order('discount_pct', { ascending: false })
        .limit(30),
      API_MS,
      'deals',
    );
    if (error) throw error;
    return data as Product[];
  } catch {
    const { data, error } = await withTimeout(
      supabase.from('products').select('*').gt('discount_pct', 0).eq('is_available', true).limit(30),
      API_MS,
      'deals-fallback',
    );
    if (error) throw error;
    return (data ?? []) as Product[];
  }
};

export const createProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'total_likes' | 'total_comments' | 'discounted_price'>) => {
  const { discounted_price: _ignore, ...rest } = product as any;
  const { data, error } = await supabase
    .from('products')
    .insert(rest)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── POSTS / FEED ─────────────────────────────────────────────────────

async function feedFromPostsTable(page = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, shop:shops(id,name,logo_url,category,avg_rating,is_open)')
    .order('created_at', { ascending: false })
    .range(page * PAGE, (page + 1) * PAGE - 1);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    ...p,
    shop_name: p.shop?.name,
    shop_logo: p.shop?.logo_url,
    shop_category: p.shop?.category,
    shop_avg_rating: p.shop?.avg_rating,
    shop_is_open: p.shop?.is_open,
    distance_km: 0,
  }));
}

export const getFeed = async (lat: number, lng: number, radiusKm: number, page = 0) => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .rpc('feed_within_radius', { user_lat: lat, user_lng: lng, radius_km: radiusKm })
        .range(page * PAGE, (page + 1) * PAGE - 1),
      API_MS,
      'feed',
    );
    if (error) throw error;
    return (data ?? []) as Post[];
  } catch {
    return withTimeout(feedFromPostsTable(page), API_MS, 'feed-fallback');
  }
};

export const getPostsByShop = async (shopId: string): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
};

export const likePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('post_likes')
    .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id' });
  if (error) throw error;
};

export const unlikePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

export const savePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('saved_posts')
    .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id' });
  if (error) throw error;
};

export const unsavePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

export const getComments = async (postId: string): Promise<Comment[]> => {
  const { data, error } = await withTimeout(
    supabase
      .from('comments')
      .select('*, user:profiles(id,name,avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50),
    API_MS,
    'comments',
  );
  if (error) throw error;
  return data ?? [];
};

export const addComment = async (userId: string, postId: string, text: string) => {
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, post_id: postId, text: text.trim() })
    .select('*, user:profiles(id,name,avatar_url)')
    .single();
  if (error) throw error;
  return data as Comment;
};

export const createPost = async (post: {
  shop_id: string;
  product_id?: string;
  caption: string;
  media_urls: string[];
  media_type: 'image' | 'video';
}) => {
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();
  if (error) throw error;
  return data as Post;
};

export const getFollowingFeed = async (userId: string, page = 0, followedShopIds: string[] = []) => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('feed_from_followed', { p_user_id: userId }).range(page * PAGE, (page + 1) * PAGE - 1),
      API_MS,
      'following-feed',
    );
    if (error) throw error;
    return (data ?? []) as Post[];
  } catch {
    // Client-side fallback using followed shop ids
    if (!followedShopIds.length) return [];
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .select('*, shop:shops(id,name,logo_url,category,avg_rating,is_open)')
        .in('shop_id', followedShopIds)
        .order('created_at', { ascending: false })
        .range(page * PAGE, (page + 1) * PAGE - 1),
      API_MS,
      'following-fallback',
    );
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      ...p,
      shop_name: p.shop?.name,
      shop_logo: p.shop?.logo_url,
      shop_category: p.shop?.category,
      shop_avg_rating: p.shop?.avg_rating,
      shop_is_open: p.shop?.is_open,
      distance_km: 0,
    })) as Post[];
  }
};

// ─── STORIES ──────────────────────────────────────────────────────────

export const getStories = async (userId: string): Promise<Story[]> => {
  return softFail(
    (async () => {
      const { data, error } = await withTimeout(
        supabase.rpc('stories_for_user', { p_user_id: userId }),
        5000,
        'stories',
      );
      if (!error && data) {
        return (data as any[]).map(st => ({
          ...st,
          shop_name: st.shop_name,
          shop_logo: st.shop_logo,
        }));
      }
      const { data: fallback, error: fbErr } = await supabase
        .from('stories')
        .select('*, shop:shops(name,logo_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (fbErr) return [];
      return (fallback ?? []).map((st: any) => ({
        ...st,
        shop_name: st.shop?.name,
        shop_logo: st.shop?.logo_url,
      }));
    })(),
    [],
  );
};

export const createStory = async (story: {
  shop_id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
}) => {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      ...story,
      caption: story.caption ?? '',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Story;
};

// ─── REELS ────────────────────────────────────────────────────────────

export const getReels = async (shopIds?: string[]): Promise<Reel[]> => {
  return softFail(
    (async () => {
      let query = supabase
        .from('reels')
        .select('*, shop:shops(name,logo_url)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (shopIds && shopIds.length > 0) query = query.in('shop_id', shopIds);
      const { data, error } = await withTimeout(query, 5000, 'reels');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        shop_name: r.shop?.name,
        shop_logo: r.shop?.logo_url,
        tags: r.tags ?? [],
      }));
    })(),
    [],
  );
};

export const createReel = async (reel: {
  shop_id: string;
  author_id: string;
  media_url: string;
  caption: string;
  tags?: string[];
}) => {
  const { data, error } = await supabase
    .from('reels')
    .insert({
      ...reel,
      tags: reel.tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Reel;
};

// ─── CART ─────────────────────────────────────────────────────────────

export const getCart = async (userId: string): Promise<CartItem[]> => {
  return softFail(
    (async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('cart_items')
          .select('*, product:products(*), shop:shops(id,name,logo_url,city)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        5000,
        'cart',
      );
      if (error) throw error;
      return (data ?? []) as CartItem[];
    })(),
    [],
  );
};

export const addToCart = async (userId: string, productId: string, shopId: string, quantity = 1) => {
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity: Math.min(99, existing.quantity + quantity), updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*, product:products(*), shop:shops(id,name,logo_url,city)')
      .single();
    if (error) throw error;
    return data as CartItem;
  }

  const { data, error } = await supabase
    .from('cart_items')
    .insert({ user_id: userId, product_id: productId, shop_id: shopId, quantity })
    .select('*, product:products(*), shop:shops(id,name,logo_url,city)')
    .single();
  if (error) throw error;
  return data as CartItem;
};

export const updateCartQuantity = async (itemId: string, quantity: number) => {
  if (quantity <= 0) {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*, product:products(*), shop:shops(id,name,logo_url,city)')
    .single();
  if (error) throw error;
  return data as CartItem;
};

export const removeFromCart = async (itemId: string) => {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
};

// ─── SEARCH & NOTIFICATIONS ───────────────────────────────────────────

export const globalSearch = async (
  q: string,
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<SearchResult[]> => {
  const query = q.trim();
  if (!query) return [];
  return softFail(
    (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.rpc('global_search', {
            q: query,
            user_lat: lat,
            user_lng: lng,
            radius_km: radiusKm,
          }),
          5000,
          'search',
        );
        if (error) throw error;
        return (data ?? []) as SearchResult[];
      } catch {
        const [shopsRes, productsRes] = await Promise.all([
          supabase.from('shops').select('id,name,category,city,logo_url').ilike('name', `%${query}%`).eq('is_active', true).limit(15),
          supabase.from('products').select('id,title,shop_id,images,discounted_price, shop:shops(name)').ilike('title', `%${query}%`).eq('is_available', true).limit(15),
        ]);
        const shops: SearchResult[] = (shopsRes.data ?? []).map((s: any) => ({
          result_type: 'shop',
          id: s.id,
          title: s.name,
          subtitle: `${s.category} · ${s.city}`,
          image_url: s.logo_url,
          shop_id: s.id,
          distance_km: 0,
        }));
        const products: SearchResult[] = (productsRes.data ?? []).map((p: any) => ({
          result_type: 'product',
          id: p.id,
          title: p.title,
          subtitle: `${p.shop?.name ?? 'Shop'} · ₹${p.discounted_price}`,
          image_url: p.images?.[0] ?? null,
          shop_id: p.shop_id,
          distance_km: 0,
        }));
        return [...shops, ...products];
      }
    })(),
    [],
  );
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  return softFail(
    (async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        5000,
        'notifications',
      );
      if (error) throw error;
      return (data ?? []) as Notification[];
    })(),
    [],
  );
};

export const markNotificationsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
};

export const getProductById = async (productId: string): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .select('*, shop:shops(*)')
    .eq('id', productId)
    .single();
  if (error) throw error;
  return data as Product;
};

// ─── SERVICES ─────────────────────────────────────────────────────────

export const getServicesNearby = async (lat: number, lng: number, radiusKm: number, category?: string) => {
  try {
    let query = supabase.rpc('services_within_radius', { user_lat: lat, user_lng: lng, radius_km: radiusKm });
    if (category && category !== 'all') query = query.eq('category', category);
    const { data, error } = await withTimeout(query.order('avg_rating', { ascending: false }).limit(50), API_MS, 'services');
    if (error) throw error;
    return data as ServiceProvider[];
  } catch {
    let q = supabase.from('service_providers').select('*').limit(50);
    if (category && category !== 'all') q = q.eq('category', category);
    const { data, error } = await withTimeout(q.order('avg_rating', { ascending: false }), API_MS, 'services-fallback');
    if (error) throw error;
    return (data ?? []) as ServiceProvider[];
  }
};

export const createServiceProvider = async (svc: Omit<ServiceProvider, 'id' | 'created_at' | 'avg_rating' | 'total_reviews' | 'total_jobs'>) => {
  const { data, error } = await supabase
    .from('service_providers')
    .insert(svc)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── REVIEWS ──────────────────────────────────────────────────────────

export const getReviews = async (targetId: string, targetType: 'shop' | 'service_provider'): Promise<Review[]> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:profiles(id,name,avatar_url)')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
};

export const addReview = async (review: {
  reviewer_id: string;
  target_id: string;
  target_type: 'shop' | 'service_provider';
  rating: number;
  comment: string;
}) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert(review)
    .select('*, reviewer:profiles(id,name,avatar_url)')
    .single();
  if (error) throw error;
  return data as Review;
};

// ─── ADS ──────────────────────────────────────────────────────────────

export const getActiveAds = async (city: string): Promise<Ad[]> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('ads')
    .select('*, shop:shops(id,name,logo_url)')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('priority', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data;
};

export const trackAdImpression = async (adId: string) => {
  await supabase.rpc('increment_ad_impressions', { ad_id: adId });
};

export const trackAdClick = async (adId: string) => {
  await supabase.rpc('increment_ad_clicks', { ad_id: adId });
};

// ─── STORAGE ──────────────────────────────────────────────────────────

export const uploadImage = async (
  bucket: string,
  path: string,
  file: Blob | File,
  contentType = 'image/jpeg',
): Promise<string> => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteImage = async (bucket: string, path: string) => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
};
