// app/pro/settings.tsx — Manage My Listing (Home Pro Settings)

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Pressable, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  ensureServiceProviderRecord,
  getServiceProviderByProfile,
  updateServiceProvider,
} from '../../lib/api';
import { AddServiceSkillModal } from '../../components/seller/AddServiceSkillModal';
import { getProCategoryLabel, unicodeProsStyle } from '../../lib/prosUtils';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { ServiceProvider } from '../../types';

export default function ProSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const updateLocalProfile = useAuthStore(s => s.updateProfile);
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let row = await getServiceProviderByProfile(profile.id);
      if (!row) {
        row = await ensureServiceProviderRecord(profile.id, {
          name: profile.name ?? 'My Service',
          city: profile.city ?? 'Unknown',
          lat: profile.lat ?? null,
          lng: profile.lng ?? null,
          phone: profile.phone,
        });
      }
      setProvider(row);
    } catch (e) {
      console.error(e);
      Alert.alert('Could not load listing', 'Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  const toggleAvailable = async (next: boolean) => {
    if (!provider || !profile?.id) return;
    setSaving(true);
    const prev = provider;
    setProvider({ ...provider, is_available: next });
    try {
      const updated = await updateServiceProvider(provider.id, { is_available: next });
      setProvider(updated);
    } catch {
      setProvider(prev);
      Alert.alert('Update failed', 'Could not change availability.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <Text style={s.hint}>Sign in to manage your professional listing.</Text>
        <Pressable onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </Pressable>
        <View style={s.headerCopy}>
          <Text style={s.title}>Manage My Listing</Text>
          <Text style={s.sub}>Home Pro Settings</Text>
        </View>
        <View style={s.side} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={s.hint}>Loading your listing…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={[s.bizName, unicodeProsStyle]}>
              {provider?.business_name || profile.name || 'Your listing'}
            </Text>
            <Text style={s.meta}>
              {provider ? getProCategoryLabel(provider) : 'Service professional'}
              {provider?.city ? ` · ${provider.city}` : ''}
            </Text>
            {provider?.base_rate_label ? (
              <Text style={s.rate}>🏷️ {provider.base_rate_label}</Text>
            ) : null}
          </View>

          <View style={s.card}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.rowTitle}>Available for jobs</Text>
                <Text style={s.rowSub}>When off, buyers see you as Away.</Text>
              </View>
              <Switch
                value={!!provider?.is_available}
                onValueChange={v => { void toggleAvailable(v); }}
                disabled={saving || !provider}
                trackColor={{ false: Colors.border2, true: Colors.orange }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <Pressable style={s.primaryBtn} onPress={() => setShowSkillModal(true)}>
            <Text style={s.primaryBtnText}>🛠️ Edit skills & rates</Text>
          </Pressable>

          <Pressable
            style={s.secondaryBtn}
            onPress={() => router.replace('/(tabs)/' as any)}
          >
            <Text style={s.secondaryBtnText}>Open Home dashboard</Text>
          </Pressable>

          <Text style={s.footerNote}>
            Changes appear on the Pros marketplace for nearby buyers right away.
          </Text>
        </ScrollView>
      )}

      <AddServiceSkillModal
        visible={showSkillModal}
        provider={provider}
        onClose={() => setShowSkillModal(false)}
        onSaved={(updated) => {
          setProvider(updated);
          setShowSkillModal(false);
          if (updated.city || updated.lat != null) {
            updateLocalProfile({
              city: updated.city || profile.city,
              lat: updated.lat ?? profile.lat,
              lng: updated.lng ?? profile.lng,
            });
          }
        }}
      />
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  backBtnText: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  headerCopy: { flex: 1, alignItems: 'center' },
  side: { width: 40 },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  bizName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Fonts.bodySemiBold,
  },
  meta: { marginTop: 4, fontSize: 13, color: Colors.sub },
  rate: { marginTop: 8, fontSize: 13, fontWeight: '800', color: Colors.orange },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  rowSub: { marginTop: 3, fontSize: 12, color: Colors.sub },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  footerNote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.dim,
    lineHeight: 17,
  },
  hint: { color: Colors.sub, marginTop: 12, textAlign: 'center' },
  backLink: { marginTop: 16 },
  backLinkText: { color: Colors.orange, fontWeight: '800' },
}));
