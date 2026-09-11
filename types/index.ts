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
  delivery_address?: string | null;
  radius_km: number;          // discovery radius
  push_enabled?: boolean;
  push_token?: string | null;
  is_verified: boolean;
  is_suspended: boolean;
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
  email: string;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  open_time: string;
  close_time: string;
  operating_hours?: ShopOperatingHours | null;
  is_open: boolean;
  is_verified: boolean;
  is_active: boolean;
  presence_status?: ShopPresenceStatus;
  status_message?: string | null;
  last_active_at?: string;
  accepts_messages?: boolean;
  avg_rating: number;
  total_reviews: number;
  total_followers: number;
  total_products: number;
  created_at: string;
  updated_at: string;
  // computed
  distance_km?: number;
}

export type ShopPresenceStatus = 'open' | 'closed' | 'busy' | 'custom';

export interface ShopDayHours {
  enabled: boolean;
  open: string;
  close: string;
}

export interface ShopOperatingHours {
  schedule: Record<string, ShopDayHours>;
  closedToday?: boolean;
  is24_7?: boolean;
}

export interface ShopConversation {
  id: string;
  buyer_id: string;
  shop_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ShopMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type ShopEnquiryType = 'chat' | 'quote' | 'callback';
export type ShopEnquiryStatus = 'new' | 'contacted' | 'converted' | 'closed';

export interface ShopEnquiry {
  id: string;
  shop_id: string;
  buyer_id: string;
  product_id: string | null;
  type: ShopEnquiryType;
  message: string;
  status: ShopEnquiryStatus;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  buyer?: Pick<Profile, 'id' | 'name' | 'avatar_url' | 'city' | 'lat' | 'lng' | 'phone'>;
  product?: Pick<Product, 'id' | 'title' | 'price' | 'discount_pct' | 'discounted_price' | 'images'>;
  distance_km?: number;
}

export interface SellerEnquiryStats {
  total_leads: number;
  new_leads: number;
  conversion_rate: number;
  avg_response_minutes: number;
}

export interface SellerDashboardMetrics {
  daily_views: number;
  product_saves: number;
  new_leads: number;
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
  | 'toys'
  | 'pet_supplies'
  | 'home_decor'
  | 'jewelry'
  | 'watches'
  | 'footwear'
  | 'baby_kids'
  | 'stationery'
  | 'gifts'
  | 'florists'
  | 'hardware'
  | 'kitchenware'
  | 'mobile_accessories'
  | 'computer_accessories'
  | 'appliances'
  | 'bakery'
  | 'cafe'
  | 'restaurant'
  | 'meat_seafood'
  | 'dairy'
  | 'organic'
  | 'liquor'
  | 'eyewear'
  | 'luggage'
  | 'music'
  | 'gaming'
  | 'art_crafts'
  | 'fitness'
  | 'medical_supplies'
  | 'industrial'
  | 'gardening'
  | 'cleaning_supplies'
  | 'fabrics'
  | 'tailoring'
  | 'salon'
  | 'spa'
  | 'bicycle'
  | 'travel'
  | 'religious'
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
  shop_id: string | null;
  service_provider_id?: string | null;
  caption: string;
  media_urls: string[];
  media_type: 'image' | 'video';
  is_ad: boolean;
  ad_cta_text: string | null;
  ad_cta_url: string | null;
  total_likes: number;
  total_comments: number;
  total_reposts?: number;
  created_at: string;
  // joined
  deleted_at?: string | null;
  shop?: Shop;
  product?: Product;
  is_liked?: boolean;
  is_saved?: boolean;
  is_reposted?: boolean;
  /** Stable list key when post appears as a repost feed entry */
  feed_item_id?: string;
  /** Attribution for community/profile repost cards */
  reposted_by_name?: string | null;
  reposted_by_id?: string | null;
  reposted_at?: string | null;
  quote_caption?: string | null;
  is_repost_entry?: boolean;
  /** True when this repost entry originated from a native Spark (reel) */
  is_spark_repost?: boolean;
  spark_id?: string | null;
}

export interface SellerCompetitiveProfile {
  seller_id: string;
  shop_id: string;
  city: string;
  category: ShopCategory;
  review_score_raw: number;
  review_points: number;
  monthly_successful_orders: number;
  order_points: number;
  repeat_buyer_pct: number;
  retention_points: number;
  composite_competitive_score: number;
  category_rank: number;
  category_population: number;
  seller_tier: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';
  calculated_at: string;
}

export interface ServiceProvider {
  id: string;
  profile_id: string;
  business_name: string;
  category: ServiceCategory;
  subcategory?: string | null;
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
  presence_status?: PresenceStatus;
  custom_status?: string | null;
  last_active_at?: string;
  base_rate_label?: string | null;
  portfolio_photos?: string[];
  coverage_radius_km?: number;
  created_at: string;
  // computed
  distance_km?: number;
}

export type PresenceStatus = 'online' | 'offline' | 'away' | 'custom';

export type OtherSubcategory =
  | 'mistri'
  | 'majdoor'
  | 'welder'
  | 'mechanic'
  | 'appliance_repair'
  | 'masonry'
  | 'glasswork'
  | 'fabricator';

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

export interface ProConversation {
  id: string;
  buyer_id: string;
  provider_profile_id: string;
  service_provider_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProConversationWithBuyer extends ProConversation {
  buyer?: Pick<Profile, 'id' | 'name' | 'avatar_url' | 'phone'> | null;
}

export interface ProMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type ServiceRequestUrgency = 'emergency' | 'today' | 'scheduled';
export type ServiceRequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceRequest {
  id: string;
  buyer_id: string;
  service_provider_id: string;
  urgency: ServiceRequestUrgency;
  scheduled_date: string | null;
  subcategory: string | null;
  description: string;
  status: ServiceRequestStatus;
  created_at: string;
  updated_at: string;
}

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
  type: 'new_product' | 'deal' | 'follow' | 'like' | 'comment' | 'system' | 'order' | 'repost';
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export type CityNewsCategory = 'event' | 'rates' | 'weather' | 'alerts' | 'general';

export type DailyWidgetKind = 'weather' | 'fx' | 'gold' | 'silver' | 'mandi' | 'index' | 'fuel';

export interface DailyWidgetMeta {
  kind: DailyWidgetKind;
  label?: string;
  value?: string;
  changePct?: number | null;
  unit?: string;
  temp?: number;
  condition?: string;
  humidity?: number;
  wind?: number;
  /** Precipitation probability 0–100 */
  rainChance?: number;
  /** Air quality index (US / European scale from Open-Meteo) */
  aqi?: number;
  /** WMO weather code for dynamic tile graphics */
  weatherCode?: number;
  /** Multi-row widgets (mandi board, gold 24K/22K, petrol/diesel) */
  items?: Array<{
    name: string;
    price: string;
    changePct?: number | null;
    /** Prior close / last-week baseline for comparison tables */
    baseline?: string;
    /** 7-day percentage move */
    trend7d?: number | null;
  }>;
  live?: boolean;
  /** weekly | daily cadence for rate boards */
  cadence?: 'daily' | 'weekly';
  /** ISO timestamp for LIVE / WEEKLY badge */
  updatedAt?: string;
}

export interface CityNews {
  id: string;
  city: string;
  category: CityNewsCategory;
  title: string;
  body: string;
  image_url: string | null;
  source_url: string | null;
  is_published: boolean;
  author_id: string | null;
  total_likes: number;
  total_comments: number;
  created_at: string;
  updated_at: string;
  author?: Profile | null;
  is_liked?: boolean;
  /** Explore mosaic: image or video Spark tile */
  media_type?: 'image' | 'video' | null;
  /** Structured data for rates / weather widgets */
  widget?: DailyWidgetMeta | null;
  /** Prefer tall 1×2 tile in the Explore mosaic */
  featured?: boolean;
}

export interface CityNewsComment {
  id: string;
  news_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user?: Profile | null;
}

export interface Story {
  id: string;
  shop_id: string | null;
  service_provider_id?: string | null;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  expires_at: string;
  created_at: string;
  deleted_at?: string | null;
  shop_name?: string;
  shop_logo?: string | null;
  audio_track_id?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  audio_url?: string | null;
  audio_start_time?: number | null;
  audio_volume_balance?: { video: number; music: number } | null;
}

export interface Reel {
  id: string;
  shop_id: string | null;
  service_provider_id?: string | null;
  author_id: string;
  media_url: string;
  caption: string;
  tags: string[];
  total_likes: number;
  total_comments: number;
  created_at: string;
  deleted_at?: string | null;
  shop_name?: string;
  shop_logo?: string | null;
  product_id?: string | null;
  product?: Pick<Product, 'id' | 'title' | 'price' | 'discounted_price' | 'images'> | null;
  audio_track_id?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  audio_url?: string | null;
  audio_start_time?: number | null;
  audio_volume_balance?: { video: number; music: number } | null;
  /** Hydrated for the current viewer */
  is_liked?: boolean;
  is_reposted?: boolean;
  is_following?: boolean;
  total_reposts?: number;
  source_type?: 'reel' | 'post';
}

export interface SparkComment {
  id: string;
  spark_id?: string;
  post_id?: string;
  user_id: string;
  body: string;
  text?: string;
  created_at: string;
  user?: Pick<Profile, 'id' | 'name' | 'avatar_url'>;
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
  shop?: Pick<Shop, 'id' | 'name' | 'logo_url' | 'city' | 'owner_id'>;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';

export interface Order {
  id: string;
  buyer_id: string;
  shop_id: string;
  status: OrderStatus;
  total_amount: number;
  item_subtotal: number;
  delivery_charge: number;
  delivery_address: string | null;
  contact_phone: string | null;
  order_notes: string | null;
  placed_at: string;
  completed_at: string | null;
  shop?: Pick<Shop, 'id' | 'name' | 'logo_url'>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface CheckoutOrderResult {
  order_id: string;
  order_ref: string;
  shop_id: string;
  shop_name: string;
  owner_id: string;
  item_subtotal: number;
  delivery_charge: number;
  total_amount: number;
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
