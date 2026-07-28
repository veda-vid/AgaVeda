-- =============================================================
-- CityConnect — Storage Policies
-- Run in: Supabase Dashboard → SQL Editor AFTER creating
-- a Storage bucket named "cityconnect" (set to Public)
-- =============================================================

-- Allow any authenticated user to read public files
CREATE POLICY "storage_public_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'cityconnect');

-- Users can only upload to their own folder (userId/*)
CREATE POLICY "storage_upload_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cityconnect'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only update their own files
CREATE POLICY "storage_update_own_files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cityconnect'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete their own files
-- Super admin can delete any file (handled via service role in edge functions)
CREATE POLICY "storage_delete_own_files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cityconnect'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
