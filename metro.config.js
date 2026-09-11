const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const mapsStub = path.resolve(__dirname, 'metro-stubs/react-native-maps.web.js');
const expoVideoStub = path.resolve(__dirname, 'metro-stubs/expo-video.js');

const defaultResolveRequest = config.resolver.resolveRequest;

// Keep Metro from crawling debug logs / agent dumps (common cause of hangs near 95%).
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const exclusionList = require('metro-config/src/defaults/exclusionList');
  config.resolver.blockList = exclusionList([
    /\/\.cursor\/.*/,
    /.*\.log$/,
  ]);
} catch {
  config.resolver.blockList = [/\/\.cursor\/.*/, /.*\.log$/];
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    if (moduleName === 'expo-video') {
      return { type: 'sourceFile', filePath: expoVideoStub };
    }
    if (platform === 'web' && moduleName === 'react-native-maps') {
      return { type: 'sourceFile', filePath: mapsStub };
    }
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    console.warn('[metro] resolveRequest failed for', moduleName, error);
    throw error;
  }
};

module.exports = config;
