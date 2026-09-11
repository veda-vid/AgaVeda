// app/(tabs)/cart.tsx — Buyer shopping cart with multi-shop checkout

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { CheckoutModal } from '../../components/cart/CheckoutModal';
import { OrderSuccessModal } from '../../components/cart/OrderSuccessModal';
import {
  cartLineUnitPrice, cartLineTotal, formatRupee, groupCartByShop, unicodeCartStyle,
} from '../../lib/cartUtils';
import { upsertProfile } from '../../lib/api';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { CartItem, CheckoutOrderResult } from '../../types';

function CartLineItem({
  item,
  pending,
  onDecrement,
  onIncrement,
  onRemove,
}: {
  item: CartItem;
  pending: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}) {
  const price = cartLineUnitPrice(item);
  const img = item.product?.images?.[0];

  return (
    <View style={[s.card, pending && s.cardPending]}>
      <View style={s.thumb}>
        {img
          ? <Image source={{ uri: img }} style={s.thumbImg} />
          : <Text style={{ fontSize: 28 }}>📦</Text>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.productTitle, unicodeCartStyle]} numberOfLines={2}>
          {item.product?.title ?? 'Product'}
        </Text>
        <Text style={[s.price, unicodeCartStyle]}>{formatRupee(price)}</Text>
        <View style={s.qtyRow}>
          <TouchableOpacity style={s.qtyBtn} onPress={onDecrement} disabled={pending}>
            <Text style={s.qtyBtnText}>−</Text>
          </TouchableOpacity>
          {pending ? (
            <ActivityIndicator color={Colors.orange} size="small" style={{ minWidth: 28 }} />
          ) : (
            <Text style={s.qty}>{item.quantity}</Text>
          )}
          <TouchableOpacity style={s.qtyBtn} onPress={onIncrement} disabled={pending}>
            <Text style={s.qtyBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={s.remove} disabled={pending}>
            <Text style={s.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { profile, updateProfile, loadNotifications } = useAuthStore();
  const {
    items, isLoading, loadCart, setQuantity, removeItem, checkout,
    cartTotals, isItemPending,
  } = useCartStore();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successOrders, setSuccessOrders] = useState<CheckoutOrderResult[]>([]);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (profile?.id) loadCart(profile.id);
  }, [profile?.id, loadCart]);

  const refreshCart = useCallback(async () => {
    if (profile?.id) await loadCart(profile.id);
  }, [profile?.id, loadCart]);

  const { refreshControl, scrollHandlers } = useScreenRefresh(refreshCart);

  const shopGroups = useMemo(() => groupCartByShop(items), [items]);
  const totals = useMemo(() => cartTotals(), [items, cartTotals]);

  const handleConfirmCheckout = async (payload: {
    deliveryAddress: string;
    contactPhone: string;
    orderNotes: string;
  }) => {
    if (!profile?.id) return;
    setProcessing(true);
    try {
      const orders = await checkout(
        profile.id,
        payload.deliveryAddress,
        payload.contactPhone,
        payload.orderNotes,
      );
      updateProfile({
        delivery_address: payload.deliveryAddress,
        phone: payload.contactPhone,
      });
      await upsertProfile({
        id: profile.id,
        delivery_address: payload.deliveryAddress,
        phone: payload.contactPhone,
      }).catch(() => {});
      await loadNotifications(profile.id).catch(() => {});
      setCheckoutOpen(false);
      setSuccessOrders(orders);
      setSuccessOpen(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Checkout failed. Please try again.';
      Alert.alert('Checkout failed', message);
    } finally {
      setProcessing(false);
    }
  };

  const openShopChat = (shopId: string) => {
    setSuccessOpen(false);
    router.push({ pathname: '/chat/[shopId]', params: { shopId } } as never);
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Your Cart</Text>
          <Text style={s.sub}>
            {totals.shopCount} shop{totals.shopCount === 1 ? '' : 's'} · {items.reduce((n, i) => n + i.quantity, 0)} items
          </Text>
        </View>
      </SafeAreaView>

      {items.length === 0 ? (
        <ScrollView
          contentContainerStyle={s.center}
          refreshControl={refreshControl}
          {...scrollHandlers}
        >
          <Text style={s.emptyEmoji}>🛍️</Text>
          <Text style={s.emptyText}>
            Your cart is empty. Follow shops and add products from the feed or shop pages.
          </Text>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={s.listContent}
            refreshControl={refreshControl}
            {...scrollHandlers}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
          >
            {shopGroups.map(group => (
              <View key={group.shopId} style={s.vendorSection}>
                <View style={s.vendorHeader}>
                  <Text style={[s.vendorName, unicodeCartStyle]} numberOfLines={1}>{group.shopName}</Text>
                  <Text style={s.vendorMeta}>
                    {group.items.length} item{group.items.length === 1 ? '' : 's'} · {formatRupee(group.subtotal)}
                  </Text>
                </View>
                {group.items.map(item => (
                  <CartLineItem
                    key={item.id}
                    item={item}
                    pending={isItemPending(item.id)}
                    onDecrement={() => void setQuantity(item.id, item.quantity - 1)}
                    onIncrement={() => void setQuantity(item.id, item.quantity + 1)}
                    onRemove={() => void removeItem(item.id)}
                  />
                ))}
                <View style={s.vendorDeliveryRow}>
                  <Text style={s.summaryLabel}>Delivery estimate</Text>
                  <Text style={s.summaryValue}>{formatRupee(group.deliveryCharge)}</Text>
                </View>
              </View>
            ))}

            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Price summary</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Item subtotal</Text>
                <Text style={s.summaryValue}>{formatRupee(totals.itemSubtotal)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>
                  Estimated delivery ({totals.shopCount} shop{totals.shopCount === 1 ? '' : 's'})
                </Text>
                <Text style={s.summaryValue}>{formatRupee(totals.deliveryTotal)}</Text>
              </View>
              <View style={[s.summaryRow, s.grandRow]}>
                <Text style={s.grandLabel}>Grand total</Text>
                <Text style={s.grandValue}>{formatRupee(totals.grandTotal)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={s.footer}>
            <View>
              <Text style={s.totalLabel}>Grand total</Text>
              <Text style={s.totalVal}>{formatRupee(totals.grandTotal)}</Text>
            </View>
            <TouchableOpacity
              style={s.checkoutBtn}
              onPress={() => setCheckoutOpen(true)}
              disabled={processing}
            >
              <Text style={s.checkoutText}>Place Order</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <CheckoutModal
        visible={checkoutOpen}
        profile={profile}
        grandTotal={totals.grandTotal}
        processing={processing}
        onClose={() => !processing && setCheckoutOpen(false)}
        onConfirm={handleConfirmCheckout}
        onEditAddress={() => router.push('/(tabs)/profile')}
      />

      <OrderSuccessModal
        visible={successOpen}
        orders={successOrders}
        onClose={() => setSuccessOpen(false)}
        onTrackOrders={openShopChat}
      />
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.bg },
  header: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, fontFamily: Fonts.bodySemiBold },
  sub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 140, gap: 16 },
  vendorSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
    gap: 10,
  },
  vendorHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 2,
  },
  vendorName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  vendorMeta: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  vendorDeliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.surface,
    borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border2,
  },
  cardPending: { opacity: 0.7 },
  thumb: {
    width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: 72, height: 72 },
  productTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  price: { fontSize: 16, fontWeight: '800', color: Colors.amber },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  qty: { color: Colors.text, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  remove: { marginLeft: 'auto' },
  removeText: { color: Colors.red, fontSize: 12, fontWeight: '600' },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 14,
    gap: 10,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: Colors.sub, fontSize: 13, flex: 1, paddingRight: 8 },
  summaryValue: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  grandRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  grandLabel: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  grandValue: { color: Colors.amber, fontSize: 18, fontWeight: '800' },
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
}));
