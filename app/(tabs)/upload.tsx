// app/(tabs)/upload.tsx — Redirect tab → unified seller create menu on feed
import { Redirect } from 'expo-router';

export default function UploadTab() {
  return <Redirect href="/(tabs)/?create_menu=1" />;
}
