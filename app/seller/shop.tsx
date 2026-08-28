// app/seller/shop.tsx — Create / edit seller shop (merchant dashboard)
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  StyleSheet, Platform, Image, Modal, Pressable, Animated, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuthStore } from '../../stores/authStore';
import {
  createShop, getShopByOwner, updateShop,
  updateProfile as updateUserProfile, uploadImage,
} from '../../lib/api';
import { getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { Colors, Fonts, SHOP_CATEGORIES, Shadow } from '../../constants/theme';
import { getShopHoursState } from '../../lib/marketplaceUtils';
import {
  parseOperatingHours, scheduleToLegacyTimes, defaultWeeklySchedule, getWeekdayKey,
} from '../../lib/shopScheduleUtils';
import { WeeklyHoursPicker } from '../../components/seller/WeeklyHoursPicker';
import { LocationSetupPicker } from '../../components/seller/LocationSetupPicker';
import { MediaSourceSheet, type MediaSourceChoice } from '../../components/media/MediaSourceSheet';
import { CameraCapture, type CapturedMedia } from '../../components/media/CameraCapture';
import type { ShopCategory, ShopOperatingHours } from '../../types';

const DEFAULT_SERVICE_RADIUS_KM = 20;

function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function categoryLabel(categoryId: ShopCategory) {
  return SHOP_CATEGORIES.find(option => option.id === categoryId)?.label ?? 'Select category';
}

function buildFormattedAddress(geo?: Location.LocationGeocodedAddress | null) {
  if (!geo) return '';
  return [geo.name, geo.street, geo.district, geo.city, geo.region, geo.country].filter(Boolean).join(', ');
}

function IconPhone({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7.1 3.6c.4-.5 1.1-.6 1.6-.3l2.5 1.1c.5.2.8.8.7 1.3l-.5 2.4c-.1.4-.3.7-.7.9l-1.5.8a12.2 12.2 0 0 0 5.4 5.4l.8-1.5c.2-.4.5-.6.9-.7l2.4-.5c.6-.1 1.1.2 1.3.7l1.1 2.5c.3.6.2 1.2-.3 1.6l-1.3 1.2c-.5.4-1.1.6-1.8.6C11.6 19.1 4.9 12.4 4.9 4.9c0-.7.2-1.3.6-1.8l1.6-1.3Z" fill={color} />
    </Svg>
  );
}

function IconMail({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2 8 5 8-5" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function IconGlobe({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function IconCamera({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm8 10a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" fill={color} />
    </Svg>
  );
}

function ScalePressable({
  children, onPress, style, disabled, pressedScale = 0.97,
}: {
  children: React.ReactNode; onPress?: () => void; style?: object; disabled?: boolean; pressedScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 8, tension: 160 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => !disabled && animate(pressedScale)}
      onPressOut={() => animate(1)}
      style={Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as object) : undefined}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function SectionCard({ index, title, subtitle, children }: {
  index: number; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHeader}>
        <View style={s.sectionIndex}><Text style={s.sectionIndexText}>{index}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function FieldInput({
  label, value, onChangeText, placeholder, icon, keyboardType, autoCapitalize, multiline, maxLength, counter,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
  icon?: React.ReactNode; keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences'; multiline?: boolean; maxLength?: number; counter?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, focused && s.fieldLabelFocused]}>{label}</Text>
      <View style={[s.fieldBox, focused && s.fieldBoxFocused, multiline && s.fieldBoxArea]}>
        {icon ? <View style={s.fieldIcon}>{icon}</View> : null}
        <TextInput
          style={[s.fieldInput, multiline && s.fieldInputArea]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.dim}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {counter ? <Text style={s.fieldCounter}>{counter}</Text> : null}
    </View>
  );
}

function AvatarUploader({ url, uploading, onPress }: { url: string; uploading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.avatarPicker} accessibilityRole="button">
      {url ? (
        <Image source={{ uri: url }} style={s.avatarImage} resizeMode="cover" />
      ) : (
        <View style={s.avatarPlaceholder}>
          <Text style={s.avatarEmoji}>🏬</Text>
          <Text style={s.avatarHint}>Shop image</Text>
        </View>
      )}
      <View style={s.avatarCamera}>
        {uploading ? <ActivityIndicator color={Colors.white} size="small" /> : <IconCamera color={Colors.white} size={16} />}
      </View>
    </Pressable>
  );
}

function BannerUploader({ url, uploading, onPress }: { url: string; uploading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.bannerPicker} accessibilityRole="button">
      {url ? (
        <>
          <Image source={{ uri: url }} style={s.bannerImage} resizeMode="cover" />
          <View style={s.bannerOverlay}><Text style={s.bannerOverlayText}>Tap to change wall</Text></View>
        </>
      ) : (
        <View style={s.bannerEmpty}>
          <IconCamera color={Colors.sub} size={28} />
          <Text style={s.bannerEmptyTitle}>Upload shop wall</Text>
          <Text style={s.bannerEmptyHint}>16:6 · Take photo or gallery</Text>
        </View>
      )}
      {uploading ? (
        <View style={s.bannerLoading}><ActivityIndicator color={Colors.orange} /></View>
      ) : null}
    </Pressable>
  );
}

export default function SellerShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(width - 32, 720);
  const { profile } = useAuthStore();
  const updateLocalProfile = useAuthStore(s => s.updateProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'logo' | 'cover' | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [resolvingManualLocation, setResolvingManualLocation] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ShopCategory>('grocery');
  const [address, setAddress] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual'>('gps');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(DEFAULT_SERVICE_RADIUS_KM);
  const [locationCity, setLocationCity] = useState(profile?.city ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null,
  );
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [operatingHours, setOperatingHours] = useState<ShopOperatingHours>(() => ({
    schedule: defaultWeeklySchedule(),
    closedToday: false,
    is24_7: false,
  }));
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [mediaField, setMediaField] = useState<'logo' | 'cover' | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cropPreviewUri, setCropPreviewUri] = useState<string | null>(null);

  const goToShopsTab = () => router.replace('/(tabs)/shops');

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
          data?.name, data?.address?.road, data?.address?.suburb,
          data?.address?.city || data?.address?.town || data?.address?.village,
          data?.address?.state, data?.address?.country,
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
    latitude, longitude, city, formattedAddress, method,
  }: {
    latitude: number; longitude: number; city: string; formattedAddress: string; method: 'gps' | 'manual';
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
        setOperatingHours(parseOperatingHours(shop));
        setServiceRadiusKm(profile?.radius_km ?? DEFAULT_SERVICE_RADIUS_KM);
        setLogoUrl(shop.logo_url ?? '');
        setCoverUrl(shop.cover_url ?? '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const uploadShopImageUri = async (field: 'logo' | 'cover', uri: string) => {
    if (!profile) return;
    setUploadingField(field);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mime = blob.type || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : 'jpg';
      const path = `shops/${profile.id}/${field}-${Date.now()}.${ext}`;
      const url = await uploadImage('cityconnect', path, blob, mime);
      if (field === 'logo') setLogoUrl(url);
      else setCoverUrl(url);
    } catch (e: any) {
      showMessage('Upload failed', e?.message || 'Could not upload the selected image.');
    } finally {
      setUploadingField(null);
      setCropPreviewUri(null);
    }
  };

  /** Gallery pick with built-in crop, then upload */
  const pickFromGallery = async (field: 'logo' | 'cover') => {
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
      await uploadShopImageUri(field, result.assets[0].uri);
    } catch (e: any) {
      showMessage('Upload failed', e?.message || 'Could not upload the selected image.');
    }
  };

  /**
   * After live camera capture: on native, camera already cropped via ImagePicker.
   * On web, show a confirm/preview step before upload (crop utility).
   */
  const onShopPhotoCaptured = async (media: CapturedMedia) => {
    setCameraOpen(false);
    const field = mediaField;
    if (!field || media.type !== 'image') {
      setMediaField(null);
      return;
    }

    if (Platform.OS !== 'web') {
      setMediaField(null);
      await uploadShopImageUri(field, media.uri);
      return;
    }

    // Web: pass into crop/preview confirm before saving
    setCropPreviewUri(media.uri);
  };

  const onMediaSourceSelect = (choice: MediaSourceChoice) => {
    const field = mediaField;
    if (!field) return;
    if (choice === 'gallery') {
      setMediaField(null);
      void pickFromGallery(field);
      return;
    }
    // Take Photo — open live camera
    setCameraOpen(true);
  };

  const openMediaSheet = (field: 'logo' | 'cover') => {
    if (uploadingField) return;
    setMediaField(field);
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
      applyResolvedLocation({ latitude, longitude, city: details.city, formattedAddress: details.formattedAddress, method: 'gps' });
    } catch (e: any) {
      showMessage('Location unavailable', e?.message || 'Could not detect your current location. Try Manual Entry.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const useManualLocation = async () => {
    const query = manualLocation.trim();
    if (!query) { showMessage('Required', 'Enter a manual location to continue.'); return; }
    setResolvingManualLocation(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const results = await Location.geocodeAsync(query);
        if (results[0]) { latitude = results[0].latitude; longitude = results[0].longitude; }
      } catch { /* fall through */ }
      if (latitude == null || longitude == null) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'CityConnect/1.0' }, signal: controller.signal },
        );
        clearTimeout(timeoutId);
        const data = await response.json();
        if (data?.[0]) { latitude = Number(data[0].lat); longitude = Number(data[0].lon); }
      }
      if (latitude == null || longitude == null) {
        showMessage('Location not found', 'Try a more complete address with area, city, and landmark.');
        return;
      }
      const details = await resolveLocationDetails(latitude, longitude);
      applyResolvedLocation({ latitude, longitude, city: details.city, formattedAddress: query, method: 'manual' });
    } catch (e: any) {
      showMessage('Manual location failed', e?.message || 'Could not verify that address. Please refine it.');
    } finally {
      setResolvingManualLocation(false);
    }
  };

  const applyPlaceSelection = async (place: { label: string; lat: number; lng: number }) => {
    const details = await resolveLocationDetails(place.lat, place.lng);
    applyResolvedLocation({
      latitude: place.lat,
      longitude: place.lng,
      city: details.city,
      formattedAddress: place.label || details.formattedAddress,
      method: 'manual',
    });
    setManualLocation(place.label || details.formattedAddress);
  };

  const save = async () => {
    if (!profile) return;
    try {
      if (!isDemoAuthEnabled()) {
        const { data } = await getSupabase().auth.getSession();
        const sessionUserId = data.session?.user?.id;
        if (!sessionUserId) { showMessage('Not authenticated', 'Supabase session is missing. Please log in again as the seller.'); return; }
        if (sessionUserId !== profile.id) {
          showMessage('Auth mismatch', `Supabase user id (${sessionUserId}) does not match profile id (${profile.id}). Log out and log in again.`);
          return;
        }
      }
    } catch (e: any) {
      showMessage('Auth check failed', e?.message || 'Could not verify Supabase session.');
      return;
    }

    if (!name.trim()) { showMessage('Required', 'Shop name is required.'); return; }
    if (!category) { showMessage('Required', 'Select a shop category.'); return; }
    const hasEnabledDay = Object.values(operatingHours.schedule).some(d => d.enabled);
    if (!operatingHours.is24_7 && !hasEnabledDay) {
      showMessage('Required', 'Enable at least one day in your operating schedule.');
      return;
    }
    if (!phone.trim()) { showMessage('Required', 'Phone number is required.'); return; }
    if (!email.trim()) { showMessage('Required', 'Email is required.'); return; }
    if (!email.includes('@')) { showMessage('Invalid email', 'Enter a valid business email address.'); return; }
    if (!address.trim() || !coords || !locationCity.trim()) {
      showMessage('Location needed', 'Choose your location via auto-pick or manual entry before saving.');
      return;
    }
    if (!logoUrl) { showMessage('Required', 'Shop image is required.'); return; }
    if (!coverUrl) { showMessage('Required', 'Shop banner is required.'); return; }
    if (description.trim().length > 500) { showMessage('Too long', 'Description can be up to 500 characters only.'); return; }

    setSaving(true);
    try {
      await updateUserProfile(profile.id, {
        role: 'seller', city: locationCity.trim(), lat: coords.lat, lng: coords.lng,
        radius_km: serviceRadiusKm, email: email.trim(),
      });
      updateLocalProfile({
        role: 'seller', city: locationCity.trim(), lat: coords.lat, lng: coords.lng,
        radius_km: serviceRadiusKm, email: email.trim(),
      });

      const { openTime, closeTime } = scheduleToLegacyTimes(operatingHours);
      const hoursState = getShopHoursState(openTime, closeTime, new Date(), operatingHours);
      const shopIsOpen = operatingHours.closedToday
        ? false
        : (hoursState === 'open' || hoursState === 'closing_soon');

      const payload = {
        name: name.trim(), description: description.trim(), category,
        logo_url: logoUrl, cover_url: coverUrl, address: address.trim(), city: locationCity.trim(),
        lat: coords.lat, lng: coords.lng, phone: phone.trim(), email: email.trim(),
        whatsapp: whatsapp.trim() || null, website: website.trim() || null, instagram: instagram.trim() || null,
        open_time: openTime, close_time: closeTime,
        operating_hours: operatingHours as any,
        is_open: shopIsOpen,
        is_verified: false, is_active: true,
      };

      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9be6ad'},body:JSON.stringify({sessionId:'9be6ad',runId:'shop-save-debug',hypothesisId:'C',location:'app/seller/shop.tsx:save:payload',message:'shop save payload hours',data:{openTime,closeTime,hoursState,shopIsOpen,closedToday:operatingHours.closedToday,is24_7:operatingHours.is24_7,todayKey:getWeekdayKey(),todaySchedule:operatingHours.schedule[getWeekdayKey()]},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (shopId) await updateShop(shopId, payload);
      else await createShop({ owner_id: profile.id, ...payload });

      showMessage('Saved', 'Your shop profile has been saved. You can now start posting products and updates.', goToShopsTab);
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

  const pageTitle = shopId ? 'Edit Shop' : 'Create Shop';

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.stickyHeader}>
          <Pressable onPress={goToShopsTab} style={s.exitBtn} hitSlop={12}>
            <Text style={s.exitText}>✕</Text>
          </Pressable>
          <Text style={s.headerTitle}>{pageTitle}</Text>
          <ScalePressable onPress={save} disabled={saving} style={[s.saveBtn, saving && s.saveBtnDisabled]}>
            {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
          </ScalePressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={[s.scrollContent, { alignItems: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[s.formColumn, { maxWidth: contentMaxWidth, width: '100%' }]}>

          <SectionCard index={1} title="Basic Details" subtitle="Name, category, and shop description">
            <FieldInput label="Shop name *" value={name} onChangeText={setName} placeholder="e.g. Sharma Toy Store" />
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Category *</Text>
              <Pressable style={s.selectField} onPress={() => setCategoryPickerOpen(true)}>
                <Text style={s.selectValue}>
                  {(SHOP_CATEGORIES.find(o => o.id === category)?.emoji ?? '🏪')} {categoryLabel(category)}
                </Text>
                <Text style={s.selectChevron}>▾</Text>
              </Pressable>
            </View>
            <FieldInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell customers what your shop offers."
              multiline
              maxLength={500}
              counter={`${description.trim().length}/500`}
            />
          </SectionCard>

          <SectionCard index={2} title="Branding & Media" subtitle="Shop image and wall customers will see">
            <View style={[s.brandingRow, width >= 600 && s.brandingRowWide]}>
              <View style={s.avatarCol}>
                <Text style={s.mediaLabel}>Shop Image *</Text>
                <AvatarUploader url={logoUrl} uploading={uploadingField === 'logo'} onPress={() => openMediaSheet('logo')} />
              </View>
              <View style={s.bannerCol}>
                <Text style={s.mediaLabel}>Shop Wall *</Text>
                <BannerUploader url={coverUrl} uploading={uploadingField === 'cover'} onPress={() => openMediaSheet('cover')} />
              </View>
            </View>
          </SectionCard>

          <SectionCard index={3} title="Contact & Socials" subtitle="How customers reach you">
            <FieldInput label="Phone *" value={phone} onChangeText={setPhone} placeholder="+91..." keyboardType="phone-pad" icon={<IconPhone color={Colors.sub} />} />
            <FieldInput label="Email *" value={email} onChangeText={setEmail} placeholder="shop@example.com" keyboardType="email-address" autoCapitalize="none" icon={<IconMail color={Colors.sub} />} />
            <FieldInput label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} placeholder="91XXXXXXXXXX" keyboardType="phone-pad" icon={<IconPhone color={Colors.sub} />} />
            <FieldInput label="Website" value={website} onChangeText={setWebsite} placeholder="https://yourshop.com" autoCapitalize="none" icon={<IconGlobe color={Colors.sub} />} />
            <FieldInput label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="@yourshop" autoCapitalize="none" icon={<Text style={s.igIcon}>📸</Text>} />
          </SectionCard>

          <SectionCard index={4} title="Business Hours" subtitle="Weekly schedule · presets · closed today">
            <WeeklyHoursPicker value={operatingHours} onChange={setOperatingHours} />
          </SectionCard>

          <SectionCard index={5} title="Location Setup" subtitle="Pin your shop · search · delivery radius">
            <LocationSetupPicker
              method={locationMethod}
              onMethodChange={setLocationMethod}
              coords={coords}
              address={address}
              city={locationCity}
              manualQuery={manualLocation}
              onManualQueryChange={setManualLocation}
              serviceRadiusKm={serviceRadiusKm}
              onServiceRadiusChange={setServiceRadiusKm}
              detecting={detectingLocation}
              resolving={resolvingManualLocation}
              onDetectGps={detectCurrentLocation}
              onConfirmManual={useManualLocation}
              onSelectPlace={applyPlaceSelection}
            />
          </SectionCard>

          <Text style={s.footerHint}>
            Your shop appears to buyers within {serviceRadiusKm} km. Confirm the map preview before saving.
          </Text>
        </View>
      </ScrollView>

      <Modal transparent visible={categoryPickerOpen} animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCategoryPickerOpen(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Select category</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {SHOP_CATEGORIES.map(option => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => { setCategory(option.id as ShopCategory); setCategoryPickerOpen(false); }}
                  style={[s.modalOption, category === option.id && s.modalOptionActive]}
                >
                  <Text style={s.modalOptionText}>{option.emoji} {option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <MediaSourceSheet
        visible={!!mediaField && !cameraOpen && !cropPreviewUri}
        title={mediaField === 'cover' ? 'Shop Wall' : 'Shop Image'}
        cameraLabel="Take Photo"
        galleryLabel="Choose from Gallery"
        onClose={() => setMediaField(null)}
        onSelect={onMediaSourceSelect}
      />

      <CameraCapture
        visible={cameraOpen}
        mode="photo"
        onClose={() => {
          setCameraOpen(false);
          setMediaField(null);
        }}
        onCapture={media => { void onShopPhotoCaptured(media); }}
      />

      <Modal
        transparent
        visible={!!cropPreviewUri && !!mediaField}
        animationType="fade"
        onRequestClose={() => { setCropPreviewUri(null); setMediaField(null); }}
      >
        <View style={s.cropBackdrop}>
          <View style={s.cropCard}>
            <Text style={s.modalTitle}>
              {mediaField === 'cover' ? 'Preview Shop Wall' : 'Preview Shop Image'}
            </Text>
            {cropPreviewUri ? (
              <Image
                source={{ uri: cropPreviewUri }}
                style={mediaField === 'logo' ? s.cropAvatar : s.cropBanner}
                resizeMode="cover"
              />
            ) : null}
            <Text style={s.cropHint}>Confirm to save, or retake with the camera.</Text>
            <View style={s.cropActions}>
              <TouchableOpacity
                style={s.cropSecondary}
                onPress={() => {
                  setCropPreviewUri(null);
                  setCameraOpen(true);
                }}
              >
                <Text style={s.cropSecondaryText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cropPrimary}
                disabled={!!uploadingField}
                onPress={() => {
                  if (mediaField && cropPreviewUri) void uploadShopImageUri(mediaField, cropPreviewUri);
                }}
              >
                {uploadingField
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.cropPrimaryText}>Use Photo</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  safeTop: { backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadow.sm },
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  exitBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  exitText: { color: Colors.sub, fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: Fonts.displayXBold, fontWeight: '800', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    minWidth: 110, alignItems: 'center', shadowColor: Colors.orange, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 13 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
  formColumn: { gap: 16 },
  sectionCard: {
    backgroundColor: hexAlpha(Colors.card, 'F0'),
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border2,
    padding: 18, gap: 14, ...Shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  sectionIndex: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: hexAlpha(Colors.orange, '22'),
    alignItems: 'center', justifyContent: 'center',
  },
  sectionIndexText: { color: Colors.orange, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '800', color: Colors.text },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.body, color: Colors.sub, marginTop: 2, lineHeight: 17 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.sub, letterSpacing: 0.4 },
  fieldLabelFocused: { color: Colors.orange },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 12,
  },
  fieldBoxFocused: { borderColor: Colors.orange, shadowColor: Colors.orange, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
  fieldBoxArea: { alignItems: 'flex-start', paddingVertical: 4 },
  fieldIcon: { marginRight: 8 },
  fieldInput: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: Fonts.body, paddingVertical: 12 },
  fieldInputArea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
  fieldCounter: { fontSize: 11, color: Colors.dim, textAlign: 'right', fontFamily: Fonts.body },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  selectValue: { color: Colors.text, fontSize: 15, fontFamily: Fonts.bodySemiBold, flex: 1 },
  selectChevron: { color: Colors.sub, fontSize: 14 },
  brandingRow: { flexDirection: 'column', gap: 16 },
  brandingRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarCol: { alignItems: 'center', gap: 8, minWidth: 120 },
  bannerCol: { flex: 1, gap: 8 },
  mediaLabel: { fontSize: 11, fontFamily: Fonts.bodySemiBold, color: Colors.sub, fontWeight: '700', alignSelf: 'flex-start' },
  avatarPicker: {
    width: 108, height: 108, borderRadius: 20, overflow: 'hidden', position: 'relative',
    borderWidth: 2, borderColor: Colors.border2, backgroundColor: Colors.surface,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  avatarEmoji: { fontSize: 36 },
  avatarHint: { fontSize: 10, color: Colors.dim, fontFamily: Fonts.body },
  avatarCamera: {
    position: 'absolute', bottom: 6, right: 6, width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.card,
  },
  bannerPicker: {
    aspectRatio: 16 / 6, borderRadius: 16, overflow: 'hidden', position: 'relative',
    borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border2, backgroundColor: Colors.surface,
    minHeight: 100,
  },
  bannerImage: { width: '100%', height: '100%', position: 'absolute' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055',
    alignItems: 'center', justifyContent: 'center', opacity: 0.85,
  },
  bannerOverlayText: { color: Colors.white, fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 },
  bannerEmptyTitle: { color: Colors.text, fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  bannerEmptyHint: { color: Colors.dim, fontSize: 11, fontFamily: Fonts.body },
  bannerLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  igIcon: { fontSize: 16 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1, gap: 6 },
  timePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  timePillValue: { color: Colors.text, fontSize: 15, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  timePillAction: { color: Colors.orange, fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentCard: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
  },
  segmentCardActive: { borderColor: Colors.orange, backgroundColor: hexAlpha(Colors.orange, '12') },
  segmentIcon: { fontSize: 24 },
  segmentTitle: { fontSize: 13, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.sub },
  segmentTitleActive: { color: Colors.orange },
  segmentHint: { fontSize: 11, color: Colors.dim, fontFamily: Fonts.body },
  detectBtn: {
    backgroundColor: Colors.orange, borderRadius: 12, minHeight: 44, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 16, marginTop: 4,
  },
  detectBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 14 },
  manualBlock: { gap: 8 },
  mapPreview: {
    marginTop: 8, borderRadius: 16, overflow: 'hidden', minHeight: 160,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2, position: 'relative',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: hexAlpha(Colors.blue, '08'),
    borderWidth: 1, borderColor: hexAlpha(Colors.border2, '88'),
  },
  mapPin: { position: 'absolute', top: '38%', left: '46%' },
  mapPinText: { fontSize: 28 },
  mapBadges: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 6 },
  mapBadge: {
    backgroundColor: hexAlpha('#000000', 'AA'), borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
  },
  mapBadgeText: { color: Colors.white, fontSize: 11, fontFamily: Fonts.bodySemiBold, fontWeight: '600' },
  footerHint: { color: Colors.dim, fontSize: 12, fontFamily: Fonts.body, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  modalBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, padding: 18,
  },
  timeModalCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, padding: 18, gap: 16 },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: Fonts.bodySemiBold, fontWeight: '800', marginBottom: 12 },
  modalOption: {
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2,
  },
  modalOptionActive: { borderColor: Colors.orange, backgroundColor: hexAlpha(Colors.orange, '18') },
  modalOptionText: { color: Colors.text, fontSize: 14, fontFamily: Fonts.bodySemiBold },
  cropBackdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    padding: 20,
  },
  cropCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 18,
    gap: 12,
  },
  cropAvatar: {
    width: 180,
    height: 180,
    borderRadius: 20,
    alignSelf: 'center',
    backgroundColor: Colors.card,
  },
  cropBanner: {
    width: '100%',
    aspectRatio: 16 / 6,
    borderRadius: 14,
    backgroundColor: Colors.card,
  },
  cropHint: {
    color: Colors.dim,
    fontSize: 12,
    fontFamily: Fonts.body,
    textAlign: 'center',
  },
  cropActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cropSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  cropSecondaryText: {
    color: Colors.sub,
    fontWeight: '700',
    fontFamily: Fonts.bodySemiBold,
  },
  cropPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.orange,
  },
  cropPrimaryText: {
    color: Colors.white,
    fontWeight: '800',
    fontFamily: Fonts.bodySemiBold,
  },
});
