// lib/sparkAudioSync.ts — Shared Spark audio/video mix helpers

export type SparkVolumeBalance = {
  video: number;
  music: number;
};

export const DEFAULT_SPARK_VOLUME_BALANCE: SparkVolumeBalance = {
  video: 0,
  music: 100,
};

export function clampVolumePct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseSparkVolumeBalance(raw: unknown): SparkVolumeBalance {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SPARK_VOLUME_BALANCE };
  const row = raw as Record<string, unknown>;
  return {
    video: clampVolumePct(Number(row.video ?? DEFAULT_SPARK_VOLUME_BALANCE.video)),
    music: clampVolumePct(Number(row.music ?? DEFAULT_SPARK_VOLUME_BALANCE.music)),
  };
}

export function volumePctToGain(pct: number, muted: boolean) {
  if (muted) return 0;
  return clampVolumePct(pct) / 100;
}
