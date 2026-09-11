// lib/sparkAiEngine.ts — Client-side Spark AI assist (captions, hashtags, audio ducking)

import {
  clampVolumePct,
  type SparkVolumeBalance,
} from './sparkAudioSync';

export type CaptionStyle = 'promotional' | 'storytelling' | 'local';

export type AiCaptionOption = {
  id: string;
  style: CaptionStyle;
  label: string;
  text: string;
};

export type AiEnhanceContext = {
  location?: string | null;
  productTitle?: string | null;
  audioTitle?: string | null;
  audioArtist?: string | null;
  existingCaption?: string | null;
  cityHint?: string | null;
};

export type AiEnhanceResult = {
  captions: AiCaptionOption[];
  hashtags: string[];
  audioBalance: SparkVolumeBalance;
  audioDusted: boolean;
};

const STYLE_LABELS: Record<CaptionStyle, string> = {
  promotional: 'Promotional',
  storytelling: 'Storytelling',
  local: 'Local engagement',
};

function cleanToken(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s#-]/gu, '')
    .trim();
}

function placeLabel(location?: string | null, cityHint?: string | null) {
  const raw = (location || cityHint || '').trim();
  if (!raw) return 'your city';
  const first = raw.split(',')[0]?.trim();
  return first || raw;
}

function productHook(productTitle?: string | null) {
  const title = productTitle?.trim();
  return title ? `"${title}"` : 'this drop';
}

/**
 * Generate 3 catchy caption options: promotional, storytelling, and local hyper-engagement.
 * Pure client heuristics — no network call; UTF-8 safe.
 */
export function generateAiCaptions(ctx: AiEnhanceContext = {}): AiCaptionOption[] {
  const place = placeLabel(ctx.location, ctx.cityHint);
  const product = productHook(ctx.productTitle);
  const trackBit =
    ctx.audioTitle?.trim()
      ? ` Set to ${ctx.audioTitle.trim()}${ctx.audioArtist ? ` · ${ctx.audioArtist}` : ''}.`
      : '';

  const promotional = cleanToken(
    `Fresh from the studio — ${product} is live.${trackBit} Tap through before it’s gone.`,
  );
  const storytelling = cleanToken(
    `Started as a quiet idea. Now it’s on camera — ${product}, made for moments that feel like ${place}.`,
  );
  const local = cleanToken(
    `Hey ${place} — this one’s for you. ${product} just dropped. Tag a friend who needs this energy.`,
  );

  return [
    { id: 'promo', style: 'promotional', label: STYLE_LABELS.promotional, text: promotional },
    { id: 'story', style: 'storytelling', label: STYLE_LABELS.storytelling, text: storytelling },
    { id: 'local', style: 'local', label: STYLE_LABELS.local, text: local },
  ];
}

/**
 * Suggest contextually relevant hashtags for Sparks discovery.
 */
export function suggestSmartHashtags(ctx: AiEnhanceContext = {}): string[] {
  const tags = new Set<string>([
    'LocalDeals',
    'Handmade',
    'Trending',
    'SparkDrop',
    'ShopLocal',
  ]);

  const place = placeLabel(ctx.location, ctx.cityHint);
  if (place && place !== 'your city') {
    const compact = place.replace(/\s+/g, '');
    if (compact.length >= 2) tags.add(compact);
    tags.add(`${compact}Finds`);
  }

  const product = ctx.productTitle?.trim();
  if (product) {
    const words = product.split(/\s+/).filter(w => w.length > 2).slice(0, 2);
    words.forEach(w => tags.add(w.replace(/[^\p{L}\p{N}]/gu, '')));
    tags.add('MustHave');
  }

  if (ctx.audioTitle?.trim()) tags.add('SoundOn');

  return Array.from(tags)
    .map(t => t.replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Audio Duster: duck background music when speech/dialogue is likely present.
 * Heuristic — prefers lower music + raised video when no explicit mix exists,
 * or when video volume is already audible (dialogue track present).
 */
export function applyAudioDuster(
  current?: SparkVolumeBalance | null,
  opts?: { hasLikelySpeech?: boolean },
): { balance: SparkVolumeBalance; dusted: boolean } {
  const hasLikelySpeech = opts?.hasLikelySpeech ?? true;
  if (!hasLikelySpeech) {
    return {
      balance: {
        video: clampVolumePct(current?.video ?? 0),
        music: clampVolumePct(current?.music ?? 100),
      },
      dusted: false,
    };
  }

  const videoBase = clampVolumePct(Math.max(current?.video ?? 0, 55));
  const musicBase = clampVolumePct(Math.min(current?.music ?? 100, 35));

  return {
    balance: { video: videoBase, music: musicBase },
    dusted: true,
  };
}

/**
 * One-tap AI Enhance pack used by the studio drawer.
 */
export async function runSparkAiEnhance(
  ctx: AiEnhanceContext = {},
  currentBalance?: SparkVolumeBalance | null,
): Promise<AiEnhanceResult> {
  // Soft yield so UI can show a loading pulse (feels intentional, stays offline-safe).
  await new Promise(resolve => setTimeout(resolve, 420));

  const captions = generateAiCaptions(ctx);
  const hashtags = suggestSmartHashtags(ctx);
  const { balance, dusted } = applyAudioDuster(currentBalance, { hasLikelySpeech: true });

  return {
    captions,
    hashtags,
    audioBalance: balance,
    audioDusted: dusted,
  };
}

export function formatHashtagChip(tag: string) {
  const clean = tag.replace(/^#/, '').trim();
  return clean ? `#${clean}` : '';
}
