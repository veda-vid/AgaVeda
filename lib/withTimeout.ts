// lib/withTimeout.ts — Prevent hung network calls from freezing screens

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/** Accepts Promise or thenable (Supabase query builders) */
export async function withTimeout<T>(
  promise: PromiseLike<T> | Promise<T>,
  ms = 8000,
  label = 'request',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Swallow errors and return a fallback — keeps UI responsive when RPCs are missing */
export async function softFail<T>(promise: PromiseLike<T> | Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}
