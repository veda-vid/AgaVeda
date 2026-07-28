// app/seller/shop.tsx — Create / edit seller shop (required before posting)
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { createShop, getShopByOwner, updateShop } from '../../lib/api';
import { Colors, SHOP_CATEGORIES } from '../../constants/theme';
import type { ShopCategory } from '../../types';

export default function SellerShopScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ShopCategory>('grocery');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (!profile) return;
    getShopByOwner(profile.id)
      .then(shop => {
        if (shop) {
          setShopId(shop.id);
          setName(shop.name);
          setDescription(shop.description);
          setCategory(shop.category);
          setAddress(shop.address);
          setPhone(shop.phone);
          setWhatsapp(shop.whatsapp ?? '');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    if (!name.trim()) { Alert.alert('Required', 'Enter your shop name'); return; }
    if (!phone.trim()) { Alert.alert('Required', 'Enter a contact phone'); return; }
    if (profile.lat == null || profile.lng == null) {
      Alert.alert('Location needed', 'Set your location first so customers can find you.');
      return;
    }

    setSaving(true);
    try {
      if (shopId) {
        await updateShop(shopId, {
          name: name.trim(),
          description: description.trim(),
          category,
          address: address.trim() || profile.city,
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || null,
          city: profile.city,
          lat: profile.lat,
          lng: profile.lng,
        });
      } else {
        await createShop({
          owner_id: profile.id,
          name: name.trim(),
          description: description.trim(),
          category,
          logo_url: null,
          cover_url: null,
          address: address.trim() || profile.city,
          city: profile.city,
          lat: profile.lat,
          lng: profile.lng,
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || null,
          is_open: true,
          is_verified: false,
          is_active: true,
        });
      }
      Alert.alert('Saved', 'Your shop is ready. You can post products, stories and reels.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save shop');
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
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>✕</Text></TouchableOpacity>
        <Text style={s.headerTitle}>{shopId ? 'Edit Shop' : 'Create Shop'}</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>SHOP NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Sharma Kirana" placeholderTextColor={Colors.dim} />

        <Text style={s.label}>DESCRIPTION</Text>
        <TextInput
          style={[s.input, s.area]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What do you sell?"
          placeholderTextColor={Colors.dim}
        />

        <Text style={s.label}>CATEGORY</Text>
        <View style={s.chips}>
          {SHOP_CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[s.chip, category === c.id && s.chipActive]}
            >
              <Text style={[s.chipText, category === c.id && s.chipTextActive]}>{c.emoji} {c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>ADDRESS</Text>
        <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder={`${profile?.city ?? 'City'} area / street`} placeholderTextColor={Colors.dim} />

        <Text style={s.label}>PHONE</Text>
        <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91…" placeholderTextColor={Colors.dim} />

        <Text style={s.label}>WHATSAPP (optional)</Text>
        <TextInput style={s.input} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="91XXXXXXXXXX" placeholderTextColor={Colors.dim} />

        <Text style={s.hint}>Location: {profile?.city} · uses your profile pin for nearby discovery.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { color: Colors.sub, fontSize: 22, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  saveBtn: { backgroundColor: Colors.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 64, alignItems: 'center' },
  saveText: { color: Colors.white, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.6, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    color: Colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { color: Colors.sub, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.white },
  hint: { marginTop: 20, color: Colors.dim, fontSize: 12, lineHeight: 18 },
});
