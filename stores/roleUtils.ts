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

/** Sellers lock city/radius after shop setup; buyers and pros may edit. */
export function isLocationLocked(role?: UserRole | null) {
  return isMerchantSeller(role);
}

export function canEditDiscoveryRadius(role?: UserRole | null) {
  return !isLocationLocked(role);
}

export function canSwitchBuyerSeller(role?: UserRole | null) {
  return role === 'buyer' || role === 'seller';
}

export function getRoleBadgeLabel(role?: UserRole | null) {
  if (isServiceProvider(role)) return 'Service Pro';
  if (isMerchantSeller(role)) return 'Seller';
  if (role === 'super_admin') return 'Admin';
  return 'Buyer';
}

export function getRoleEmoji(role?: UserRole | null) {
  if (isServiceProvider(role)) return '🔧';
  if (isMerchantSeller(role)) return '🏪';
  return '🛍️';
}

export type ProfileTabId =
  | 'posts'
  | 'videos'
  | 'reposts'
  | 'saved'
  | 'orders'
  | 'leads'
  | 'tagged';

export function getDefaultProfileTab(role?: UserRole | null): ProfileTabId {
  if (isSellerLike(role)) return 'posts';
  return 'saved';
}

export function getProfileTabsForRole(role?: UserRole | null): Array<{
  id: ProfileTabId;
  icon: string;
  label: string;
}> {
  if (isServiceProvider(role)) {
    return [
      { id: 'posts', icon: '▦', label: 'Posts' },
      { id: 'videos', icon: '▷', label: 'Moments' },
      { id: 'reposts', icon: '↺', label: 'Reposts' },
      { id: 'saved', icon: '🔖', label: 'Saved' },
      { id: 'leads', icon: '📥', label: 'Leads' },
    ];
  }
  if (isMerchantSeller(role)) {
    return [
      { id: 'posts', icon: '▦', label: 'Posts' },
      { id: 'videos', icon: '▷', label: 'Moments' },
      { id: 'reposts', icon: '↺', label: 'Reposts' },
      { id: 'saved', icon: '🔖', label: 'Saved' },
    ];
  }
  return [
    { id: 'saved', icon: '🔖', label: 'Saved' },
    { id: 'reposts', icon: '↺', label: 'Reposts' },
    { id: 'orders', icon: '📦', label: 'Orders' },
  ];
}
