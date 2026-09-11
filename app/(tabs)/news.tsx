// app/(tabs)/news.tsx — Legacy route → City Veda Daily
import { Redirect } from 'expo-router';

export default function NewsRedirect() {
  return <Redirect href={'/(tabs)/daily' as any} />;
}
