-- 작업표준서 영상용 비공개 Storage 버킷과 접근 정책
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-media',
  'sop-media',
  false,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated can read sop media" on storage.objects;
create policy "authenticated can read sop media"
on storage.objects
for select
to authenticated
using (bucket_id = 'sop-media');

drop policy if exists "users can upload own sop media" on storage.objects;
create policy "users can upload own sop media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sop-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can delete own sop media" on storage.objects;
create policy "users can delete own sop media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sop-media'
  and owner_id = (select auth.uid())::text
);
