// scripts/boot-guard-smoke.mjs — Simulates offline / slow / normal boot paths

import assert from 'node:assert/strict';

const BOOT_TIMEOUT_MS = 3000;

class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

async function withTimeout(promise, ms, label = 'request') {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function softBoot(promise, fallback, label = 'boot task') {
  try {
    return await withTimeout(promise, BOOT_TIMEOUT_MS, label);
  } catch {
    return fallback;
  }
}

async function scenarioNormal() {
  const result = await softBoot(Promise.resolve({ city: 'Delhi' }), { city: 'cached' }, 'normal');
  assert.equal(result.city, 'Delhi');
  console.log('✓ Normal network — resolves with live data');
}

async function scenarioOffline() {
  const result = await softBoot(
    Promise.reject(new Error('Network request failed')),
    { city: 'cached-city' },
    'offline',
  );
  assert.equal(result.city, 'cached-city');
  console.log('✓ Offline — falls back to cached state instantly');
}

async function scenarioSlow() {
  const started = Date.now();
  const result = await softBoot(
    new Promise(resolve => setTimeout(() => resolve({ city: 'late' }), 8000)),
    { city: 'timeout-fallback' },
    'slow',
  );
  const elapsed = Date.now() - started;
  assert.equal(result.city, 'timeout-fallback');
  assert.ok(elapsed < BOOT_TIMEOUT_MS + 800, `expected ~${BOOT_TIMEOUT_MS}ms guard, got ${elapsed}ms`);
  console.log(`✓ Slow network — hard timeout unblocked UI in ${elapsed}ms`);
}

await scenarioNormal();
await scenarioOffline();
await scenarioSlow();
console.log('All boot-guard scenarios passed.');
