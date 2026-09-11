// scripts/moments-publish-smoke.mjs — Static checks for Moments share wiring
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const review = read('components/sparks/PublishReviewSheet.tsx');
assert.match(review, /handleShare/, 'Share handler present');
assert.match(review, /Share Moment button pressed/, 'Share press logged');
assert.match(review, /TouchableOpacity/, 'uses TouchableOpacity (not SpringPressable)');
assert.match(review, /Sticky Share/, 'sticky share button outside scroll');
assert.match(review, /Keyboard\.dismiss/, 'dismisses keyboard before share');
assert.match(review, /alsoShareToStory/, 'story toggle wired');
assert.doesNotMatch(review, /SpringPressable/, 'SpringPressable removed from share CTA');

const modal = read('components/sparks/UploadSparkModal.tsx');
assert.match(modal, /also_share_to_story/, 'payload includes story flag');
assert.match(modal, /setSharing\(true\)/, 'sharing lock on publish');
assert.match(modal, /onPublish=\{publish\}/, 'review sheet publishes');
assert.match(modal, /posting=\{sharing\}/, 'passes sharing state to sheet');

const home = read('app/(tabs)/index.tsx');
assert.match(home, /onPublish=\{submitSpark\}/, 'home wires submitSpark');
assert.match(home, /createReel\(/, 'createReel called');
assert.match(home, /also_share_to_story/, 'story cross-post handled');
assert.match(home, /createStory\(/, 'createStory for story toggle');
assert.match(home, /uploadSparkMediaFromUri/, 'spark media upload');

const editor = read('components/sparks/SparkEditor.tsx');
assert.match(editor, /FeedVideo/, 'editor latches music via FeedVideo');
assert.match(editor, /backgroundAudioUrl/, 'background audio wired');
assert.match(editor, />Next</, 'Continue renamed to Next');

console.log('moments-publish-smoke: ok');

const prep = read('lib/prepareMediaUpload.ts');
assert.match(prep, /prepareMediaForUpload/, 'prepareMediaForUpload export');
assert.match(prep, /UPLOAD_SOFT_LIMIT_BYTES/, 'soft limit');
assert.match(prep, /react-native-compressor/, 'uses compressor');
assert.match(prep, /compressImage|ImageManipulator/, 'image path');

const api2 = read('lib/api.ts');
assert.match(api2, /prepareMediaForUpload/, 'uploadSpark prepares media');
assert.match(api2, /Optimizing media/, 'optimize progress label');

const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.dependencies['react-native-compressor'], 'compressor dependency');

const appJson = JSON.parse(read('app.json'));
assert.ok(appJson.expo.plugins.includes('react-native-compressor') || appJson.expo.plugins.some(p => p === 'react-native-compressor' || (Array.isArray(p) && p[0] === 'react-native-compressor')), 'compressor plugin');

console.log('moments-size-smoke: ok');
