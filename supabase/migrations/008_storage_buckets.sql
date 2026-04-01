-- 008_storage_buckets.sql
-- Create public storage buckets for user and merchant media assets.
-- All three buckets are public so images can be served via CDN without auth.
-- RLS policies on storage.objects enforce who may upload/delete.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
  VALUES ('user-avatars',      'user-avatars',      true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('merchant-avatars',  'merchant-avatars',  true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('portfolio-images',  'portfolio-images',  true) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- user-avatars policies
-- Path convention: user-avatars/<user_uid>/<filename>
-- Only the owning user may upload or delete; any authenticated user may read.
-- ---------------------------------------------------------------------------
CREATE POLICY "user_avatars_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user_avatars_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-avatars');

CREATE POLICY "user_avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public (unauthenticated) read — required for CDN / <Image> without tokens
CREATE POLICY "user_avatars_public_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'user-avatars');

-- ---------------------------------------------------------------------------
-- merchant-avatars policies
-- Path convention: merchant-avatars/<user_uid>/<filename>
-- ---------------------------------------------------------------------------
CREATE POLICY "merchant_avatars_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchant-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "merchant_avatars_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-avatars');

CREATE POLICY "merchant_avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'merchant-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "merchant_avatars_public_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'merchant-avatars');

-- ---------------------------------------------------------------------------
-- portfolio-images policies
-- Path convention: portfolio-images/<user_uid>/<filename>
-- ---------------------------------------------------------------------------
CREATE POLICY "portfolio_images_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "portfolio_images_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio-images');

CREATE POLICY "portfolio_images_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "portfolio_images_public_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'portfolio-images');
