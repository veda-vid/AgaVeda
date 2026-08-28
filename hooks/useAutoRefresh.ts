import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

/**
 * Polls `refetch` on a fixed interval while the screen is focused.
 * Use for background data + time-sensitive UI updates (shop hours, ratings, etc.).
 */
export function useAutoRefresh(
  refetch: () => void | Promise<void>,
  intervalMs = 60_000,
) {
  const isFocused = useIsFocused();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!isFocused) return undefined;
    const tick = () => { void refetchRef.current(); };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [isFocused, intervalMs]);
}
