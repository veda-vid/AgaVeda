// lib/portfolioImage.ts — Client-side portfolio image compression before upload

import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.7;

export async function compressPortfolioImage(uri: string): Promise<{ uri: string; mime: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, mime: 'image/jpeg' };
}
