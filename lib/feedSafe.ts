// lib/feedSafe.ts — Defensive sanitizers for Home feed posts / sparks

export const DEFAULT_AVATAR =
  'https://placehold.co/96x96/1C1C2E/FF5722/png?text=%F0%9F%8F%AA';

export const DEFAULT_SHOP_NAME = 'Shop';

type LooseRow = Record<string, any> | null | undefined;

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

/** Drop null/invalid rows and normalize required fields for PostCard. */
export function sanitizeFeedPosts<T extends LooseRow>(rows: T[] | null | undefined): Array<NonNullable<T>> {
  if (!Array.isArray(rows)) return [];
  const out: Array<NonNullable<T>> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const id = asString(row.id) || asString(row.feed_item_id);
    if (!id) continue;
    const createdAt = asString(row.created_at) || new Date().toISOString();
    out.push({
      ...row,
      id,
      feed_item_id: asString(row.feed_item_id) || id,
      caption: asString(row.caption),
      media_urls: asStringArray(row.media_urls),
      media_type: asString(row.media_type, 'image') || 'image',
      shop_name: asString(row.shop_name, DEFAULT_SHOP_NAME) || DEFAULT_SHOP_NAME,
      shop_logo: (row.shop_logo as string | null | undefined) ?? null,
      created_at: createdAt,
      total_likes: Number(row.total_likes ?? 0) || 0,
      total_comments: Number(row.total_comments ?? 0) || 0,
      total_reposts: Number(row.total_reposts ?? 0) || 0,
    } as NonNullable<T>);
  }
  return out;
}

/** Normalize Spark / Reel rows for SparksFeed. */
export function sanitizeSparkItems<T extends LooseRow>(rows: T[] | null | undefined): Array<NonNullable<T>> {
  if (!Array.isArray(rows)) return [];
  const out: Array<NonNullable<T>> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const id = asString(row.id);
    const mediaUrl = asString(row.media_url).trim();
    if (!id || !mediaUrl) continue;
    const musicTrack =
      (row.music_track_url as string | null | undefined)
      ?? (row.audio_url as string | null | undefined)
      ?? null;
    out.push({
      ...row,
      id,
      media_url: mediaUrl,
      caption: asString(row.caption),
      shop_name: asString(row.shop_name, DEFAULT_SHOP_NAME) || DEFAULT_SHOP_NAME,
      shop_logo: (row.shop_logo as string | null | undefined) ?? null,
      audio_url: musicTrack,
      music_track_url: musicTrack,
      audio_start_time: Number(row.audio_start_time ?? 0) || 0,
      audio_volume_balance: row.audio_volume_balance && typeof row.audio_volume_balance === 'object'
        ? row.audio_volume_balance
        : { video: 0, music: 100 },
      created_at: asString(row.created_at) || new Date().toISOString(),
      total_likes: Number(row.total_likes ?? row.likes_count ?? 0) || 0,
      total_comments: Number(row.total_comments ?? row.comments_count ?? 0) || 0,
      total_reposts: Number(row.total_reposts ?? row.reposts_count ?? 0) || 0,
    } as NonNullable<T>);
  }
  return out;
}

export function safeFeedItemKey(item: { id?: string; feed_item_id?: string } | null | undefined, index: number) {
  const key = item?.feed_item_id || item?.id;
  return key ? String(key) : `feed-fallback-${index}`;
}
