// app/(auth)/login.tsx — Instagram-simple login / signup / forgot password
import { useEffect, useMemo, useState } from 'react';
import {
  Platform, View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  sendPasswordResetEmail,
  isDemoAuthEnabled,
} from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { friendlyAuthNetworkError } from '../../lib/config';
import { VedastyaWordmark } from '../../components/common/VedastyaWordmark';

type Mode = 'signin' | 'signup' | 'forgot';

function hasCompletedLocation(profile: { city?: string; lat?: number | null; lng?: number | null } | null | undefined) {
  return !!profile && !!profile.city?.trim() && profile.lat != null && profile.lng != null;
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function LoginScreen() {
  const router = useRouter();
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const { role } = useLocalSearchParams<{ role: string }>();
  const selectedRole = useMemo(() => (Array.isArray(role) ? role[0] : role) || 'buyer', [role]);
  const demoMode = isDemoAuthEnabled();

  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotCooldownUntil, setForgotCooldownUntil] = useState<number>(0);

  useEffect(() => {
    if (mode !== 'forgot') return;
    if (!forgotCooldownUntil) return;
    const remaining = forgotCooldownUntil - Date.now();
    if (remaining <= 0) {
      setForgotCooldownUntil(0);
      return;
    }
    const t = setTimeout(() => setForgotCooldownUntil(0), remaining);
    return () => clearTimeout(t);
  }, [forgotCooldownUntil, mode]);

  const parseRateLimitWaitMs = (message: string): number | null => {
    const msg = String(message || '').toLowerCase();
    // Common Supabase message patterns include:
    // - "email rate limit exceeded, try again in 120 minutes"
    // - "too many requests, please wait 2 hours"
    if (!msg.includes('rate limit') && !msg.includes('too many') && !msg.includes('throttl')) return null;

    const minutes = msg.match(/(\d+)\s*(minute|min|mins|minutes)\b/i)?.[1];
    if (minutes) return Number(minutes) * 60 * 1000;

    const hours = msg.match(/(\d+)\s*(hour|hours|hr|hrs)\b/i)?.[1];
    if (hours) return Number(hours) * 60 * 60 * 1000;

    const seconds = msg.match(/(\d+)\s*(second|seconds|sec|secs)\b/i)?.[1];
    if (seconds) return Number(seconds) * 1000;

    // Fallback for "rate limit exceeded" without explicit duration
    return 2 * 60 * 1000; // 2 minutes
  };

  // Shared fields (Instagram-style: one form)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');

  const goAfterAuth = async () => {
    try { await refreshProfile(selectedRole); } catch {}
    const nextProfile = useAuthStore.getState().profile;
    if (hasCompletedLocation(nextProfile)) {
      router.replace('/(tabs)' as any);
      return;
    }
    router.replace({
      pathname: '/location',
      params: { role: selectedRole },
    } as any);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setInfo('');
    setShowPassword(false);
  };

  const handleSignIn = async () => {
    setError('');
    setInfo('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await signInWithEmailPassword(email.trim(), password);
      if (err) throw err;
      if (data?.session) {
        goAfterAuth();
      } else {
        setError('Could not start a session. Please try again.');
      }
    } catch (e: any) {
      const msg = friendlyAuthNetworkError(e);
      setError(msg.includes('Invalid login') || msg.includes('Incorrect') ? 'Incorrect email or password.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    setInfo('');
    const mail = email.trim().toLowerCase();
    const name = fullName.trim();
    const user = username.trim().replace(/\s+/g, '_').toLowerCase();

    if (!mail || !password || !name) {
      setError('Email, full name and password are required.');
      return;
    }
    if (!mail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: err } = await signUpWithEmailPassword({
        email: mail,
        password,
        fullName: name,
        username: user || mail.split('@')[0],
        role: selectedRole,
      });
      if (err) throw err;

      if (data?.session) {
        await goAfterAuth();
        return;
      }

      // Account created but needs email confirmation
      setInfo('Account created. Check your email to confirm, then log in.');
      setMode('signin');
      setPassword('');
      notify('Check your email', 'Confirm your email, then log in with the same password.');
    } catch (e: any) {
      const msg = friendlyAuthNetworkError(e);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        setError('This email is already registered. Try logging in.');
        setMode('signin');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setInfo('');
    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes('@')) {
      setError('Enter the email linked to your account.');
      return;
    }

    const now = Date.now();
    if (now < forgotCooldownUntil) {
      const secs = Math.ceil((forgotCooldownUntil - now) / 1000);
      setError(`Email rate limit exceeded. Please wait ${secs} seconds and try again.`);
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await sendPasswordResetEmail(mail);
      if (err) throw err;
      if (demoMode) {
        setInfo('Demo mode: password reset email is simulated. Sign in with your existing password, or sign up with a new email.');
      } else {
        setInfo('Password reset link sent. Check your inbox.');
        notify('Email sent', 'Open the reset link from your email to set a new password.');
      }
      setMode('signin');
    } catch (e: any) {
      const msg = friendlyAuthNetworkError(e);
      const cooldownMs = parseRateLimitWaitMs(String(msg));
      if (cooldownMs) {
        setForgotCooldownUntil(Date.now() + cooldownMs);
        const secs = Math.ceil(cooldownMs / 1000);
        const mins = Math.ceil(secs / 60);
        const label = mins >= 60 ? `${Math.ceil(mins / 60)} hour(s)` : `${mins} minute(s)`;
        setError(`Email rate limit exceeded. Please wait ${label} and try again.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError('');
    setLoading(true);
    try {
      const action = provider === 'google' ? signInWithGoogle : signInWithApple;
      const { data, error: err } = await action(selectedRole);
      if (err) throw err;
      if (data?.url) {
        if (Platform.OS === 'web') window.location.assign(data.url);
        else await Linking.openURL(data.url);
      }
    } catch (e: any) {
      setError(e?.message || 'Social login failed.');
    } finally {
      setLoading(false);
    }
  };

  const primaryAction =
    mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleForgot;

  const primaryLabel =
    mode === 'signin' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link';

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>

        <View style={s.brandBlock}>
          <VedastyaWordmark size="lg" showTagline />
          <Text style={s.tagline}>
            {mode === 'forgot'
              ? 'Reset your password'
              : mode === 'signup'
                ? 'Sign up to see shops & deals near you'
                : 'Log in to discover your city'}
          </Text>
          {demoMode && (
            <View style={s.demoBanner}>
              <Text style={s.demoBannerText}>
                Local demo mode — Supabase keys are not set. Email signup/login works on this device.
              </Text>
            </View>
          )}
        </View>

        <View style={s.form}>
          {mode === 'signup' && (
            <TextInput
              style={s.field}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={Colors.dim}
              autoCapitalize="words"
            />
          )}

          {mode === 'signup' && (
            <TextInput
              style={s.field}
              value={username}
              onChangeText={setUsername}
              placeholder="Username (optional)"
              placeholderTextColor={Colors.dim}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={s.field}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          {mode !== 'forgot' && (
            <View style={s.passwordWrap}>
              <TextInput
                style={[s.field, s.passwordField]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.dim}
                secureTextEntry={!showPassword}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.showBtn}>
                <Text style={s.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'signin' && (
            <TouchableOpacity onPress={() => switchMode('forgot')} style={s.forgotLink}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}
          {!!info && <Text style={s.info}>{info}</Text>}

          <TouchableOpacity
            style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
            onPress={primaryAction}
            disabled={loading || (mode === 'forgot' && Date.now() < forgotCooldownUntil)}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.primaryBtnText}>{primaryLabel}</Text>}
          </TouchableOpacity>

          {mode === 'forgot' && (
            <TouchableOpacity onPress={() => switchMode('signin')} style={s.centerLink}>
              <Text style={s.centerLinkText}>Back to log in</Text>
            </TouchableOpacity>
          )}
        </View>

        {mode !== 'forgot' && (
          <>
            <View style={s.orRow}>
              <View style={s.orLine} />
              <Text style={s.orText}>OR</Text>
              <View style={s.orLine} />
            </View>

            <TouchableOpacity style={s.oauthBtn} onPress={() => handleOAuth('google')} disabled={loading}>
              <Text style={s.oauthIcon}>G</Text>
              <Text style={s.oauthText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.oauthBtn} onPress={() => handleOAuth('apple')} disabled={loading}>
              <Text style={s.oauthIcon}></Text>
              <Text style={s.oauthText}>Continue with Apple</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={s.footer}>
          {mode === 'signin' ? (
            <Text style={s.footerText}>
              Don&apos;t have an account?{' '}
              <Text style={s.footerAction} onPress={() => switchMode('signup')}>Sign up</Text>
            </Text>
          ) : mode === 'signup' ? (
            <Text style={s.footerText}>
              Have an account?{' '}
              <Text style={s.footerAction} onPress={() => switchMode('signin')}>Log in</Text>
            </Text>
          ) : null}
        </View>

        <Text style={s.roleHint}>
          Joining as {selectedRole === 'buyer' ? 'Buyer' : selectedRole === 'seller' ? 'Seller' : 'Service Provider'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  back: { position: 'absolute', top: 48, left: 20, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: Colors.text, fontSize: 32, lineHeight: 34, fontWeight: '300' },
  brandBlock: { alignItems: 'center', marginBottom: 28, marginTop: 24, gap: 10 },
  tagline: { fontSize: 14, color: Colors.sub, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12, marginTop: 4 },
  demoBanner: {
    marginTop: 14,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  demoBannerText: { color: Colors.amber, fontSize: 12, textAlign: 'center', lineHeight: 17, fontWeight: '600' },
  form: { gap: 10 },
  field: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordField: { paddingRight: 64 },
  showBtn: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center' },
  showText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 4 },
  forgotText: { color: Colors.blue, fontSize: 13, fontWeight: '600' },
  error: { color: Colors.red, fontSize: 13, marginTop: 4, lineHeight: 18 },
  info: { color: Colors.green, fontSize: 13, marginTop: 4, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  centerLink: { alignItems: 'center', paddingVertical: 12 },
  centerLinkText: { color: Colors.blue, fontWeight: '700', fontSize: 14 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border2 },
  orText: { color: Colors.dim, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  oauthIcon: { color: Colors.blue, fontSize: 18, fontWeight: '800' },
  oauthText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  footer: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 22,
    alignItems: 'center',
  },
  footerText: { color: Colors.sub, fontSize: 14 },
  footerAction: { color: Colors.orange, fontWeight: '800' },
  roleHint: { textAlign: 'center', color: Colors.dim, fontSize: 11, marginTop: 16 },
}));
