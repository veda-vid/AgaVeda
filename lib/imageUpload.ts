// lib/imageUpload.ts — Secure image upload to Supabase Storage
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type UploadTarget = 'avatar' | 'product' | 'shop-logo' | 'shop-cover' | 'ad';

/** Pick an image from library and upload to Supabase Storage.
 *  Returns the public URL or null on cancel/error. */
export async function pickAndUpload(
  userId: string,
  target: UploadTarget,
  options?: { aspect?: [number, number]; quality?: number }
): Promise<string | null> {
  // 1. Request permission
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;
  }

  // 2. Launch picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const ext   = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime  = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path  = `${userId}/${target}/${Date.now()}.${ext}`;

  // 3. Fetch file as blob (works on both native & web)
  const response = await fetch(asset.uri);
  const blob     = await response.blob();

  // 4. Upload to Supabase Storage bucket 'cityconnect'
  const { error } = await supabase.storage
    .from('cityconnect')
    .upload(path, blob, { contentType: mime, upsert: true });

  if (error) { console.error('Upload error:', error); return null; }

  // 5. Return public URL
  const { data } = supabase.storage.from('cityconnect').getPublicUrl(path);
  return data.publicUrl;
}

/** Take a photo with camera and upload */
export async function cameraAndUpload(
  userId: string,
  target: UploadTarget,
): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const path  = `${userId}/${target}/${Date.now()}.jpg`;

  const response = await fetch(asset.uri);
  const blob     = await response.blob();

  const { error } = await supabase.storage
    .from('cityconnect')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) return null;
  const { data } = supabase.storage.from('cityconnect').getPublicUrl(path);
  return data.publicUrl;
}
