// lib/bootGuards.ts — Startup timeout helpers so cold boot never hangs indefinitely

import { LogBox } from 'react-native';
import { withTimeout, TimeoutError } from './withTimeout';

/** Max wait before forcing the launch UI to dismiss and render the app (3s hard guard). */
export const BOOT_TIMEOUT_MS = 3000;

// Expected soft-boot fallbacks must not surface as yellow LogBox banners
LogBox.ignoreLogs(['[boot]', '[daily]']);

export async function withBootTimeout<T>(
  promise: PromiseLike<T> | Promise<T>,
  label = 'boot task',
): Promise<T> {
  return withTimeout(promise, BOOT_TIMEOUT_MS, label);
}

/** Race a task against the boot budget; return fallback on timeout/error. */
export async function softBoot<T>(
  promise: PromiseLike<T> | Promise<T>,
  fallback: T,
  label = 'boot task',
): Promise<T> {
  try {
    return await withBootTimeout(promise, label);
  } catch (error) {
    // Timeouts are intentional degradation — log quietly so Expo Go LogBox stays clean
    if (__DEV__) {
      const isTimeout = error instanceof TimeoutError
        || (error instanceof Error && /timed out/i.test(error.message));
      if (isTimeout) {
        console.log(`[boot] ${label} timed out after ${BOOT_TIMEOUT_MS}ms — using fallback.`);
      } else {
        console.log(`[boot] ${label} failed — using fallback.`, error);
      }
    }
    return fallback;
  }
}
