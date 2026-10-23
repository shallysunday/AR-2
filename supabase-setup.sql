-- Run this once in Supabase: SQL Editor → New query → paste → Run.

-- 1) Table for artwork metadata
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  student text not null,
  lecturer text not null,
  class_name text not null,
  class_code text not null,
  period text not null,
  model_url text not null,
  thumbnail_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.artworks enable row level security;

-- Anyone can view and add artworks. Nobody can edit or delete from the website
-- (do that from the Supabase dashboard instead).
create policy "public read artworks"   on public.artworks for select using (true);
create policy "public insert artworks" on public.artworks for insert with check (true);

-- 2) Public storage bucket for .glb files and thumbnails (50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('artworks', 'artworks', true, 52428800)
on conflict (id) do nothing;

create policy "public read files"   on storage.objects for select using (bucket_id = 'artworks');
create policy "public upload files" on storage.objects for insert with check (bucket_id = 'artworks');
