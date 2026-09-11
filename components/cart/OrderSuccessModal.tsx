// components/cart/OrderSuccessModal.tsx — Post-checkout confirmation with order IDs

import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { formatRupee, unicodeCartStyle } from '../../lib/cartUtils';
import type { CheckoutOrderResult } from '../../types';

type OrderSuccessModalProps = {
  visible: boolean;
  orders: CheckoutOrderResult[];
  onClose: () => void;
  onTrackOrders: (shopId: string) => void;
};

export function OrderSuccessModal({
  visible,
  orders,
  onClose,
  onTrackOrders,
}: OrderSuccessModalProps) {
  const grandTotal = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.card}>
          <Text style={s.emoji}>✅</Text>
          <Text style={s.title}>Order placed successfully</Text>
          <Text style={s.sub}>
            {orders.length} shop{orders.length === 1 ? '' : 's'} · {formatRupee(grandTotal)} total
          </Text>

          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {orders.map(order => (
              <View key={order.order_id} style={s.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.shopName, unicodeCartStyle]} numberOfLines={1}>{order.shop_name}</Text>
                  <Text style={s.orderRef}>Order #{order.order_ref}</Text>
                  <Text style={s.orderTotal}>{formatRupee(Number(order.total_amount))}</Text>
                </View>
                <TouchableOpacity
                  style={s.chatBtn}
                  onPress={() => onTrackOrders(order.shop_id)}
                >
                  <Text style={s.chatBtnText}>Chat</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              if (orders[0]) onTrackOrders(orders[0].shop_id);
            }}
          >
            <Text style={s.primaryText}>Track Orders / Chat with Shops</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
            <Text style={s.secondaryText}>Continue shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', fontFamily: Fonts.bodySemiBold },
  sub: { color: Colors.sub, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  list: { maxHeight: 220, marginBottom: 12 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  shopName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  orderRef: { color: Colors.sub, fontSize: 12, marginTop: 2 },
  orderTotal: { color: Colors.amber, fontSize: 14, fontWeight: '800', marginTop: 4 },
  chatBtn: {
    borderWidth: 1,
    borderColor: Colors.orange,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatBtnText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  secondaryText: { color: Colors.sub, fontWeight: '600', fontSize: 14 },
}));
