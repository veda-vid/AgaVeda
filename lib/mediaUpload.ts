// lib/mediaUpload.ts — Robust Android/iOS/Web URI → Supabase-ready bytes

import { Platform } from 'react-native';

type FileSystemModule = typeof import('expo-file-system');

function getFileSystem(): FileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as FileSystemModule;
  } catch {
    return null;
  }
}

/** Ensure Android absolute paths become file:// URIs. */
export function normalizeMediaUri(uri: string): string {
  if (!uri) return uri;
  if (Platform.OS === 'android' && uri.startsWith('/') && !uri.startsWith('file://')) {
    return `file://${uri}`;
  }
  return uri;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  let bufferLength = clean.length * 0.75;
  if (clean[len - 1] === '=') {
    bufferLength -= 1;
    if (clean[len - 2] === '=') bufferLength -= 1;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== 64 && enc3 !== -1) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== 64 && enc4 !== -1) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes.buffer;
}

/**
 * Preferred Android path: expo-file-system base64 → ArrayBuffer.
 * Avoids broken fetch()/blob() on content:// and many file:// URIs in Expo Go.
 */
async function readUriViaFileSystem(uri: string): Promise<ArrayBuffer> {
  const FileSystem = getFileSystem();
  if (!FileSystem?.readAsStringAsync) {
    throw new Error('FileSystem unavailable');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error('Media file is empty.');
  return base64ToArrayBuffer(base64);
}

function xhrBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = () => {
      const ok = xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300);
      if (!ok || !xhr.response) {
        reject(new Error(`Could not read media file (${xhr.status || 'blocked'}).`));
        return;
      }
      resolve(xhr.response as Blob);
    };
    xhr.onerror = () => reject(new Error('Could not read the selected media file.'));
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Could not encode media for upload.'));
    };
    reader.onerror = () => reject(new Error('Could not encode media for upload.'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Read a local or remote media URI into an ArrayBuffer for Supabase Storage.
 */
export async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (!uri) throw new Error('No media file selected.');
  const normalized = normalizeMediaUri(uri);

  // Remote / blob / data — fetch is reliable
  if (/^(https?:|blob:|data:)/i.test(normalized)) {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`Could not read media (${response.status}). Try again.`);
    }
    const blob = await response.blob();
    if (!blob || blob.size <= 0) throw new Error('Media file is empty.');
    return blobToArrayBuffer(blob);
  }

  // Native local files — FileSystem first (Android Expo Go)
  if (Platform.OS !== 'web') {
    try {
      return await readUriViaFileSystem(normalized);
    } catch {
      /* fall through */
    }
  }

  // XHR blob fallback
  try {
    const blob = await xhrBlob(normalized);
    if (blob && blob.size > 0) return blobToArrayBuffer(blob);
  } catch {
    /* fall through */
  }

  // Last resort: fetch(uri).blob() as requested by spec
  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`Could not read the selected media file (${response.status}).`);
    }
    const blob = await response.blob();
    if (!blob || blob.size <= 0) {
      throw new Error('Media file is empty. Please pick or record again.');
    }
    return blobToArrayBuffer(blob);
  } catch (e: any) {
    throw new Error(
      e?.message
      || (Platform.OS === 'android'
        ? 'Could not read this video on Android. Try recording again or pick a different clip.'
        : 'Could not read the selected media file. Try again.'),
    );
  }
}

/** @deprecated Prefer readUriAsArrayBuffer — kept for callers expecting Blob. */
export async function readUriAsBlob(uri: string): Promise<Blob> {
  const buffer = await readUriAsArrayBuffer(uri);
  return new Blob([buffer]);
}
