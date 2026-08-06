// types/index.ts — All shared TypeScript types for CityConnect

export type UserRole = 'buyer' | 'seller' | 'service_provider' | 'super_admin';

export interface Profile {
  id: string;                 // matches auth.users.id
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  bio?: string;
  role: UserRole;
  city: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;          // discovery radius
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;           // references profiles.id
  name: string;
  description: string;
  category: ShopCategory;
  logo_url: string | null;
  cover_url: string | null;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp: string | null;
  is_open: boolean;
  is_verified: boolean;
  is_active: boolean;
  avg_rating: number;
  total_reviews: number;
  total_followers: number;
  total_products: number;
  created_at: string;
  updated_at: string;
  // computed
  distance_km?: number;
}

export type ShopCategory =
  | 'grocery'
  | 'electronics'
  | 'fashion'
  | 'food'
  | 'pharmacy'
  | 'automobile'
  | 'furniture'
  | 'beauty'
  | 'sports'
  | 'books'
  | 'other';

export interface Product {
  id: string;
  shop_id: string;
  title: string;
  description: string;
  price: number;
  discount_pct: number;       // 0-100
  discounted_price: number;   // computed
  images: string[];           // array of storage URLs
  category: ShopCategory;
  is_available: boolean;
  is_featured: boolean;
  total_likes: number;
  total_comments: number;
  created_at: string;
  updated_at: string;
  // joined
  shop?: Shop;
}

export interface Post {
  id: string;
  product_id: string | null;
  shop_id: string;
  caption: string;
  media_urls: string[];
  media_type: 'image' | 'video';
  is_ad: boolean;
  ad_cta_text: string | null;
  ad_cta_url: string | null;
  total_likes: number;
  total_comments: number;
  created_at: string;
  // joined
  shop?: Shop;
  product?: Product;
  is_liked?: boolean;
  is_saved?: boolean;
}

export interface ServiceProvider {
  id: string;
  profile_id: string;
  business_name: string;
  category: ServiceCategory;
  description: string;
  phone: string;
  whatsapp: string | null;
  area_served: string;
  city: string;
  lat: number | null;
  lng: number | null;
  experience_years: number;
  total_jobs: number;
  avg_rating: number;
  total_reviews: number;
  is_available: boolean;
  is_verified: boolean;
  created_at: string;
  // computed
  distance_km?: number;
}

export type ServiceCategory =
  | 'plumber'
  | 'electrician'
  | 'ac_technician'
  | 'painter'
  | 'cleaning'
  | 'gardening'
  | 'security'
  | 'carpenter'
  | 'pest_control'
  | 'other';

export interface Review {
  id: string;
  reviewer_id: string;
  target_id: string;           // shop_id or service_provider_id
  target_type: 'shop' | 'service_provider';
  rating: number;              // 1-5
  comment: string;
  created_at: string;
  // joined
  reviewer?: Profile;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  // joined
  user?: Profile;
}

export interface Ad {
  id: string;
  shop_id: string;
  title: string;
  description: string;
  image_url: string;
  cta_text: string;
  cta_url: string;
  is_active: boolean;
  priority: number;
  impressions: number;
  clicks: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  // joined
  shop?: Shop;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_product' | 'deal' | 'follow' | 'like' | 'comment' | 'system';
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface Story {
  id: string;
  shop_id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  expires_at: string;
  created_at: string;
  shop_name?: string;
  shop_logo?: string | null;
}

export interface Reel {
  id: string;
  shop_id: string;
  author_id: string;
  media_url: string;
  caption: string;
  tags: string[];
  total_likes: number;
  total_comments: number;
  created_at: string;
  shop_name?: string;
  shop_logo?: string | null;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  shop_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
  shop?: Shop;
}

export interface SearchResult {
  result_type: 'shop' | 'product';
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  shop_id: string;
  distance_km: number;
}

// Auth state
export interface AuthState {
  user: Profile | null;
  session: unknown | null;
  isLoading: boolean;
}

// Feed filter
export interface FeedFilter {
  radius_km: number;
  category?: ShopCategory;
  city: string;
}
