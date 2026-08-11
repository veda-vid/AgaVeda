// app/(auth)/splash.tsx — Animated splash screen
import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '../../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const fade   = useRef(new Animated.Value(0)).current;
  const scale  = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(fade,  { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => router.replace('/(auth)/role'), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.container}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center', gap: 16 }}>
        <Text style={s.icon}>🏙️</Text>
        <Text style={s.title}>Vedastya</Text>
        <Text style={s.sub}>Your city. Your market.</Text>
      </Animated.View>
      <Animated.View style={[s.dot, { opacity: fade }]} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  icon:  { fontSize: 72 },
  title: { fontSize: 36, fontFamily: Fonts.displayXBold, fontWeight: '900', color: Colors.orange, letterSpacing: -0.6 },
  sub:   { fontSize: 15, color: Colors.sub },
  dot:   { position: 'absolute', bottom: 60, width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.orange },
});
