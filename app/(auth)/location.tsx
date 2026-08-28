// app/(auth)/location.tsx — Streamlined location onboarding with auto-detect + search

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { getCurrentUser, getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { upsertProfile } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { POPULAR_CITIES, staticMapUrl, type CityOption } from '../../constants/cities';
import {
  reverseGeocodeLocation,
  searchLocations,
  type LocationSuggestion,
} from '../../lib/locationSearch';
import type { UserRole, Profile } from '../../types';

const ONBOARDING_RADIUS_OPTIONS = [2, 5, 10, 25] as const;

const SLATE_900 = '#0F172A';
const SLATE_800 = '#1E293B';
const SLATE_700 = '#334155';
const SLATE_100 = '#F1F5F9';

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
  const updateLocal = useAuthStore(s => s.applyLocationSetup);
  const setStore = useAuthStore.setState;
  const profile = useAuthStore(s => s.profile);

  const [name, setName] = useState(profile?.name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [radius, setRadius] = useState<number>(profile?.radius_km ?? 5);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile?.lat != null && profile?.lng != null
      ? { lat: profile.lat, lng: profile.lng }
      : null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const selectedRole = ((role as UserRole) || profile?.role || 'buyer') as UserRole;
  const locationReady = Boolean(city.trim() && coords);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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

  const applySuggestion = useCallback((item: LocationSuggestion) => {
    const cityName = item.city ?? item.label.split(',')[0]?.trim() ?? item.label;
    setCity(cityName);
    setCoords({ lat: item.lat, lng: item.lon });
    setSearchQuery(item.label);
    setSuggestions([]);
    setHint(null);
    setMapReady(false);
  }, []);

  const applyPopularCity = useCallback((option: CityOption) => {
    setCity(option.name);
    setCoords({ lat: option.lat, lng: option.lng });
    setSearchQuery(`${option.name}${option.state ? `, ${option.state}` : ''}, India`);
    setSuggestions([]);
    setHint(null);
    setMapReady(false);
  }, []);

  const detectLocation = async () => {
    setDetecting(true);
    setHint(null);
    try {
      let latitude: number;
      let longitude: number;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 60000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setHint('Location permission denied. Search for your city below or pick a popular city.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }

      const result = await reverseGeocodeLocation(latitude, longitude);
      if (!mountedRef.current) return;

      if (result) {
        applySuggestion(result);
      } else {
        setCoords({ lat: latitude, lng: longitude });
        setCity('Current Location');
        setSearchQuery('Current Location');
      }
    } catch {
      if (mountedRef.current) {
        setHint('Could not detect location. Search for your city or pick a popular city below.');
      }
    } finally {
      if (mountedRef.current) setDetecting(false);
    }
  };

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchLocations(trimmed, 8);
        if (mountedRef.current) setSuggestions(rows);
      } catch {
        if (mountedRef.current) setSuggestions([]);
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

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
      is_suspended: (nextProfile as Profile).is_suspended ?? false,
      created_at: nextProfile.created_at ?? now,
      updated_at: now,
    };

    setStore({ profile: merged, isInitialized: true });
    updateLocal(merged);
    router.replace('/(tabs)' as any);
  };

  const finish = async () => {
    const safeName = name.trim() || profile?.name?.trim() || 'Vedastya User';
    const safeCity = city.trim();

    if (!safeName) {
      notify('Required', 'Please enter your name');
      return;
    }

    if (!safeCity || !coords) {
      notify('Select your location', 'Auto-detect your location or search for your city to continue.');
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

      const resolvedRole = (role as UserRole) || profile?.role || (user.user_metadata?.role as UserRole) || 'buyer';
      const payload = {
        id: user.id,
        name: safeName,
        city: safeCity,
        role: resolvedRole,
        radius_km: radius,
        lat: coords.lat,
        lng: coords.lng,
        email: user.email ?? profile?.email ?? null,
        phone: user.phone ?? profile?.phone ?? null,
      };

      try {
        await upsertProfile(payload);
        await refreshProfile().catch(() => {});
      } catch (dbErr: unknown) {
        console.warn('Profile save failed, continuing with local profile', dbErr);
      }

      enterApp(payload);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not continue. Please try again.';
      notify('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const mapUri = coords && mapReady ? staticMapUrl(coords.lat, coords.lng) : null;
  const roleHint =
    selectedRole === 'seller'
      ? 'Your shop feed and discovery radius will use this area.'
      : selectedRole === 'service_provider'
        ? 'Buyers nearby will find your services from this area.'
        : 'Discover shops, deals, and local updates near you.';

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.icon}>📍</Text>
      <Text style={s.title}>Set Your Area</Text>
      <Text style={s.sub}>{roleHint}</Text>

      <View style={s.glassCard}>
        <Text style={s.cardEyebrow}>Location Status</Text>
        <Text style={s.cardTitle}>
          {locationReady ? `Ready · ${city}` : detecting ? 'Detecting location…' : 'Choose your city'}
        </Text>
        <Text style={s.cardSub}>
          {locationReady
            ? `Feed opens within ${radius} km of ${city}.`
            : 'Use auto-detect for the fastest setup, or search manually.'}
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
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[s.detectBtn, detecting && s.detectBtnDisabled]}
        onPress={() => void detectLocation()}
        disabled={detecting}
        activeOpacity={0.88}
      >
        {detecting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={s.detectBtnText}>📍 Auto-Detect My Location</Text>
        )}
      </TouchableOpacity>

      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      <Text style={s.fieldLabel}>OR SEARCH YOUR CITY</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputIcon}>🔎</Text>
        <TextInput
          style={s.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search city, state, or country"
          placeholderTextColor={Colors.dim}
          autoCorrect={false}
        />
        {searching ? <ActivityIndicator color={Colors.orange} size="small" /> : null}
      </View>

      {suggestions.length > 0 ? (
        <View style={s.suggestions}>
          {suggestions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={s.suggestionRow}
              onPress={() => applySuggestion(item)}
              activeOpacity={0.85}
            >
              <Text style={s.suggestionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={s.fieldLabel}>POPULAR CITIES</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {POPULAR_CITIES.map(option => {
          const active = city === option.name;
          return (
            <TouchableOpacity
              key={option.name}
              style={[s.chip, active && s.chipActive]}
              onPress={() => applyPopularCity(option)}
              activeOpacity={0.85}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{option.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {mapUri ? (
        <View style={s.mapWrap}>
          <Image source={{ uri: mapUri }} style={s.mapImage} resizeMode="cover" />
          <View style={s.mapBadge}>
            <Text style={s.mapBadgeText}>{city} · {coords?.lat.toFixed(4)}, {coords?.lng.toFixed(4)}</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.fieldLabel}>DISCOVERY RADIUS</Text>
      <View style={s.radiusRow}>
        {ONBOARDING_RADIUS_OPTIONS.map(option => (
          <TouchableOpacity
            key={option}
            style={[s.radiusBtn, radius === option && s.radiusBtnActive]}
            onPress={() => setRadius(option)}
            activeOpacity={0.85}
          >
            <Text style={[s.radiusText, radius === option && s.radiusTextActive]}>{option} km</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.btn, (!locationReady || loading) && s.btnDisabled]}
        onPress={() => void finish()}
        disabled={!locationReady || loading}
        activeOpacity={0.88}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={s.btnText}>Explore Now</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SLATE_900 },
  content: { padding: 24, paddingBottom: 48 },
  icon: { fontSize: 42, textAlign: 'center', marginTop: 12 },
  title: {
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: SLATE_100,
    textAlign: 'center',
    marginTop: 8,
  },
  sub: {
    fontSize: 14,
    color: Colors.sub,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  glassCard: {
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dim,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SLATE_100,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.sub,
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dim,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrap: {
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: { fontSize: 18, marginRight: 8 },
  input: {
    flex: 1,
    color: SLATE_100,
    fontSize: 16,
    paddingVertical: 13,
  },
  detectBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 54,
  },
  detectBtnDisabled: { opacity: 0.75 },
  detectBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    color: Colors.amber,
    marginBottom: 8,
    lineHeight: 17,
  },
  suggestions: {
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_700,
  },
  suggestionText: {
    color: SLATE_100,
    fontSize: 14,
  },
  chipRow: { gap: 8, paddingBottom: 4, marginBottom: 12 },
  chip: {
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  chipTextActive: { color: Colors.white },
  mapWrap: {
    height: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SLATE_700,
    backgroundColor: SLATE_800,
  },
  mapImage: { width: '100%', height: '100%' },
  mapBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#000000CC',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  radiusBtn: {
    flex: 1,
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  radiusBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusText: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  radiusTextActive: { color: Colors.white },
  btn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
