// app/seller/shop.tsx — Create / edit seller shop (required before posting)
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../stores/authStore';
import {
  createShop,
  getShopByOwner,
  updateShop,
  updateProfile as updateUserProfile,
  uploadImage,
} from '../../lib/api';
import { getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { Colors, SHOP_CATEGORIES } from '../../constants/theme';
import type { ShopCategory } from '../../types';

const FIXED_SELLER_RADIUS_KM = 50;
const WebInput = 'input' as any;
const webTimeInputStyle: any = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: Colors.text,
  fontSize: 15,
  fontWeight: 600,
};

type LocationMethod = 'gps' | 'manual';
type TimeField = 'open' | 'close' | null;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeTimeValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toLowerCase() === 'pm') hour += 12;
    return `${pad2(hour)}:${twelveHour[2]}`;
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    return `${pad2(Math.min(23, Number(twentyFourHour[1])))}:${twentyFourHour[2]}`;
  }

  return '';
}

function formatDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function fallbackDateTimeValue(fallbackHour: number) {
  const date = new Date();
  date.setHours(fallbackHour, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function normalizeDateTimeValue(value: string, fallbackHour: number) {
  const trimmed = value.trim();
  if (!trimmed) return fallbackDateTimeValue(fallbackHour);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const parsedTime = normalizeTimeValue(trimmed);
  if (parsedTime) {
    const [hour, minute] = parsedTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return formatDateTimeLocal(date);
  }

  const parsedDate = new Date(trimmed);
  if (!Number.isNaN(parsedDate.valueOf())) {
    return formatDateTimeLocal(parsedDate);
  }

  return fallbackDateTimeValue(fallbackHour);
}

function formatDateTimeLabel(value: string, fallbackHour: number) {
  const normalized = normalizeDateTimeValue(value, fallbackHour);
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return 'Select date and time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function dateFromDateTimeValue(value: string, fallbackHour: number) {
  const normalized = normalizeDateTimeValue(value, fallbackHour);
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.valueOf())) return parsed;
  const date = new Date();
  date.setHours(fallbackHour, 0, 0, 0);
  return date;
}

function eventToDateTimeValue(event: DateTimePickerEvent, date?: Date) {
  if (event.type === 'dismissed' || !date) return null;
  return formatDateTimeLocal(date);
}

function dateTimeValueToIso(value: string, fallbackHour: number) {
  return dateFromDateTimeValue(value, fallbackHour).toISOString();
}

function categoryLabel(categoryId: ShopCategory) {
  return SHOP_CATEGORIES.find(option => option.id === categoryId)?.label ?? 'Select category';
}

function buildFormattedAddress(geo?: Location.LocationGeocodedAddress | null) {
  if (!geo) return '';
  return [
    geo.name,
    geo.street,
    geo.district,
    geo.city,
    geo.region,
    geo.country,
  ].filter(Boolean).join(', ');
}

export default function SellerShopScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const updateLocalProfile = useAuthStore(s => s.updateProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'logo' | 'cover' | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [resolvingManualLocation, setResolvingManualLocation] = useState(false);
  const [timePickerField, setTimePickerField] = useState<TimeField>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ShopCategory>('grocery');
  const [address, setAddress] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [locationMethod, setLocationMethod] = useState<LocationMethod>('gps');
  const [locationCity, setLocationCity] = useState(profile?.city ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null,
  );
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const goToShopsTab = () => {
    router.replace('/(tabs)/shops');
  };

  const showMessage = (title: string, body: string, onOk?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${body}`);
      onOk?.();
      return;
    }
    Alert.alert(title, body, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
  };

  const resolveLocationDetails = async (latitude: number, longitude: number) => {
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      return {
        city: geo?.city || geo?.subregion || geo?.region || 'Current Location',
        formattedAddress: buildFormattedAddress(geo) || 'Current Location',
      };
    } catch {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'CityConnect/1.0' }, signal: controller.signal },
        );
        clearTimeout(timeoutId);
        const data = await response.json();
        const addressParts = [
          data?.name,
          data?.address?.road,
          data?.address?.suburb,
          data?.address?.city || data?.address?.town || data?.address?.village,
          data?.address?.state,
          data?.address?.country,
        ].filter(Boolean);
        return {
          city: data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.state || 'Current Location',
          formattedAddress: addressParts.join(', ') || 'Current Location',
        };
      } catch {
        return { city: 'Current Location', formattedAddress: 'Current Location' };
      }
    }
  };

  const applyResolvedLocation = ({
    latitude,
    longitude,
    city,
    formattedAddress,
    method,
  }: {
    latitude: number;
    longitude: number;
    city: string;
    formattedAddress: string;
    method: LocationMethod;
  }) => {
    setCoords({ lat: latitude, lng: longitude });
    setLocationCity(city);
    setAddress(formattedAddress);
    setManualLocation(formattedAddress);
    setLocationMethod(method);
  };

  useEffect(() => {
    if (!profile) return;
    getShopByOwner(profile.id)
      .then(shop => {
        if (!shop) return;
        setShopId(shop.id);
        setName(shop.name);
        setDescription(shop.description || '');
        setCategory(shop.category);
        setAddress(shop.address);
        setManualLocation(shop.address);
        setLocationMethod('manual');
        setLocationCity(shop.city);
        setCoords({ lat: shop.lat, lng: shop.lng });
        setPhone(shop.phone);
        setWhatsapp(shop.whatsapp ?? '');
        setEmail(shop.email ?? profile.email ?? '');
        setWebsite(shop.website ?? '');
        setInstagram(shop.instagram ?? '');
        setOpenTime(normalizeDateTimeValue(shop.open_time, 9));
        setCloseTime(normalizeDateTimeValue(shop.close_time, 21));
        setLogoUrl(shop.logo_url ?? '');
        setCoverUrl(shop.cover_url ?? '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const pickAndUploadImage = async (field: 'logo' | 'cover') => {
    if (!profile) return;
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showMessage('Permission needed', 'Allow photo access in Settings to upload shop media.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: field === 'logo' ? [1, 1] : [16, 6],
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingField(field);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = `shops/${profile.id}/${field}-${Date.now()}.jpg`;
      const url = await uploadImage('cityconnect', path, blob, 'image/jpeg');

      if (field === 'logo') setLogoUrl(url);
      else setCoverUrl(url);
    } catch (e: any) {
      showMessage('Upload failed', e?.message || 'Could not upload the selected image.');
    } finally {
      setUploadingField(null);
    }
  };

  const detectCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      let latitude: number;
      let longitude: number;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 7000, maximumAge: 60000 }),
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showMessage('Location access needed', 'Please allow GPS access or switch to Manual Entry.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const details = await resolveLocationDetails(latitude, longitude);
      applyResolvedLocation({
        latitude,
        longitude,
        city: details.city,
        formattedAddress: details.formattedAddress,
        method: 'gps',
      });
    } catch (e: any) {
      showMessage('Location unavailable', e?.message || 'Could not detect your current location. Try Manual Entry.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const useManualLocation = async () => {
    const query = manualLocation.trim();
    if (!query) {
      showMessage('Required', 'Enter a manual location to continue.');
      return;
    }

    setResolvingManualLocation(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const results = await Location.geocodeAsync(query);
        if (results[0]) {
          latitude = results[0].latitude;
          longitude = results[0].longitude;
        }
      } catch {
        // Fall through to the web lookup below.
      }

      if (latitude == null || longitude == null) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'CityConnect/1.0' }, signal: controller.signal },
        );
        clearTimeout(timeoutId);
        const data = await response.json();
        if (data?.[0]) {
          latitude = Number(data[0].lat);
          longitude = Number(data[0].lon);
        }
      }

      if (latitude == null || longitude == null) {
        showMessage('Location not found', 'Try a more complete address with area, city, and landmark.');
        return;
      }

      const details = await resolveLocationDetails(latitude, longitude);
      applyResolvedLocation({
        latitude,
        longitude,
        city: details.city,
        formattedAddress: query,
        method: 'manual',
      });
    } catch (e: any) {
      showMessage('Manual location failed', e?.message || 'Could not verify that address. Please refine it.');
    } finally {
      setResolvingManualLocation(false);
    }
  };

  const handleTimeChange = (field: 'open' | 'close') => (event: DateTimePickerEvent, date?: Date) => {
    const nextValue = eventToDateTimeValue(event, date);
    if (Platform.OS === 'android') setTimePickerField(null);
    if (!nextValue) return;
    if (field === 'open') setOpenTime(nextValue);
    else setCloseTime(nextValue);
  };

  const save = async () => {
    if (!profile) return;

    try {
      if (!isDemoAuthEnabled()) {
        const { data } = await getSupabase().auth.getSession();
        const sessionUserId = data.session?.user?.id;
        if (!sessionUserId) {
          showMessage('Not authenticated', 'Supabase session is missing. Please log in again as the seller.');
          return;
        }
        if (sessionUserId !== profile.id) {
          showMessage(
            'Auth mismatch',
            `Supabase user id (${sessionUserId}) does not match profile id (${profile.id}). Log out and log in again.`,
          );
          return;
        }
      }
    } catch (e: any) {
      showMessage('Auth check failed', e?.message || 'Could not verify Supabase session.');
      return;
    }

    if (!name.trim()) { showMessage('Required', 'Shop name is required.'); return; }
    if (!category) { showMessage('Required', 'Select a shop category.'); return; }
    if (!openTime.trim() || !closeTime.trim()) { showMessage('Required', 'Open and close date-time values are required.'); return; }
    if (!phone.trim()) { showMessage('Required', 'Phone number is required.'); return; }
    if (!email.trim()) { showMessage('Required', 'Email is required.'); return; }
    if (!email.includes('@')) { showMessage('Invalid email', 'Enter a valid business email address.'); return; }
    if (!address.trim() || !coords || !locationCity.trim()) {
      showMessage('Location needed', 'Choose your location via auto-pick or manual entry before saving.');
      return;
    }
    if (!logoUrl) { showMessage('Required', 'Shop image is required.'); return; }
    if (!coverUrl) { showMessage('Required', 'Shop wall image is required.'); return; }
    if (description.trim().length > 500) { showMessage('Too long', 'Description can be up to 500 characters only.'); return; }

    setSaving(true);
    try {
      await updateUserProfile(profile.id, {
        role: 'seller',
        city: locationCity.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radius_km: FIXED_SELLER_RADIUS_KM,
        phone: phone.trim(),
        email: email.trim(),
      });
      updateLocalProfile({
        role: 'seller',
        city: locationCity.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radius_km: FIXED_SELLER_RADIUS_KM,
        phone: phone.trim(),
        email: email.trim(),
      });

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        logo_url: logoUrl,
        cover_url: coverUrl,
        address: address.trim(),
        city: locationCity.trim(),
        lat: coords.lat,
        lng: coords.lng,
        phone: phone.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim() || null,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        open_time: dateTimeValueToIso(openTime, 9),
        close_time: dateTimeValueToIso(closeTime, 21),
        is_open: true,
        is_verified: false,
        is_active: true,
      };

      if (shopId) {
        await updateShop(shopId, payload);
      } else {
        await createShop({
          owner_id: profile.id,
          ...payload,
        });
      }

      showMessage(
        'Saved',
        'Your shop profile has been saved. You can now start posting products and updates.',
        goToShopsTab,
      );
    } catch (e: any) {
      console.error('Save shop failed', e);
      showMessage('Error', e?.message || 'Could not save shop');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={goToShopsTab}><Text style={s.back}>✕</Text></TouchableOpacity>
        <Text style={s.headerTitle}>{shopId ? 'Edit Shop' : 'Create Shop'}</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.sectionTitle}>Business Basics</Text>

        <Text style={s.label}>SHOP NAME *</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sharma Toy Store"
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>CATEGORY *</Text>
        <Pressable style={s.selectField} onPress={() => setCategoryPickerOpen(true)}>
          <Text style={s.selectValue}>
            {(SHOP_CATEGORIES.find(option => option.id === category)?.emoji ?? '🏪')} {categoryLabel(category)}
          </Text>
          <Text style={s.selectChevron}>v</Text>
        </Pressable>

        <Text style={s.label}>DESCRIPTION (optional, 500 characters)</Text>
        <TextInput
          style={[s.input, s.area]}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
          placeholder="Tell customers what your shop offers."
          placeholderTextColor={Colors.dim}
        />
        <Text style={s.counter}>{description.trim().length}/500</Text>

        <Text style={s.sectionTitle}>Media</Text>
        <View style={s.mediaRow}>
          <TouchableOpacity onPress={() => pickAndUploadImage('logo')} style={s.mediaCard} activeOpacity={0.85}>
            {logoUrl ? <Image source={{ uri: logoUrl }} style={s.mediaImage} /> : <Text style={s.mediaEmoji}>🏬</Text>}
            <Text style={s.mediaTitle}>Shop Image *</Text>
            <Text style={s.mediaHint}>{uploadingField === 'logo' ? 'Uploading...' : 'Tap to crop in square shop DP ratio'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => pickAndUploadImage('cover')} style={s.mediaCard} activeOpacity={0.85}>
            {coverUrl ? <Image source={{ uri: coverUrl }} style={s.mediaImage} /> : <Text style={s.mediaEmoji}>🖼️</Text>}
            <Text style={s.mediaTitle}>Shop Wall *</Text>
            <Text style={s.mediaHint}>{uploadingField === 'cover' ? 'Uploading...' : 'Tap to crop in wide Facebook-style cover ratio'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Contact & Hours</Text>
        <Text style={s.label}>PHONE NUMBER *</Text>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91..."
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>EMAIL *</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="shop@example.com"
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>WHATSAPP (optional)</Text>
        <TextInput
          style={s.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
          placeholder="91XXXXXXXXXX"
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>WEBSITE (optional)</Text>
        <TextInput
          style={s.input}
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          placeholder="https://yourshop.com"
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>INSTAGRAM (optional)</Text>
        <TextInput
          style={s.input}
          value={instagram}
          onChangeText={setInstagram}
          autoCapitalize="none"
          placeholder="@yourshop"
          placeholderTextColor={Colors.dim}
        />

        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.label}>OPEN DATE & TIME *</Text>
            {Platform.OS === 'web' ? (
              <View style={s.webTimeWrap}>
                <WebInput
                  type="datetime-local"
                  value={normalizeDateTimeValue(openTime, 9)}
                  onChange={(event: any) => setOpenTime(event.target.value)}
                  style={webTimeInputStyle}
                />
              </View>
            ) : (
              <TouchableOpacity style={s.timeButton} activeOpacity={0.85} onPress={() => setTimePickerField('open')}>
                <Text style={s.timeValue}>{formatDateTimeLabel(openTime, 9)}</Text>
                <Text style={s.timeAction}>Choose</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={s.col}>
            <Text style={s.label}>CLOSE DATE & TIME *</Text>
            {Platform.OS === 'web' ? (
              <View style={s.webTimeWrap}>
                <WebInput
                  type="datetime-local"
                  value={normalizeDateTimeValue(closeTime, 21)}
                  onChange={(event: any) => setCloseTime(event.target.value)}
                  style={webTimeInputStyle}
                />
              </View>
            ) : (
              <TouchableOpacity style={s.timeButton} activeOpacity={0.85} onPress={() => setTimePickerField('close')}>
                <Text style={s.timeValue}>{formatDateTimeLabel(closeTime, 21)}</Text>
                <Text style={s.timeAction}>Choose</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={s.sectionTitle}>Location & Reach</Text>
        <View style={s.methodRow}>
          <TouchableOpacity
            style={[s.methodCard, locationMethod === 'gps' && s.methodCardActive]}
            activeOpacity={0.88}
            onPress={() => setLocationMethod('gps')}
          >
            <Text style={s.methodIcon}>📍</Text>
            <Text style={s.methodTitle}>Auto Pick Location</Text>
            <Text style={s.methodText}>Use current GPS coordinates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.methodCard, locationMethod === 'manual' && s.methodCardActive]}
            activeOpacity={0.88}
            onPress={() => {
              setLocationMethod('manual');
              setManualLocation(address || manualLocation);
            }}
          >
            <Text style={s.methodIcon}>🏠</Text>
            <Text style={s.methodTitle}>Manual Entry</Text>
            <Text style={s.methodText}>Enter the exact shop address</Text>
          </TouchableOpacity>
        </View>

        {locationMethod === 'gps' ? (
          <View style={s.locationCard}>
            <Text style={s.locationTitle}>Current Location</Text>
            <Text style={s.locationHint}>Fetch the shop address directly from your current device location.</Text>
            <TouchableOpacity style={s.primaryAction} onPress={detectCurrentLocation} disabled={detectingLocation}>
              {detectingLocation
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.primaryActionText}>Detect My Location</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.locationCard}>
            <Text style={s.locationTitle}>Manual Location</Text>
            <Text style={s.locationHint}>Enter area, street, landmark, and city so we can pin the shop accurately.</Text>
            <TextInput
              style={s.input}
              value={manualLocation}
              onChangeText={setManualLocation}
              placeholder="e.g. SCO 21, Sector 7C, Chandigarh"
              placeholderTextColor={Colors.dim}
            />
            <TouchableOpacity style={s.primaryAction} onPress={useManualLocation} disabled={resolvingManualLocation}>
              {resolvingManualLocation
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.primaryActionText}>Use Manual Address</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Selected Shop Location</Text>
          <Text style={s.infoText}>Address: {address || 'Not selected yet'}</Text>
          <Text style={s.infoText}>City: {locationCity || 'Not selected yet'}</Text>
          <Text style={s.infoText}>
            Coordinates: {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Not selected yet'}
          </Text>
          <Text style={s.infoText}>Radius: {FIXED_SELLER_RADIUS_KM} km (fixed for sellers)</Text>
        </View>

        <Text style={s.hint}>
          Choose either auto-pick or manual entry, then confirm the saved location card above. Seller reach remains fixed at {FIXED_SELLER_RADIUS_KM} km.
        </Text>
      </ScrollView>

      <Modal transparent visible={categoryPickerOpen} animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCategoryPickerOpen(false)}>
          <Pressable style={s.modalCard}>
            <Text style={s.modalTitle}>Select Shop Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SHOP_CATEGORIES.map(option => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setCategory(option.id as ShopCategory);
                    setCategoryPickerOpen(false);
                  }}
                  style={[s.modalOption, category === option.id && s.modalOptionActive]}
                  activeOpacity={0.85}
                >
                  <Text style={s.modalOptionText}>{option.emoji} {option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {Platform.OS !== 'web' && timePickerField ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setTimePickerField(null)}>
          <Pressable style={s.modalBackdrop} onPress={() => setTimePickerField(null)}>
            <Pressable style={s.timeModalCard}>
              <Text style={s.modalTitle}>{timePickerField === 'open' ? 'Select Open Date & Time' : 'Select Close Date & Time'}</Text>
              <DateTimePicker
                value={dateFromDateTimeValue(timePickerField === 'open' ? openTime : closeTime, timePickerField === 'open' ? 9 : 21)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange(timePickerField)}
              />
              {Platform.OS === 'ios' ? (
                <TouchableOpacity style={s.primaryAction} onPress={() => setTimePickerField(null)}>
                  <Text style={s.primaryActionText}>Done</Text>
                </TouchableOpacity>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { color: Colors.sub, fontSize: 22, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveText: { color: Colors.white, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.6, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 100, textAlignVertical: 'top' },
  counter: { color: Colors.dim, fontSize: 11, marginTop: 6, textAlign: 'right' },
  selectField: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: { color: Colors.text, fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 12 },
  selectChevron: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  mediaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  mediaCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  mediaImage: { width: '100%', height: 92, borderRadius: 12, marginBottom: 12 },
  mediaEmoji: { fontSize: 40, marginBottom: 12 },
  mediaTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  mediaHint: { color: Colors.sub, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  webTimeWrap: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  timeAction: { color: Colors.orange, fontSize: 12, fontWeight: '700' },
  methodRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  methodCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 14,
  },
  methodCardActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '10' },
  methodIcon: { fontSize: 28, marginBottom: 10 },
  methodTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  methodText: { color: Colors.sub, fontSize: 12, lineHeight: 18 },
  locationCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 14,
  },
  locationTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  locationHint: { color: Colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  primaryAction: {
    marginTop: 12,
    backgroundColor: Colors.orange,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryActionText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  infoCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    gap: 4,
  },
  infoTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  infoText: { color: Colors.sub, fontSize: 13, lineHeight: 18 },
  hint: { marginTop: 16, color: Colors.dim, fontSize: 12, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 18,
  },
  timeModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 18,
    gap: 16,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  modalOptionActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '18' },
  modalOptionText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});
