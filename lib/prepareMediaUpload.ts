// lib/prepareMediaUpload.ts — Auto-resize/compress media before Moments/Story upload

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { normalizeMediaUri } from './mediaUpload';
import { agentDebugLog } from './agentDebugLog';

/** Stay under Supabase Free hard-cap (~50MB) with headroom. */
export const UPLOAD_SOFT_LIMIT_BYTES = 42 * 1024 * 1024;
export const UPLOAD_HARD_LIMIT_BYTES = 48 * 1024 * 1024;

type FileSystemModule = typeof import('expo-file-system');

function getFileSystem(): FileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as FileSystemModule;
  } catch {
    return null;
  }
}

export async function getUriByteSize(uri: string): Promise<number | null> {
  if (!uri) return null;
  const normalized = normalizeMediaUri(uri);

  if (/^(https?:|blob:|data:)/i.test(normalized) && typeof fetch === 'function') {
    try {
      const res = await fetch(normalized, { method: 'HEAD' });
      const len = res.headers.get('content-length');
      if (len) return Number(len) || null;
    } catch { /* ignore */ }
  }

  const FileSystem = getFileSystem();
  if (!FileSystem?.getInfoAsync) return null;
  try {
    const info = await FileSystem.getInfoAsync(normalized, { size: true } as any);
    if (info?.exists && typeof (info as any).size === 'number') {
      return (info as any).size as number;
    }
  } catch { /* ignore */ }
  return null;
}

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export type PrepareMediaResult = {
  uri: string;
  compressed: boolean;
  originalBytes: number | null;
  finalBytes: number | null;
  mimeHint?: string | null;
};

async function optimizeViaWebView(
  uri: string,
  onProgress?: (pct: number) => void,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { optimizeVideoForUpload } = await import('../components/media/VideoOptimizeHost');
    return await optimizeVideoForUpload(uri, onProgress);
  } catch (e: any) {
    agentDebugLog({
      hypothesisId: 'H-size',
      location: 'prepareMediaUpload.ts:webviewError',
      message: 'WebView optimize failed',
      data: { errorMessage: e?.message ?? String(e) },
      runId: 'publish-debug',
    });
    return null;
  }
}

/**
 * Automatically shrink Moments/Story media so upload stays under storage caps.
 * Never throws for size — always returns best available URI.
 */
export async function prepareMediaForUpload(
  uri: string,
  type: 'image' | 'video',
  options?: {
    onProgress?: (pct: number, label: string) => void;
    targetBytes?: number;
  },
): Promise<PrepareMediaResult> {
  const target = options?.targetBytes ?? UPLOAD_SOFT_LIMIT_BYTES;
  const report = (pct: number, label: string) => {
    try { options?.onProgress?.(pct, label); } catch { /* ignore */ }
  };

  const originalBytes = await getUriByteSize(uri);
  report(5, 'Checking media size…');

  agentDebugLog({
    hypothesisId: 'H-size',
    location: 'prepareMediaUpload.ts:start',
    message: 'Preparing media for upload',
    data: {
      type,
      platform: Platform.OS,
      originalBytes,
      target,
      uriScheme: String(uri || '').split(':')[0] || null,
    },
    runId: 'publish-debug',
  });

  if (type === 'image') {
    report(20, 'Optimizing photo…');
    try {
      let next = await compressImage(uri);
      let size = await getUriByteSize(next);
      if (size != null && size > target) {
        const tighter = await ImageManipulator.manipulateAsync(
          next,
          [{ resize: { width: 960 } }],
          { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
        );
        next = tighter.uri;
        size = await getUriByteSize(next);
      }
      report(90, 'Photo ready');
      return {
        uri: next,
        compressed: next !== uri,
        originalBytes,
        finalBytes: size,
        mimeHint: 'image/jpeg',
      };
    } catch {
      return { uri, compressed: false, originalBytes, finalBytes: originalBytes };
    }
  }

  // Video already small enough — keep original MP4/MOV (always playable natively).
  if (originalBytes != null && originalBytes <= target) {
    report(100, 'Video already optimized');
    return { uri, compressed: false, originalBytes, finalBytes: originalBytes };
  }

  // Expo Go–safe path: WebView MediaRecorder re-encode (no native compressor).
  report(20, 'Optimizing video for upload…');
  const webOut = await optimizeViaWebView(uri, (pct) => {
    report(20 + Math.round(pct * 70), `Optimizing… ${Math.round(pct * 100)}%`);
  });

  if (webOut) {
    const size = await getUriByteSize(webOut);
    const isMp4 = /\.mp4$/i.test(webOut);
    const isWebm = /\.webm$/i.test(webOut);

    // Prefer keeping the original camera MP4 when WebView only produced WebM
    // AND the original still fits under the hard storage cap — native play is more reliable.
    if (
      isWebm
      && !isMp4
      && originalBytes != null
      && originalBytes <= UPLOAD_HARD_LIMIT_BYTES
    ) {
      agentDebugLog({
        hypothesisId: 'H-size',
        location: 'prepareMediaUpload.ts:keepOriginalMp4',
        message: 'Skipping WebM optimize — original fits and stays natively playable',
        data: { size, originalBytes },
        runId: 'publish-debug',
      });
      report(100, 'Video ready');
      return {
        uri,
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
        mimeHint: 'video/mp4',
      };
    }

    agentDebugLog({
      hypothesisId: 'H-size',
      location: 'prepareMediaUpload.ts:webviewDone',
      message: 'WebView optimize finished',
      data: { size, originalBytes, isWebm, isMp4 },
      runId: 'publish-debug',
    });
    report(100, 'Video ready');
    return {
      uri: webOut,
      compressed: true,
      originalBytes,
      finalBytes: size,
      mimeHint: isMp4 ? 'video/mp4' : 'video/webm',
    };
  }

  agentDebugLog({
    hypothesisId: 'H-size',
    location: 'prepareMediaUpload.ts:noCompressor',
    message: 'WebView optimize unavailable — will attempt original upload',
    data: { originalBytes, platform: Platform.OS },
    runId: 'publish-debug',
  });
  report(100, 'Video ready');
  return {
    uri,
    compressed: false,
    originalBytes,
    finalBytes: originalBytes,
  };
}

/** True when storage rejected the object for size. */
export function isUploadSizeError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  const code = String((error as any)?.statusCode || (error as any)?.code || '');
  return /exceeded the maximum allowed size|Payload too large|entity too large|413|file.?size|too large/i.test(
    `${msg} ${code}`,
  );
}
