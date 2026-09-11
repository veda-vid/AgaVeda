// scripts/media-upload-smoke.mjs — Offline checks for Android URI helpers
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'lib/mediaUpload.ts'), 'utf8');

assert.match(src, /normalizeMediaUri/, 'normalizeMediaUri exported');
assert.match(src, /readUriAsArrayBuffer/, 'readUriAsArrayBuffer exported');
assert.match(src, /expo-file-system/, 'uses expo-file-system for Android');
assert.match(src, /fetch\(normalized\)/, 'keeps fetch\(uri\).blob fallback');
assert.match(src, /xhr\.responseType = 'blob'/, 'XHR blob fallback present');

const api = readFileSync(join(root, 'lib/api.ts'), 'utf8');
assert.match(api, /SPARKS_MEDIA_BUCKET/, 'sparks_media bucket constant');
assert.match(api, /uploadSparkMediaFromUri/, 'spark upload helper');

const bar = readFileSync(join(root, 'components/common/UploadProgressBar.tsx'), 'utf8');
assert.match(bar, /Posting Moment/, 'progress copy present');
assert.match(bar, /Moment Published Successfully/, 'success copy present');

const store = readFileSync(join(root, 'stores/uploadProgressStore.ts'), 'utf8');
assert.match(store, /startJob/, 'upload store startJob');
assert.match(store, /setProgress/, 'upload store setProgress');

console.log('media-upload-smoke: ok');
