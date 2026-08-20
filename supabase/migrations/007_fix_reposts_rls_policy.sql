-- Fix RLS policy for reposts table to work properly with auth context

-- Drop all existing policies first
DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.reposts;
DROP POLICY IF EXISTS "Users can insert their own reposts" ON public.reposts;
DROP POLICY IF EXISTS "Users can delete their own reposts" ON public.reposts;

-- Recreate view policy for all authenticated users
CREATE POLICY "Reposts are viewable by everyone"
  ON public.reposts FOR SELECT
  TO authenticated
  USING (true);

-- Recreate insert policy - allow authenticated users to insert only their own reposts
-- CRITICAL: Must use WITH CHECK for INSERT operations
CREATE POLICY "Users can insert their own reposts"
  ON public.reposts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recreate delete policy - allow users to delete only their own reposts
CREATE POLICY "Users can delete their own reposts"
  ON public.reposts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created (this will show in SQL Editor output)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'reposts'
ORDER BY policyname;
