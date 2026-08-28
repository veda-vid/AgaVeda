import { useCallback, useEffect, useRef } from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePullToRefresh } from './usePullToRefresh';

const DEBUG_ENDPOINT = 'http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430';
const SESSION_ID = '9be6ad';

function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'refresh-debug',
) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      runId,
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {});
  // #endregion
}

export type ScreenRefreshOptions = {
  /** Polling interval while focused (default 60s). */
  intervalMs?: number;
  /** Disable auto-refresh entirely. */
  autoRefresh?: boolean;
};

/**
 * Unified pull-to-refresh + 60s auto-refresh for tab screens.
 * Includes web wheel/touch pull fallback when RefreshControl is inactive.
 */
export function useScreenRefresh(
  refetch: () => void | Promise<void>,
  options: ScreenRefreshOptions = {},
) {
  const { intervalMs = 60_000, autoRefresh = true } = options;
  const isFocused = useIsFocused();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const scrollYRef = useRef(0);
  const pullStartYRef = useRef(0);
  const lastWebPullRef = useRef(0);

  const { refreshing, onRefresh, refreshControl } = usePullToRefresh(refetch);

  // Auto-refresh: run once when focused, then on interval (silent — no spinner).
  useEffect(() => {
    if (!autoRefresh || !isFocused) return undefined;

    const tick = (source: 'focus' | 'interval') => {
      debugLog('useScreenRefresh.ts:auto', 'auto refresh fired', { source, isFocused }, 'H2');
      void refetchRef.current();
    };

    tick('focus');
    const id = setInterval(() => tick('interval'), intervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, isFocused, intervalMs]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  // Web: wheel overscroll + touch pull when scroll position is at top.
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const atTop = () => {
      const windowTop = (document.scrollingElement?.scrollTop ?? window.scrollY) <= 8;
      return windowTop || scrollYRef.current <= 5;
    };

    const triggerWebPull = (source: 'wheel' | 'touch') => {
      const now = Date.now();
      if (refreshing || now - lastWebPullRef.current < 1500) return;
      lastWebPullRef.current = now;
      debugLog(
        'useScreenRefresh.ts:webPull',
        'web pull refresh triggered',
        { source, scrollY: scrollYRef.current },
        'H1',
      );
      void onRefresh();
    };

    const onWheel = (event: WheelEvent) => {
      if (!atTop() || event.deltaY >= -60) return;
      triggerWebPull('wheel');
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!atTop()) return;
      pullStartYRef.current = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (refreshing) return;
      const dy = (event.touches[0]?.clientY ?? 0) - pullStartYRef.current;
      if (dy > 72 && atTop()) triggerWebPull('touch');
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [isFocused, onRefresh, refreshing]);

  useEffect(() => {
    debugLog('useScreenRefresh.ts:focus', 'screen focus state', { isFocused, autoRefresh }, 'H3');
  }, [isFocused, autoRefresh]);

  return {
    refreshing,
    onRefresh,
    refreshControl,
    scrollHandlers: { onScroll, scrollEventThrottle: 16 as const },
  };
}
