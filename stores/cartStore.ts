// stores/cartStore.ts — Buyer cart state with row-level pending actions

import { create } from 'zustand';
import {
  getCart, addToCart, updateCartQuantity, removeFromCart,
  processCheckout, postCheckoutShopMessages,
} from '../lib/api';
import { computeCartTotals } from '../lib/cartUtils';
import { notifySellerOrderPush, sendLocalNotification } from '../lib/pushNotifications';
import type { CartItem, CheckoutOrderResult } from '../types';

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  pendingItemIds: Record<string, boolean>;
  version: number;
  loadCart: (userId: string) => Promise<void>;
  addItem: (userId: string, productId: string, shopId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  checkout: (
    userId: string,
    deliveryAddress: string,
    contactPhone: string,
    orderNotes?: string,
  ) => Promise<CheckoutOrderResult[]>;
  clearLocal: () => void;
  totalItems: () => number;
  totalAmount: () => number;
  cartTotals: () => ReturnType<typeof computeCartTotals>;
  isItemPending: (itemId: string) => boolean;
}

function setPending(set: (fn: (s: CartStore) => Partial<CartStore>) => void, itemId: string, pending: boolean) {
  set(state => {
    const next = { ...state.pendingItemIds };
    if (pending) next[itemId] = true;
    else delete next[itemId];
    return { pendingItemIds: next };
  });
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isLoading: false,
  pendingItemIds: {},
  version: 0,

  loadCart: async (userId) => {
    set({ isLoading: true });
    try {
      const items = await getCart(userId);
      set({ items, isLoading: false });
    } catch {
      set({ items: [], isLoading: false });
    }
  },

  addItem: async (userId, productId, shopId, quantity = 1) => {
    const item = await addToCart(userId, productId, shopId, quantity);
    set(state => {
      const others = state.items.filter(i => i.product_id !== productId);
      return { items: [item, ...others], version: state.version + 1 };
    });
  },

  setQuantity: async (itemId, quantity) => {
    setPending(set, itemId, true);
    try {
      const updated = await updateCartQuantity(itemId, quantity);
      if (!updated) {
        set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
        return;
      }
      set(state => ({
        items: state.items.map(i => (i.id === itemId ? updated : i)),
      }));
    } finally {
      setPending(set, itemId, false);
    }
  },

  removeItem: async (itemId) => {
    setPending(set, itemId, true);
    try {
      await removeFromCart(itemId);
      set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
    } finally {
      setPending(set, itemId, false);
    }
  },

  checkout: async (userId, deliveryAddress, contactPhone, orderNotes = '') => {
    const snapshot = [...get().items];
    const orders = await processCheckout(userId, deliveryAddress, contactPhone, orderNotes);

    await postCheckoutShopMessages(
      userId,
      orders,
      snapshot,
      deliveryAddress,
      contactPhone,
      orderNotes,
    ).catch(() => {});

    await Promise.all(orders.map(order =>
      notifySellerOrderPush(order.owner_id, {
        title: 'New order received',
        body: `${order.shop_name}: order #${order.order_ref} · ₹${order.total_amount.toFixed(0)}`,
        data: { order_id: order.order_id, shop_id: order.shop_id, type: 'order' },
      }),
    )).catch(() => {});

    const grandTotal = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    await sendLocalNotification({
      title: 'Order placed',
      body: `${orders.length} order${orders.length === 1 ? '' : 's'} confirmed · ${grandTotal.toFixed(0)} total`,
      data: { type: 'checkout_success', order_ids: orders.map(o => o.order_id) },
    });

    set({ items: [], pendingItemIds: {}, version: get().version + 1 });
    return orders;
  },

  clearLocal: () => set({ items: [], pendingItemIds: {} }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalAmount: () => get().cartTotals().grandTotal,

  cartTotals: () => computeCartTotals(get().items),

  isItemPending: (itemId) => !!get().pendingItemIds[itemId],
}));
