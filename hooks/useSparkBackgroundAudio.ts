import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { volumePctToGain } from '../lib/sparkAudioSync';

const LOAD_TIMEOUT_MS = 8000;

type AudioModule = typeof import('expo-av');

function getExpoAudio(): AudioModule['Audio'] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const av = require('expo-av') as AudioModule;
    return av?.Audio ?? null;
  } catch (error) {
    console.warn('[audio] expo-av Audio unavailable — skipping background track.', error);
    return null;
  }
}

type UseSparkBackgroundAudioOptions = {
  audioUrl?: string | null;
  audioStartTime?: number;
  musicVolumePct?: number;
  active?: boolean;
  muted?: boolean;
  shouldMount?: boolean;
  onFallbackToNativeVideo?: () => void;
};

export function useSparkBackgroundAudio({
  audioUrl,
  audioStartTime = 0,
  musicVolumePct = 100,
  active = false,
  muted = true,
  shouldMount = true,
  onFallbackToNativeVideo,
}: UseSparkBackgroundAudioOptions) {
  const soundRef = useRef<{
    stopAsync: () => Promise<unknown>;
    unloadAsync: () => Promise<unknown>;
    setVolumeAsync: (v: number) => Promise<unknown>;
    getStatusAsync: () => Promise<{ isLoaded?: boolean; positionMillis?: number }>;
    setPositionAsync: (ms: number) => Promise<unknown>;
    playAsync: () => Promise<unknown>;
    pauseAsync: () => Promise<unknown>;
  } | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const [bgReady, setBgReady] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const activeRef = useRef(active);
  const mutedRef = useRef(muted);
  const musicVolumeRef = useRef(musicVolumePct);
  const startTimeRef = useRef(audioStartTime);

  activeRef.current = active;
  mutedRef.current = muted;
  musicVolumeRef.current = musicVolumePct;
  startTimeRef.current = audioStartTime;

  const triggerFallback = useCallback(() => {
    if (bgFailed) return;
    setBgFailed(true);
    setBgReady(false);
    onFallbackToNativeVideo?.();
  }, [bgFailed, onFallbackToNativeVideo]);

  const unloadNative = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch { /* noop */ }
    try {
      await sound.unloadAsync();
    } catch { /* noop */ }
  }, []);

  const unloadWeb = useCallback(() => {
    const el = webAudioRef.current;
    webAudioRef.current = null;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch { /* noop */ }
    el.src = '';
  }, []);

  const applyWebVolume = useCallback(() => {
    const el = webAudioRef.current;
    if (!el) return;
    el.volume = volumePctToGain(musicVolumeRef.current, mutedRef.current);
  }, []);

  const syncWebPlayback = useCallback(async (playing: boolean) => {
    const el = webAudioRef.current;
    if (!el || bgFailed) return;
    applyWebVolume();
    if (playing) {
      try {
        if (Math.abs(el.currentTime - startTimeRef.current) > 0.35) {
          el.currentTime = startTimeRef.current;
        }
        await el.play();
      } catch { /* noop */ }
      return;
    }
    el.pause();
  }, [applyWebVolume, bgFailed]);

  const syncNativePlayback = useCallback(async (playing: boolean) => {
    const sound = soundRef.current;
    if (!sound || bgFailed) return;
    try {
      await sound.setVolumeAsync(volumePctToGain(musicVolumeRef.current, mutedRef.current));
      if (playing) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          const posMs = startTimeRef.current * 1000;
          if (Math.abs((status.positionMillis ?? 0) - posMs) > 350) {
            await sound.setPositionAsync(posMs);
          }
        }
        await sound.playAsync();
      } else {
        // stopAsync cuts output immediately — pause can lag behind the next Moment's music.
        try {
          await sound.stopAsync();
        } catch {
          await sound.pauseAsync();
        }
      }
    } catch { /* noop */ }
  }, [bgFailed]);

  const resetToStart = useCallback(async () => {
    const startSec = startTimeRef.current;
    if (Platform.OS === 'web') {
      const el = webAudioRef.current;
      if (!el) return;
      el.currentTime = startSec;
      if (activeRef.current) void el.play().catch(() => {});
      return;
    }
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.setPositionAsync(startSec * 1000);
      if (activeRef.current) await sound.playAsync();
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!audioUrl || !shouldMount) {
      setBgReady(false);
      setBgFailed(false);
      void unloadNative();
      unloadWeb();
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      return;
    }

    let cancelled = false;
    loadedRef.current = false;
    setBgFailed(false);
    setBgReady(false);

    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = setTimeout(() => {
      if (!cancelled && !loadedRef.current) triggerFallback();
    }, LOAD_TIMEOUT_MS);

    const load = async () => {
      try {
        if (Platform.OS === 'web') {
          const el = new window.Audio(audioUrl);
          el.preload = 'auto';
          el.loop = false;
          // Do not set crossOrigin — iTunes preview CDN blocks CORS and would silence music
          const markReady = () => {
            if (cancelled) return;
            loadedRef.current = true;
            webAudioRef.current = el;
            setBgReady(true);
            if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
            try {
              el.currentTime = Math.max(0, startTimeRef.current);
            } catch { /* noop */ }
            applyWebVolume();
            if (activeRef.current) void syncWebPlayback(true);
          };
          el.addEventListener('canplaythrough', markReady, { once: true });
          el.addEventListener('loadeddata', markReady, { once: true });
          el.addEventListener('error', () => {
            if (!cancelled) triggerFallback();
          });
          el.load();
          return;
        }

        const Audio = getExpoAudio();
        if (!Audio) {
          triggerFallback();
          return;
        }
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          // Keep latched music audible even if a WebView video element is mounted.
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay: false,
            isLooping: false,
            positionMillis: Math.max(0, startTimeRef.current * 1000),
            volume: volumePctToGain(musicVolumeRef.current, mutedRef.current),
            progressUpdateIntervalMillis: 250,
          },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        loadedRef.current = true;
        soundRef.current = sound;
        setBgReady(true);
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
        if (activeRef.current) await syncNativePlayback(true);
      } catch {
        if (!cancelled) triggerFallback();
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      void unloadNative();
      unloadWeb();
    };
  }, [
    audioUrl,
    shouldMount,
    unloadNative,
    unloadWeb,
    triggerFallback,
    applyWebVolume,
    syncWebPlayback,
    syncNativePlayback,
  ]);

  useEffect(() => {
    if (!bgReady || bgFailed) return;
    if (Platform.OS === 'web') {
      void syncWebPlayback(active);
      return;
    }
    void syncNativePlayback(active);
  }, [active, bgReady, bgFailed, syncWebPlayback, syncNativePlayback]);

  useEffect(() => {
    if (!bgReady || bgFailed) return;
    if (Platform.OS === 'web') {
      applyWebVolume();
      return;
    }
    void soundRef.current?.setVolumeAsync(volumePctToGain(musicVolumePct, muted));
  }, [musicVolumePct, muted, bgReady, bgFailed, applyWebVolume]);

  useEffect(() => {
    if (!bgReady || bgFailed) return;
    void resetToStart();
  }, [audioStartTime, bgReady, bgFailed, resetToStart]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') return;
      if (Platform.OS === 'web') {
        webAudioRef.current?.pause();
        return;
      }
      void soundRef.current?.pauseAsync();
    });
    return () => sub.remove();
  }, []);

  return {
    bgReady: bgReady && !bgFailed,
    bgFailed,
    resetToStart,
    pauseAll: useCallback(async () => {
      if (Platform.OS === 'web') {
        const el = webAudioRef.current;
        if (el) {
          el.pause();
          try { el.currentTime = 0; } catch { /* noop */ }
        }
        return;
      }
      const sound = soundRef.current;
      if (!sound) return;
      try {
        await sound.stopAsync();
      } catch {
        try { await sound.pauseAsync(); } catch { /* noop */ }
      }
    }, []),
  };
}
