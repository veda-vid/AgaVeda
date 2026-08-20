# Testing Guide: State Persistence & Repost Feature

## Prerequisites

Ensure all migrations are applied in Supabase SQL Editor:

1. ✅ `005_reposts_table.sql` - Creates reposts table
2. ✅ `006_add_repost_support_to_feeds.sql` - Updates feed functions
3. ✅ `007_fix_reposts_rls_policy.sql` - Fixes RLS policies (optional)
4. ✅ `008_add_update_policy_for_reposts.sql` - **CRITICAL** - Adds UPDATE policy for UPSERT

After running migrations, **restart PostgREST** in Supabase:
- Go to Settings → API → Click "Restart server"
- Wait 20-30 seconds

## Test Scenarios

### Test 1: Repost Functionality
**Expected Behavior:** Instagram-style repost with persistent state

1. Navigate to http://localhost:8081/
2. Find any post in the feed
3. Click the repost icon (↻)
4. **Expected:** 
   - Icon turns GREEN immediately
   - Counter increases (e.g., 0 → 1)
   - Alert shows "Reposted ✓"
   - Icon stays GREEN after alert dismisses

5. Refresh the page (F5 or Cmd+R)
6. **Expected:**
   - Repost icon is still GREEN
   - Counter still shows correct number

7. Click repost icon again (to remove)
8. **Expected:**
   - Icon turns gray immediately
   - Counter decreases
   - Alert shows "Removed"
   - Icon stays gray

### Test 2: Like Persistence
**Expected Behavior:** Likes persist across refreshes

1. Click like (heart) on a post
2. **Expected:** Heart turns RED, counter increases
3. Refresh page
4. **Expected:** Heart is still RED
5. Click heart again to unlike
6. **Expected:** Heart turns white, counter decreases

### Test 3: Save Persistence
**Expected Behavior:** Saved posts persist

1. Click three-dot menu (⋯) on a post
2. Click "Save post"
3. Refresh page
4. Open three-dot menu again
5. **Expected:** Shows "Remove from saved" (was saved)

### Test 4: Pull-to-Refresh
**Expected Behavior:** Feed refreshes with current state

1. Like, repost, or save some posts
2. Scroll to top of feed
3. Pull down to trigger refresh
4. **Expected:**
   - Spinner appears
   - Feed reloads
   - All your previous interactions (likes, reposts) are still visible
   - New posts appear if any exist

### Test 5: Login/Logout Persistence
**Expected Behavior:** State persists across sessions

1. Like, repost several posts
2. Log out
3. Log back in
4. **Expected:** All likes and reposts are still there

### Test 6: Profile Repost Tab
**Expected Behavior:** Reposts appear in profile tab

1. Repost a post from the feed
2. Navigate to Profile tab
3. Click "Reposts" tab (for sellers)
4. **Expected:** The reposted post appears in the grid
5. Go back to feed, unrepost the same post
6. Go back to Profile → Reposts tab
7. **Expected:** Post disappears from reposts tab

## Common Issues & Solutions

### Issue: "Could not repost. Please try again."
**Cause:** Migration 008 not applied
**Solution:** 
1. Run `008_add_update_policy_for_reposts.sql` in Supabase SQL Editor
2. Restart PostgREST in Settings → API
3. Wait 30 seconds
4. Try again

### Issue: Repost icon appears but counter stays at 0
**Cause:** Migration 006 not applied
**Solution:**
1. Run `006_add_repost_support_to_feeds.sql`
2. Restart PostgREST
3. Refresh the app

### Issue: State doesn't persist after refresh
**Cause:** Feed not passing userId or migration 006 not applied
**Check:**
1. Verify migration 006 is applied
2. Check browser console for errors
3. Verify you're logged in (profile exists)

### Issue: Pull-to-refresh doesn't trigger
**Cause:** Not pulling from top of feed
**Solution:**
1. Scroll to top of feed first
2. Pull down from the very top
3. Should see refresh spinner

## Performance Expectations

- **Like/Repost click:** Instant visual feedback (< 50ms)
- **API call:** Completes in background (200-500ms)
- **Pull-to-refresh:** Loads in 1-2 seconds
- **Page refresh:** All state loads correctly in < 1 second

## Success Criteria

✅ All tests pass
✅ No console errors
✅ State persists across refreshes
✅ Pull-to-refresh works smoothly
✅ Repost counter matches database
✅ Profile repost tab syncs correctly

---

## Quick Test Command

For rapid testing, use this sequence:
1. Like a post → Refresh → Still red? ✓
2. Repost a post → Refresh → Still green? ✓
3. Pull to refresh → States persist? ✓
4. Log out → Log in → States still there? ✓

If all 4 pass, the feature is working correctly! 🎉
