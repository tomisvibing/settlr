-- Receipts: a photo or PDF attached to an expense.
--
-- Files live in a private Storage bucket at "<group id>/<file id>.<ext>", so
-- the first folder of the path says which group a receipt belongs to and the
-- same membership check that guards expenses guards the files. The app shrinks
-- photos before upload; the 10 MB cap is for PDFs and undecodable images.

alter table public.expenses add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The group id at the start of an object path, or null when the path doesn't
-- start with one (so a malformed path is refused instead of raising an error).
create or replace function private.receipt_group_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.receipt_group_id(text) from public, anon;
grant execute on function private.receipt_group_id(text) to authenticated;

create policy "members read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.is_member(private.receipt_group_id(name)));
create policy "members add receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member(private.receipt_group_id(name)));
create policy "members delete receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and private.is_member(private.receipt_group_id(name)));
