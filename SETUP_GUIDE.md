# CityConnect — Complete Setup Guide
> React Native + Web + Supabase | Production Ready

---

## PREREQUISITES — Install these first

```bash
# 1. Install Node.js (v18+)
# Download from: https://nodejs.org

# 2. Install dependencies
npm install -g expo-cli eas-cli

# 3. Verify
node --version   # should be v18+
npm --version    # should be v9+
```

---

## STEP 1 — Create Expo Project

```bash
npx create-expo-app@latest CityConnect --template blank-typescript
cd CityConnect
```

---

## STEP 2 — Install All Packages

```bash
npx expo install \
  expo-router \
  expo-secure-store \
  expo-location \
  expo-image-picker \
  expo-notifications \
  expo-constants \
  expo-linking \
  expo-status-bar \
  react-native-safe-area-context \
  react-native-screens \
  react-native-gesture-handler \
  react-native-reanimated \
  react-native-svg \
  @react-native-async-storage/async-storage \
  @supabase/supabase-js \
  @shopify/flash-list \
  react-native-image-crop-picker

npm install \
  zustand \
  react-hook-form \
  zod \
  @hookform/resolvers \
  date-fns \
  react-native-toast-message
```

---

## STEP 3 — Copy Project Files

Copy all files from this package into your CityConnect folder,
replacing any existing files when prompted.

Folder structure after copying:
```
CityConnect/
├── app/                    ← All screens (Expo Router)
│   ├── (auth)/
│   │   ├── splash.tsx
│   │   ├── role.tsx
│   │   ├── login.tsx
│   │   └── location.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx       ← Home feed
│   │   ├── shops.tsx
│   │   ├── deals.tsx
│   │   ├── services.tsx
│   │   └── profile.tsx
│   ├── seller/
│   │   └── upload.tsx
│   └── _layout.tsx
├── components/             ← Reusable UI
├── lib/                    ← Supabase + helpers
├── stores/                 ← Zustand state
├── hooks/                  ← Custom hooks
├── types/                  ← TypeScript types
├── constants/              ← Colors, config
└── supabase/               ← DB schema + RLS
```

---

## STEP 4 — Supabase Setup

1. Go to https://supabase.com → Create new project
2. Save your: Project URL + anon key + service_role key
3. Go to SQL Editor → paste contents of `supabase/schema.sql`
4. Go to SQL Editor → paste contents of `supabase/rls.sql`
5. Go to Storage → create bucket named `cityconnect` (public)
6. Copy `.env.example` → `.env.local` and fill in your keys

---

## STEP 5 — Run the App

```bash
# Start development server
npx expo start

# Press 'w' for web
# Press 'a' for Android emulator
# Press 'i' for iOS simulator
# Or scan QR code with Expo Go app
```

---

## STEP 6 — Build for Production

```bash
# Configure EAS
eas build:configure

# Build Android APK
eas build --platform android

# Build iOS IPA
eas build --platform ios

# Deploy web
npx expo export --platform web
# Then deploy /dist folder to Vercel/Netlify
```
