// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="role" />
      <Stack.Screen name="login" />
      <Stack.Screen name="location" />
      <Stack.Screen name="reset" />
    </Stack>
  );
}
