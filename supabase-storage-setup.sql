insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diary-media',
  'diary-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own diary media" on storage.objects;
create policy "Users can read own diary media"
  on storage.objects
  for select
  using (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload own diary media" on storage.objects;
create policy "Users can upload own diary media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own diary media" on storage.objects;
create policy "Users can update own diary media"
  on storage.objects
  for update
  using (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own diary media" on storage.objects;
create policy "Users can delete own diary media"
  on storage.objects
  for delete
  using (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
