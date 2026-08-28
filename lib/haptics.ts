import { Platform, Vibration } from 'react-native';

/** Light tactile feedback for outreach actions (no extra dependency). */
export function hapticLight() {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(10);
  } catch {
    // ignore
  }
}

export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate([0, 12, 40, 12]);
  } catch {
    // ignore
  }
}
