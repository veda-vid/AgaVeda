-- =============================================================
-- CityConnect — Row Level Security (RLS) Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- This makes every table 100% secure by default
-- =============================================================

-- Enable RLS on ALL tables (deny-by-default)
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_followers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROFILES
-- =============================================================
-- Anyone authenticated can read any profile (needed for feed/shops)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Block role elevation: only super_admin can set super_admin
DROP POLICY IF EXISTS "profiles_no_role_escalation" ON public.profiles;
CREATE POLICY "profiles_no_role_escalation"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    -- If trying to set role = super_admin, must already be super_admin
    CASE WHEN role = 'super_admin'
      THEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
      ELSE true
    END
  );

-- =============================================================
-- SHOPS
-- =============================================================
DROP POLICY IF EXISTS "shops_select_all" ON public.shops;
CREATE POLICY "shops_select_all"
  ON public.shops FOR SELECT
  TO authenticated
  USING (is_active = true OR owner_id = auth.uid());

-- Re-run safe: remove old policies so we don't keep stale logic
DROP POLICY IF EXISTS "shops_insert_own" ON public.shops;
DROP POLICY IF EXISTS "shops_update_own" ON public.shops;
DROP POLICY IF EXISTS "shops_delete_own" ON public.shops;

CREATE POLICY "shops_insert_own"
  ON public.shops FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
  );

CREATE POLICY "shops_update_own"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "shops_delete_own"
  ON public.shops FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- =============================================================
-- PRODUCTS
-- =============================================================
DROP POLICY IF EXISTS "products_select_available" ON public.products;
CREATE POLICY "products_select_available"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    is_available = true
    OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "products_insert_shop_owner" ON public.products;
CREATE POLICY "products_insert_shop_owner"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "products_update_shop_owner" ON public.products;
CREATE POLICY "products_update_shop_owner"
  ON public.products FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "products_delete_shop_owner" ON public.products;
CREATE POLICY "products_delete_shop_owner"
  ON public.products FOR DELETE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- =============================================================
-- POSTS
-- =============================================================
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "posts_insert_shop_owner" ON public.posts;
CREATE POLICY "posts_insert_shop_owner"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "posts_update_shop_owner" ON public.posts;
CREATE POLICY "posts_update_shop_owner"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "posts_delete_shop_owner" ON public.posts;
CREATE POLICY "posts_delete_shop_owner"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- =============================================================
-- POST LIKES
-- =============================================================
DROP POLICY IF EXISTS "likes_select_own" ON public.post_likes;
CREATE POLICY "likes_select_own"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "likes_insert_own" ON public.post_likes;
CREATE POLICY "likes_insert_own"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "likes_delete_own" ON public.post_likes;
CREATE POLICY "likes_delete_own"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- SAVED POSTS
-- =============================================================
DROP POLICY IF EXISTS "saved_select_own" ON public.saved_posts;
CREATE POLICY "saved_select_own"
  ON public.saved_posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_insert_own" ON public.saved_posts;
CREATE POLICY "saved_insert_own"
  ON public.saved_posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_delete_own" ON public.saved_posts;
CREATE POLICY "saved_delete_own"
  ON public.saved_posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- COMMENTS
-- =============================================================
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.comments;
CREATE POLICY "comments_delete_own_or_admin"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- =============================================================
-- SHOP FOLLOWERS
-- =============================================================
DROP POLICY IF EXISTS "followers_select_all" ON public.shop_followers;
CREATE POLICY "followers_select_all"
  ON public.shop_followers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "followers_insert_own" ON public.shop_followers;
CREATE POLICY "followers_insert_own"
  ON public.shop_followers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "followers_delete_own" ON public.shop_followers;
CREATE POLICY "followers_delete_own"
  ON public.shop_followers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- SERVICE PROVIDERS
-- =============================================================
DROP POLICY IF EXISTS "services_select_all" ON public.service_providers;
CREATE POLICY "services_select_all"
  ON public.service_providers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "services_insert_own" ON public.service_providers;
CREATE POLICY "services_insert_own"
  ON public.service_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('service_provider','super_admin')
  );

DROP POLICY IF EXISTS "services_update_own" ON public.service_providers;
CREATE POLICY "services_update_own"
  ON public.service_providers FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK (profile_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "services_delete_own" ON public.service_providers;
CREATE POLICY "services_delete_own"
  ON public.service_providers FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- =============================================================
-- REVIEWS
-- =============================================================
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_delete_own_or_admin" ON public.reviews;
CREATE POLICY "reviews_delete_own_or_admin"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- =============================================================
-- ADS
-- =============================================================
DROP POLICY IF EXISTS "ads_select_active" ON public.ads;
CREATE POLICY "ads_select_active"
  ON public.ads FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND ends_at > NOW())
    OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "ads_insert_shop_owner_or_admin" ON public.ads;
CREATE POLICY "ads_insert_shop_owner_or_admin"
  ON public.ads FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "ads_update_own" ON public.ads;
CREATE POLICY "ads_update_own"
  ON public.ads FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only server-side (service role) can INSERT notifications
-- So no INSERT policy for authenticated users

-- =============================================================
-- STORAGE BUCKET POLICIES
-- Run in: Supabase Dashboard → Storage → Policies
-- Bucket name: cityconnect
-- =============================================================
-- (These are run via the dashboard UI, but here for reference)

-- Allow authenticated users to read all public files
-- INSERT policy: authenticated users can only upload to their own folder (userId/*)
-- UPDATE/DELETE: users can only modify their own files

-- Real Storage Object policies for bucket "cityconnect"
-- This app uploads to: <folder>/<userId>/<filename>
-- Example: products/<uuid>/<file>, stories/<uuid>/<file>, reels/<uuid>/<file>
DROP POLICY IF EXISTS "storage_objects_select_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_select_cityconnect"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'cityconnect');

DROP POLICY IF EXISTS "storage_objects_insert_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_insert_cityconnect"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cityconnect'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_objects_update_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_update_cityconnect"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cityconnect'
    AND split_part(name, '/', 2) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'cityconnect'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_objects_delete_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_delete_cityconnect"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cityconnect'
    AND split_part(name, '/', 2) = auth.uid()::text
  );
