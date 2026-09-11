// lib/haptics.ts — Light haptic feedback (native) with web no-op

import { Platform } from 'react-native';

export async function hapticLight() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Optional — Expo Go / emulator may lack haptic hardware
  }
}

export async function hapticSuccess() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Optional — ignore on unsupported devices
  }
}
