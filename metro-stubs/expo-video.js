/**
 * metro-stubs/expo-video.js
 * expo-video / ExpoVideo is NOT available in Expo Go (SDK 51).
 * Any accidental import resolves here instead of crashing the native runtime.
 */
const React = require('react');
const { View } = require('react-native');

function warnOnce() {
  if (warnOnce.done) return;
  warnOnce.done = true;
  console.warn(
    '[video] expo-video is not supported in Expo Go. Use components/media/SafeVideoPlayer.tsx (expo-av) instead.',
  );
}

function VideoView() {
  warnOnce();
  return React.createElement(View, { style: { flex: 1, backgroundColor: '#000' } });
}

function useVideoPlayer() {
  warnOnce();
  return null;
}

module.exports = {
  VideoView,
  useVideoPlayer,
  VideoPlayer: null,
};
