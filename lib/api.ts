// lib/api.ts — All database query functions

import { supabase } from './supabase';
import { withTimeout, softFail } from './withTimeout';
import { isDemoAuthEnabled } from './config';
import { resolveSparkBackendRef } from './sparkUtils';
import {
  dedupeProfileMediaItems, isProfileVideoItem, reelToProfileVideoPost, sortProfileMediaNewest,
} from './profileMedia';
import type {
  Profile, Shop, Product, Post, ServiceProvider, Review, Comment, Ad,
  Story, Reel, CartItem, SearchResult, Notification, SellerCompetitiveProfile, CityNews, CityNewsComment,
  ProConversation, ProMessage, PresenceStatus,
  ShopConversation, ShopMessage,
  ShopEnquiry, ShopEnquiryStatus, ShopEnquiryType, SellerEnquiryStats, SellerDashboardMetrics,
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
  // #region agent log
  fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'H1',location:'lib/api.ts:updateProfile:entry',message:'updateProfile called',data:{userId,updateKeys:Object.keys(updates),includesPhone:'phone' in updates,includesEmail:'email' in updates},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'H1',location:'lib/api.ts:updateProfile:error',message:'updateProfile failed',data:{code:error.code,message:error.message,details:error.details,hint:error.hint},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }
  // #region agent log
  fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'H1',location:'lib/api.ts:updateProfile:success',message:'updateProfile succeeded',data:{userId},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return data;
};

export const getMySellerCompetitiveProfile = async (): Promise<SellerCompetitiveProfile | null> => {
  if (isDemoAuthEnabled()) return null;
  const { data, error } = await supabase.rpc('get_my_seller_competitive_profile');
  if (error) throw error;
  if (!Array.isArray(data) || !data.length) return null;
  return data[0] as SellerCompetitiveProfile;
};

// ─── SHOPS ────────────────────────────────────────────────────────────

function sortShopsByDistance(list: Shop[]): Shop[] {
  return [...list].sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
}

function applyShopGeoFallback(rows: Shop[], lat: number, lng: number, radiusKm: number): Shop[] {
  return sortShopsByDistance(
    rows
      .map(row => ({
        ...row,
        distance_km: haversineKm(lat, lng, row.lat, row.lng),
      }))
      .filter(row => (row.distance_km ?? 9999) <= radiusKm),
  );
}

export const getShopsNearby = async (lat: number, lng: number, radiusKm: number, category?: string) => {
  try {
    let query = supabase.rpc('shops_within_radius', { user_lat: lat, user_lng: lng, radius_km: radiusKm });
    if (category && category !== 'all') query = query.eq('category', category);
    const { data, error } = await withTimeout(query.limit(50), API_MS, 'shops');
    if (error) throw error;
    return sortShopsByDistance((data ?? []) as Shop[]);
  } catch {
    let q = supabase.from('shops').select('*').eq('is_active', true).limit(100);
    if (category && category !== 'all') q = q.eq('category', category);
    const { data, error } = await withTimeout(q, API_MS, 'shops-fallback');
    if (error) throw error;
    return applyShopGeoFallback((data ?? []) as Shop[], lat, lng, radiusKm).slice(0, 50);
  }
};

export const getProductTitlesByShopIds = async (shopIds: string[]): Promise<Record<string, string[]>> => {
  if (!shopIds.length) return {};
  const { data, error } = await supabase
    .from('products')
    .select('shop_id, title')
    .in('shop_id', shopIds)
    .limit(500);
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!map[row.shop_id]) map[row.shop_id] = [];
    map[row.shop_id].push(row.title);
  }
  return map;
};

export const touchShopActivity = async (ownerId: string) => {
  const { error } = await supabase
    .from('shops')
    .update({ last_active_at: new Date().toISOString() })
    .eq('owner_id', ownerId);
  if (error) throw error;
};

export const getOrCreateShopConversation = async (buyerId: string, shop: Shop): Promise<ShopConversation> => {
  const { data: existing, error: findErr } = await supabase
    .from('shop_conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('shop_id', shop.id)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as ShopConversation;

  const { data, error } = await supabase
    .from('shop_conversations')
    .insert({ buyer_id: buyerId, shop_id: shop.id, owner_id: shop.owner_id })
    .select()
    .single();
  if (error) throw error;
  return data as ShopConversation;
};

export const getShopMessages = async (conversationId: string): Promise<ShopMessage[]> => {
  const { data, error } = await supabase
    .from('shop_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ShopMessage[];
};

export const sendShopMessage = async (
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ShopMessage> => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('shop_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('shop_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as ShopMessage;
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

export const getShopCommerceMeta = async (shopId: string) => {
  const { data, error } = await supabase
    .from('shops')
    .select('id,name,phone,whatsapp,lat,lng')
    .eq('id', shopId)
    .single();
  if (error) throw error;
  return data as Pick<Shop, 'id' | 'name' | 'phone' | 'whatsapp' | 'lat' | 'lng'>;
};

export const createShop = async (shop: Omit<Shop, 'id' | 'created_at' | 'updated_at' | 'avg_rating' | 'total_reviews' | 'total_followers' | 'total_products'>) => {
  const { data, error } = await supabase
    .from('shops')
    .insert(shop)
    .select()
    .single();
  if (error?.message?.includes('operating_hours')) {
    const { operating_hours: _omit, ...rest } = shop as Record<string, unknown>;
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'A',location:'lib/api.ts:createShop:fallback',message:'retrying without operating_hours',data:{code:error.code,message:error.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const retry = await supabase.from('shops').insert(rest).select().single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
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
  if (error?.message?.includes('operating_hours')) {
    const { operating_hours: _omit, ...rest } = updates as Record<string, unknown>;
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'A',location:'lib/api.ts:updateShop:fallback',message:'retrying without operating_hours',data:{shopId,code:error.code,message:error.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const retry = await supabase
      .from('shops')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', shopId)
      .select()
      .single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'A',location:'lib/api.ts:updateShop:error',message:'updateShop failed',data:{shopId,code:error.code,message:error.message,details:error.details},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }
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

export const toggleShopFollow = async (userId: string, shopId: string, shouldFollow: boolean) => {
  if (shouldFollow) await followShop(userId, shopId);
  else await unfollowShop(userId, shopId);
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

// ─── SHOP ENQUIRIES ───────────────────────────────────────────────────

const ENQUIRY_SELECT = `
  *,
  buyer:profiles!buyer_id(id, name, avatar_url, city, lat, lng, phone),
  product:products(id, title, price, discount_pct, discounted_price, images)
`;

function attachEnquiryDistances(
  rows: ShopEnquiry[],
  sellerLat?: number | null,
  sellerLng?: number | null,
): ShopEnquiry[] {
  if (sellerLat == null || sellerLng == null) return rows;
  return rows.map(row => {
    const lat = row.buyer?.lat;
    const lng = row.buyer?.lng;
    if (lat == null || lng == null) return row;
    return { ...row, distance_km: haversineKm(sellerLat, sellerLng, lat, lng) };
  });
}

export const getShopEnquiries = async (
  shopId: string,
  sellerLat?: number | null,
  sellerLng?: number | null,
): Promise<ShopEnquiry[]> => {
  const { data, error } = await supabase
    .from('shop_enquiries')
    .select(ENQUIRY_SELECT)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return attachEnquiryDistances((data ?? []) as ShopEnquiry[], sellerLat, sellerLng);
};

export const updateEnquiryStatus = async (
  enquiryId: string,
  status: ShopEnquiryStatus,
): Promise<ShopEnquiry> => {
  const payload: Partial<ShopEnquiry> = { status, updated_at: new Date().toISOString() };
  if (status === 'contacted' || status === 'converted') {
    payload.contacted_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('shop_enquiries')
    .update(payload)
    .eq('id', enquiryId)
    .select(ENQUIRY_SELECT)
    .single();
  if (error) throw error;
  return data as ShopEnquiry;
};

export const createBuyerEnquiry = async (input: {
  shopId: string;
  productId?: string | null;
  type: ShopEnquiryType;
  message: string;
  buyerId: string;
}): Promise<ShopEnquiry> => {
  const trimmed = input.message.trim();
  if (!trimmed) throw new Error('Message is required');

  const { data, error } = await supabase
    .from('shop_enquiries')
    .insert({
      shop_id: input.shopId,
      buyer_id: input.buyerId,
      product_id: input.productId ?? null,
      type: input.type,
      message: trimmed,
      status: 'new',
    })
    .select(ENQUIRY_SELECT)
    .single();
  if (error) throw error;
  return data as ShopEnquiry;
};

export const getMySellerEnquiryStats = async (): Promise<SellerEnquiryStats> => {
  if (isDemoAuthEnabled()) {
    return { total_leads: 0, new_leads: 0, conversion_rate: 0, avg_response_minutes: 0 };
  }
  const { data, error } = await supabase.rpc('get_my_seller_enquiry_stats');
  if (error) throw error;
  const row = Array.isArray(data) && data.length ? data[0] : null;
  return {
    total_leads: Number(row?.total_leads ?? 0),
    new_leads: Number(row?.new_leads ?? 0),
    conversion_rate: Number(row?.conversion_rate ?? 0),
    avg_response_minutes: Number(row?.avg_response_minutes ?? 0),
  };
};

export const getSellerDashboardMetrics = async (ownerId: string): Promise<SellerDashboardMetrics> => {
  if (isDemoAuthEnabled()) {
    return { daily_views: 142, product_saves: 28, new_leads: 2 };
  }
  const shop = await getShopByOwner(ownerId);
  if (!shop) return { daily_views: 0, product_saves: 0, new_leads: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [postsRes, enquiryStats, productPostsRes, convTodayRes] = await Promise.all([
    supabase.from('posts').select('total_likes, total_comments, created_at').eq('shop_id', shop.id),
    getMySellerEnquiryStats(),
    supabase.from('posts').select('id').eq('shop_id', shop.id).not('product_id', 'is', null),
    supabase
      .from('shop_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('created_at', todayIso),
  ]);

  const posts = postsRes.data ?? [];
  const impressions = posts.reduce(
    (sum, row) => sum + (row.total_likes ?? 0) * 8 + (row.total_comments ?? 0) * 15 + 42,
    0,
  );
  const todayChats = convTodayRes.count ?? 0;
  const daily_views = impressions + todayChats * 25;

  let product_saves = 0;
  const productPostIds = (productPostsRes.data ?? []).map(row => row.id);
  if (productPostIds.length) {
    const { count } = await supabase
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .in('post_id', productPostIds);
    product_saves = count ?? 0;
  }

  return {
    daily_views,
    product_saves,
    new_leads: enquiryStats.new_leads,
  };
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

export async function hydratePostsWithUserState(posts: Post[], userId?: string | null): Promise<Post[]> {
  if (!posts.length) return posts;
  const ids = posts.map(p => p.id).filter(Boolean);
  if (!ids.length) return posts;

  const empty = { data: [] as Array<{ post_id: string }> };
  const [likesRes, savesRes, mineRepostsRes, allRepostsRes, commentsRes] = await Promise.all([
    userId
      ? supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids)
      : Promise.resolve(empty),
    userId
      ? supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids)
      : Promise.resolve(empty),
    userId
      ? supabase.from('reposts').select('post_id').eq('user_id', userId).in('post_id', ids)
      : Promise.resolve(empty),
    supabase.from('reposts').select('post_id').in('post_id', ids),
    supabase.from('comments').select('post_id').in('post_id', ids),
  ]);

  const liked = new Set((likesRes.data ?? []).map((row: any) => row.post_id));
  const saved = new Set((savesRes.data ?? []).map((row: any) => row.post_id));
  const reposted = new Set((mineRepostsRes.data ?? []).map((row: any) => row.post_id));
  const repostCounts = new Map<string, number>();
  for (const row of allRepostsRes.data ?? []) {
    const id = (row as any).post_id;
    if (!id) continue;
    repostCounts.set(id, (repostCounts.get(id) ?? 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const row of commentsRes.data ?? []) {
    const id = (row as any).post_id;
    if (!id) continue;
    commentCounts.set(id, (commentCounts.get(id) ?? 0) + 1);
  }

  return posts.map(post => ({
    ...post,
    is_liked: liked.has(post.id),
    is_saved: saved.has(post.id),
    is_reposted: reposted.has(post.id),
    total_reposts: repostCounts.get(post.id) ?? 0,
    total_comments: Math.max(post.total_comments ?? 0, commentCounts.get(post.id) ?? 0),
  }));
}

export async function feedFromPostsTable(page = 0, userId?: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, shop:shops(id,name,logo_url,category,avg_rating,is_open)')
    .order('created_at', { ascending: false })
    .range(page * PAGE, (page + 1) * PAGE - 1);
  if (error) throw error;
  const mapped = (data ?? []).map((p: any) => ({
    ...p,
    shop_name: p.shop?.name,
    shop_logo: p.shop?.logo_url,
    shop_category: p.shop?.category,
    shop_avg_rating: p.shop?.avg_rating,
    shop_is_open: p.shop?.is_open,
    distance_km: 0,
  })) as Post[];
  return hydratePostsWithUserState(mapped, userId);
}

export const getFeed = async (lat: number, lng: number, radiusKm: number, page = 0, userId?: string) => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .rpc('feed_within_radius', { 
          user_lat: lat, 
          user_lng: lng, 
          radius_km: radiusKm, 
          p_user_id: userId || null 
        })
        .range(page * PAGE, (page + 1) * PAGE - 1),
      API_MS,
      'feed',
    );
    if (error) throw error;
    const posts = await hydratePostsWithUserState((data ?? []) as Post[], userId);
    if (page === 0 && userId) {
      const reposts = await getAttributedRepostFeed(userId, { limit: 12 });
      return mergeFeedWithReposts(posts, reposts);
    }
    return posts;
  } catch {
    return withTimeout(feedFromPostsTable(page, userId), API_MS, 'feed-fallback');
  }
};

export const getPostsByShop = async (shopId: string, userId?: string): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return hydratePostsWithUserState((data ?? []) as Post[], userId);
};

export const likePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('post_likes')
    .insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error;
};

export const unlikePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

export const repostPost = async (
  userId: string,
  postId: string,
  shopId: string,
  quoteCaption?: string | null,
) => {
  const payload: Record<string, unknown> = {
    user_id: userId,
    post_id: postId,
    shop_id: shopId,
    content_type: 'post',
    quote_caption: quoteCaption?.trim() || null,
  };

  const { error } = await supabase
    .from('reposts')
    .upsert(payload, { onConflict: 'user_id,post_id' });
  if (error && error.code !== '23505') throw error;
};

export const unrepostPost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('reposts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

function mapRepostRow(row: any, viewerNameFallback?: string | null): Post | null {
  const post = row.post;
  if (!post) return null;
  const reposterName = row.user?.name ?? viewerNameFallback ?? 'Someone';
  return {
    ...post,
    shop_name: post.shop?.name,
    shop_logo: post.shop?.logo_url,
    shop_category: post.shop?.category,
    shop_avg_rating: post.shop?.avg_rating,
    shop_is_open: post.shop?.is_open,
    shop_city: post.shop?.city,
    feed_item_id: `repost-${row.id}`,
    reposted_at: row.created_at,
    reposted_by_id: row.user_id,
    reposted_by_name: reposterName,
    quote_caption: row.quote_caption ?? null,
    is_repost_entry: true,
    is_reposted: true,
  } as Post;
}

function mapSparkRepostRow(row: any, viewerNameFallback?: string | null): Post | null {
  const reel = row.spark;
  if (!reel?.id) return null;
  const reposterName = row.user?.name ?? viewerNameFallback ?? 'Someone';
  return {
    id: reel.id,
    product_id: null,
    shop_id: reel.shop_id,
    caption: reel.caption ?? '',
    media_urls: reel.media_url ? [reel.media_url] : [],
    media_type: 'video',
    is_ad: false,
    ad_cta_text: null,
    ad_cta_url: null,
    total_likes: reel.total_likes ?? 0,
    total_comments: reel.total_comments ?? 0,
    total_reposts: 0,
    created_at: reel.created_at,
    shop_name: reel.shop?.name,
    shop_logo: reel.shop?.logo_url,
    shop_category: reel.shop?.category,
    shop_avg_rating: reel.shop?.avg_rating,
    shop_is_open: reel.shop?.is_open,
    shop_city: reel.shop?.city,
    feed_item_id: `spark-repost-${row.id}`,
    reposted_at: row.created_at,
    reposted_by_id: row.user_id,
    reposted_by_name: reposterName,
    quote_caption: null,
    is_repost_entry: true,
    is_reposted: true,
    is_spark_repost: true,
    spark_id: reel.id,
  } as Post;
}

/** Recent community / following reposts with attribution for the home feed. */
export const getAttributedRepostFeed = async (
  userId: string,
  options?: { followedShopIds?: string[]; limit?: number },
): Promise<Post[]> => {
  const limit = options?.limit ?? 24;
  try {
    let ownerIds: string[] | null = null;
    if (options?.followedShopIds?.length) {
      const { data: shops } = await supabase
        .from('shops')
        .select('owner_id')
        .in('id', options.followedShopIds);
      ownerIds = [...new Set((shops ?? []).map((s: any) => s.owner_id).filter(Boolean))];
    }

    let query = supabase
      .from('reposts')
      .select('id, created_at, quote_caption, user_id, post:posts(*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)), user:profiles(id,name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ownerIds?.length) {
      query = query.in('user_id', ownerIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    const mapped = (data ?? []).map((row: any) => mapRepostRow(row)).filter(Boolean) as Post[];
    return hydratePostsWithUserState(mapped, userId);
  } catch {
    return [];
  }
};

function mergeFeedWithReposts(original: Post[], reposts: Post[]): Post[] {
  const seen = new Set<string>();
  const merged: Post[] = [];
  const push = (item: Post) => {
    const key = item.feed_item_id ?? item.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  // Interleave: prefer freshest by created_at / reposted_at
  const pool = [
    ...original.map(p => ({ item: p, ts: new Date(p.created_at).getTime() })),
    ...reposts.map(p => ({ item: p, ts: new Date(p.reposted_at ?? p.created_at).getTime() })),
  ].sort((a, b) => b.ts - a.ts);

  for (const entry of pool) push(entry.item);
  return merged;
}

export const savePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('saved_posts')
    .insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error;
};

export const unsavePost = async (userId: string, postId: string) => {
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

export const getSavedPosts = async (userId: string): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('created_at, post:posts(*, shop:shops(id,name,logo_url,category,avg_rating,is_open))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => {
      const post = row.post;
      if (!post) return null;
      return {
        ...post,
        shop_name: post.shop?.name,
        shop_logo: post.shop?.logo_url,
        shop_category: post.shop?.category,
        shop_avg_rating: post.shop?.avg_rating,
        shop_is_open: post.shop?.is_open,
        saved_at: row.created_at,
        is_saved: true,
      };
    })
    .filter(Boolean) as Post[];
};

function mapUnifiedRepostRow(row: any, viewerNameFallback?: string | null): Post | null {
  if (row.content_type === 'spark' || row.spark_id || row.spark) {
    return mapSparkRepostRow(row, viewerNameFallback);
  }
  return mapRepostRow(row, viewerNameFallback);
}

const USER_REPOST_SELECT = `
  id, created_at, quote_caption, user_id, content_type, spark_id, post_id,
  post:posts(*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)),
  spark:reels!spark_id(*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)),
  user:profiles(id,name)
`;

async function fetchLegacySparkReposts(userId: string, viewerName?: string | null): Promise<Post[]> {
  const { data, error } = await supabase
    .from('spark_reposts')
    .select('id, created_at, user_id, spark:reels!spark_id(*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)), user:profiles(id,name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (String(error.message).includes('spark_reposts')) return [];
    throw error;
  }
  return (data ?? [])
    .map((row: any) => mapSparkRepostRow(row, viewerName))
    .filter(Boolean) as Post[];
}

/** User reposts — posts and Sparks unified for profile Reposts tab */
export const getUserReposts = async (userId: string): Promise<Post[]> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('reposts')
    .select(USER_REPOST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (String(error.message).includes('spark_id')) {
      return getRepostedPostsLegacy(userId);
    }
    throw error;
  }

  const mapped = (data ?? [])
    .map((row: any) => mapUnifiedRepostRow(row, profile?.name))
    .filter(Boolean) as Post[];

  const legacySparkOnly = await fetchLegacySparkReposts(userId, profile?.name);
  const existingSparkKeys = new Set(
    mapped.filter(p => p.is_spark_repost).map(p => p.spark_id ?? p.id),
  );
  const extras = legacySparkOnly.filter(p => !existingSparkKeys.has(p.spark_id ?? p.id));

  const merged = sortProfileMediaNewest([...mapped, ...extras]);
  return hydratePostsWithUserState(merged, userId);
};

async function getRepostedPostsLegacy(userId: string): Promise<Post[]> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();

  const [postRepostsRes, sparkReposts] = await Promise.all([
    supabase
      .from('reposts')
      .select('id, created_at, quote_caption, user_id, post:posts(*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)), user:profiles(id,name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    fetchLegacySparkReposts(userId, profile?.name),
  ]);

  if (postRepostsRes.error) throw postRepostsRes.error;

  const postReposts = (postRepostsRes.data ?? [])
    .map((row: any) => mapRepostRow(row, profile?.name))
    .filter(Boolean) as Post[];

  return hydratePostsWithUserState(sortProfileMediaNewest([...postReposts, ...sparkReposts]), userId);
}

/** @deprecated Use getUserReposts */
export const getRepostedPosts = getUserReposts;

/** Profile Videos / Sparks tab — originals only (no reposts) */
export const getUserSparks = async (userId: string): Promise<Post[]> => {
  const shop = await getShopByOwner(userId);

  const [shopPosts, reelsRes] = await Promise.all([
    shop ? getPostsByShop(shop.id, userId) : Promise.resolve([] as Post[]),
    supabase
      .from('reels')
      .select('*, shop:shops(id,name,logo_url,category,avg_rating,is_open,city)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (reelsRes.error) throw reelsRes.error;

  const originals: Post[] = [];
  for (const post of shopPosts) {
    if (isProfileVideoItem(post)) originals.push(post);
  }

  for (const reel of reelsRes.data ?? []) {
    const mapped = reelToProfileVideoPost({
      ...(reel as Reel),
      shop_name: reel.shop?.name,
      shop_logo: reel.shop?.logo_url,
      shop: reel.shop,
    });
    originals.push(mapped);
  }

  const combined = dedupeProfileMediaItems(sortProfileMediaNewest(originals));
  return hydratePostsWithUserState(combined, userId);
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

export const deletePost = async (postId: string) => {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
};

export const setProductAvailability = async (productId: string, isAvailable: boolean) => {
  const { error } = await supabase
    .from('products')
    .update({ is_available: isAvailable })
    .eq('id', productId);
  if (error) throw error;
};

export const getFollowingFeed = async (userId: string, page = 0, followedShopIds: string[] = []) => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('feed_from_followed', { p_user_id: userId }).range(page * PAGE, (page + 1) * PAGE - 1),
      API_MS,
      'following-feed',
    );
    if (error) throw error;
    const posts = await hydratePostsWithUserState((data ?? []) as Post[], userId);
    if (page === 0) {
      const reposts = await getAttributedRepostFeed(userId, {
        followedShopIds,
        limit: 16,
      });
      return mergeFeedWithReposts(posts, reposts);
    }
    return posts;
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
    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      shop_name: p.shop?.name,
      shop_logo: p.shop?.logo_url,
      shop_category: p.shop?.category,
      shop_avg_rating: p.shop?.avg_rating,
      shop_is_open: p.shop?.is_open,
      distance_km: 0,
    })) as Post[];
    const posts = await hydratePostsWithUserState(mapped, userId);
    if (page === 0) {
      const reposts = await getAttributedRepostFeed(userId, { followedShopIds, limit: 16 });
      return mergeFeedWithReposts(posts, reposts);
    }
    return posts;
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

// ─── REELS / SPARKS ───────────────────────────────────────────────────

async function hydrateReelsWithUserState(reels: Reel[], userId?: string | null): Promise<Reel[]> {
  if (!reels.length) return reels;
  const ids = reels.map(r => r.id).filter(Boolean);
  if (!ids.length) return reels;

  const empty = { data: [] as Array<{ spark_id: string }> };
  const [likesRes, mineRepostsRes, allRepostsRes] = await Promise.all([
    userId
      ? supabase.from('spark_likes').select('spark_id').eq('user_id', userId).in('spark_id', ids)
      : Promise.resolve(empty),
    userId
      ? supabase.from('spark_reposts').select('spark_id').eq('user_id', userId).in('spark_id', ids)
      : Promise.resolve(empty),
    supabase.from('spark_reposts').select('spark_id').in('spark_id', ids),
  ]);

  const liked = new Set((likesRes.data ?? []).map((row: any) => row.spark_id));
  const reposted = new Set((mineRepostsRes.data ?? []).map((row: any) => row.spark_id));
  const repostCounts = new Map<string, number>();
  for (const row of allRepostsRes.data ?? []) {
    const id = (row as any).spark_id;
    if (!id) continue;
    repostCounts.set(id, (repostCounts.get(id) ?? 0) + 1);
  }

  return reels.map(reel => ({
    ...reel,
    is_liked: liked.has(reel.id),
    is_reposted: reposted.has(reel.id),
    total_reposts: repostCounts.get(reel.id) ?? 0,
  }));
}

type UnifiedSparkRow = {
  id: string;
  source_type?: string;
  shop_id: string;
  author_id: string;
  media_url: string;
  caption?: string;
  tags?: string[];
  created_at: string;
  shop_name?: string;
  shop_logo?: string | null;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_followed?: boolean;
  product_id?: string | null;
  product_title?: string | null;
  product_price?: number | null;
  product_discounted_price?: number | null;
  product_image?: string | null;
};

function mapUnifiedSparkRow(row: UnifiedSparkRow): Reel {
  return {
    id: row.id,
    shop_id: row.shop_id,
    author_id: row.author_id,
    media_url: row.media_url,
    caption: row.caption ?? '',
    tags: row.tags ?? [],
    created_at: row.created_at,
    shop_name: row.shop_name,
    shop_logo: row.shop_logo,
    total_likes: row.likes_count ?? 0,
    total_comments: row.comments_count ?? 0,
    total_reposts: row.reposts_count ?? 0,
    is_liked: !!row.is_liked,
    is_reposted: !!row.is_reposted,
    is_following: !!row.is_followed,
    product_id: row.product_id ?? null,
    source_type: row.source_type === 'post' ? 'post' : 'reel',
    product: row.product_id ? {
      id: row.product_id,
      title: row.product_title ?? 'Product',
      price: Number(row.product_price ?? 0),
      discounted_price: row.product_discounted_price != null
        ? Number(row.product_discounted_price)
        : Number(row.product_price ?? 0),
      images: row.product_image ? [row.product_image] : [],
    } : null,
  };
}

async function fallbackUnifiedSparksFeed(
  userId: string | null | undefined,
  limit: number,
  offset: number,
  shopIds?: string[],
): Promise<Reel[]> {
  const reels = await getReels(shopIds?.length ? shopIds : undefined, userId);
  const { data: postRows } = await supabase
    .from('posts')
    .select('*, shop:shops(name, logo_url)')
    .eq('is_ad', false)
    .or('media_type.eq.video')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const fromPosts: Reel[] = (postRows ?? [])
    .filter((p: any) => {
      if (String(p.caption ?? '').startsWith('__TEXT_CARD__')) return false;
      const urls: string[] = Array.isArray(p.media_urls) ? p.media_urls.filter(Boolean) : [];
      return urls.length > 0 && (p.media_type === 'video' || urls.some((u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)));
    })
    .map((p: any) => ({
      id: `post-spark-${p.id}`,
      shop_id: p.shop_id,
      author_id: p.shop_id,
      media_url: (p.media_urls ?? [])[0],
      caption: p.caption ?? '',
      tags: [],
      total_likes: p.total_likes ?? 0,
      total_comments: p.total_comments ?? 0,
      total_reposts: 0,
      created_at: p.created_at,
      shop_name: p.shop?.name,
      shop_logo: p.shop?.logo_url,
      product_id: p.product_id,
      source_type: 'post' as const,
    }));

  const merged = [...reels, ...fromPosts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
  return merged;
}

export const getUnifiedSparksFeed = async (
  userId: string | null | undefined,
  limit = 20,
  offset = 0,
  shopIds?: string[],
): Promise<Reel[]> => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_unified_sparks_feed', {
        p_user_id: userId ?? null,
        p_limit: limit,
        p_offset: offset,
        p_shop_ids: shopIds?.length ? shopIds : null,
      }),
      API_MS,
      'unified-sparks',
    );
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: UnifiedSparkRow) => mapUnifiedSparkRow(row));
  } catch {
    return fallbackUnifiedSparksFeed(userId, limit, offset, shopIds);
  }
};

export const getReels = async (shopIds?: string[], userId?: string | null): Promise<Reel[]> => {
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
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        shop_name: r.shop?.name,
        shop_logo: r.shop?.logo_url,
        tags: r.tags ?? [],
      })) as Reel[];
      return hydrateReelsWithUserState(mapped, userId);
    })(),
    [],
  );
};

export const likeSpark = async (userId: string, sparkId: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) throw new Error('Invalid Spark');
  if (ref.kind === 'post') return likePost(userId, ref.id);
  const { error } = await supabase
    .from('spark_likes')
    .insert({ user_id: userId, spark_id: ref.id });
  if (error && error.code !== '23505') throw error;
};

export const unlikeSpark = async (userId: string, sparkId: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) throw new Error('Invalid Spark');
  if (ref.kind === 'post') return unlikePost(userId, ref.id);
  const { error } = await supabase
    .from('spark_likes')
    .delete()
    .eq('user_id', userId)
    .eq('spark_id', ref.id);
  if (error) throw error;
};

export const repostSpark = async (userId: string, sparkId: string, shopId: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) throw new Error('Invalid Spark');
  if (ref.kind === 'post') return repostPost(userId, ref.id, shopId);

  const unified = await supabase
    .from('reposts')
    .insert({
      user_id: userId,
      spark_id: ref.id,
      shop_id: shopId,
      content_type: 'spark',
    });
  if (!unified.error) return;
  if (unified.error.code === '23505') return;

  const missingUnifiedColumn = String(unified.error.message).includes('spark_id')
    || String(unified.error.message).includes('content_type');
  if (missingUnifiedColumn) {
    const legacy = await supabase
      .from('spark_reposts')
      .insert({ user_id: userId, spark_id: ref.id });
    if (legacy.error && legacy.error.code !== '23505') throw legacy.error;
    return;
  }
  throw unified.error;
};

export const unrepostSpark = async (userId: string, sparkId: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) throw new Error('Invalid Spark');
  if (ref.kind === 'post') return unrepostPost(userId, ref.id);

  const unified = await supabase
    .from('reposts')
    .delete()
    .eq('user_id', userId)
    .eq('spark_id', ref.id);
  if (!unified.error) return;

  const legacy = await supabase
    .from('spark_reposts')
    .delete()
    .eq('user_id', userId)
    .eq('spark_id', ref.id);
  if (legacy.error) throw legacy.error;
};

export const toggleSparkLike = async (userId: string, sparkId: string, shouldLike: boolean) => {
  if (shouldLike) await likeSpark(userId, sparkId);
  else await unlikeSpark(userId, sparkId);
};

export const toggleSparkRepost = async (
  userId: string,
  sparkId: string,
  shopId: string,
  shouldRepost: boolean,
) => {
  if (shouldRepost) await repostSpark(userId, sparkId, shopId);
  else await unrepostSpark(userId, sparkId);
};

export const createSparkComment = async (userId: string, sparkId: string, body: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) throw new Error('Invalid Spark');
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty');
  if (ref.kind === 'post') {
    const comment = await addComment(userId, ref.id, trimmed);
    return {
      id: comment.id,
      post_id: ref.id,
      user_id: userId,
      body: comment.text ?? trimmed,
      text: comment.text ?? trimmed,
      created_at: comment.created_at,
      user: comment.user,
    };
  }
  const { data, error } = await supabase
    .from('spark_comments')
    .insert({ user_id: userId, spark_id: ref.id, body: trimmed })
    .select('*, user:profiles(id, name, avatar_url)')
    .single();
  if (error) throw error;
  return data;
};

export const getSparkComments = async (sparkId: string) => {
  const ref = resolveSparkBackendRef(sparkId);
  if (!ref) return [];
  if (ref.kind === 'post') {
    const rows = await getComments(ref.id);
    return rows.map((row: any) => ({
      id: row.id,
      post_id: ref.id,
      user_id: row.user_id,
      body: row.text,
      text: row.text,
      created_at: row.created_at,
      user: row.user,
    }));
  }
  const { data, error } = await supabase
    .from('spark_comments')
    .select('*, user:profiles(id, name, avatar_url)')
    .eq('spark_id', ref.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const createReel = async (reel: {
  shop_id: string;
  author_id: string;
  media_url: string;
  caption: string;
  tags?: string[];
  product_id?: string | null;
  audio_track_id?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  audio_url?: string | null;
}) => {
  const { data, error } = await supabase
    .from('reels')
    .insert({
      ...reel,
      tags: reel.tags ?? [],
      product_id: reel.product_id ?? null,
      audio_track_id: reel.audio_track_id ?? null,
      audio_title: reel.audio_title ?? null,
      audio_artist: reel.audio_artist ?? null,
      audio_url: reel.audio_url ?? null,
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

// ─── CITY NEWS ─────────────────────────────────────────────────────────────
export const getCityNews = async (city: string, userId?: string, limit = 30): Promise<CityNews[]> => {
  const { data, error } = await supabase
    .from('city_news')
    .select('*, author:author_id(id,name,avatar_url)')
    .in('city', [city, 'National'])
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const items = (data ?? []) as CityNews[];
  if (!userId || !items.length) return items;

  const newsIds = items.map(item => item.id);
  const { data: likes, error: likesError } = await supabase
    .from('city_news_likes')
    .select('news_id')
    .eq('user_id', userId)
    .in('news_id', newsIds);
  if (likesError) throw likesError;

  const likedIds = new Set((likes ?? []).map((row: { news_id: string }) => row.news_id));
  return items.map(item => ({ ...item, is_liked: likedIds.has(item.id) }));
};

export const adminListCityNews = async (limit = 50) => {
  const { data, error } = await supabase
    .from('city_news')
    .select('*, author:author_id(id,name,avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const createCityNews = async (n: {
  city: string;
  category: string;
  title: string;
  body: string;
  image_url?: string | null;
  source_url?: string | null;
  is_published?: boolean;
  author_id?: string | null;
}) => {
  const { data, error } = await supabase
    .from('city_news')
    .insert({
      ...n,
      author_id: n.author_id ?? null,
      is_published: n.is_published ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCityNews = async (id: string, updates: {
  title?: string;
  body?: string;
  image_url?: string | null;
  source_url?: string | null;
  category?: string;
  city?: string;
  is_published?: boolean;
}) => {
  const { data, error } = await supabase
    .from('city_news')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const setCityNewsPublished = async (id: string, is_published: boolean) => {
  const { data, error } = await supabase
    .from('city_news')
    .update({ is_published, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const likeCityNews = async (userId: string, newsId: string) => {
  const { error } = await supabase
    .from('city_news_likes')
    .upsert({ user_id: userId, news_id: newsId }, { onConflict: 'user_id,news_id' });
  if (error) throw error;
};

export const unlikeCityNews = async (userId: string, newsId: string) => {
  const { error } = await supabase
    .from('city_news_likes')
    .delete()
    .eq('user_id', userId)
    .eq('news_id', newsId);
  if (error) throw error;
};

export const getCityNewsComments = async (newsId: string): Promise<CityNewsComment[]> => {
  const { data, error } = await withTimeout(
    supabase
      .from('city_news_comments')
      .select('*, user:profiles(id,name,avatar_url)')
      .eq('news_id', newsId)
      .order('created_at', { ascending: true })
      .limit(100),
    API_MS,
    'news-comments',
  );
  if (error) throw error;
  return (data ?? []) as CityNewsComment[];
};

export const addCityNewsComment = async (userId: string, newsId: string, text: string) => {
  const { data, error } = await supabase
    .from('city_news_comments')
    .insert({ user_id: userId, news_id: newsId, text: text.trim() })
    .select('*, user:profiles(id,name,avatar_url)')
    .single();
  if (error) throw error;
  return data as CityNewsComment;
};

export const adminListProfiles = async (limit = 100) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,role,city,lat,lng,radius_km,is_verified,is_suspended,created_at,updated_at,email,phone,avatar_url')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const adminSetProfileSuspended = async (profileId: string, is_suspended: boolean) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_suspended })
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const adminListShops = async (limit = 100) => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const adminSetShopActive = async (shopId: string, is_active: boolean) => {
  const { data, error } = await supabase
    .from('shops')
    .update({ is_active })
    .eq('id', shopId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const adminSetShopsActiveByOwner = async (ownerId: string, is_active: boolean) => {
  const { data, error } = await supabase
    .from('shops')
    .update({ is_active })
    .eq('owner_id', ownerId)
    .select();
  if (error) throw error;
  return data ?? [];
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortServicesByDistance(list: ServiceProvider[]): ServiceProvider[] {
  return [...list].sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
}

function applyGeoFallback(
  rows: ServiceProvider[],
  lat: number,
  lng: number,
  radiusKm: number,
): ServiceProvider[] {
  return sortServicesByDistance(
    rows
      .filter(row => row.lat != null && row.lng != null)
      .map(row => ({
        ...row,
        distance_km: haversineKm(lat, lng, row.lat!, row.lng!),
      }))
      .filter(row => (row.distance_km ?? 9999) <= radiusKm),
  );
}

export type ServiceProDashboardStats = {
  active_requests: number;
  quote_inquiries: number;
  is_available: boolean;
};

export const getServiceProviderByProfile = async (profileId: string): Promise<ServiceProvider | null> => {
  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceProvider | null;
};

export const getServiceProDashboardStats = async (profileId: string): Promise<ServiceProDashboardStats> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [providerRes, activeRes, quoteRes] = await Promise.all([
    getServiceProviderByProfile(profileId),
    supabase
      .from('pro_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('provider_profile_id', profileId),
    supabase
      .from('pro_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('provider_profile_id', profileId)
      .gte('updated_at', weekAgo),
  ]);

  return {
    active_requests: activeRes.count ?? 0,
    quote_inquiries: quoteRes.count ?? 0,
    is_available: providerRes?.is_available ?? false,
  };
};

export const getServicesNearby = async (
  lat: number,
  lng: number,
  radiusKm: number,
  category?: string,
  subcategory?: string,
): Promise<ServiceProvider[]> => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('services_within_radius', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radiusKm,
        filter_category: category && category !== 'all' ? category : null,
        filter_subcategory: subcategory ?? null,
      }).limit(50),
      API_MS,
      'services',
    );
    if (error) throw error;
    return sortServicesByDistance((data ?? []) as ServiceProvider[]);
  } catch {
    let q = supabase.from('service_providers').select('*').limit(100);
    if (category && category !== 'all') q = q.eq('category', category);
    if (subcategory) q = q.eq('subcategory', subcategory);
    const { data, error } = await withTimeout(q, API_MS, 'services-fallback');
    if (error) throw error;
    return applyGeoFallback((data ?? []) as ServiceProvider[], lat, lng, radiusKm).slice(0, 50);
  }
};

export const getServiceProviderById = async (id: string): Promise<ServiceProvider> => {
  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ServiceProvider;
};

export const computeRatingFromReviews = (reviews: Review[]): { avg_rating: number; total_reviews: number } => {
  if (!reviews.length) return { avg_rating: 0, total_reviews: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { avg_rating: Math.round((total / reviews.length) * 10) / 10, total_reviews: reviews.length };
};

export const touchServiceProviderActivity = async (profileId: string) => {
  const { error } = await supabase
    .from('service_providers')
    .update({ last_active_at: new Date().toISOString(), presence_status: 'online' })
    .eq('profile_id', profileId);
  if (error) throw error;
};

export const setServiceProviderAvailability = async (
  profileId: string,
  isAvailable: boolean,
): Promise<ServiceProvider | null> => {
  const { data, error } = await supabase
    .from('service_providers')
    .update({
      is_available: isAvailable,
      presence_status: isAvailable ? 'online' : 'away',
      last_active_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ServiceProvider | null;
};

export const updateServicePresence = async (
  profileId: string,
  presence_status: PresenceStatus,
  custom_status?: string | null,
) => {
  const { data, error } = await supabase
    .from('service_providers')
    .update({
      presence_status,
      custom_status: presence_status === 'custom' ? (custom_status ?? null) : null,
      last_active_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ServiceProvider | null;
};

export const getOrCreateProConversation = async (
  buyerId: string,
  svc: ServiceProvider,
): Promise<ProConversation> => {
  const { data: existing, error: findErr } = await supabase
    .from('pro_conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('service_provider_id', svc.id)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as ProConversation;

  const { data, error } = await supabase
    .from('pro_conversations')
    .insert({
      buyer_id: buyerId,
      provider_profile_id: svc.profile_id,
      service_provider_id: svc.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProConversation;
};

export const getProMessages = async (conversationId: string): Promise<ProMessage[]> => {
  const { data, error } = await supabase
    .from('pro_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ProMessage[];
};

export const sendProMessage = async (
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ProMessage> => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('pro_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('pro_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as ProMessage;
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
