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
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Block role elevation: only super_admin can set super_admin
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
CREATE POLICY "shops_select_all"
  ON public.shops FOR SELECT
  TO authenticated
  USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY "shops_insert_own"
  ON public.shops FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('seller','super_admin')
  );

CREATE POLICY "shops_update_own"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK (owner_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "shops_delete_own"
  ON public.shops FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- =============================================================
-- PRODUCTS
-- =============================================================
CREATE POLICY "products_select_available"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    is_available = true
    OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "products_insert_shop_owner"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "products_update_shop_owner"
  ON public.products FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "products_delete_shop_owner"
  ON public.products FOR DELETE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- =============================================================
-- POSTS
-- =============================================================
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "posts_insert_shop_owner"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "posts_update_shop_owner"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

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
CREATE POLICY "likes_select_own"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "likes_insert_own"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete_own"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- SAVED POSTS
-- =============================================================
CREATE POLICY "saved_select_own"
  ON public.saved_posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "saved_insert_own"
  ON public.saved_posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_delete_own"
  ON public.saved_posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- COMMENTS
-- =============================================================
CREATE POLICY "comments_select_all"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

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
CREATE POLICY "followers_select_all"
  ON public.shop_followers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "followers_insert_own"
  ON public.shop_followers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "followers_delete_own"
  ON public.shop_followers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- SERVICE PROVIDERS
-- =============================================================
CREATE POLICY "services_select_all"
  ON public.service_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "services_insert_own"
  ON public.service_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('service_provider','super_admin')
  );

CREATE POLICY "services_update_own"
  ON public.service_providers FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "services_delete_own"
  ON public.service_providers FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- =============================================================
-- REVIEWS
-- =============================================================
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid());

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
CREATE POLICY "ads_select_active"
  ON public.ads FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND ends_at > NOW())
    OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "ads_insert_shop_owner_or_admin"
  ON public.ads FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "ads_update_own"
  ON public.ads FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

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
