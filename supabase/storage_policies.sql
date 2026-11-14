-- ============================================================================
-- CampusConnect: 04 - Storage Bucket & Access Policies
-- Execute FOURTH, after rls_policies.sql.
-- ============================================================================

-- Create the public item-images bucket (5 MB file limit, JPEG/PNG/WebP only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for listing images inside item-images
DROP POLICY IF EXISTS "item_images_public_read" ON storage.objects;
CREATE POLICY "item_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'item-images');

-- Authenticated users can upload images strictly into their own <auth.uid()>/ folder
DROP POLICY IF EXISTS "item_images_authenticated_insert_own" ON storage.objects;
CREATE POLICY "item_images_authenticated_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update only their own uploaded images
DROP POLICY IF EXISTS "item_images_authenticated_update_own" ON storage.objects;
CREATE POLICY "item_images_authenticated_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete only their own uploaded images
DROP POLICY IF EXISTS "item_images_authenticated_delete_own" ON storage.objects;
CREATE POLICY "item_images_authenticated_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
