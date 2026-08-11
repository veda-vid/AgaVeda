// hooks/useNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export function useNotifications() {
  const { profile } = useAuthStore();
  const notifListener  = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!profile) return;
    registerForPushNotifications(profile.id);

    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Handle navigation based on notification type
      console.log('Notification tapped:', data);
    });

    return () => {
      Notifications.removeNotificationSubscription(notifListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [profile?.id]);
}

async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return; // skip on emulator

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Vedastya',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5722',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Save push token to Supabase for server-side delivery
  await supabase
    .from('profiles')
    .update({ push_token: token } as any)
    .eq('id', userId);
}
