// app/(auth)/role.tsx — Role selection
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { UserRole } from '../../types';

const ROLES = [
  { id: 'buyer'            as UserRole, icon: '🛍️', title: 'Buyer',            sub: 'Discover local shops, deals & services near you' },
  { id: 'seller'           as UserRole, icon: '🏪', title: 'Seller',           sub: 'List your shop, upload products & reach local buyers' },
  { id: 'service_provider' as UserRole, icon: '🔧', title: 'Service Provider', sub: 'Offer plumbing, electrical, cleaning & more' },
];

export default function RoleScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.heroGlow} />
      <Text style={s.eyebrow}>Choose Your Experience</Text>
      <Text style={s.title}>Welcome to{'\n'}Vedastya</Text>
      <Text style={s.sub}>
        A local social-commerce app inspired by Instagram: discover, follow, post, sell and stay updated in your city.
      </Text>

      <View style={s.previewCard}>
        <Text style={s.previewTitle}>What happens next?</Text>
        <Text style={s.previewText}>
          Pick your role, sign in, confirm your location, then start exploring local feeds, shops and services around you.
        </Text>
      </View>

      <Text style={s.label}>I want to join as</Text>

      {ROLES.map(r => (
        <TouchableOpacity
          key={r.id}
          onPress={() => setRole(r.id)}
          activeOpacity={0.75}
          style={[s.card, role === r.id && s.cardActive]}>
          <View style={[s.cardIconWrap, role === r.id && s.cardIconWrapActive]}>
            <Text style={s.cardIcon}>{r.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{r.title}</Text>
            <Text style={s.cardSub}>{r.sub}</Text>
          </View>
          <View style={[s.radio, role === r.id && s.radioActive]}>
            {role === r.id && <View style={s.radioDot} />}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={() => role && router.push({ pathname: '/(auth)/login', params: { role } })}
        activeOpacity={0.85}
        style={[s.btn, { opacity: role ? 1 : 0.4 }]}>
        <Text style={s.btnText}>Continue</Text>
      </TouchableOpacity>

      <Text style={s.terms}>By continuing you agree to our Terms of Service & Privacy Policy</Text>
    </ScrollView>
  );
}

const s = createDynamicStyles((Colors) => ({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  heroGlow: { position: 'absolute', top: 40, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.orange + '16' },
  eyebrow: { fontSize: 13, color: Colors.orange, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  title:   { fontSize: 38, fontFamily: Fonts.displayXBold, fontWeight: '900', color: Colors.text, marginBottom: 10, lineHeight: 42, letterSpacing: -0.4 },
  sub:     { fontSize: 15, color: Colors.sub, lineHeight: 22, marginBottom: 22 },
  previewCard: { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, padding: 16, marginBottom: 28 },
  previewTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  previewText: { fontSize: 13, color: Colors.sub, lineHeight: 19 },
  label:   { fontSize: 14, fontWeight: '600', color: Colors.sub, marginBottom: 16 },
  card:    { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  cardActive: { borderColor: Colors.orange, backgroundColor: Colors.orange + '18' },
  cardIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  cardIconWrapActive: { backgroundColor: Colors.orange + '20' },
  cardIcon:{ fontSize: 32 },
  cardTitle:{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  cardSub: { fontSize: 12, color: Colors.sub },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.orange },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange },
  btn:     { backgroundColor: Colors.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  terms:   { textAlign: 'center', color: Colors.dim, fontSize: 11, marginTop: 16 },
}));
