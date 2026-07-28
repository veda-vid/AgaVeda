-- =============================================================
-- CityConnect — Fixed Seed Data
-- 
-- THE FIX: We first create a real auth user via Supabase's
-- auth.users table directly (only works as service_role / SQL editor).
-- Then seed all shops, products, posts, services from that user.
-- =============================================================

DO $$
DECLARE
  test_user_id UUID;
  shop1_id UUID := gen_random_uuid();
  shop2_id UUID := gen_random_uuid();
  shop3_id UUID := gen_random_uuid();
  shop4_id UUID := gen_random_uuid();
BEGIN

  -- ── Step 1: Create a real auth user so FK constraint is satisfied ──
  -- This inserts directly into auth.users (only possible from SQL Editor)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'testadmin@cityconnect.app',
    crypt('TestPass123!', gen_salt('bf')),  -- hashed password
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Test Admin"}',
    false,
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (email) DO NOTHING;  -- skip if already exists

  -- ── Step 2: Get the user ID we just created ──
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'testadmin@cityconnect.app'
  LIMIT 1;

  -- ── Step 3: Profile is auto-created by trigger, but upsert to set role ──
  UPDATE public.profiles
  SET
    name       = 'Test Admin',
    role       = 'seller',
    city       = 'Mumbai',
    lat        = 19.0760,
    lng        = 72.8777,
    radius_km  = 10,
    is_verified = true
  WHERE id = test_user_id;

  -- ── Step 4: Shops ─────────────────────────────────────────────
  INSERT INTO public.shops (id, owner_id, name, description, category, logo_url, address, city, lat, lng, phone, is_open, is_verified, is_active)
  VALUES
    (shop1_id, test_user_id, 'Fresh Basket',  'Farm-fresh organic vegetables delivered daily. Zero middlemen.', 'grocery',     '🛒', 'Shop 12, Andheri Market, Mumbai',   'Mumbai', 19.1136, 72.8697, '+919876543210', true,  true,  true),
    (shop2_id, test_user_id, 'TechZone',      'Latest gadgets, accessories, repairs & warranties.',            'electronics', '💻', '42 Linking Road, Bandra, Mumbai',   'Mumbai', 19.0596, 72.8295, '+918765432109', true,  true,  true),
    (shop3_id, test_user_id, 'Bakery Bliss',  'Artisan sourdough, croissants & custom cakes. Fresh daily.',   'food',        '🍰', '8 Hill Road, Bandra West, Mumbai',  'Mumbai', 19.0524, 72.8258, '+917654321098', true,  false, true),
    (shop4_id, test_user_id, 'Style Hub',     'Trending fashion for men, women & kids. New arrivals weekly.', 'fashion',     '👗', 'Fashion Street, Colaba, Mumbai',    'Mumbai', 18.9218, 72.8322, '+916543210987', false, true,  true)
  ON CONFLICT (id) DO NOTHING;

  -- ── Step 5: Products ─────────────────────────────────────────
  INSERT INTO public.products (shop_id, title, description, price, discount_pct, category, is_available, is_featured)
  VALUES
    (shop1_id, 'Organic Tomatoes (1kg)',  'Hand-picked from local farms. Zero pesticides.',       40,    0,  'grocery',     true, true),
    (shop1_id, 'Mixed Veggie Bundle',     'Tomatoes, spinach, capsicum, cucumber & more.',        299,  33,  'grocery',     true, false),
    (shop2_id, 'iPhone 16 Pro Case',      'MagSafe compatible. Military-grade drop protection.',  349,   0,  'electronics', true, true),
    (shop2_id, 'Bluetooth Earbuds Pro',   '40-hr battery. ANC. IPX7 waterproof.',                899,  40,  'electronics', true, false),
    (shop3_id, 'Sourdough Loaf',          'Naturally fermented. No preservatives. Baked at 5 AM.',180,   0,  'food',        true, true),
    (shop3_id, 'Custom Cake (1kg)',       'Personalized flavour, message & design.',              450,  31,  'food',        true, false),
    (shop4_id, 'Summer Dress Collection', 'Lightweight cotton. 12 colours available.',            999,  50,  'fashion',     true, true),
    (shop4_id, 'Casual Sneakers',         'Comfort sole. Sizes 5–12. Unisex.',                   1299, 20,  'fashion',     true, false)
  ON CONFLICT DO NOTHING;

  -- ── Step 6: Posts ─────────────────────────────────────────────
  INSERT INTO public.posts (shop_id, caption, media_urls, media_type, is_ad)
  VALUES
    (shop1_id, 'Farm-fresh organic veggies just arrived! 🥦🍅 Hand-picked tomatoes, broccoli & seasonal greens. Zero middlemen — direct from farm to you.', '{}', 'image', false),
    (shop2_id, 'iPhone 16 Pro cases restocked! 📱 Premium MagSafe compatible covers. 20 units only — grab yours before it sells out!',                      '{}', 'image', false),
    (shop3_id, 'Freshly baked sourdough every morning 🥐 Order before 8 AM for same-day pickup. No preservatives, just real bread.',                        '{}', 'image', false),
    (shop4_id, 'Summer collection drop 🔥 50% OFF on all dresses this week. New arrivals every Monday.',                                                     '{}', 'image', false)
  ON CONFLICT DO NOTHING;

  -- ── Step 7: Service Providers ─────────────────────────────────
  INSERT INTO public.service_providers (profile_id, business_name, category, description, phone, area_served, city, lat, lng, experience_years, total_jobs, is_available, is_verified)
  VALUES
    (test_user_id, 'Raju Plumbing',     'plumber',       'All plumbing works — leaks, fittings, bathroom renovations. Same-day service.', '+919876543210', 'Andheri, Bandra, Juhu',       'Mumbai', 19.1136, 72.8697, 8,  420, true,  true),
    (test_user_id, 'Spark Electricals', 'electrician',   'Wiring, MCB, inverter setup, fan installations. Licensed electrician.',         '+918765432109', 'Kurla, Ghatkopar, Powai',     'Mumbai', 19.0760, 72.8777, 12, 310, true,  true),
    (test_user_id, 'Cool Air AC',       'ac_technician', 'AC installation, servicing, gas refilling. All brands.',                        '+917654321098', 'Powai, Vikhroli, Mulund',     'Mumbai', 19.1200, 72.9100, 6,  180, false, true),
    (test_user_id, 'PaintPro',          'painter',       'Interior & exterior painting. Texture, wallpaper, waterproofing.',              '+916543210987', 'Dadar, Sion, Matunga',        'Mumbai', 19.0176, 72.8562, 10, 290, true,  true),
    (test_user_id, 'Clean Sweep',       'cleaning',      'Deep cleaning, sofa cleaning, bathroom sanitization. Eco-friendly products.',   '+915432109876', 'Malad, Goregaon, Borivali',   'Mumbai', 19.1870, 72.8480, 4,  120, true,  false)
  ON CONFLICT DO NOTHING;

  -- ── Step 8: Ads ───────────────────────────────────────────────
  INSERT INTO public.ads (shop_id, title, description, image_url, cta_text, cta_url, is_active, priority, ends_at)
  VALUES
    (shop1_id, 'Fresh Basket',  'Get 20% off your first order! Use code: FRESH20',       '', 'Shop Now',   'https://cityconnect.app', true, 10, NOW() + INTERVAL '30 days'),
    (shop2_id, 'TechZone Sale', 'Biggest electronics sale of the year. Up to 40% off!',  '', 'View Deals', 'https://cityconnect.app', true, 8,  NOW() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete. Test user ID: %', test_user_id;
  RAISE NOTICE 'Test user email: testadmin@cityconnect.app';
  RAISE NOTICE 'Test user password: TestPass123!';

END $$;
