// app/(tabs)/notifications.tsx — In-app updates inbox (opened from header bell)

import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { GlassSurface } from '../../components/ui/modernSurfaces';

export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useAuthStore(s => s.notifications);
  const clearNotifications = useAuthStore(s => s.clearNotifications);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        <TouchableOpacity onPress={() => clearNotifications()} hitSlop={8}>
          <Text style={s.clear}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <GlassSurface style={s.emptyCard} radius={18}>
            <Text style={s.emptyEmoji}>🔔</Text>
            <Text style={s.emptyTitle}>You are all caught up</Text>
            <Text style={s.emptyBody}>
              Follow local shops to receive updates when they post new products and offers.
            </Text>
          </GlassSurface>
        ) : (
          notifications.map((item, index) => (
            <GlassSurface key={`${item}-${index}`} style={s.item} radius={16}>
              <Text style={s.itemText}>{item}</Text>
            </GlassSurface>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  backText: { color: Colors.text, fontSize: 22, fontWeight: '600' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  clear: { color: Colors.orange, fontWeight: '700', fontSize: 14, width: 48, textAlign: 'right' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  emptyCard: { padding: 28, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  emptyBody: { color: Colors.sub, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  item: { paddingHorizontal: 14, paddingVertical: 14 },
  itemText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
}));
