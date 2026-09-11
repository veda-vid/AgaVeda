// components/marketplace/ProductQuickViewModal.tsx

import { useState } from 'react';
import {
  View, Text, Modal, Pressable, Image, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { unicodeMarketplaceStyle } from '../../lib/marketplaceUtils';
import { useCartStore } from '../../stores/cartStore';
import type { Product, Shop } from '../../types';

type Props = {
  visible: boolean;
  product: Product | null;
  shop: Shop | null;
  userId?: string;
  onClose: () => void;
};

export function ProductQuickViewModal({ visible, product, shop, userId, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const addItem = useCartStore(s => s.addItem);
  const [adding, setAdding] = useState(false);

  if (!product || !shop) return null;

  const price = Number(product.discounted_price ?? product.price);
  const hasDiscount = product.discount_pct > 0;
  const image = product.images?.[0];

  const handleAdd = async () => {
    if (!userId || adding) return;
    setAdding(true);
    try {
      await addItem(userId, product.id, shop.id, qty);
      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2: `Added ${product.title} from ${shop.name}`,
      });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not add item', text2: 'Please try again.' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          {image ? (
            <Image source={{ uri: image }} style={s.hero} resizeMode="cover" />
          ) : (
            <View style={[s.hero, s.heroFallback]}><Text style={s.heroEmoji}>📦</Text></View>
          )}
          <View style={s.body}>
            <Text style={[s.title, unicodeMarketplaceStyle]}>{product.title}</Text>
            <View style={s.priceRow}>
              <Text style={s.price}>₹{price.toFixed(0)}</Text>
              {hasDiscount ? (
                <>
                  <Text style={s.wasPrice}>₹{Number(product.price).toFixed(0)}</Text>
                  <View style={s.discountBadge}>
                    <Text style={s.discountText}>-{product.discount_pct}%</Text>
                  </View>
                </>
              ) : null}
            </View>
            {product.description ? (
              <Text style={[s.desc, unicodeMarketplaceStyle]} numberOfLines={6}>{product.description}</Text>
            ) : null}
            <View style={s.qtyRow}>
              <Text style={s.qtyLabel}>Quantity</Text>
              <View style={s.qtyControls}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.qtyVal}>{qty}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(q => q + 1)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={[s.addBtn, adding && s.addBtnDisabled]} onPress={() => void handleAdd()} disabled={!userId || adding}>
              <Text style={s.addBtnText}>{adding ? 'Adding…' : 'Add to cart'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  hero: { width: '100%', height: 240, backgroundColor: Colors.card },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 48 },
  body: { padding: 18, gap: 10 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '900', fontFamily: Fonts.displayXBold },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price: { color: Colors.orange, fontSize: 22, fontWeight: '900' },
  wasPrice: { color: Colors.dim, fontSize: 14, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#10B98122', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { color: Colors.green, fontWeight: '800', fontSize: 12 },
  desc: { color: Colors.sub, fontSize: 14, lineHeight: 21 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  qtyLabel: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  qtyVal: { color: Colors.text, fontWeight: '800', fontSize: 16, minWidth: 24, textAlign: 'center' },
  addBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addBtnDisabled: { opacity: 0.55 },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
}));
