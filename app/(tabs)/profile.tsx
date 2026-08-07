// app/(tabs)/profile.tsx
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  Switch, Alert, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { updateProfile, uploadImage, getShopByOwner, getPostsByShop, updateShop } from '../../lib/api';
import * as ImagePicker from 'expo-image-picker';
import { Colors, CurrentThemeId, DEFAULT_SHOP_BIO, RADIUS_OPTIONS, THEME_OPTIONS, THEME_STORAGE_KEY, type AppThemeId } from '../../constants/theme';

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ icon, label, value, onPress, danger, toggle, toggled, onToggle }:
  { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean; toggle?: boolean; toggled?: boolean; onToggle?: (v: boolean) => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={s.settingRow}>
      <Text style={s.settingIcon}>{icon}</Text>
      <Text style={[s.settingLabel, danger && { color: Colors.red }]}>{label}</Text>
      {toggle
        ? <Switch value={toggled} onValueChange={onToggle} trackColor={{ true: Colors.orange }} thumbColor={Colors.white} />
        : <>
            {value ? <Text style={s.settingValue}>{value}</Text> : null}
            {onPress && !danger ? <Text style={s.chevron}>›</Text> : null}
          </>
      }
    </TouchableOpacity>
  );
}

function EditModal({
  profile,
  onSave,
  onClose,
  canEditCity,
}: {
  profile: any;
  onSave: (p: any) => void;
  onClose: () => void;
  canEditCity: boolean;
}) {
  const [name,  setName]  = useState(profile.name);
  const [city,  setCity]  = useState(profile.city);
  const [bio,   setBio]   = useState(profile.bio || DEFAULT_SHOP_BIO);
  const [saving,setSaving]= useState(false);

  const save = async () => {
    if (!name.trim() || (canEditCity && !city.trim())) {
      Alert.alert('Required', canEditCity ? 'Name and city cannot be empty' : 'Name cannot be empty');
      return;
    }
    if (bio.length > 500) { Alert.alert('Bio too long', 'Bio can be up to 500 characters.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ...(canEditCity ? { city: city.trim() } : {}),
        bio: bio.trim(),
      });
      onClose();
    }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <View style={m.root}>
      <View style={m.handle} />
      <Text style={m.title}>Edit Profile</Text>
      <Text style={m.label}>NAME</Text>
      <View style={m.inputWrap}>
        <TextInput style={m.input} value={name} onChangeText={setName} placeholderTextColor={Colors.dim} />
      </View>
      {canEditCity ? (
        <>
          <Text style={m.label}>CITY</Text>
          <View style={m.inputWrap}>
            <TextInput style={m.input} value={city} onChangeText={setCity} placeholderTextColor={Colors.dim} />
          </View>
        </>
      ) : (
        <>
          <Text style={m.label}>DISCOVERY AREA</Text>
          <View style={m.inputWrap}>
            <TextInput style={m.input} value={city} editable={false} placeholderTextColor={Colors.dim} />
          </View>
        </>
      )}
      <Text style={m.label}>BIO (500 characters)</Text>
      <View style={[m.inputWrap, { height: 100 }]}>
        <TextInput
          style={[m.input, { textAlignVertical: 'top' }]}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={500}
          placeholder="Tell people about yourself or your shop…"
          placeholderTextColor={Colors.dim}
        />
      </View>
      <TouchableOpacity onPress={save} disabled={saving} style={m.btn}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={m.btnText}>Save Changes</Text>}
      </TouchableOpacity>
    </View>
  );
}

function RadiusModal({ current, onSave, onClose }: { current: number; onSave: (r: number) => void; onClose: () => void }) {
  const [radius, setRadius] = useState(current);
  return (
    <View style={m.root}>
      <View style={m.handle} />
      <Text style={m.title}>Discovery Radius</Text>
      <Text style={m.sub}>Set how far you want to discover shops and services</Text>
      <View style={m.radiusRow}>
        {RADIUS_OPTIONS.map(r => (
          <TouchableOpacity key={r} onPress={() => setRadius(r)} style={[m.radiusBtn, radius === r && m.radiusBtnActive]}>
            <Text style={[m.radiusBtnText, radius === r && { color: Colors.white }]}>{r} km</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={() => { onSave(radius); onClose(); }} style={m.btn}>
        <Text style={m.btnText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );
}

function ThemeModal({ current, onSelect, onClose }: { current: AppThemeId; onSelect: (themeId: AppThemeId) => void; onClose: () => void }) {
  return (
    <View style={m.root}>
      <View style={m.handle} />
      <Text style={m.title}>Choose Theme</Text>
      <Text style={m.sub}>Pick the look that should be used across the app.</Text>
      <View style={{ gap: 10 }}>
        {THEME_OPTIONS.map(option => {
          const active = current === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[m.themeOption, active && m.themeOptionActive]}
            >
              <View style={[m.themeSwatch, { backgroundColor: option.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={m.themeTitle}>{option.label}</Text>
                <Text style={m.themeNote}>{option.note}</Text>
              </View>
              <Text style={[m.themeCheck, active && m.themeCheckActive]}>{active ? '✓' : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={onClose} style={[m.btn, { marginTop: 14 }]}>
        <Text style={m.btnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

function PlansModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: 'free' | 'pro' | 'premium';
  onSelect: (p: 'free' | 'pro' | 'premium') => void;
  onClose: () => void;
}) {
  return (
    <View style={m.root}>
      <View style={m.handle} />
      <Text style={m.title}>Shopkeeper Plans</Text>
      <Text style={m.sub}>Choose a plan to unlock more features.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {([
          ['free', 'Free Hobby', '$0/mo', ['Basic access', 'Limited products', 'Default theme']],
          ['pro', 'Pro Hobby', '$20/mo', ['More products', 'Advanced themes', 'Priority support']],
          ['premium', 'Premium', '$40/mo', ['Unlimited products', 'Pro analytics', 'Early access']],
        ] as const).map(([id, title, price, features]) => {
          const active = selected === id;
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.9}
              style={[s.planCard, { width: 240 }, active && s.planCardActive]}
              onPress={() => onSelect(id)}
            >
              <Text style={s.planTitle}>{title}</Text>
              <Text style={s.planPrice}>{price}</Text>
              <View style={s.planFeatures}>
                {features.map((f, i) => (
                  <Text key={i} style={s.planFeature}>• {f}</Text>
                ))}
              </View>
              <View style={s.planBtn}>
                <Text style={active ? s.planBtnTextActive : s.planBtnText}>{active ? 'Selected ✓' : 'Select'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity onPress={onClose} style={[m.btn, { marginTop: 14 }]}>
        <Text style={m.btnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const TEXT_CARD_BACKGROUNDS = [
  { id: 'sunset', color: '#E94F37' },
  { id: 'berry', color: '#7B2CBF' },
  { id: 'ocean', color: '#146C94' },
  { id: 'midnight', color: '#172554' },
  { id: 'forest', color: '#146B55' },
  { id: 'rose', color: '#BE185D' },
  { id: 'amber', color: '#C2410C' },
  { id: 'slate', color: '#334155' },
] as const;

const TEXT_CARD_COLORS = [
  { id: 'white', color: '#FFFFFF' },
  { id: 'ink', color: '#111827' },
  { id: 'sun', color: '#FDE047' },
  { id: 'mint', color: '#A7F3D0' },
  { id: 'blush', color: '#FBCFE8' },
] as const;

const TEXT_FONT_STYLES = {
  classic: { fontSize: 16, fontWeight: '600' },
  bold: { fontSize: 18, fontWeight: '900' },
  elegant: { fontSize: 17, fontFamily: 'serif', fontStyle: 'italic' },
  typewriter: { fontSize: 15, fontFamily: 'monospace', fontWeight: '700' },
} as const;

type TextCardMeta = {
  text: string;
  fontStyle?: keyof typeof TEXT_FONT_STYLES;
  background?: string;
  textColor?: string;
  style?: string;
};

function getTextBackground(id?: string) {
  return TEXT_CARD_BACKGROUNDS.find(o => o.id === id)?.color ?? TEXT_CARD_BACKGROUNDS[0].color;
}

function getTextColor(id?: string) {
  return TEXT_CARD_COLORS.find(o => o.id === id)?.color ?? TEXT_CARD_COLORS[0].color;
}

function getTextFontStyle(id?: string) {
  if (id && id in TEXT_FONT_STYLES) return (TEXT_FONT_STYLES as any)[id];
  return id === 'headline' ? TEXT_FONT_STYLES.bold : TEXT_FONT_STYLES.classic;
}

function parseTextCardCaption(caption?: string): TextCardMeta | null {
  if (typeof caption !== 'string') return null;
  if (!caption.startsWith('__TEXT_CARD__')) return null;
  try {
    const raw = JSON.parse(caption.slice('__TEXT_CARD__'.length));
    return raw as TextCardMeta;
  } catch {
    return null;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile: updateLocal, signOut, followedShopIds } = useAuthStore();
  const [editOpen,   setEditOpen]   = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notifs,     setNotifs]     = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [sellerShopProducts, setSellerShopProducts] = useState<number | null>(null);
  const [shopCoverUrl, setShopCoverUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'profile' | 'settings'>('profile');
  const [profileTab, setProfileTab] = useState<'posts' | 'tagged' | 'saved'>('posts');
  const [settingsQuery, setSettingsQuery] = useState('');
  const [selectedShopPlan, setSelectedShopPlan] = useState<'free' | 'pro' | 'premium'>('free');
  const [plansOpen, setPlansOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState<any[]>([]);
  const [postOpen, setPostOpen] = useState(false);
  const [activePost, setActivePost] = useState<any | null>(null);
  const [appearanceBarOpen, setAppearanceBarOpen] = useState(false);
  const [termsBarOpen, setTermsBarOpen] = useState(false);
  const [settingsBarOpen, setSettingsBarOpen] = useState(false);

  const isSeller = profile?.role === 'seller' || profile?.role === 'service_provider';
  const isBuyer = profile?.role === 'buyer';
  const isLockedSeller = profile?.role === 'seller';

  useEffect(() => {
    if (!profile || !isSeller) return;
    let cancelled = false;
    (async () => {
      try {
        const shop = await getShopByOwner(profile.id);
        setShopCoverUrl(shop?.cover_url ?? null);
        // #region agent log
        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H3',location:'app/(tabs)/profile.tsx:158',message:'seller shop loaded for profile cover',data:{isSeller,hasShop:!!shop,hasCoverUrl:!!shop?.cover_url},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!shop || cancelled) {
          return;
        }
        const posts = await getPostsByShop(shop.id);
        setSellerShopProducts(posts.filter(post => !!post.product_id).length);
      } catch (error: any) {
        if (!cancelled) setSellerShopProducts(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSeller, profile?.id]);

  useEffect(() => {
    if (viewMode !== 'profile') return;
    if (!profile || profileTab !== 'posts') return;
    if (!isSeller) {
      setProfilePosts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const shop = await getShopByOwner(profile.id);
        if (!shop) {
          if (!cancelled) setProfilePosts([]);
          return;
        }
        const posts = await getPostsByShop(shop.id);
        const textCardCount = Array.isArray(posts)
          ? posts.filter(p => typeof p?.caption === 'string' && p.caption.startsWith('__TEXT_CARD__')).length
          : 0;
        if (!cancelled) setProfilePosts(Array.isArray(posts) ? posts : []);
      } catch {
        if (!cancelled) setProfilePosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, isSeller, profileTab, viewMode]);

  useEffect(() => {
    if (!profile) return;
    // #region agent log
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-media-debug',hypothesisId:'H7',location:'app/(tabs)/profile.tsx:173',message:'profile media state on screen',data:{role:profile.role,hasAvatarUrl:!!profile.avatar_url,hasShopCoverUrl:!!shopCoverUrl},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [profile?.id, profile?.role, profile?.avatar_url, shopCoverUrl]);

  if (!profile) return null;

  const handleSaveProfile = async (updates: Partial<typeof profile>) => {
    await updateProfile(profile.id, updates);
    if (isSeller && typeof updates.bio === 'string') {
      const shop = await getShopByOwner(profile.id);
      if (shop) await updateShop(shop.id, { description: updates.bio });
    }
    updateLocal(updates);
  };

  const changeAvatar = async () => {
    if (avatarUploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      setAvatarUploading(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = `avatars/${profile.id}/${Date.now()}.jpg`;
      const url = await uploadImage('cityconnect', path, blob, 'image/jpeg');
      await handleSaveProfile({ avatar_url: url });
    } catch (e: any) {
      Alert.alert('Photo upload failed', e?.message || 'Try again with a different photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const changeCover = async () => {
    if (!isSeller || coverUploading) return;
    try {
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H4',location:'app/(tabs)/profile.tsx:210',message:'cover change requested',data:{isSeller,coverUploading},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const shop = await getShopByOwner(profile.id);
      if (!shop) {
        // #region agent log
        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H4',location:'app/(tabs)/profile.tsx:214',message:'cover change blocked because shop missing',data:{hasShop:false},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        Alert.alert('Create shop first', 'Set up your shop before changing the cover.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 1],
      });
      if (result.canceled || !result.assets[0]) {
        // #region agent log
        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H4',location:'app/(tabs)/profile.tsx:223',message:'cover picker closed without asset',data:{canceled:result.canceled,assetCount:result.assets?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }
      setCoverUploading(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = `covers/${profile.id}/${Date.now()}.jpg`;
      const url = await uploadImage('cityconnect', path, blob, 'image/jpeg');
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H2',location:'app/(tabs)/profile.tsx:233',message:'cover image uploaded',data:{hasUploadUrl:!!url},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const updatedShop = await updateShop(shop.id, { cover_url: url } as any);
      setShopCoverUrl(updatedShop.cover_url ?? null);
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H1',location:'app/(tabs)/profile.tsx:237',message:'cover url saved on shop',data:{hasCoverUrl:!!updatedShop.cover_url,hasLocalCoverState:!!(updatedShop.cover_url ?? null)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-cover-debug',hypothesisId:'H2',location:'app/(tabs)/profile.tsx:240',message:'cover change failed',data:{message:e?.message ?? 'unknown'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      Alert.alert('Cover upload failed', e?.message || 'Try again with a different image.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSaveRadius = async (radius_km: number) => {
    // Sellers keep their original signup radius; buyers and other roles can adjust later.
    if (profile.role === 'seller') return;
    await updateProfile(profile.id, { radius_km });
    updateLocal({ radius_km });
  };

  const handleRoleSwitch = async () => {
    const newRole = profile.role === 'buyer' ? 'seller' : 'buyer';
    Alert.alert(
      'Switch Role',
      `Switch to ${newRole === 'seller' ? 'Seller' : 'Buyer'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch', onPress: async () => {
            await updateProfile(profile.id, { role: newRole });
            updateLocal({ role: newRole });
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    const doLogout = async () => {
      setSigningOut(true);
      try {
        await signOut();
        // Force navigation back into the auth flow so the user immediately
        // sees they’re logged out (independent of auth listener timing).
        router.replace('/(auth)/role' as any);
      } finally {
        setSigningOut(false);
      }
    };

    // Expo web + React Native Alert can be unreliable; use window.confirm instead.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm('Are you sure you want to log out?');
      if (!ok) return;
      void doLogout();
      return;
    }

    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void doLogout() },
    ]);
  };

  const roleEmoji = profile.role === 'buyer' ? '🛍️' : profile.role === 'seller' ? '🏪' : '🔧';
  const roleLabel = profile.role === 'buyer' ? 'Buyer' : profile.role === 'seller' ? 'Seller' : 'Service Provider';
  const activeTheme = THEME_OPTIONS.find(option => option.id === CurrentThemeId) ?? THEME_OPTIONS[0];

  const handleThemeSelect = (themeId: AppThemeId) => {
    if (themeId === CurrentThemeId) {
      setThemeOpen(false);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
      window.location.reload();
      return;
    }

    Alert.alert('Theme saved', 'Theme changes are available on web preview right now.');
    setThemeOpen(false);
  };

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {viewMode === 'profile' ? (
          <>
            {/* Cover */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={isSeller ? changeCover : undefined}
              style={s.cover}
            >
              {shopCoverUrl ? (
                <Image
                  source={{ uri: shopCoverUrl }}
                  style={s.coverImage}
                  resizeMode="cover"
                  onLoad={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'post-fix',hypothesisId:'H1',location:'app/(tabs)/profile.tsx:309',message:'cover image rendered successfully',data:{hasShopCoverUrl:!!shopCoverUrl},timestamp:Date.now()})}).catch(()=>{});
                    // #endregion
                  }}
                  onError={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'post-fix',hypothesisId:'H6',location:'app/(tabs)/profile.tsx:315',message:'cover image failed to render',data:{hasShopCoverUrl:!!shopCoverUrl},timestamp:Date.now()})}).catch(()=>{});
                    // #endregion
                  }}
                />
              ) : null}
              <View style={s.coverOverlay} />
              <Text style={s.coverEmoji}>🏙️</Text>
            </TouchableOpacity>

            {/* Avatar + edit */}
            <View style={s.avatarRow}>
              <TouchableOpacity onPress={changeAvatar} style={s.avatar} activeOpacity={0.8}>
                {profile.avatar_url
                  ? <Image
                      source={{ uri: profile.avatar_url }}
                      style={s.avatarImg}
                      onLoad={() => {
                        // #region agent log
                        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-media-debug',hypothesisId:'H6',location:'app/(tabs)/profile.tsx:327',message:'avatar image rendered successfully',data:{hasAvatarUrl:true},timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
                      }}
                      onError={() => {
                        // #region agent log
                        fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'10da03'},body:JSON.stringify({sessionId:'10da03',runId:'profile-media-debug',hypothesisId:'H6',location:'app/(tabs)/profile.tsx:333',message:'avatar image failed to render',data:{hasAvatarUrl:true},timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
                      }}
                    />
                  : <Text style={s.avatarEmoji}>{roleEmoji}</Text>}
              </TouchableOpacity>
              <View style={s.avatarActions}>
                <TouchableOpacity onPress={() => setEditOpen(true)} style={s.editBtn}>
                  <Text style={s.editBtnText}>✏️ Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('settings')} style={s.iconBtn} activeOpacity={0.85} accessibilityRole="button">
              <Text style={s.iconBtnText}>≡</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Info */}
            <View style={s.infoBlock}>
              <Text style={s.name}>{profile.name}</Text>
              <View style={s.roleBadge}>
                <Text style={s.roleText}>{roleEmoji} {roleLabel}</Text>
              </View>
              <Text style={s.city}>📍 {profile.city} · within {profile.radius_km} km</Text>
              <Text style={s.bio} numberOfLines={3}>{profile.bio || DEFAULT_SHOP_BIO}</Text>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <StatBox
                value={isSeller ? String(sellerShopProducts ?? 0) : String(followedShopIds.length)}
                label={isSeller ? 'Products' : 'Following'}
              />
              <StatBox value={String(followedShopIds.length)} label={isSeller ? 'Followers' : 'Shops'} />
              <StatBox value={`${profile.radius_km}`} label="km radius" />
            </View>

            {/* Tabs (Instagram-like) */}
            <View style={s.profileTabsRow}>
              <TouchableOpacity
                onPress={() => setProfileTab('posts')}
                style={[s.profileTabBtn, profileTab === 'posts' && s.profileTabBtnActive]}
              >
                <Text style={[s.profileTabIcon, profileTab === 'posts' && s.profileTabIconActive]}>▦</Text>
                <Text style={[s.profileTabLabel, profileTab === 'posts' && s.profileTabLabelActive]}>Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setProfileTab('tagged')}
                style={[s.profileTabBtn, profileTab === 'tagged' && s.profileTabBtnActive]}
              >
                <Text style={[s.profileTabIcon, profileTab === 'tagged' && s.profileTabIconActive]}>👥</Text>
                <Text style={[s.profileTabLabel, profileTab === 'tagged' && s.profileTabLabelActive]}>Tagged</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setProfileTab('saved')}
                style={[s.profileTabBtn, profileTab === 'saved' && s.profileTabBtnActive]}
              >
                <Text style={[s.profileTabIcon, profileTab === 'saved' && s.profileTabIconActive]}>🔖</Text>
                <Text style={[s.profileTabLabel, profileTab === 'saved' && s.profileTabLabelActive]}>Saved</Text>
              </TouchableOpacity>
            </View>

            {/* Posts grid */}
            <View style={s.gridWrap}>
              {profileTab === 'posts' && profilePosts.length > 0
                ? profilePosts.slice(0, 12).map((post, idx) => (
                    <TouchableOpacity
                      key={post.id ?? idx}
                      activeOpacity={0.9}
                      style={s.gridItem}
                      onPress={() => {
                        const postId = post?.id ?? null;
                        setActivePost(post);
                        setPostOpen(true);
                      }}
                    >
                      <View style={s.gridThumb}>
                        {post.media_urls?.length ? (
                          <Image source={{ uri: post.media_urls[0] }} style={s.gridThumbImg} />
                        ) : (() => {
                          const textMeta = parseTextCardCaption(post.caption);
                          if (!textMeta) return <Text style={s.gridEmoji}>📷</Text>;
                          return (
                            <View style={[s.textCardThumb, { backgroundColor: getTextBackground(textMeta.background) }]}>
                              <Text
                                style={[
                                  s.textCardThumbText,
                                  getTextFontStyle((textMeta as any).fontStyle ?? (textMeta as any).style ?? 'classic'),
                                  { color: getTextColor(textMeta.textColor) },
                                ]}
                                numberOfLines={3}
                              >
                                {textMeta.text}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                  ))
                : Array.from({ length: 12 }).map((_, idx) => (
                    <TouchableOpacity
                      key={`ph-${idx}`}
                      activeOpacity={0.9}
                      style={s.gridItem}
                      onPress={() => {
                      }}
                    >
                      <View style={s.gridThumb}>
                        <Text style={s.gridEmoji}>{profileTab === 'posts' ? '📷' : profileTab === 'tagged' ? '🏷️' : '🔖'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
            </View>

            <Text style={s.version}>CityConnect v1.0.0</Text>
          </>
        ) : (
          <>
            {/* Settings and activity header */}
            <View style={s.settingsHeader}>
              <TouchableOpacity onPress={() => setViewMode('profile')} style={s.settingsBackBtn} activeOpacity={0.85}>
                <Text style={s.settingsBackText}>‹</Text>
              </TouchableOpacity>
              <Text style={s.settingsTitle}>Settings and activity</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={s.settingsSearchWrap}>
              <Text style={s.settingsSearchIcon}>⌕</Text>
              <TextInput
                value={settingsQuery}
                onChangeText={setSettingsQuery}
                placeholder="Search"
                placeholderTextColor={Colors.dim}
                style={s.settingsSearchInput}
              />
            </View>

            {/* Instagram-like settings sections (3 bars) */}
            <View style={s.settingsListPad}>
              <View style={s.section}>
                <Text style={s.sectionTitle}>Appearance</Text>
                <SettingRow
                  icon="📍"
                  label="Location & Radius"
                  value={`${profile.city} · ${profile.radius_km} km`}
                  onPress={profile.role === 'seller' ? undefined : () => setRadiusOpen(true)}
                />
                <SettingRow icon="🎨" label="Theme" value={activeTheme.label} onPress={() => setThemeOpen(true)} />
                {isSeller ? (
                  <SettingRow
                    icon="💳"
                    label="Plans"
                    value={selectedShopPlan === 'free' ? 'Free Hobby' : selectedShopPlan === 'pro' ? 'Pro Hobby' : 'Premium'}
                    onPress={() => setPlansOpen(true)}
                  />
                ) : (
                  <SettingRow icon="🏪" label="Switch to Seller Mode" onPress={handleRoleSwitch} />
                )}
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Terms & Conditions</Text>
                <SettingRow icon="📋" label="Terms of Service" onPress={() => {}} />
                <SettingRow icon="🔒" label="Privacy Policy" onPress={() => {}} />
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Settings</Text>
                {isSeller && (
                  <SettingRow icon="🏪" label="My Shop" value="Manage" onPress={() => router.push('/seller/shop' as any)} />
                )}
                {isBuyer && (
                  <SettingRow icon="🛒" label="My Cart" onPress={() => router.push('/(tabs)/cart' as any)} />
                )}
                <SettingRow icon="🔔" label="Push Notifications" toggle toggled={notifs} onToggle={setNotifs} />
                <SettingRow icon="🌐" label="Language" value="English" />
                <SettingRow icon="📞" label="Help & Support" onPress={() => {}} />
                <SettingRow icon="⭐" label="Rate the App" onPress={() => {}} />
                <SettingRow icon="🚪" label={signingOut ? 'Signing out…' : 'Log Out'} onPress={handleSignOut} danger />
              </View>
            </View>

            <Text style={s.version}>CityConnect v1.0.0</Text>
          </>
        )}
      </ScrollView>

      {/* Edit Profile sheet */}
      {editOpen && (
        <TouchableOpacity onPress={() => setEditOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <EditModal
              profile={profile}
              onSave={handleSaveProfile}
              onClose={() => setEditOpen(false)}
              canEditCity={!isLockedSeller}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Radius sheet: locked for sellers after initial setup, open for buyers and other roles */}
      {radiusOpen && profile.role !== 'seller' && (
        <TouchableOpacity onPress={() => setRadiusOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <RadiusModal current={profile.radius_km} onSave={handleSaveRadius} onClose={() => setRadiusOpen(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {themeOpen && (
        <TouchableOpacity onPress={() => setThemeOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <ThemeModal current={CurrentThemeId} onSelect={handleThemeSelect} onClose={() => setThemeOpen(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {plansOpen && (
        <TouchableOpacity onPress={() => setPlansOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <PlansModal
              selected={selectedShopPlan}
              onSelect={(p) => {
                setSelectedShopPlan(p);
                setPlansOpen(false);
              }}
              onClose={() => setPlansOpen(false)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {postOpen && activePost && (
        <TouchableOpacity onPress={() => setPostOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View>
              <View style={m.handle} />
              <Text style={[m.title, { marginBottom: 12 }]}>Post</Text>
              {activePost.media_urls?.length ? (
                <Image source={{ uri: activePost.media_urls[0] }} style={s.postImg} resizeMode="cover" />
              ) : (() => {
                const textMeta = parseTextCardCaption(activePost.caption);
                if (!textMeta) return null;
                return (
                  <View style={[s.textCardBig, { backgroundColor: getTextBackground((textMeta as any).background) }]}>
                    <Text
                      style={[
                        s.textCardBigText,
                        getTextFontStyle((textMeta as any).fontStyle ?? (textMeta as any).style ?? 'classic'),
                        { color: getTextColor((textMeta as any).textColor) },
                      ]}
                      numberOfLines={6}
                    >
                      {textMeta.text}
                    </Text>
                  </View>
                );
              })()}
              <Text style={{ color: Colors.text, marginTop: 10, fontSize: 13, fontWeight: '600' }}>
                {activePost.shop_name ?? ''}
              </Text>
              <Text style={{ color: Colors.sub, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                {activePost.caption ?? ''}
              </Text>
              <TouchableOpacity onPress={() => setPostOpen(false)} style={[m.btn, { marginTop: 14 }]}>
                <Text style={m.btnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  cover:        { height: 160, backgroundColor: Colors.orange + '33', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverImage:   { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055' },
  coverEmoji:   { fontSize: 80, opacity: 0.25 },
  avatarRow:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -36 },
  avatarActions:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:       { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.card, borderWidth: 4, borderColor: Colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:    { width: '100%', height: '100%' },
  avatarEmoji:  { fontSize: 36 },
  editBtn:      { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText:  { color: Colors.text, fontSize: 13, fontWeight: '600' },
  iconBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:  { fontSize: 16, color: Colors.text },
  infoBlock:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 4 },
  name:         { fontSize: 22, fontWeight: '800', color: Colors.text },
  roleBadge:    { backgroundColor: Colors.orange + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
  roleText:     { color: Colors.orange, fontSize: 12, fontWeight: '700' },
  city:         { fontSize: 13, color: Colors.sub, marginTop: 4 },
  bio:          { fontSize: 12, color: Colors.sub, marginTop: 6 },
  statsRow:     { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, gap: 10 },
  stat:         { flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2 },
  statVal:      { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel:    { fontSize: 10, color: Colors.sub, marginTop: 2 },
  section:      { marginHorizontal: 20, marginTop: 20, backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, overflow: 'hidden' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.dim, letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  barHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  barHeaderTitle: { fontSize: 12, fontWeight: '800', color: Colors.text, letterSpacing: 0.6 },
  barChevron: { color: Colors.text, fontSize: 18 },
  settingRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  settingIcon:  { fontSize: 20, marginRight: 14 },
  settingLabel: { flex: 1, fontSize: 15, color: Colors.text },
  settingValue: { fontSize: 13, color: Colors.sub },
  chevron:      { color: Colors.dim, fontSize: 18, marginLeft: 8 },
  version:      { textAlign: 'center', color: Colors.dim, fontSize: 12, marginTop: 24, marginBottom: 8 },
  profileTabsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 4, marginBottom: 10, gap: 10 },
  profileTabBtn: { flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  profileTabBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '18' },
  profileTabIcon: { fontSize: 18, color: Colors.sub },
  profileTabIconActive: { color: Colors.orange },
  profileTabLabel: { marginTop: 2, fontSize: 11, color: Colors.sub, fontWeight: '700' },
  profileTabLabelActive: { color: Colors.text },
  gridWrap: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginBottom: 12 },
  gridItem: { width: '33.33%', aspectRatio: 1, },
  gridThumb: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gridEmoji: { fontSize: 22, opacity: 0.55 },
  gridThumbImg: { width: '100%', height: '100%' },
  textCardThumb: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  textCardThumbText: { textAlign: 'center', paddingHorizontal: 2, fontWeight: '700' },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  settingsBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  settingsBackText: { fontSize: 22, color: Colors.text, marginTop: -2 },
  settingsTitle: { flex: 1, textAlign: 'left', fontSize: 16, fontWeight: '800', color: Colors.text, paddingLeft: 8 },
  settingsSearchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.card, borderRadius: 24, borderWidth: 1.5, borderColor: Colors.border2, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  settingsSearchIcon: { fontSize: 16, color: Colors.dim },
  settingsSearchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 0 },
  settingsListPad: { paddingBottom: 24 },
  rightBarsWrap: { position: 'absolute', top: 120, right: 14, width: 270, zIndex: 40 },
  rightSection: { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, overflow: 'hidden', marginTop: 10 },
  plansWrap: { marginTop: 12 },
  plansRow: { paddingHorizontal: 16, gap: 10 },
  planCard: { width: 220, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border2, padding: 14 },
  planCardActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '12' },
  planTitle: { color: Colors.text, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  planPrice: { color: Colors.orange, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  planFeatures: { gap: 6, marginBottom: 12 },
  planFeature: { color: Colors.sub, fontSize: 12, lineHeight: 16 },
  planBtn: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border2, paddingVertical: 10, alignItems: 'center' },
  planBtnText: { color: Colors.sub, fontSize: 12, fontWeight: '800' },
  planBtnTextActive: { color: Colors.white, fontSize: 12, fontWeight: '900' },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: Colors.surface, borderRadius: 24, padding: 20 },
  postImg:      { width: '100%', height: 220, borderRadius: 14, marginTop: 2 },
  textCardBig: { width: '100%', height: 220, borderRadius: 14, marginTop: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  textCardBigText: { textAlign: 'center', fontWeight: '700' },
});

const m = StyleSheet.create({
  root:          { gap: 4 },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  title:         { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  sub:           { fontSize: 13, color: Colors.sub, marginBottom: 16 },
  label:         { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, marginBottom: 8 },
  inputWrap:     { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  input:         { color: Colors.text, fontSize: 16, paddingVertical: 12 },
  radiusRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  radiusBtn:     { flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  radiusBtnActive:{ backgroundColor: Colors.orange, borderColor: Colors.orange },
  radiusBtnText: { fontSize: 14, fontWeight: '700', color: Colors.sub },
  btn:           { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText:       { color: Colors.white, fontSize: 15, fontWeight: '700' },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  themeOptionActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '18' },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  themeNote: { color: Colors.sub, fontSize: 12, marginTop: 2 },
  themeCheck: { width: 18, textAlign: 'center', color: Colors.dim, fontSize: 16, fontWeight: '800' },
  themeCheckActive: { color: Colors.orange },
});
