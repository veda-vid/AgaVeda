// app/(tabs)/_layout.tsx — Bottom tab navigator (buyer vs seller)
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';

function TabIcon({
  icon,
  focused,
  badge,
}: {
  icon: 'home' | 'shops' | 'upload' | 'cart' | 'services' | 'profile' | 'news';
  focused: boolean;
  badge?: number;
}) {
  const iconColor = focused ? Colors.text : Colors.dim;

  if (icon === 'upload') {
    return (
      <View style={s.uploadBtn}>
        <Text style={s.uploadIcon}>＋</Text>
      </View>
    );
  }

  return (
    <View style={s.tabItem}>
      <View style={s.iconWrap}>
        {icon === 'home' && (
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path
              d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5Z"
              fill={iconColor}
            />
          </Svg>
        )}
        {icon === 'shops' && (
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path d="M4 7V3h16v4l-1.5 2H5.5L4 7Zm1 4h14v10H5V11Z" fill={iconColor} />
          </Svg>
        )}
        {icon === 'services' && (
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path
              d="M14.7 6.3a5 5 0 0 0-7.1 7.1l-2.6 2.6 1.4 1.4 2.6-2.6a5 5 0 0 0 7.1-7.1Zm-6.2 6.2a3 3 0 1 1 4.2-4.2 3 3 0 0 1-4.2 4.2Z"
              fill={iconColor}
            />
          </Svg>
        )}
        {icon === 'cart' && (
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path
              d="M6 6h15l-2 9H8L6 6Zm0 0L5 3H2v2h2l2.3 11.5A2 2 0 0 0 8.2 18H20v-2H8.2a.1.1 0 0 1-.1-.1L10 8H6Z"
              fill={iconColor}
            />
            <Circle cx="9.5" cy="21" r="1.5" fill={iconColor} />
            <Circle cx="17.5" cy="21" r="1.5" fill={iconColor} />
          </Svg>
        )}
        {icon === 'profile' && (
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Circle cx="12" cy="8" r="4" fill={iconColor} />
            <Path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7v1H4v-1Z" fill={iconColor} />
          </Svg>
        )}
        {icon === 'news' && (
          <Text style={{ fontSize: 24, color: iconColor, fontWeight: '900', letterSpacing: -0.5 }}>D</Text>
        )}
      </View>

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
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="news"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="news" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shops"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="shops" focused={focused} /> }}
      />
      <Tabs.Screen
        name="upload"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="cart"
        options={
          isSeller
            ? { href: null }
            : { tabBarIcon: ({ focused }) => <TabIcon icon="cart" focused={focused} badge={cartCount} /> }
        }
      />
      <Tabs.Screen name="deals" options={{ href: null }} />
      <Tabs.Screen
        name="services"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="services" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="profile" focused={focused} /> }}
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
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
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
