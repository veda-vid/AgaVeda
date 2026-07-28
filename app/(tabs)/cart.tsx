// app/(tabs)/cart.tsx — Buyer shopping cart
import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Image,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { Colors } from '../../constants/theme';

export default function CartScreen() {
  const { profile } = useAuthStore();
  const { items, isLoading, loadCart, setQuantity, removeItem, totalAmount, totalItems } = useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (profile?.id) loadCart(profile.id);
  }, [profile?.id]);

  const checkout = () => {
    if (items.length === 0) return;
    setCheckingOut(true);
    setTimeout(() => {
      setCheckingOut(false);
      Alert.alert(
        'Order placed',
        `Your order of ₹${totalAmount().toFixed(0)} for ${totalItems()} item(s) was sent to the shop(s). They will contact you shortly.`,
      );
    }, 600);
  };

  if (!profile || profile.role !== 'buyer') {
    return (
      <View style={s.center}>
        <Text style={s.emptyEmoji}>🛒</Text>
        <Text style={s.emptyText}>Cart is available for buyers. Switch role in Profile if needed.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Your Cart</Text>
        <Text style={s.sub}>{totalItems()} item{totalItems() === 1 ? '' : 's'}</Text>
      </View>

      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🛍️</Text>
          <Text style={s.emptyText}>Your cart is empty. Follow shops and add products from the feed or shop pages.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
            renderItem={({ item }) => {
              const price = Number(item.product?.discounted_price ?? item.product?.price ?? 0);
              const img = item.product?.images?.[0];
              return (
                <View style={s.card}>
                  <View style={s.thumb}>
                    {img
                      ? <Image source={{ uri: img }} style={s.thumbImg} />
                      : <Text style={{ fontSize: 28 }}>📦</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.productTitle} numberOfLines={2}>{item.product?.title ?? 'Product'}</Text>
                    <Text style={s.shopName}>{item.shop?.name ?? 'Shop'}</Text>
                    <Text style={s.price}>₹{price.toFixed(0)}</Text>
                    <View style={s.qtyRow}>
                      <TouchableOpacity
                        style={s.qtyBtn}
                        onPress={() => setQuantity(item.id, item.quantity - 1)}
                      >
                        <Text style={s.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qty}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={s.qtyBtn}
                        onPress={() => setQuantity(item.id, item.quantity + 1)}
                      >
                        <Text style={s.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeItem(item.id)} style={s.remove}>
                        <Text style={s.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <View style={s.footer}>
            <View>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalVal}>₹{totalAmount().toFixed(0)}</Text>
            </View>
            <TouchableOpacity style={s.checkoutBtn} onPress={checkout} disabled={checkingOut}>
              {checkingOut
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.checkoutText}>Place Order</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.card, borderRadius: 16,
    padding: 12, borderWidth: 1, borderColor: Colors.border2,
  },
  thumb: {
    width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: 72, height: 72 },
  productTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  shopName: { fontSize: 12, color: Colors.sub },
  price: { fontSize: 16, fontWeight: '800', color: Colors.amber },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  qty: { color: Colors.text, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  remove: { marginLeft: 'auto' },
  removeText: { color: Colors.red, fontSize: 12, fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingBottom: 28, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  totalLabel: { fontSize: 12, color: Colors.sub },
  totalVal: { fontSize: 22, fontWeight: '800', color: Colors.text },
  checkoutBtn: {
    backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14,
  },
  checkoutText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
