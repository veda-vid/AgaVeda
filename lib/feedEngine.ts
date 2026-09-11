// lib/feedEngine.ts — Home feed loading with cold-start regional fallback

import { getFeed, getFollowingFeed, feedFromPostsTable, hydratePostsWithUserState } from './api';
import { supabase } from './supabase';
import type { Profile, Post } from '../types';

const PAGE = 0;
const EXPANDED_RADIUS_KM = 50;

export type HomeFeedLoadOptions = {
  page?: number;
  mode?: 'nearby' | 'following';
  followedShopIds?: string[];
};

export type HomeFeedLoadResult = {
  posts: Post[];
  isRegionalFallback: boolean;
  effectiveRadiusKm: number;
  usedFeaturedFallback: boolean;
};

async function fetchFeaturedVerifiedPosts(userId?: string, limit = 12): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, shop:shops(id,name,logo_url,category,avg_rating,is_open,is_verified)')
    .eq('is_ad', false)
    .is('deleted_at', null)
    .order('total_likes', { ascending: false })
    .limit(limit * 2);

  if (error) return [];

  const verified = (data ?? []).filter((row: any) => row.shop?.is_verified);
  const mapped = verified.slice(0, limit).map((p: any) => ({
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

export async function loadHomeFeed(
  profile: Profile,
  options: HomeFeedLoadOptions = {},
): Promise<HomeFeedLoadResult> {
  const page = options.page ?? PAGE;
  const mode = options.mode ?? 'nearby';
  const followedShopIds = options.followedShopIds ?? [];
  const baseRadius = profile.radius_km ?? 5;

  let posts: Post[] = [];
  let isRegionalFallback = false;
  let effectiveRadiusKm = baseRadius;
  let usedFeaturedFallback = false;

  if (mode === 'following' && profile.role === 'buyer') {
    posts = await getFollowingFeed(profile.id, page, followedShopIds);
    return { posts, isRegionalFallback, effectiveRadiusKm, usedFeaturedFallback };
  }

  if (profile.lat != null && profile.lng != null) {
    posts = await getFeed(profile.lat, profile.lng, baseRadius, page, profile.id);
    if (page === 0 && posts.length === 0 && baseRadius < EXPANDED_RADIUS_KM) {
      const expanded = await getFeed(profile.lat, profile.lng, EXPANDED_RADIUS_KM, page, profile.id);
      if (expanded.length) {
        posts = expanded;
        isRegionalFallback = true;
        effectiveRadiusKm = EXPANDED_RADIUS_KM;
      }
    }
  } else {
    posts = await feedFromPostsTable(page, profile.id);
  }

  if (page === 0 && posts.length === 0) {
    const featured = await fetchFeaturedVerifiedPosts(profile.id);
    if (featured.length) {
      posts = featured;
      usedFeaturedFallback = true;
      isRegionalFallback = true;
      effectiveRadiusKm = Math.max(effectiveRadiusKm, EXPANDED_RADIUS_KM);
    }
  }

  return { posts, isRegionalFallback, effectiveRadiusKm, usedFeaturedFallback };
}
