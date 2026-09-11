// lib/cartUtils.ts — Cart grouping, pricing, and checkout helpers

import { Platform } from 'react-native';
import type { CartItem } from '../types';

export const DELIVERY_FEE_PER_SHOP = 49;

export type CartShopGroup = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
};

export type CartTotals = {
  itemSubtotal: number;
  deliveryTotal: number;
  grandTotal: number;
  shopCount: number;
};

export const unicodeCartStyle = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: {},
}) as object;

export function cartLineUnitPrice(item: CartItem): number {
  return Number(item.product?.discounted_price ?? item.product?.price ?? 0);
}

export function cartLineTotal(item: CartItem): number {
  return cartLineUnitPrice(item) * item.quantity;
}

export function groupCartByShop(items: CartItem[]): CartShopGroup[] {
  const map = new Map<string, CartShopGroup>();

  for (const item of items) {
    const shopId = item.shop_id;
    const shopName = item.shop?.name ?? 'Shop';
    const existing = map.get(shopId);
    if (existing) {
      existing.items.push(item);
      existing.subtotal += cartLineTotal(item);
      existing.total = existing.subtotal + existing.deliveryCharge;
    } else {
      map.set(shopId, {
        shopId,
        shopName,
        items: [item],
        subtotal: cartLineTotal(item),
        deliveryCharge: DELIVERY_FEE_PER_SHOP,
        total: cartLineTotal(item) + DELIVERY_FEE_PER_SHOP,
      });
    }
  }

  return Array.from(map.values());
}

export function computeCartTotals(items: CartItem[]): CartTotals {
  const groups = groupCartByShop(items);
  const itemSubtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const deliveryTotal = groups.reduce((sum, g) => sum + g.deliveryCharge, 0);
  return {
    itemSubtotal,
    deliveryTotal,
    grandTotal: itemSubtotal + deliveryTotal,
    shopCount: groups.length,
  };
}

export function formatRupee(amount: number): string {
  return `₹${amount.toFixed(0)}`;
}

export function buildOrderChatSummary(params: {
  orderRef: string;
  shopName: string;
  itemSubtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  deliveryAddress: string;
  contactPhone: string;
  orderNotes?: string;
  lines: Array<{ title: string; quantity: number; lineTotal: number }>;
}): string {
  const lines = params.lines
    .map(l => `• ${l.title} × ${l.quantity} — ₹${l.lineTotal.toFixed(0)}`)
    .join('\n');

  return [
    `🛒 New order #${params.orderRef}`,
    `Shop: ${params.shopName}`,
    '',
    lines,
    '',
    `Subtotal: ₹${params.itemSubtotal.toFixed(0)}`,
    `Delivery: ₹${params.deliveryCharge.toFixed(0)}`,
    `Total: ₹${params.totalAmount.toFixed(0)}`,
    '',
    `📍 ${params.deliveryAddress}`,
    `📞 ${params.contactPhone}`,
    params.orderNotes?.trim() ? `📝 ${params.orderNotes.trim()}` : null,
    '',
    'Please confirm availability and delivery timing.',
  ].filter(Boolean).join('\n');
}
