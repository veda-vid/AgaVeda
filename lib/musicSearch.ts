// lib/musicSearch.ts — iTunes Search API for Spark audio picker (preview clips)

import type { SparkVolumeBalance } from './sparkAudioSync';
import { DEFAULT_SPARK_VOLUME_BALANCE } from './sparkAudioSync';

export type MusicCategoryId =
  | 'trending'
  | 'bollywood'
  | 'hollywood'
  | 'punjabi'
  | 'instrumental'
  | 'local';

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  previewUrl: string | null;
  durationMs: number;
};

export type SparkAudioSelection = {
  audio_track_id: string;
  audio_title: string;
  audio_artist: string;
  audio_url: string | null;
  audio_start_time?: number;
  audio_duration_sec?: number | null;
  audio_volume_balance?: SparkVolumeBalance;
};

export const MUSIC_CATEGORIES: Array<{
  id: MusicCategoryId;
  label: string;
}> = [
  { id: 'trending', label: '🔥 Trending' },
  { id: 'bollywood', label: '🎬 Bollywood' },
  { id: 'hollywood', label: '🇺🇸 Hollywood' },
  { id: 'punjabi', label: '🎤 Punjabi' },
  { id: 'instrumental', label: '🎧 Instrumental' },
  { id: 'local', label: '🎵 Local / City Hits' },
];

type ItunesTrack = {
  trackId: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
};

type ItunesResponse = {
  results?: ItunesTrack[];
};

function categoryQuery(category: MusicCategoryId, cityHint?: string) {
  switch (category) {
    case 'trending':
      return { term: 'trending hits', country: 'US' };
    case 'bollywood':
      return { term: 'bollywood hindi songs', country: 'IN' };
    case 'hollywood':
      return { term: 'hollywood pop hits', country: 'US' };
    case 'punjabi':
      return { term: 'punjabi hits', country: 'IN' };
    case 'instrumental':
      return { term: 'instrumental background music', country: 'US' };
    case 'local':
      return {
        term: cityHint?.trim() ? `${cityHint.trim()} local hits` : 'india city hits',
        country: 'IN',
      };
    default:
      return { term: 'popular music', country: 'US' };
  }
}

function mapItunesTrack(row: ItunesTrack): MusicTrack | null {
  if (!row.trackId) return null;
  return {
    id: String(row.trackId),
    title: row.trackName?.trim() || 'Unknown track',
    artist: row.artistName?.trim() || 'Unknown artist',
    albumArt: row.artworkUrl100 ?? null,
    previewUrl: row.previewUrl ?? null,
    durationMs: row.trackTimeMillis ?? 0,
  };
}

export function formatTrackDuration(durationMs: number) {
  const totalSec = Math.max(0, Math.round(durationMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export async function searchMusicTracks(
  query: string,
  options?: { country?: string; limit?: number },
): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const params = new URLSearchParams({
    term: trimmed,
    media: 'music',
    entity: 'song',
    limit: String(options?.limit ?? 25),
    country: options?.country ?? 'US',
  });

  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!response.ok) throw new Error('Music search is temporarily unavailable');
  const data = (await response.json()) as ItunesResponse;
  return (data.results ?? [])
    .map(mapItunesTrack)
    .filter((row): row is MusicTrack => !!row);
}

export async function fetchMusicByCategory(
  category: MusicCategoryId,
  cityHint?: string,
): Promise<MusicTrack[]> {
  const { term, country } = categoryQuery(category, cityHint);
  return searchMusicTracks(term, { country, limit: 25 });
}

export function trackToAudioSelection(track: MusicTrack, startTimeSec = 0): SparkAudioSelection {
  return {
    audio_track_id: track.id,
    audio_title: track.title,
    audio_artist: track.artist,
    audio_url: track.previewUrl,
    audio_start_time: startTimeSec,
    audio_duration_sec: track.durationMs ? Math.round(track.durationMs / 1000) : null,
    audio_volume_balance: { ...DEFAULT_SPARK_VOLUME_BALANCE },
  };
}
