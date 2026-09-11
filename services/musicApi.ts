// services/musicApi.ts — Bollywood / Reels music catalog + audio trim helpers

import {
  fetchMusicByCategory,
  formatTrackDuration,
  searchMusicTracks,
  trackToAudioSelection,
  MUSIC_CATEGORIES,
  type MusicCategoryId,
  type MusicTrack,
  type SparkAudioSelection,
} from '../lib/musicSearch';
import {
  clampVolumePct,
  DEFAULT_SPARK_VOLUME_BALANCE,
  type SparkVolumeBalance,
} from '../lib/sparkAudioSync';

export type { MusicCategoryId, MusicTrack, SparkAudioSelection, SparkVolumeBalance };
export { MUSIC_CATEGORIES, formatTrackDuration, DEFAULT_SPARK_VOLUME_BALANCE, clampVolumePct };

/** Max Spark clip length (seconds) — Instagram Reels–style. */
export const SPARK_MAX_DURATION_SEC = 60;

/** Default music preview window when attaching a track. */
export const MUSIC_TRIM_WINDOW_SEC = 15;

/** Alternate Reels-style selection window. */
export const MUSIC_TRIM_WINDOW_LONG_SEC = 30;

export type AudioTrimRange = {
  startSec: number;
  endSec: number;
};

export type MusicWindowSec = AudioTrimRange & {
  windowSec: number;
};

/**
 * Clamp a music/video trim window into a valid range for Spark publish.
 */
export function clampAudioTrim(
  startSec: number,
  endSec: number,
  mediaDurationSec?: number | null,
): AudioTrimRange {
  const maxEnd = Math.max(
    1,
    Math.min(
      SPARK_MAX_DURATION_SEC,
      mediaDurationSec && mediaDurationSec > 0 ? mediaDurationSec : SPARK_MAX_DURATION_SEC,
    ),
  );
  let start = Math.max(0, startSec);
  let end = Math.max(start + 0.05, endSec);
  if (end > maxEnd) end = maxEnd;
  if (start >= end) start = Math.max(0, end - 1);
  return {
    startSec: Math.round(start * 100) / 100,
    endSec: Math.round(end * 100) / 100,
  };
}

/**
 * Clamp a fixed-length selection window (15s / 30s) across a music track.
 * Frame-accurate enough for expo-av position seeks (centisecond precision).
 */
export function clampMusicWindow(
  startSec: number,
  windowSec: number,
  trackDurationSec?: number | null,
): MusicWindowSec {
  const duration = Math.max(
    1,
    trackDurationSec && trackDurationSec > 0 ? trackDurationSec : MUSIC_TRIM_WINDOW_SEC,
  );
  const window = Math.min(
    Math.max(1, windowSec),
    duration,
    SPARK_MAX_DURATION_SEC,
  );
  const maxStart = Math.max(0, duration - window);
  const start = Math.max(0, Math.min(maxStart, startSec));
  const end = Math.min(duration, start + window);
  return {
    startSec: Math.round(start * 100) / 100,
    endSec: Math.round(end * 100) / 100,
    windowSec: Math.round((end - start) * 100) / 100,
  };
}

/**
 * Bollywood-first catalog fetch for the Spark music picker.
 * Uses iTunes Search (IN store) under the hood — preview URLs only.
 */
export async function fetchBollywoodHits(limit = 25): Promise<MusicTrack[]> {
  const rows = await searchMusicTracks('bollywood hindi songs', { country: 'IN', limit });
  return rows.filter(t => !!t.previewUrl);
}

export async function fetchTrendingForSparks(cityHint?: string): Promise<MusicTrack[]> {
  const [trending, bollywood, punjabi] = await Promise.all([
    fetchMusicByCategory('trending', cityHint),
    fetchMusicByCategory('bollywood', cityHint),
    fetchMusicByCategory('punjabi', cityHint),
  ]);
  const seen = new Set<string>();
  const merged: MusicTrack[] = [];
  for (const track of [...bollywood, ...punjabi, ...trending]) {
    if (!track.previewUrl || seen.has(track.id)) continue;
    seen.add(track.id);
    merged.push(track);
  }
  return merged;
}

export async function searchSparkMusic(
  query: string,
  options?: { country?: string; limit?: number; bollywoodBias?: boolean },
): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return fetchBollywoodHits(options?.limit ?? 25);

  const country = options?.country ?? (options?.bollywoodBias === false ? 'US' : 'IN');
  const term = options?.bollywoodBias === false
    ? trimmed
    : `${trimmed} bollywood hindi`;
  return searchMusicTracks(term, { country, limit: options?.limit ?? 25 });
}

/**
 * Attach a catalog track to a Spark with trim start aligned to the video window.
 */
export function attachTrackToSpark(
  track: MusicTrack,
  trim: AudioTrimRange,
  volumes: SparkVolumeBalance = DEFAULT_SPARK_VOLUME_BALANCE,
): SparkAudioSelection {
  const range = clampAudioTrim(trim.startSec, trim.endSec);
  return {
    ...trackToAudioSelection(track, range.startSec),
    audio_volume_balance: {
      video: clampVolumePct(volumes.video),
      music: clampVolumePct(volumes.music),
    },
  };
}

export const musicApi = {
  categories: MUSIC_CATEGORIES,
  fetchBollywoodHits,
  fetchTrendingForSparks,
  searchSparkMusic,
  fetchByCategory: fetchMusicByCategory,
  attachTrackToSpark,
  clampAudioTrim,
  clampMusicWindow,
  formatTrackDuration,
};

export default musicApi;
