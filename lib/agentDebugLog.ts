// Debug-session NDJSON ingest helper (Expo Go–safe host resolution + offline buffer)

import { AppState, LogBox, NativeModules, Platform } from 'react-native';
import { platformStorage } from './platformStorage';

const SESSION = '0812e6';
const INGEST_PATH = '/ingest/9f87a31d-926e-4ca8-ab20-bba1a00c7458';
const PORTS = [7579, 7580];
const BUFFER_KEY = 'dbg0812e6_buffer';
const MAX_BUFFER = 80;

LogBox.ignoreLogs(['DBG0812e6']);

type AgentDebugPayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
};

type DebugEntry = {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

const memoryBuffer: DebugEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let appStateHooked = false;

function resolveDebugHosts(): string[] {
  const hosts = new Set<string>();
  try {
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    const m = scriptURL?.match(/https?:\/\/([^/:]+)/);
    if (m?.[1]) hosts.add(m[1]);
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost ||
      Constants?.linkingUri;
    if (typeof hostUri === 'string' && hostUri.length) {
      const cleaned = hostUri.replace(/^[a-z]+:\/\//i, '').split('/')[0];
      const host = cleaned.split(':')[0];
      if (host) hosts.add(host);
    }
  } catch {
    /* ignore */
  }
  hosts.add('127.0.0.1');
  if (Platform.OS === 'android') hosts.add('10.0.2.2');
  return Array.from(hosts);
}

function postEntry(entry: DebugEntry): void {
  const body = JSON.stringify(entry);
  const headers = {
    'Content-Type': 'application/json',
    'X-Debug-Session-Id': SESSION,
  };
  for (const host of resolveDebugHosts()) {
    for (const port of PORTS) {
      fetch(`http://${host}:${port}${INGEST_PATH}`, { method: 'POST', headers, body }).catch(() => {});
    }
  }
}

async function persistBuffer(): Promise<void> {
  try {
    await platformStorage.setItem(BUFFER_KEY, JSON.stringify(memoryBuffer.slice(-MAX_BUFFER)));
  } catch {
    /* ignore */
  }
}

/** Awaitable persist — call before launching native pickers that background the app. */
export async function persistAgentDebugLogs(): Promise<void> {
  await persistBuffer();
}

/** Flush buffered debug events (call on AppState active / after gallery). */
export async function flushAgentDebugLogs(): Promise<void> {
  try {
    const raw = await platformStorage.getItem(BUFFER_KEY);
    const stored: DebugEntry[] = raw ? JSON.parse(raw) : [];
    const merged = [...stored, ...memoryBuffer];
    const unique = merged.slice(-MAX_BUFFER);
    for (const entry of unique) postEntry(entry);
    memoryBuffer.length = 0;
    await platformStorage.removeItem(BUFFER_KEY);
  } catch {
    for (const entry of memoryBuffer) postEntry(entry);
    memoryBuffer.length = 0;
  }
}

export function ensureAgentDebugFlushHook(): void {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', state => {
    if (state === 'active') void flushAgentDebugLogs();
  });
  void flushAgentDebugLogs();
}

/** Fire-and-forget debug ingest for session 17e086. Buffers while picker backgrounds the app. */
export function agentDebugLog(payload: AgentDebugPayload): void {
  ensureAgentDebugFlushHook();
  const entry: DebugEntry = {
    sessionId: SESSION,
    runId: payload.runId ?? 'spark-debug',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: {
      ...(payload.data ?? {}),
      platform: Platform.OS,
    },
    timestamp: Date.now(),
  };
  memoryBuffer.push(entry);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.shift();
  void persistBuffer();
  if (__DEV__) console.log(`DBG0812e6 ${JSON.stringify(entry)}`);
  postEntry(entry);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushAgentDebugLogs();
  }, 800);
}
