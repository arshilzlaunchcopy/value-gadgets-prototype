-- 20260912000900_product_images_pipeline.sql
-- Image pipeline columns (BUILD_PROMPT_PART2 §16.1) + Supabase Storage bucket used
-- as the fallback when Cloudflare R2 credentials are blank.

alter table public.product_images
  add column if not exists blur_data_url text,
  add column if not exists manifest jsonb,
  add column if not exists content_hash text,
  add column if not exists format text,
  add column if not exists bytes int;

create index if not exists product_images_hash_idx on public.product_images (content_hash);

comment on column public.product_images.manifest is
  'Variant manifest: {hash, width, height, formats:{avif:[{w,url}], webp:[{w,url}], jpeg:{w,url}}}';

-- Public bucket for processed product images (R2 fallback).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 10485760,
  array['image/avif', 'image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read; only the service role writes (it bypasses RLS, so no write policy).
drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');
