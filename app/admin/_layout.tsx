// app/admin/_layout.tsx — Admin stack (index + login)

import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
