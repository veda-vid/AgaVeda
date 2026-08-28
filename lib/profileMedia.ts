import type { Post, Reel } from '../types';

export function isProfileVideoItem(post: Pick<Post, 'media_type' | 'media_urls' | 'is_spark_repost'>): boolean {
  if (post.is_spark_repost) return true;
  if (post.media_type === 'video') return true;
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(post.media_urls?.[0] ?? '');
}

export function reelToProfileVideoPost(reel: Reel & { shop?: any }): Post {
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
    total_reposts: reel.total_reposts ?? 0,
    created_at: reel.created_at,
    shop_name: reel.shop_name ?? reel.shop?.name,
    shop_logo: reel.shop_logo ?? reel.shop?.logo_url,
    shop_category: reel.shop?.category,
    is_spark_repost: false,
    spark_id: reel.id,
    feed_item_id: `reel-${reel.id}`,
  } as Post;
}

export function dedupeProfileMediaItems(items: Post[]): Post[] {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const item of items) {
    const key = item.feed_item_id
      ?? (item.is_spark_repost ? `spark-repost-${item.spark_id ?? item.id}` : null)
      ?? item.spark_id
      ?? item.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function sortProfileMediaNewest(items: Post[]): Post[] {
  return [...items].sort((a, b) => {
    const at = new Date(a.reposted_at ?? a.created_at).getTime();
    const bt = new Date(b.reposted_at ?? b.created_at).getTime();
    return bt - at;
  });
}
