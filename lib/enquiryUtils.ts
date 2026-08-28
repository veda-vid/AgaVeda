import { formatDistanceToNow } from 'date-fns';
import type { ShopEnquiry, ShopEnquiryStatus, ShopEnquiryType } from '../types';

export const ENQUIRY_STATUS_LABELS: Record<ShopEnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
};

export const ENQUIRY_STATUS_COLORS: Record<ShopEnquiryStatus, string> = {
  new: '#448AFF',
  contacted: '#FFA726',
  converted: '#00C853',
  closed: '#5A5870',
};

export const ENQUIRY_TYPE_LABELS: Record<ShopEnquiryType, string> = {
  chat: 'Chat',
  quote: 'Product Quote',
  callback: 'Callback Request',
};

export function formatEnquiryTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

export function formatBuyerShortName(name?: string | null): string {
  if (!name?.trim()) return 'Buyer';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export function formatProximityLine(enquiry: ShopEnquiry): string {
  const name = formatBuyerShortName(enquiry.buyer?.name);
  if (typeof enquiry.distance_km === 'number' && !Number.isNaN(enquiry.distance_km)) {
    return `${name} · ${enquiry.distance_km.toFixed(1)} km away`;
  }
  if (enquiry.buyer?.city) return `${name} · ${enquiry.buyer.city}`;
  return name;
}

export function formatResponseTime(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function buildEnquiryWhatsAppMessage(
  buyerName: string,
  subject: string,
): string {
  return `Hi ${buyerName}, regarding your query on ${subject} via Vedastya — I'd be happy to help.`;
}

export function filterEnquiriesByTab(
  enquiries: ShopEnquiry[],
  tab: 'all' | 'quote' | 'callback',
): ShopEnquiry[] {
  if (tab === 'all') return enquiries;
  if (tab === 'quote') return enquiries.filter(e => e.type === 'quote');
  return enquiries.filter(e => e.type === 'callback');
}

export function productDisplayPrice(product: ShopEnquiry['product']): string | null {
  if (!product) return null;
  const price = product.discount_pct > 0 ? product.discounted_price : product.price;
  if (price == null) return null;
  return `₹${Number(price).toLocaleString('en-IN')}`;
}
