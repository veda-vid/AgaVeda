// app/(tabs)/upload.tsx — Redirect tab → seller upload modal
import { Redirect } from 'expo-router';

export default function UploadTab() {
  return <Redirect href="/seller/upload" />;
}
