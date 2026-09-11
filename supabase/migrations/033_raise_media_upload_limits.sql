-- 033_raise_media_upload_limits.sql
-- Keep Moments / Story buckets at 100MB; client also auto-compresses under ~42MB.

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id IN ('sparks_media', 'cityconnect');

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp'
]::text[]
WHERE id = 'sparks_media';
