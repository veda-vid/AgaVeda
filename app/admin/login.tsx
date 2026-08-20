// app/admin/login.tsx — Super admin login (separate entry)
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { signInWithEmailPassword, isDemoAuthEnabled } from '../../lib/supabase';
import { Colors, Fonts } from '../../constants/theme';

export default function AdminLoginScreen() {
  const router = useRouter();
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const signOut = useAuthStore(s => s.signOut);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      if (isDemoAuthEnabled()) {
        Alert.alert('Demo mode', 'Super admin login needs a real Supabase project.');
        return;
      }

      const { data, error: err } = await signInWithEmailPassword(email.trim(), password);
      if (err) throw err;
      if (!data?.session && !data?.user) {
        throw new Error('Could not create a session.');
      }

      await refreshProfile();
      const profile = useAuthStore.getState().profile;
      if (!profile || profile.role !== 'super_admin') {
        await signOut();
        setError('Access denied. This account is not a super admin.');
        return;
      }

      router.replace('/admin' as any);
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
      <Text style={s.brand}>Vedastya Admin</Text>
      <Text style={s.sub}>Super admin controls (city news + moderation)</Text>

      <View style={s.form}>
        <Text style={s.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="admin@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          style={s.input}
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          style={s.input}
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity onPress={onLogin} disabled={loading} style={[s.btn, loading && { opacity: 0.65 }]} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.btnText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, padding: 24, backgroundColor: Colors.bg, gap: 14, justifyContent: 'center' },
  brand: { fontSize: 28, fontFamily: Fonts.displayXBold, fontWeight: '900', color: Colors.orange },
  sub: { fontSize: 13, color: Colors.sub, lineHeight: 18 },
  form: { gap: 10, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '800', color: Colors.sub },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text },
  btn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
  error: { color: Colors.red, fontSize: 13, marginTop: 8 },
});

