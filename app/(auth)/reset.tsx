// app/(auth)/reset.tsx — Supabase password recovery completion screen
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabase, isDemoAuthEnabled } from '../../lib/supabase';
import { updateProfile } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Colors, createDynamicStyles } from '../../constants/theme';
import type { UserRole } from '../../types';

function notify(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const isInitialized = useAuthStore(s => s.isInitialized);

  const [name, setName] = useState(profile?.name ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // When callback sets the session, profile will load shortly after.
  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  const submit = async () => {
    if (isDemoAuthEnabled()) {
      notify('Demo mode', 'Password reset is simulated in demo mode. Please sign in with your existing password.');
      return;
    }

    if (!name.trim()) {
      notify('Required', 'Please enter your username.');
      return;
    }

    if (!password || password.length < 6) {
      notify('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirm) {
      notify('Mismatch', 'New password and confirm password must match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();

      // Recovery callback should have verified OTP and established a session.
      // Update password for the current session user.
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // Update profiles.name ("username" in your UI)
      const userId = profile?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await updateProfile(userId, { name: name.trim() });
      }

      // Force sign-in again with new password.
      await supabase.auth.signOut();

      notify('Password updated', 'Please sign in again using your new password.');
      const role = (profile?.role ?? 'buyer') as UserRole;
      router.replace({ pathname: '/(auth)/login', params: { role } } as any);
    } catch (e: any) {
      notify('Reset failed', e?.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.card}>
        <Text style={s.title}>Reset Password</Text>
        <Text style={s.sub}>Set your new password and username.</Text>

        <Text style={s.label}>Username</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. my_username"
          placeholderTextColor={Colors.dim}
          autoCapitalize="none"
        />

        <Text style={s.label}>New Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter new password"
          placeholderTextColor={Colors.dim}
          secureTextEntry
        />

        <Text style={s.label}>Confirm Password</Text>
        <TextInput
          style={s.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm new password"
          placeholderTextColor={Colors.dim}
          secureTextEntry
        />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.btnText}>Update Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.replace({ pathname: '/(auth)/login', params: { role: (profile?.role ?? 'buyer') as any } } as any)}>
          <Text style={s.linkText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', padding: 20 },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border2 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  sub: { color: Colors.sub, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  label: { color: Colors.sub, fontWeight: '800', fontSize: 12, marginTop: 10, marginBottom: 8, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { color: Colors.blue, fontWeight: '800' },
}));
