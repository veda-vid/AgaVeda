// stores/roleUtils.ts — Explicit role helpers for routing and UI

import type { UserRole } from '../types';

export function isBuyerRole(role?: UserRole | null) {
  return role === 'buyer' || role === 'super_admin';
}

export function isMerchantSeller(role?: UserRole | null) {
  return role === 'seller';
}

export function isServiceProvider(role?: UserRole | null) {
  return role === 'service_provider';
}

export function isSellerLike(role?: UserRole | null) {
  return isMerchantSeller(role) || isServiceProvider(role);
}

export function getRoleBadgeLabel(role?: UserRole | null) {
  if (isServiceProvider(role)) return 'Service Pro';
  if (isMerchantSeller(role)) return 'Seller';
  if (role === 'super_admin') return 'Admin';
  return 'Buyer';
}
