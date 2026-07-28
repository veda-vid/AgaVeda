// app/(auth)/location.tsx — First-login location setup → Explore Now enters app
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StyleSheet, Platform, Pressable, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { getCurrentUser, getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { upsertProfile } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Colors, RADIUS_OPTIONS } from '../../constants/theme';
import { POPULAR_CITIES, matchCity, staticMapUrl, type CityOption } from '../../constants/cities';
import type { UserRole, Profile } from '../../types';

function notify(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function LocationScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const updateLocal = useAuthStore(s => s.updateProfile);
  const setStore = useAuthStore.setState;
  const profile = useAuthStore(s => s.profile);

  const [name, setName] = useState(profile?.name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [radius, setRadius] = useState(profile?.radius_km || 5);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile?.lat != null && profile?.lng != null
      ? { lat: profile.lat, lng: profile.lng }
      : null,
  );
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const didAutoDetect = useRef(false);
  const [autoDetected, setAutoDetected] = useState(false);

  const resolveCityName = async (latitude: number, longitude: number) => {
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      return geo?.city || geo?.subregion || geo?.region || 'Current Location';
    } catch {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'CityConnect/1.0' }, signal: controller.signal },
        );
        clearTimeout(t);
        const data = await response.json();
        return data?.address?.city || data?.address?.town || data?.address?.suburb || data?.address?.village || 'Current Location';
      } catch {
        return 'Current Location';
      }
    }
  };

  const applyCoords = async (latitude: number, longitude: number, preferredName?: string) => {
    setCoords({ lat: latitude, lng: longitude });
    const matched = matchCity(preferredName ?? '', latitude, longitude);
    if (matched) {
      setSelectedCity(matched);
      setCity(matched.name);
      return;
    }
    if (preferredName) {
      setCity(preferredName);
      setSelectedCity(null);
      return;
    }
    const detected = await resolveCityName(latitude, longitude);
    const matchedAfter = matchCity(detected, latitude, longitude);
    if (matchedAfter) {
      setSelectedCity(matchedAfter);
      setCity(matchedAfter.name);
    } else {
      setCity(detected);
      setSelectedCity(null);
    }
  };

  const selectPopularCity = (c: CityOption) => {
    setSelectedCity(c);
    setCity(c.name);
    setCoords({ lat: c.lat, lng: c.lng });
    setManualMode(false);
    setAutoDetected(true);
  };

  const detectLocation = async () => {
    setLocLoading(true);
    try {
      let latitude: number;
      let longitude: number;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, maximumAge: 60000 }),
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          selectPopularCity(POPULAR_CITIES[2]); // Chandigarh
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }

      await applyCoords(latitude, longitude);
      setManualMode(false);
      setAutoDetected(true);
    } catch {
      selectPopularCity(POPULAR_CITIES[0]); // Mumbai fallback
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    if (didAutoDetect.current) return;
    didAutoDetect.current = true;
    if (!coords) detectLocation();
    else setAutoDetected(true);
  }, []);

  useEffect(() => {
    if (profile?.name && !name) setName(profile.name);
    if (profile?.city && !city) setCity(profile.city);
  }, [profile?.id]);

  useEffect(() => {
    if (!coords) return;
    const t = setTimeout(() => setMapReady(true), 300);
    return () => clearTimeout(t);
  }, [coords?.lat, coords?.lng]);

  const onManualCityChange = (text: string) => {
    setCity(text);
    setManualMode(true);
    const matched = matchCity(text);
    if (matched) {
      setSelectedCity(matched);
      setCoords({ lat: matched.lat, lng: matched.lng });
    } else {
      setSelectedCity(null);
    }
  };

  const enterApp = (nextProfile: Partial<Profile> & { id: string }) => {
    const now = new Date().toISOString();
    const merged: Profile = {
      id: nextProfile.id,
      name: nextProfile.name ?? '',
      phone: nextProfile.phone ?? null,
      email: nextProfile.email ?? null,
      avatar_url: nextProfile.avatar_url ?? null,
      role: (nextProfile.role as UserRole) ?? 'buyer',
      city: nextProfile.city ?? '',
      lat: nextProfile.lat ?? null,
      lng: nextProfile.lng ?? null,
      radius_km: nextProfile.radius_km ?? 5,
      is_verified: nextProfile.is_verified ?? false,
      created_at: nextProfile.created_at ?? now,
      updated_at: now,
    };

    // Ensure AuthGuard sees a complete profile immediately
    setStore({ profile: merged, isInitialized: true });
    updateLocal(merged);
    router.replace('/(tabs)' as any);
  };

  const finish = async () => {
    const safeName = name.trim() || profile?.name?.trim() || 'CityConnect User';
    let safeCity = city.trim();
    let safeCoords = coords;

    if (!safeCoords || !safeCity) {
      const fallback = selectedCity ?? POPULAR_CITIES[0];
      safeCity = safeCity || fallback.name;
      safeCoords = safeCoords ?? { lat: fallback.lat, lng: fallback.lng };
      setCity(safeCity);
      setCoords(safeCoords);
      setSelectedCity(fallback);
    }

    if (!safeName) {
      notify('Required', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      let user = await getCurrentUser();

      if (!user && !isDemoAuthEnabled()) {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        user = sessionData.session?.user ?? null;
        if (!user) {
          const { data: userData } = await supabase.auth.getUser();
          user = userData.user;
        }
      }

      if (!user) {
        notify('Please sign in first', 'Your session is missing. Sign in again to continue.');
        router.replace({ pathname: '/(auth)/login', params: { role: role || 'buyer' } } as any);
        return;
      }

      const selectedRole = (role as UserRole) || profile?.role || (user.user_metadata?.role as UserRole) || 'buyer';
      const payload = {
        id: user.id,
        name: safeName,
        city: safeCity,
        role: selectedRole,
        radius_km: radius,
        lat: safeCoords!.lat,
        lng: safeCoords!.lng,
        email: user.email ?? profile?.email ?? null,
        phone: user.phone ?? profile?.phone ?? null,
      };

      try {
        await upsertProfile(payload);
        await refreshProfile().catch(() => {});
      } catch (dbErr: any) {
        // Still enter the app with local profile so onboarding is never blocked
        console.warn('Profile save failed, continuing with local profile', dbErr?.message);
      }

      enterApp(payload);
    } catch (e: any) {
      notify('Error', e?.message || 'Could not continue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const mapUri = coords && mapReady ? staticMapUrl(coords.lat, coords.lng) : null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.icon}>📍</Text>
      <Text style={s.title}>Set Your Area</Text>
      <Text style={s.sub}>
        We auto-detect your city and set a 5 km discovery range. Adjust it anytime with quick chips, map preview, or manual entry.
      </Text>

      <View style={s.statusCard}>
        <Text style={s.statusEyebrow}>Location Status</Text>
        <Text style={s.statusTitle}>
          {autoDetected ? 'Location detected successfully' : locLoading ? 'Finding your city…' : 'Ready to personalize your feed'}
        </Text>
        <Text style={s.statusText}>
          {autoDetected
            ? `Your feed will open around ${city || 'your area'} with ${radius} km as the selected range.`
            : 'Choose a city below or type manually if GPS is unavailable.'}
        </Text>
      </View>

      <Text style={s.fieldLabel}>YOUR NAME</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputIcon}>👤</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={Colors.dim}
        />
      </View>

      <Text style={s.fieldLabel}>YOUR CITY</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputIcon}>🏙️</Text>
        <TextInput
          style={s.input}
          value={city}
          onChangeText={onManualCityChange}
          placeholder="e.g. Chandigarh, Mumbai, Pune"
          placeholderTextColor={Colors.dim}
        />
        <Pressable onPress={detectLocation} disabled={locLoading} accessibilityRole="button">
          {locLoading
            ? <ActivityIndicator color={Colors.orange} size="small" />
            : <Text style={s.detectBtn}>Auto</Text>}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cityScroll} contentContainerStyle={s.cityRow}>
        {POPULAR_CITIES.map(c => {
          const active = selectedCity?.name === c.name || city.toLowerCase() === c.name.toLowerCase();
          return (
            <TouchableOpacity
              key={c.name}
              onPress={() => selectPopularCity(c)}
              style={[s.cityChip, active && s.cityChipActive]}
            >
              <Text style={[s.cityChipText, active && s.cityChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={s.fieldLabel}>MAP PREVIEW</Text>
      <View style={s.mapWrap}>
        {mapUri ? (
          <Image source={{ uri: mapUri }} style={s.mapImage} resizeMode="cover" />
        ) : (
          <View style={s.mapPlaceholder}>
            <Text style={s.mapPlaceholderEmoji}>🗺️</Text>
            <Text style={s.mapPlaceholderText}>
              {locLoading ? 'Detecting your location…' : 'Tap Auto or pick a city to see the map'}
            </Text>
          </View>
        )}
        {coords && (
          <View style={s.mapBadge}>
            <Text style={s.mapBadgeText}>
              📌 {city || 'Pinned'} · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              {manualMode ? ' · manual' : ''}
            </Text>
          </View>
        )}
      </View>

      <Text style={s.fieldLabel}>DISCOVERY RADIUS</Text>
      <View style={s.radiusRow}>
        {RADIUS_OPTIONS.map(r => (
          <TouchableOpacity
            key={r}
            onPress={() => setRadius(r)}
            style={[s.radiusBtn, radius === r && s.radiusActive]}
          >
            <Text style={[s.radiusText, radius === r && s.radiusTextActive]}>{r} km</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>Default is 5 km so nearby shops, feeds and services feel instantly local.</Text>

      <TouchableOpacity
        onPress={finish}
        style={[s.btn, loading && { opacity: 0.7 }]}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Explore Now</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  icon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.sub, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  statusCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 18, padding: 16, marginBottom: 24 },
  statusEyebrow: { color: Colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  statusTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statusText: { color: Colors.sub, fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12,
  },
  inputIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, color: Colors.text, fontSize: 16, paddingVertical: 13 },
  detectBtn: { color: Colors.orange, fontWeight: '700', fontSize: 13 },
  cityScroll: { marginBottom: 20 },
  cityRow: { gap: 8, paddingRight: 8 },
  cityChip: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  cityChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  cityChipText: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  cityChipTextActive: { color: Colors.white },
  mapWrap: {
    height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, position: 'relative',
  },
  mapImage: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  mapPlaceholderEmoji: { fontSize: 40 },
  mapPlaceholderText: { color: Colors.sub, fontSize: 13, textAlign: 'center' },
  mapBadge: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: '#000C', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  mapBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  radiusBtn: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  radiusActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusText: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  radiusTextActive: { color: Colors.white },
  hint: { fontSize: 12, color: Colors.dim, marginBottom: 28 },
  btn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
