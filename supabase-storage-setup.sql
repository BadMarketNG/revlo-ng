-- Run this in the Supabase SQL Editor to create the public 'media' storage
-- bucket and allow public reads. Uploads go through the server (service_role),
-- so we only need a public READ policy here.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Allow anyone to read objects in the media bucket (files are public URLs).
create policy "Public read media"
on storage.objects for select
to public
using (bucket_id = 'media');
