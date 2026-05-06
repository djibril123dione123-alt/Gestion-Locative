insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agency-archives',
  'agency-archives',
  false,
  52428800,
  array['text/csv', 'application/json', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
