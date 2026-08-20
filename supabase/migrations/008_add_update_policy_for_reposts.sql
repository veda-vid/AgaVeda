-- Fix: Add UPDATE policy for reposts table to support UPSERT operations

-- Drop and recreate all policies with UPDATE policy included
DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.reposts;
DROP POLICY IF EXISTS "Users can insert their own reposts" ON public.reposts;
DROP POLICY IF EXISTS "Users can delete their own reposts" ON public.reposts;
DROP POLICY IF EXISTS "Users can update their own reposts" ON public.reposts;

-- SELECT policy
CREATE POLICY "Reposts are viewable by everyone"
  ON public.reposts FOR SELECT
  TO authenticated
  USING (true);

-- INSERT policy  
CREATE POLICY "Users can insert their own reposts"
  ON public.reposts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy (REQUIRED for UPSERT to work!)
CREATE POLICY "Users can update their own reposts"
  ON public.reposts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
CREATE POLICY "Users can delete their own reposts"
  ON public.reposts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
