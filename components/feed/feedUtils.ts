import { getSupabaseConfig } from '../../lib/config';

const { url: SUPABASE_URL } = getSupabaseConfig();

export function resolveFeedMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!SUPABASE_URL) return value;
  const base = SUPABASE_URL.replace(/\/$/, '');
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\//, '')}`;
}

export function shopFeedHandle(name?: string | null) {
  const slug = (name || 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `@${slug || 'shop'}`;
}

export function isVideoMedia(url?: string | null, mediaType?: string) {
  if (mediaType === 'video') return true;
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url ?? '');
}

export function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export type TextCardPayload = {
  text: string;
  style?: string;
  fontStyle?: string;
  background?: string;
  textColor?: string;
};

export function parseTextCardCaption(caption?: string): TextCardPayload | null {
  if (typeof caption !== 'string' || !caption.startsWith('__TEXT_CARD__')) return null;
  try {
    return JSON.parse(caption.slice('__TEXT_CARD__'.length)) as TextCardPayload;
  } catch {
    return null;
  }
}
