// app/(auth)/location.tsx — First-login location setup → Explore Now enters app
import { useState, useEffect } from 'react';
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
  Pressable,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { getCurrentUser, getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { upsertProfile } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Colors, RADIUS_OPTIONS } from '../../constants/theme';
import { POPULAR_CITIES, matchCity, staticMapUrl, type CityOption } from '../../constants/cities';
import type { UserRole, Profile } from '../../types';

type SetupMethod = 'gps' | 'manual';
type PickerMode = 'country' | 'state' | 'city' | null;
type ManualLocationCity = CityOption & { country: string };
type ManualLocationState = { name: string; cities: ManualLocationCity[] };
type ManualLocationCountry = { name: string; states: ManualLocationState[] };

const MANUAL_LOCATION_COUNTRIES: ManualLocationCountry[] = [
  {
    name: 'India',
    states: [
      { name: 'Chandigarh', cities: [{ name: 'Chandigarh', lat: 30.7333, lng: 76.7794, state: 'Chandigarh', country: 'India' }] },
      { name: 'Delhi', cities: [{ name: 'Delhi', lat: 28.6139, lng: 77.209, state: 'Delhi', country: 'India' }] },
      { name: 'Gujarat', cities: [{ name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, state: 'Gujarat', country: 'India' }] },
      { name: 'Karnataka', cities: [{ name: 'Bengaluru', lat: 12.9716, lng: 77.5946, state: 'Karnataka', country: 'India' }] },
      {
        name: 'Maharashtra',
        cities: [
          { name: 'Mumbai', lat: 19.076, lng: 72.8777, state: 'Maharashtra', country: 'India' },
          { name: 'Pune', lat: 18.5204, lng: 73.8567, state: 'Maharashtra', country: 'India' },
        ],
      },
      { name: 'Rajasthan', cities: [{ name: 'Jaipur', lat: 26.9124, lng: 75.7873, state: 'Rajasthan', country: 'India' }] },
      { name: 'Tamil Nadu', cities: [{ name: 'Chennai', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', country: 'India' }] },
      { name: 'Telangana', cities: [{ name: 'Hyderabad', lat: 17.385, lng: 78.4867, state: 'Telangana', country: 'India' }] },
      {
        name: 'Uttar Pradesh',
        cities: [
          { name: 'Lucknow', lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh', country: 'India' },
          { name: 'Noida', lat: 28.5355, lng: 77.391, state: 'Uttar Pradesh', country: 'India' },
        ],
      },
      { name: 'West Bengal', cities: [{ name: 'Kolkata', lat: 22.5726, lng: 88.3639, state: 'West Bengal', country: 'India' }] },
    ],
  },
  {
    name: 'United Arab Emirates',
    states: [
      { name: 'Abu Dhabi', cities: [{ name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773, state: 'Abu Dhabi', country: 'United Arab Emirates' }] },
      { name: 'Dubai', cities: [{ name: 'Dubai', lat: 25.2048, lng: 55.2708, state: 'Dubai', country: 'United Arab Emirates' }] },
    ],
  },
  {
    name: 'United States',
    states: [
      { name: 'California', cities: [{ name: 'San Francisco', lat: 37.7749, lng: -122.4194, state: 'California', country: 'United States' }] },
      { name: 'New York', cities: [{ name: 'New York City', lat: 40.7128, lng: -74.006, state: 'New York', country: 'United States' }] },
    ],
  },
];

const ALL_MANUAL_CITIES = MANUAL_LOCATION_COUNTRIES.flatMap(country =>
  country.states.flatMap(state => state.cities.map(city => ({ ...city, state: state.name, country: country.name }))),
);

function findManualCityByName(name: string) {
  const query = name.trim().toLowerCase();
  if (!query) return null;
  return ALL_MANUAL_CITIES.find(option => option.name.toLowerCase() === query) ?? null;
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function SelectionField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.selectionCol}>
      <Text style={s.selectionLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[s.selectField, disabled && s.selectFieldDisabled]}
        accessibilityRole="button"
      >
        <Text style={[s.selectValue, !value && s.selectPlaceholder, disabled && s.selectValueDisabled]}>
          {value || placeholder}
        </Text>
        <Text style={[s.selectChevron, disabled && s.selectValueDisabled]}>v</Text>
      </Pressable>
    </View>
  );
}

export default function LocationScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const updateLocal = useAuthStore(s => s.updateProfile);
  const setStore = useAuthStore.setState;
  const profile = useAuthStore(s => s.profile);
  const initialManualCity = findManualCityByName(profile?.city ?? '');

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
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(matchCity(profile?.city ?? ''));
  const [mapReady, setMapReady] = useState(false);
  const [locationReady, setLocationReady] = useState(Boolean(profile?.city && profile?.lat != null && profile?.lng != null));
  const [setupMethod, setSetupMethod] = useState<SetupMethod>('gps');
  const [addressLine, setAddressLine] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(initialManualCity?.country ?? MANUAL_LOCATION_COUNTRIES[0].name);
  const [selectedState, setSelectedState] = useState(initialManualCity?.state ?? '');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const selectedRole = ((role as UserRole) || profile?.role || 'buyer') as UserRole;
  const isSellerOnly = selectedRole === 'seller';
  const selectedCountryConfig = MANUAL_LOCATION_COUNTRIES.find(option => option.name === selectedCountry) ?? null;
  const stateOptions = selectedCountryConfig?.states ?? [];
  const selectedStateConfig = stateOptions.find(option => option.name === selectedState) ?? null;
  const cityOptions = selectedStateConfig?.cities ?? [];
  const pickerOptions =
    pickerMode === 'country'
      ? MANUAL_LOCATION_COUNTRIES.map(option => option.name)
      : pickerMode === 'state'
        ? stateOptions.map(option => option.name)
        : pickerMode === 'city'
          ? cityOptions.map(option => option.name)
          : [];
  const locationSummary = setupMethod === 'manual'
    ? [city, selectedState, selectedCountry].filter(Boolean).join(', ')
    : city;

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
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'Vedastya/1.0' }, signal: controller.signal },
        );
        clearTimeout(t);
        const data = await response.json();
        return data?.address?.city || data?.address?.town || data?.address?.suburb || data?.address?.village || 'Current Location';
      } catch {
        return 'Current Location';
      }
    }
  };

  const syncManualSelectors = (nextCityName: string) => {
    const matchedManualCity = findManualCityByName(nextCityName);
    if (!matchedManualCity) return;
    setSelectedCountry(matchedManualCity.country);
    setSelectedState(matchedManualCity.state ?? '');
  };

  const applyCoords = async (latitude: number, longitude: number, preferredName?: string) => {
    setMapReady(false);
    setCoords({ lat: latitude, lng: longitude });
    const matched = matchCity(preferredName ?? '', latitude, longitude);
    if (matched) {
      setSelectedCity(matched);
      setCity(matched.name);
      syncManualSelectors(matched.name);
      setLocationReady(true);
      return;
    }
    if (preferredName) {
      setCity(preferredName);
      setSelectedCity(null);
      syncManualSelectors(preferredName);
      setLocationReady(true);
      return;
    }
    const detected = await resolveCityName(latitude, longitude);
    const matchedAfter = matchCity(detected, latitude, longitude);
    if (matchedAfter) {
      setSelectedCity(matchedAfter);
      setCity(matchedAfter.name);
      syncManualSelectors(matchedAfter.name);
    } else {
      setCity(detected);
      setSelectedCity(null);
      syncManualSelectors(detected);
    }
    setLocationReady(true);
  };

  const selectPopularCity = (option: CityOption) => {
    setSetupMethod('manual');
    setSelectedCity(option);
    setCity(option.name);
    setSelectedCountry('India');
    setSelectedState(option.state ?? '');
    setCoords({ lat: option.lat, lng: option.lng });
    setLocationReady(true);
    setMapReady(false);
  };

  const detectLocation = async () => {
    setSetupMethod('gps');
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
          setLocationReady(false);
          setSetupMethod('manual');
          notify('Location access needed', 'GPS access is unavailable. Please use Manual Entry to choose your country, state and city.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }

      await applyCoords(latitude, longitude);
    } catch {
      setLocationReady(false);
      setSetupMethod('manual');
      notify('Could not detect location', 'We could not read your current GPS coordinates. Please try again or switch to Manual Entry.');
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.name && !name) setName(profile.name);
    if (profile?.city && !city) setCity(profile.city);
    if (profile?.city) syncManualSelectors(profile.city);
  }, [profile?.id]);

  useEffect(() => {
    if (!coords) return;
    const t = setTimeout(() => setMapReady(true), 300);
    return () => clearTimeout(t);
  }, [coords?.lat, coords?.lng]);

  const handlePickerSelect = (value: string) => {
    if (pickerMode === 'country') {
      setSetupMethod('manual');
      setSelectedCountry(value);
      setSelectedState('');
      setCity('');
      setCoords(null);
      setSelectedCity(null);
      setLocationReady(false);
    } else if (pickerMode === 'state') {
      setSetupMethod('manual');
      setSelectedState(value);
      setCity('');
      setCoords(null);
      setSelectedCity(null);
      setLocationReady(false);
    } else if (pickerMode === 'city') {
      const option = cityOptions.find(entry => entry.name === value);
      if (option) {
        setSetupMethod('manual');
        setSelectedState(option.state ?? selectedState);
        setCity(option.name);
        setCoords({ lat: option.lat, lng: option.lng });
        setSelectedCity(matchCity(option.name));
        setLocationReady(true);
        setMapReady(false);
      }
    }
    setPickerMode(null);
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
      is_suspended: (nextProfile as any).is_suspended ?? false,
      created_at: nextProfile.created_at ?? now,
      updated_at: now,
    };

    // Ensure AuthGuard sees a complete profile immediately
    setStore({ profile: merged, isInitialized: true });
    updateLocal(merged);
    router.replace('/(tabs)' as any);
  };

  const finish = async () => {
    const safeName = name.trim() || profile?.name?.trim() || 'Vedastya User';
    const safeCity = city.trim();
    let safeCoords = coords;

    if (!safeCoords && safeCity) {
      const matchedManual = findManualCityByName(safeCity);
      const matchedPopular = matchCity(safeCity);
      const fallback = matchedManual ?? matchedPopular;
      if (fallback) {
        safeCoords = { lat: fallback.lat, lng: fallback.lng };
      }
    }

    if (!safeName) {
      notify('Required', 'Please enter your name');
      return;
    }

    if (setupMethod === 'gps' && (!safeCity || !safeCoords)) {
      notify('Select your location', 'Use the current location option to detect your area or switch to Manual Entry to continue.');
      return;
    }

    if (setupMethod === 'manual' && (!selectedCountry || !selectedState || !safeCity || !safeCoords)) {
      notify('Complete manual location', 'Please choose your country, state and city before continuing.');
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
        {isSellerOnly
          ? 'Choose how to set your seller location during onboarding. After this first setup, your account will keep using the same area.'
          : 'Set a trusted local area for discovery. You can use GPS for speed or switch to manual address selection.'}
      </Text>

      <View style={s.statusCard}>
        <Text style={s.statusEyebrow}>Location Status</Text>
        <Text style={s.statusTitle}>
          {locationReady
            ? setupMethod === 'gps'
              ? 'Current location selected'
              : 'Manual location selected'
            : locLoading
              ? 'Finding your location...'
              : 'Choose how to set your area'}
        </Text>
        <Text style={s.statusText}>
          {locationReady
            ? `Your feed will open around ${locationSummary || 'your selected area'} with ${radius} km as the selected range.`
            : isSellerOnly
              ? 'Choose GPS or manual entry below. This seller area will be reused automatically on future sign-ins.'
              : 'Use GPS for faster setup or switch to manual entry if you prefer to choose the address yourself.'}
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

      <Text style={s.fieldLabel}>LOCATION SETUP</Text>
      <View style={s.methodRow}>
        <Pressable
          onPress={() => setSetupMethod('gps')}
          style={[s.methodCard, setupMethod === 'gps' && s.methodCardActive]}
          accessibilityRole="button"
        >
          <Text style={s.methodIcon}>📡</Text>
          <Text style={[s.methodTitle, setupMethod === 'gps' && s.methodTitleActive]}>Use Current Location</Text>
          <Text style={[s.methodText, setupMethod === 'gps' && s.methodTextActive]}>
            Detect GPS coordinates automatically and use them for your discovery area.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSetupMethod('manual')}
          style={[s.methodCard, setupMethod === 'manual' && s.methodCardActive]}
          accessibilityRole="button"
        >
          <Text style={s.methodIcon}>📝</Text>
          <Text style={[s.methodTitle, setupMethod === 'manual' && s.methodTitleActive]}>Manual Entry</Text>
          <Text style={[s.methodText, setupMethod === 'manual' && s.methodTextActive]}>
            Enter address details manually with linked country, state and city selection.
          </Text>
        </Pressable>
      </View>

      {setupMethod === 'gps' ? (
        <View style={s.panelCard}>
          <Text style={s.panelTitle}>Automatic GPS detection</Text>
          <Text style={s.panelText}>
            Best for fast onboarding. We use your current coordinates to place the map pin and set your nearby discovery area.
          </Text>

          <TouchableOpacity
            onPress={detectLocation}
            disabled={locLoading}
            style={[s.secondaryBtn, locLoading && s.secondaryBtnDisabled]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {locLoading
              ? <ActivityIndicator color={Colors.orange} size="small" />
              : <Text style={s.secondaryBtnText}>{locationReady ? 'Refresh Current Location' : 'Use Current Location'}</Text>}
          </TouchableOpacity>

          <Text style={s.panelHint}>Allow location permission when prompted. If GPS is unavailable, switch to Manual Entry.</Text>
        </View>
      ) : (
        <View style={s.panelCard}>
          <Text style={s.panelTitle}>Manual address setup</Text>
          <Text style={s.panelText}>
            Select the address manually when you want more control over the pinned service area.
          </Text>

          <View style={s.inputWrap}>
            <Text style={s.inputIcon}>🏠</Text>
            <TextInput
              style={s.input}
              value={addressLine}
              onChangeText={text => {
                setSetupMethod('manual');
                setAddressLine(text);
              }}
              placeholder="Address line, area or landmark (optional)"
              placeholderTextColor={Colors.dim}
            />
          </View>

          <View style={s.selectionRow}>
            <SelectionField
              label="Country"
              value={selectedCountry}
              placeholder="Select country"
              onPress={() => setPickerMode('country')}
            />
            <SelectionField
              label="State"
              value={selectedState}
              placeholder="Select state"
              onPress={() => setPickerMode('state')}
              disabled={!selectedCountry}
            />
          </View>

          <View style={s.selectionSingle}>
            <SelectionField
              label="City"
              value={city}
              placeholder="Select city"
              onPress={() => setPickerMode('city')}
              disabled={!selectedState}
            />
          </View>

          <Text style={s.panelHint}>City selection sets the service coordinates used for the map preview and discovery radius.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cityScroll} contentContainerStyle={s.cityRow}>
            {POPULAR_CITIES.map(option => {
              const active = city.toLowerCase() === option.name.toLowerCase();
              return (
                <TouchableOpacity
                  key={option.name}
                  onPress={() => selectPopularCity(option)}
                  style={[s.cityChip, active && s.cityChipActive]}
                >
                  <Text style={[s.cityChipText, active && s.cityChipTextActive]}>{option.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Text style={s.fieldLabel}>MAP PREVIEW</Text>
      <View style={s.mapWrap}>
        {mapUri ? (
          <Image source={{ uri: mapUri }} style={s.mapImage} resizeMode="cover" />
        ) : (
          <View style={s.mapPlaceholder}>
            <Text style={s.mapPlaceholderEmoji}>🗺️</Text>
            <Text style={s.mapPlaceholderText}>
              {locLoading
                ? 'Detecting your location...'
                : setupMethod === 'manual'
                  ? 'Select your country, state and city to preview the map'
                  : 'Use current location to preview the map'}
            </Text>
          </View>
        )}

        {coords && (
          <View style={s.mapBadge}>
            <Text style={s.mapBadgeText}>
              📌 {city || 'Pinned'} · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              {setupMethod === 'manual' ? ' · manual' : ' · gps'}
            </Text>
          </View>
        )}
      </View>

      <Text style={s.fieldLabel}>DISCOVERY RADIUS</Text>
      <View style={s.radiusRow}>
        {RADIUS_OPTIONS.map(option => (
          <TouchableOpacity
            key={option}
            onPress={() => setRadius(option)}
            style={[s.radiusBtn, radius === option && s.radiusActive]}
          >
            <Text style={[s.radiusText, radius === option && s.radiusTextActive]}>{option} km</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>
        {isSellerOnly
          ? 'This seller radius is captured on first setup and then reused automatically on future logins.'
          : 'Default is 5 km so nearby shops, feeds and services feel instantly local.'}
      </Text>

      <TouchableOpacity
        onPress={finish}
        style={[s.btn, loading && { opacity: 0.7 }]}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Explore Now</Text>}
      </TouchableOpacity>

      <Modal transparent visible={!!pickerMode} animationType="fade" onRequestClose={() => setPickerMode(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setPickerMode(null)}>
          <Pressable style={s.modalCard}>
            <Text style={s.modalTitle}>
              {pickerMode === 'country' ? 'Select Country' : pickerMode === 'state' ? 'Select State' : 'Select City'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pickerOptions.map(option => (
                <Pressable
                  key={option}
                  onPress={() => handlePickerSelect(option)}
                  style={s.modalOption}
                  accessibilityRole="button"
                >
                  <Text style={s.modalOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  methodRow: { gap: 12, marginBottom: 16 },
  methodCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  methodCardActive: { borderColor: Colors.orange, backgroundColor: Colors.surface },
  methodIcon: { fontSize: 20 },
  methodTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  methodTitleActive: { color: Colors.orange },
  methodText: { color: Colors.sub, fontSize: 12, lineHeight: 18 },
  methodTextActive: { color: Colors.text },
  panelCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  panelTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  panelText: { color: Colors.sub, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  inputWrap: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, color: Colors.text, fontSize: 16, paddingVertical: 13 },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.orange,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryBtnDisabled: { opacity: 0.7 },
  secondaryBtnText: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
  panelHint: { color: Colors.dim, fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 12 },
  selectionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  selectionCol: { flex: 1, minWidth: 0 },
  selectionSingle: { marginBottom: 12 },
  selectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.6, marginBottom: 8 },
  selectField: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldDisabled: { opacity: 0.55 },
  selectValue: { color: Colors.text, fontSize: 15, flex: 1, paddingRight: 8 },
  selectPlaceholder: { color: Colors.dim },
  selectValueDisabled: { color: Colors.dim },
  selectChevron: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  cityScroll: { marginBottom: 4 },
  cityRow: { gap: 8, paddingRight: 8 },
  cityChip: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cityChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  cityChipText: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  cityChipTextActive: { color: Colors.white },
  mapWrap: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    position: 'relative',
  },
  mapImage: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  mapPlaceholderEmoji: { fontSize: 40 },
  mapPlaceholderText: { color: Colors.sub, fontSize: 13, textAlign: 'center' },
  mapBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#000C',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  radiusBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  radiusActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusText: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  radiusTextActive: { color: Colors.white },
  hint: { fontSize: 12, color: Colors.dim, marginBottom: 28 },
  btn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 18,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
});
