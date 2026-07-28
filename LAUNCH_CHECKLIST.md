# 🚀 CityConnect — Launch Checklist

## ✅ Already Built (Complete Code)
- [x] Auth: Splash → Role select → Phone OTP + Google/Apple SSO → Location setup
- [x] Home feed: Instagram-style posts, like, comment, save, share
- [x] Stories row with shop avatars
- [x] Shops page: search, filter by category, follow, call, reviews
- [x] Deals page: discounted products, flash sale banner
- [x] Services page: local pros with ratings, call, WhatsApp, reviews
- [x] Seller upload: product photo, price, discount, category → posts to feed live
- [x] Profile page: edit name/city, switch buyer↔seller, radius setting, logout
- [x] Supabase schema: all tables, triggers, auto-counters
- [x] Row Level Security: 100% secure, no data leaks
- [x] PostGIS geo queries: radius-based filtering
- [x] Push notifications: Expo push + edge function
- [x] Image upload: Supabase Storage with per-user folder security
- [x] Ads system: sponsored posts in feed, impression/click tracking

---

## 📋 LAUNCH STEPS — Do These In Order

### STEP 1 — Supabase Setup (30 mins)
```
1. Create account at supabase.com (free tier is fine for MVP)
2. New project → choose closest region → save password
3. SQL Editor → paste & run: supabase/schema.sql
4. SQL Editor → paste & run: supabase/rls.sql
5. SQL Editor → paste & run: supabase/storage_policies.sql
6. SQL Editor → paste & run: supabase/seed.sql (for test data)
7. Storage → New bucket → name: cityconnect → toggle Public ON
8. Authentication → Providers → Enable: Phone (Twilio), Google, Apple
9. Settings → API → Copy: Project URL + anon key
```

### STEP 2 — Twilio (for SMS OTP) (15 mins)
```
1. Create account at twilio.com (free $15 credit to start)
2. Get Account SID + Auth Token + phone number
3. Supabase → Auth → Providers → Phone → paste Twilio credentials
```

### STEP 3 — Google OAuth (15 mins)
```
1. console.cloud.google.com → New project → APIs → OAuth 2.0 Client
2. Add redirect URI: https://YOUR_PROJECT.supabase.co/auth/v1/callback
3. Copy Client ID + Secret
4. Supabase → Auth → Providers → Google → paste credentials
```

### STEP 4 — Environment Variables (5 mins)
```bash
cp .env.example .env.local
# Fill in:
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### STEP 5 — Run Locally (5 mins)
```bash
npm install
npx expo start
# Press 'w' for browser, 'a' for Android, 'i' for iOS
```

### STEP 6 — Test All Flows
```
[ ] Sign up as Buyer → browse feed → like/comment/save
[ ] Sign up as Seller → create shop → upload product → see it in feed
[ ] Sign up as Service Provider → add your service → see it in Services tab
[ ] Test radius filter (change in Profile)
[ ] Test search in Shops tab
```

### STEP 7 — Deploy Web (10 mins)
```bash
npx expo export --platform web
# Upload /dist folder to Vercel (free):
npx vercel dist/
# OR Netlify: drag & drop dist/ folder to netlify.com
```

### STEP 8 — Android APK for Beta (30 mins)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
# Share the APK link with beta testers
```

### STEP 9 — Play Store Submission
```
1. Create Google Play Developer account ($25 one-time)
2. eas build --platform android --profile production
3. eas submit --platform android
```

### STEP 10 — App Store Submission
```
1. Apple Developer account ($99/year)
2. eas build --platform ios --profile production
3. eas submit --platform ios
```

---

## 💰 COSTS TO LAUNCH MVP

| Service | Cost | Notes |
|---------|------|-------|
| Supabase | FREE | Up to 500MB DB, 1GB storage, 50k users |
| Twilio OTP | ~₹0.50/SMS | Pay as you go |
| Vercel Web | FREE | Unlimited web deploys |
| Google Play | ₹2,000 | One-time |
| Apple App Store | ₹8,000/yr | Annual fee |
| Domain | ₹800/yr | optional |
| **Total MVP** | **~₹11,000** | Launch with zero monthly costs |

---

## 📈 AFTER LAUNCH — Add These

### Week 2-3
- [ ] In-app notifications inbox screen
- [ ] WhatsApp share button on products
- [ ] Shop owner dashboard (analytics: views, follows, likes)

### Week 4-6
- [ ] Payments via Razorpay (take ₹99/month from sellers)
- [ ] Ad booking by sellers (self-serve ad creation)
- [ ] Super Admin dashboard (manage all shops, users, ads)

### Month 2+
- [ ] Product search with filters
- [ ] Map view (show shops on map)
- [ ] Delivery integration

---

## 🆘 COMMON ISSUES & FIXES

**"Supabase URL missing" error**
→ Make sure .env.local exists and expo was restarted after adding it

**OTP not received**
→ Check Twilio dashboard for errors. Verify phone format is +91XXXXXXXXXX

**Location not working on iOS**
→ Requires physical device. Check app.json has NSLocationUsageDescription

**Build fails on EAS**
→ Run: eas build:configure first, then add env vars in eas.json

**Images not uploading**
→ Check Storage bucket is named exactly "cityconnect" and is Public
