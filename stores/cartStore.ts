// stores/cartStore.ts — Buyer cart state

import { create } from 'zustand';
import { getCart, addToCart, updateCartQuantity, removeFromCart } from '../lib/api';
import type { CartItem } from '../types';

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  version: number;
  loadCart: (userId: string) => Promise<void>;
  addItem: (userId: string, productId: string, shopId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearLocal: () => void;
  totalItems: () => number;
  totalAmount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isLoading: false,
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
    const updated = await updateCartQuantity(itemId, quantity);
    if (!updated) {
      set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
      return;
    }
    set(state => ({
      items: state.items.map(i => (i.id === itemId ? updated : i)),
    }));
  },

  removeItem: async (itemId) => {
    await removeFromCart(itemId);
    set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
  },

  clearLocal: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalAmount: () =>
    get().items.reduce((sum, i) => {
      const price = i.product?.discounted_price ?? i.product?.price ?? 0;
      return sum + Number(price) * i.quantity;
    }, 0),
}));
