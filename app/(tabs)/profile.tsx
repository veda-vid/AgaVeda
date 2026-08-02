// app/(tabs)/profile.tsx
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { updateProfile } from '../../lib/api';
import { Colors, RADIUS_OPTIONS } from '../../constants/theme';

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

function EditModal({ profile, onSave, onClose }: { profile: any; onSave: (p: any) => void; onClose: () => void }) {
  const [name,  setName]  = useState(profile.name);
  const [city,  setCity]  = useState(profile.city);
  const [saving,setSaving]= useState(false);

  const save = async () => {
    if (!name.trim() || !city.trim()) { Alert.alert('Required', 'Name and city cannot be empty'); return; }
    setSaving(true);
    try { await onSave({ name: name.trim(), city: city.trim() }); onClose(); }
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
      <Text style={m.label}>CITY</Text>
      <View style={m.inputWrap}>
        <TextInput style={m.input} value={city} onChangeText={setCity} placeholderTextColor={Colors.dim} />
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

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile: updateLocal, signOut, followedShopIds } = useAuthStore();
  const [editOpen,   setEditOpen]   = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [notifs,     setNotifs]     = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  if (!profile) return null;

  const isSeller = profile.role === 'seller' || profile.role === 'service_provider';
  const isBuyer = profile.role === 'buyer';

  const handleSaveProfile = async (updates: Partial<typeof profile>) => {
    await updateProfile(profile.id, updates);
    updateLocal(updates);
  };

  const handleSaveRadius = async (radius_km: number) => {
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

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Cover */}
        <View style={s.cover}>
          <View style={s.coverOverlay} />
          <Text style={s.coverEmoji}>🏙️</Text>
        </View>

        {/* Avatar + edit */}
        <View style={s.avatarRow}>
          <View style={s.avatar}><Text style={s.avatarEmoji}>{roleEmoji}</Text></View>
          <TouchableOpacity onPress={() => setEditOpen(true)} style={s.editBtn}>
            <Text style={s.editBtnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={s.infoBlock}>
          <Text style={s.name}>{profile.name}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{roleEmoji} {roleLabel}</Text>
          </View>
          <Text style={s.city}>📍 {profile.city} · within {profile.radius_km} km</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatBox value={isSeller ? '—' : String(followedShopIds.length)} label={isSeller ? 'Products' : 'Following'} />
          <StatBox value={String(followedShopIds.length)} label={isSeller ? 'Followers' : 'Shops'} />
          <StatBox value={`${profile.radius_km}`} label="km radius" />
        </View>

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          {isSeller && (
            <SettingRow icon="🏪" label="My Shop" value="Manage" onPress={() => router.push('/seller/shop' as any)} />
          )}
          {isBuyer && (
            <SettingRow icon="🛒" label="My Cart" onPress={() => router.push('/(tabs)/cart' as any)} />
          )}
          <SettingRow icon="📍" label="Location & Radius" value={`${profile.city} · ${profile.radius_km} km`} onPress={() => setRadiusOpen(true)} />
          <SettingRow icon="🔔" label="Push Notifications" toggle toggled={notifs} onToggle={setNotifs} />
          <SettingRow icon={isSeller ? '🛍️' : '🏪'} label={isSeller ? 'Switch to Buyer Mode' : 'Switch to Seller Mode'} onPress={handleRoleSwitch} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Preferences</Text>
          <SettingRow icon="🌐" label="Language" value="English" />
          <SettingRow icon="🎨" label="Theme" value="Dark" />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Support</Text>
          <SettingRow icon="📞" label="Help & Support" onPress={() => {}} />
          <SettingRow icon="⭐" label="Rate the App" onPress={() => {}} />
          <SettingRow icon="📋" label="Terms of Service" onPress={() => {}} />
          <SettingRow icon="🔒" label="Privacy Policy" onPress={() => {}} />
        </View>

        <View style={s.section}>
          <SettingRow icon="🚪" label={signingOut ? 'Signing out…' : 'Log Out'} onPress={handleSignOut} danger />
        </View>

        <Text style={s.version}>CityConnect v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile sheet */}
      {editOpen && (
        <TouchableOpacity onPress={() => setEditOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <EditModal profile={profile} onSave={handleSaveProfile} onClose={() => setEditOpen(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Radius sheet */}
      {radiusOpen && (
        <TouchableOpacity onPress={() => setRadiusOpen(false)} style={s.overlay} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <RadiusModal current={profile.radius_km} onSave={handleSaveRadius} onClose={() => setRadiusOpen(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  cover:        { height: 160, backgroundColor: Colors.orange + '33', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055' },
  coverEmoji:   { fontSize: 80, opacity: 0.25 },
  avatarRow:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -36 },
  avatar:       { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.card, borderWidth: 4, borderColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:  { fontSize: 36 },
  editBtn:      { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText:  { color: Colors.text, fontSize: 13, fontWeight: '600' },
  infoBlock:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 4 },
  name:         { fontSize: 22, fontWeight: '800', color: Colors.text },
  roleBadge:    { backgroundColor: Colors.orange + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
  roleText:     { color: Colors.orange, fontSize: 12, fontWeight: '700' },
  city:         { fontSize: 13, color: Colors.sub, marginTop: 4 },
  statsRow:     { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, gap: 10 },
  stat:         { flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2 },
  statVal:      { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel:    { fontSize: 10, color: Colors.sub, marginTop: 2 },
  section:      { marginHorizontal: 20, marginTop: 20, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, overflow: 'hidden' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, textTransform: 'uppercase' },
  settingRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  settingIcon:  { fontSize: 20, marginRight: 14 },
  settingLabel: { flex: 1, fontSize: 15, color: Colors.text },
  settingValue: { fontSize: 13, color: Colors.sub },
  chevron:      { color: Colors.dim, fontSize: 18, marginLeft: 8 },
  version:      { textAlign: 'center', color: Colors.dim, fontSize: 12, marginTop: 24, marginBottom: 8 },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: Colors.surface, borderRadius: 24, padding: 20 },
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
});
