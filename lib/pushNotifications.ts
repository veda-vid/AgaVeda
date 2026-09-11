// lib/pushNotifications.ts — Local and Expo push helpers for checkout

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendLocalNotification({ title, body, data }: PushPayload) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: null,
    });
  } catch {
    // Non-fatal — in-app confirmation still shown
  }
}

export async function sendExpoPushToToken(token: string, payload: PushPayload) {
  if (!token?.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        priority: 'high',
      }),
    });
  } catch {
    // Push delivery is best-effort
  }
}

export async function notifySellerOrderPush(ownerId: string, payload: PushPayload) {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', ownerId)
    .maybeSingle();

  const token = (data as { push_token?: string | null } | null)?.push_token;
  if (token) await sendExpoPushToToken(token, payload);
}
