# Repost Feature - Complete Implementation

## Overview
This document outlines the complete end-to-end implementation of Instagram-style repost functionality in the CityConnect app.

## What Was Implemented

### 1. Database Layer
- ✅ Created `reposts` table with proper RLS policies (migration `005_reposts_table.sql`)
- ✅ Updated `feed_within_radius` RPC function to include repost data
- ✅ Updated `feed_from_followed` RPC function to include repost data
- ✅ Added support for `is_reposted`, `is_liked`, `is_saved` boolean flags
- ✅ Added support for `total_reposts` count

### 2. API Layer (`lib/api.ts`)
- ✅ `repostPost(userId, postId, shopId)` - Creates a repost record
- ✅ `unrepostPost(userId, postId)` - Removes a repost record
- ✅ `getRepostedPosts(userId)` - Fetches all posts reposted by a user
- ✅ Updated `getFeed()` to accept and pass `userId` parameter
- ✅ All feed functions now return `is_reposted` and `total_reposts` fields

### 3. TypeScript Types (`types/index.ts`)
- ✅ Added `total_reposts?: number` to Post interface
- ✅ Added `is_reposted?: boolean` to Post interface

### 4. UI Components

#### Home Feed (`app/(tabs)/index.tsx`)
- ✅ Repost button (↻) in post actions bar
- ✅ Green highlight when post is reposted
- ✅ Dynamic repost counter displayed next to likes
- ✅ Debouncing to prevent rapid clicks
- ✅ Optimistic UI updates with rollback on error
- ✅ Success/error alerts
- ✅ Three-dot menu with repost option

#### Profile (`app/(tabs)/profile.tsx`)
- ✅ "Reposts" tab for sellers
- ✅ Grid display of reposted items
- ✅ Real-time sync with repost actions
- ✅ Empty state messaging
- ✅ Loading states

## Required Action: Apply Database Migration

You **MUST** run the new migration file to enable full repost functionality:

### Step-by-Step Instructions:

1. **Open your Supabase project dashboard**
   - Go to https://app.supabase.com
   - Select your CityConnect project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Migration 006**
   - Open the file: `supabase/migrations/006_add_repost_support_to_feeds.sql`
   - Copy the entire contents
   - Paste into the Supabase SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

4. **Verify Success**
   - You should see "Success. No rows returned" message
   - This means the functions were updated successfully

5. **Restart PostgREST (Important!)**
   - Go to "Settings" → "API" in Supabase dashboard
   - Click "Restart PostgREST" button
   - Wait 10-20 seconds for the restart to complete
   - This ensures the updated functions are recognized

6. **Test the Feature**
   - Restart your Expo development server
   - Navigate to http://localhost:8081/
   - Try reposting a post by clicking the ↻ icon
   - Verify the icon turns green and the counter updates
   - Check your profile's "Reposts" tab to see the reposted item

## Feature Specifications

### UI State Behavior
1. **Repost Icon**: 
   - Default: Gray ↻ icon
   - Reposted: Green ↻ icon
   
2. **Repost Counter**:
   - Displayed next to "likes" count (e.g., "24 likes · 3 reposts")
   - Only shown when `total_reposts > 0`
   - Updates in real-time when reposting/unreposting

3. **Profile Repost Tab**:
   - Only visible for seller accounts
   - Shows all posts the user has reposted
   - Automatically syncs when reposts are added/removed
   - Shows empty state when no reposts exist

### API Behavior
1. **Reposting a Post**:
   - Creates a record in `reposts` table
   - Links user_id, post_id, shop_id
   - Increments local counter optimistically
   - Shows success alert

2. **Unreposting a Post**:
   - Deletes the repost record
   - Decrements local counter
   - Shows removal confirmation

3. **Feed Integration**:
   - All feed queries now include repost status for current user
   - Total repost count included for all posts
   - Profile repost tab fetches via `getRepostedPosts()`

## Troubleshooting

### Issue: "Could not find the table 'public.reposts'"
**Solution**: You haven't applied migration `005_reposts_table.sql` yet. Run it first.

### Issue: Repost count is always 0
**Solution**: You haven't applied migration `006_add_repost_support_to_feeds.sql`. The RPC functions need to be updated.

### Issue: "is_reposted" is always false
**Solution**: 
1. Make sure migration `006` is applied
2. Restart PostgREST in Supabase settings
3. Restart your Expo dev server
4. Ensure you're passing `userId` to `getFeed()` calls

### Issue: Profile "Reposts" tab is empty after reposting
**Solution**: 
1. Check that the `getRepostedPosts()` API is being called
2. Verify the `reposts` table has records (check in Supabase Table Editor)
3. Make sure RLS policies allow reading reposts

## Architecture Notes

### Database RPC Functions
The feed RPC functions now use subqueries to compute per-post metadata:
- `is_liked`: Checks if current user liked the post
- `is_saved`: Checks if current user saved the post
- `is_reposted`: Checks if current user reposted the post
- `total_reposts`: Counts total reposts for the post

This approach:
- ✅ Eliminates N+1 queries
- ✅ Returns complete post data in one round-trip
- ✅ Leverages Postgres indexes for performance
- ✅ Works seamlessly with pagination

### State Management
The repost feature uses local component state with optimistic updates:
1. UI updates immediately (optimistic)
2. API call executes in background
3. On success: state persists
4. On error: state rolls back + error alert

This provides the best UX while maintaining data consistency.

## Next Steps (Optional Enhancements)

Future improvements you could consider:
- [ ] Add repost feed view (see all posts reposted by followed users)
- [ ] Add "Reposted by [username]" label on reposted items in feed
- [ ] Add analytics for repost counts per shop
- [ ] Add notification when someone reposts your post
- [ ] Add ability to add a comment/caption when reposting

---

## Summary

The repost feature is now fully implemented and ready to use. Once you apply migration `006_add_repost_support_to_feeds.sql` and restart PostgREST, the entire feature will work end-to-end with proper UI states, counters, profile tab sync, and Instagram-style behavior.
