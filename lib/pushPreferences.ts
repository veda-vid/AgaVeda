// lib/pushPreferences.ts — Register Expo push tokens and sync profile preference

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { upsertProfile } from './api';

export async function registerPushTokenForUser(userId: string): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CityConnect',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5722',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await upsertProfile({ id: userId, push_token: token, push_enabled: true } as never);
  return token;
}

export async function syncPushPreference(userId: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await registerPushTokenForUser(userId);
    await supabase.from('profiles').update({ push_enabled: true, updated_at: new Date().toISOString() }).eq('id', userId);
    return;
  }

  await supabase
    .from('profiles')
    .update({ push_enabled: false, updated_at: new Date().toISOString() })
    .eq('id', userId);
}
