// hooks/useLocation.ts
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { updateProfile } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function useLocation() {
  const { profile, updateProfile: updateStore } = useAuthStore();
  const [requesting, setRequesting] = useState(false);

  const requestAndSave = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      if (profile) {
        await updateProfile(profile.id, { lat, lng });
        updateStore({ lat, lng });
      }
      return true;
    } catch { return false; }
    finally { setRequesting(false); }
  };

  return { requesting, requestAndSave };
}
