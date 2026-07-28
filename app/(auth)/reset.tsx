import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { updateCurrentUserPassword } from '../../lib/supabase';
import { Colors } from '../../constants/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert('Weak password', 'Use at least 8 characters with letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateCurrentUserPassword(password);
      if (error) throw error;
      Alert.alert('Password updated', 'You can now continue with your new password.', [
        { text: 'Continue', onPress: () => router.replace('/' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Reset failed', e.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>Account Recovery</Text>
        <Text style={s.title}>Set a new password</Text>
        <Text style={s.sub}>Choose a secure password and get back into CityConnect.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>NEW PASSWORD</Text>
        <View style={s.inputWrap}>
          <Text style={s.inputIcon}>🔒</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.dim}
            secureTextEntry
          />
        </View>

        <Text style={s.label}>CONFIRM PASSWORD</Text>
        <View style={s.inputWrap}>
          <Text style={s.inputIcon}>✅</Text>
          <TextInput
            style={s.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            placeholderTextColor={Colors.dim}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.btnText}>Update Password</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, padding: 24, justifyContent: 'center' },
  hero: { marginBottom: 24 },
  eyebrow: { color: Colors.orange, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginBottom: 8 },
  sub: { color: Colors.sub, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, borderRadius: 24, padding: 18 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  inputWrap: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, color: Colors.text, fontSize: 16, paddingVertical: 14 },
  btn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
