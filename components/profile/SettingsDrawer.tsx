// components/profile/SettingsDrawer.tsx — Glassmorphic settings & activity

import { useState } from 'react';
import {
  View, Text, TextInput, Switch, ScrollView, Platform, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Fonts, DEFAULT_SHOP_BIO, THEME_OPTIONS, type AppThemeId, createDynamicStyles, getThemeMeta, CurrentThemeId } from '../../constants/theme';
import { matchesSettingsSearch, unicodeProsStyle } from '../../lib/profileUtils';
import {
  canEditDiscoveryRadius,
  isMerchantSeller,
  isServiceProvider,
} from '../../stores/roleUtils';
import type { Profile } from '../../types';
import { SpringPressable } from '../ui/modernSurfaces';

function SettingRow({
  icon, label, value, onPress, danger, toggle, toggled, onToggle,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={s.row}>
      <Text style={s.rowIcon}>{icon}</Text>
      <Text style={[s.rowLabel, danger && { color: Colors.red }]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggled}
          onValueChange={onToggle}
          trackColor={{ true: Colors.orange }}
          thumbColor={Colors.white}
        />
      ) : (
        <>
          {value ? <Text style={s.rowValue}>{value}</Text> : null}
          {onPress && !danger ? <Text style={s.chevron}>›</Text> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

function GlassCard({ children, title }: { children: React.ReactNode; title: string }) {
  const light = getThemeMeta(CurrentThemeId).isLight;
  if (Platform.OS === 'web') {
    return (
      <View style={[s.card, s.cardWeb]}>
        <Text style={s.cardTitle}>{title}</Text>
        {children}
      </View>
    );
  }
  return (
    <View style={s.card}>
      <BlurView intensity={18} tint={light ? 'light' : 'dark'} style={s.blurFill} />
      <View style={s.cardInner}>
        <Text style={s.cardTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

type Props = {
  profile: Profile;
  themeId: AppThemeId;
  themeLabel: string;
  notifs: boolean;
  pushToggling?: boolean;
  signingOut?: boolean;
  shopPlan: 'free' | 'pro' | 'premium';
  showShopManagement: boolean;
  newEnquiryCount: number;
  proLeadCount: number;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  onBack: () => void;
  onOpenRadius: () => void;
  onOpenTheme: () => void;
  onOpenPlans: () => void;
  onOpenEnquiries: () => void;
  onOpenProLeads: () => void;
  onOpenShop: () => void;
  onChangeCover: () => void;
  onOpenCart: () => void;
  onSwitchRole: () => void;
  onTogglePush: (v: boolean) => void;
  onOpenLegal: (doc: 'terms' | 'privacy' | 'help') => void;
  onSignOut: () => void;
};

export function SettingsDrawer(props: Props) {
  const q = props.searchQuery.trim();
  const locationLocked = !canEditDiscoveryRadius(props.profile.role);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={props.onBack} style={s.backBtn} activeOpacity={0.85}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings and activity</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={props.searchQuery}
          onChangeText={props.onChangeSearch}
          placeholder="Search settings"
          placeholderTextColor={Colors.dim}
          style={s.searchInput}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {matchesSettingsSearch(q, 'Account', 'Profile', 'Seller', 'Switch') ? (
          <GlassCard title="Account">
            <SettingRow
              icon="👤"
              label="Signed in as"
              value={props.profile.name}
            />
            {props.profile.role === 'buyer' && matchesSettingsSearch(q, 'Switch', 'Seller') ? (
              <SettingRow icon="🛍️" label="Switch to Seller Mode" onPress={props.onSwitchRole} />
            ) : null}
            {isMerchantSeller(props.profile.role) && matchesSettingsSearch(q, 'Switch', 'Buyer') ? (
              <SettingRow icon="🛍️" label="Switch to Buyer Mode" onPress={props.onSwitchRole} />
            ) : null}
          </GlassCard>
        ) : null}

        {matchesSettingsSearch(q, 'Location', 'Radius', 'Theme', 'Appearance') ? (
          <GlassCard title="Location & Appearance">
            <SettingRow
              icon="📍"
              label="Location & Radius"
              value={`${props.profile.city} · ${props.profile.radius_km} km${locationLocked ? ' 🔒' : ''}`}
              onPress={props.onOpenRadius}
            />
            <SettingRow
              icon="🎨"
              label="Theme"
              value={props.themeLabel}
              onPress={props.onOpenTheme}
            />
          </GlassCard>
        ) : null}

        {props.showShopManagement && matchesSettingsSearch(q, 'Shop', 'Plans', 'Cover', 'Enquiries', 'Leads') ? (
          <GlassCard title="Shop Management">
            {isMerchantSeller(props.profile.role) ? (
              <SettingRow
                icon="📥"
                label="Enquiries & Leads"
                value={props.newEnquiryCount > 0 ? `${props.newEnquiryCount} new` : 'Manage'}
                onPress={props.onOpenEnquiries}
              />
            ) : null}
            {isServiceProvider(props.profile.role) ? (
              <SettingRow
                icon="📥"
                label="Enquiries & Leads"
                value={props.proLeadCount > 0 ? `${props.proLeadCount} new` : 'Manage'}
                onPress={props.onOpenProLeads}
              />
            ) : null}
            <SettingRow icon="🏪" label="My Shop" value="Manage" onPress={props.onOpenShop} />
            <SettingRow icon="🖼️" label="Shop Wall" value="Change" onPress={props.onChangeCover} />
            <SettingRow
              icon="💳"
              label="Shopkeeper Plans"
              value={props.shopPlan === 'free' ? 'Free Hobby' : props.shopPlan === 'pro' ? 'Pro Hobby' : 'Premium'}
              onPress={props.onOpenPlans}
            />
          </GlassCard>
        ) : null}

        {isServiceProvider(props.profile.role) && !props.showShopManagement && matchesSettingsSearch(q, 'Enquiries', 'Leads') ? (
          <GlassCard title="Service Leads">
            <SettingRow
              icon="📥"
              label="Enquiries & Leads"
              value={props.proLeadCount > 0 ? `${props.proLeadCount} new` : 'Manage'}
              onPress={props.onOpenProLeads}
            />
          </GlassCard>
        ) : null}

        {matchesSettingsSearch(q, 'Security', 'Notifications', 'Push', 'Cart') ? (
          <GlassCard title="Security & Preferences">
            {props.profile.role === 'buyer' && matchesSettingsSearch(q, 'Cart') ? (
              <SettingRow icon="🛒" label="My Cart" onPress={props.onOpenCart} />
            ) : null}
            <SettingRow
              icon="🔔"
              label="Push Notifications"
              toggle
              toggled={props.notifs}
              onToggle={v => { if (!props.pushToggling) props.onTogglePush(v); }}
            />
            <SettingRow icon="🌐" label="Language" value="English" />
          </GlassCard>
        ) : null}

        {matchesSettingsSearch(q, 'Help', 'Support', 'Terms', 'Privacy', 'Rate', 'Log Out') ? (
          <GlassCard title="Help & Support">
            <SettingRow icon="📋" label="Terms of Service" onPress={() => props.onOpenLegal('terms')} />
            <SettingRow icon="🔒" label="Privacy Policy" onPress={() => props.onOpenLegal('privacy')} />
            <SettingRow icon="📞" label="Help & Support" onPress={() => props.onOpenLegal('help')} />
            <SettingRow icon="⭐" label="Rate the App" onPress={() => {}} />
            <SettingRow
              icon="🚪"
              label={props.signingOut ? 'Signing out…' : 'Log Out'}
              onPress={props.onSignOut}
              danger
            />
          </GlassCard>
        ) : null}

        <Text style={s.version}>Vedastya v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

export function EditProfileSheet({
  visible,
  profile,
  canEditCity,
  onSave,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  canEditCity: boolean;
  onSave: (p: Partial<Profile>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [city, setCity] = useState(profile.city);
  const [bio, setBio] = useState(profile.bio || DEFAULT_SHOP_BIO);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const save = async () => {
    if (!name.trim() || (canEditCity && !city.trim())) return;
    if (bio.length > 500) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ...(canEditCity ? { city: city.trim() } : {}),
        bio: bio.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Edit Profile</Text>
          <Text style={s.label}>NAME</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={Colors.dim} />
          <Text style={s.label}>{canEditCity ? 'CITY' : 'DISCOVERY AREA'}</Text>
          <TextInput
            style={[s.input, !canEditCity && { opacity: 0.7 }]}
            value={city}
            onChangeText={setCity}
            editable={canEditCity}
            placeholderTextColor={Colors.dim}
          />
          <Text style={s.label}>BIO (500 characters)</Text>
          <TextInput
            style={[s.input, { height: 100, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            placeholder="Tell people about yourself or your shop…"
            placeholderTextColor={Colors.dim}
          />
          <SpringPressable style={s.primaryBtn} pressedScale={0.97} onPress={() => void save()} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
          </SpringPressable>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function ThemePickerSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: AppThemeId;
  onSelect: (id: AppThemeId) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Choose Theme</Text>
          <Text style={s.sheetSub}>Applies instantly across Vedastya.</Text>
          <View style={{ gap: 10 }}>
            {THEME_OPTIONS.map(option => {
              const active = current === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => onSelect(option.id)}
                  style={[
                    s.themeOption,
                    { backgroundColor: option.previewBg, borderColor: active ? option.accent : option.previewBg },
                  ]}
                >
                  <View style={[s.themeSwatch, { backgroundColor: option.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: option.previewText, fontWeight: '800' }}>{option.label}</Text>
                    <Text style={{ color: option.previewText, opacity: 0.72, fontSize: 12 }}>{option.note}</Text>
                  </View>
                  <Text style={{ color: active ? option.accent : option.previewText }}>{active ? '✓' : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <SpringPressable style={[s.primaryBtn, { marginTop: 14 }]} pressedScale={0.97} onPress={onClose}>
            <Text style={s.primaryBtnText}>Done</Text>
          </SpringPressable>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function PlansPickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: 'free' | 'pro' | 'premium';
  onSelect: (p: 'free' | 'pro' | 'premium') => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Shopkeeper Plans</Text>
          <Text style={s.sheetSub}>Choose a plan to unlock more features.</Text>
          {([
            ['free', 'Free Hobby', '$0/mo'],
            ['pro', 'Pro Hobby', '$20/mo'],
            ['premium', 'Premium', '$40/mo'],
          ] as const).map(([id, title, price]) => {
            const active = selected === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.planRow, active && s.planRowActive]}
                onPress={() => onSelect(id)}
              >
                <View>
                  <Text style={s.planTitle}>{title}</Text>
                  <Text style={s.planPrice}>{price}</Text>
                </View>
                <Text style={{ color: active ? Colors.orange : Colors.dim }}>{active ? 'Selected ✓' : 'Select'}</Text>
              </TouchableOpacity>
            );
          })}
          <SpringPressable style={[s.primaryBtn, { marginTop: 14 }]} pressedScale={0.97} onPress={onClose}>
            <Text style={s.primaryBtnText}>Close</Text>
          </SpringPressable>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 32, color: Colors.text, marginTop: -4 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { color: Colors.dim, fontSize: 16 },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.body,
    paddingVertical: 11,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card + 'CC',
  },
  cardWeb: { padding: 12 },
  blurFill: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object) },
  cardInner: { padding: 12 },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dim,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rowIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  rowLabel: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  rowValue: { color: Colors.sub, fontSize: 12, fontWeight: '600', maxWidth: 140 },
  chevron: { color: Colors.dim, fontSize: 18, fontWeight: '700' },
  version: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginBottom: 12,
  },
  sheetTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  sheetSub: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.sub,
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.dim,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    ...unicodeProsStyle,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
  },
  themeSwatch: { width: 28, height: 28, borderRadius: 8 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 8,
  },
  planRowActive: { borderColor: Colors.orange },
  planTitle: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  planPrice: { color: Colors.sub, fontSize: 12, marginTop: 2 },
}));
