// app/(tabs)/_layout.tsx — Bottom tab navigator (buyer vs seller)
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';

function TabIcon({
  emoji, label, focused, badge,
}: { emoji: string; label: string; focused: boolean; badge?: number }) {
  if (label === 'Upload') {
    return (
      <View style={s.uploadBtn}>
        <Text style={s.uploadIcon}>＋</Text>
      </View>
    );
  }
  return (
    <View style={s.tabItem}>
      <Text style={[s.tabEmoji, { fontSize: focused ? 26 : 22 }]}>{emoji}</Text>
      <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{label}</Text>
      {focused && <View style={s.dot} />}
      {!!badge && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { profile } = useAuthStore();
  const cartCount = useCartStore(state => state.items.reduce((n, i) => n + i.quantity, 0));
  const isSeller = profile?.role === 'seller' || profile?.role === 'service_provider';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.tabBar,
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Feed" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shops"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" label="Shops" focused={focused} /> }}
      />
      <Tabs.Screen
        name="upload"
        options={
          isSeller
            ? { tabBarIcon: ({ focused }) => <TabIcon emoji="+" label="Upload" focused={focused} /> }
            : { href: null }
        }
      />
      <Tabs.Screen
        name="cart"
        options={
          isSeller
            ? { href: null }
            : { tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Cart" focused={focused} badge={cartCount} /> }
        }
      />
      <Tabs.Screen name="deals" options={{ href: null }} />
      <Tabs.Screen
        name="services"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔧" label="Services" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 10,
    paddingTop: 4,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  tabEmoji: {},
  tabLabel: { fontSize: 9, color: Colors.dim, fontWeight: '500' },
  tabLabelActive: { color: Colors.orange, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.orange },
  badge: {
    position: 'absolute', top: -2, right: -8, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  uploadBtn: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  uploadIcon: { fontSize: 26, color: Colors.white, fontWeight: '700' },
});
