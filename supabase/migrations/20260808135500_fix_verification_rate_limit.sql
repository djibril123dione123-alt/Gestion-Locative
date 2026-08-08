-- Persistent, privacy-preserving throttling for the public document verification endpoint.
-- Raw IP addresses are never stored: the Edge Function sends a salted SHA-256 fingerprint.

create schema if not exists private;

create table if not exists private.document_verification_rate_limits (
  fingerprint text primary key
    check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
    check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table private.document_verification_rate_limits enable row level security;
alter table private.document_verification_rate_limits force row level security;

revoke all on table private.document_verification_rate_limits from public;
revoke all on table private.document_verification_rate_limits from anon;
revoke all on table private.document_verification_rate_limits from authenticated;

create index if not exists idx_document_verification_rate_limits_updated_at
  on private.document_verification_rate_limits (updated_at);

create or replace function public.consume_document_verification_rate_limit(
  p_fingerprint text,
  p_limit integer default 60,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  current_window timestamptz;
  v_current_time timestamptz := clock_timestamp();
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid verification fingerprint';
  end if;

  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid verification rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid verification rate window';
  end if;

  insert into private.document_verification_rate_limits (
    fingerprint,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_fingerprint,
    v_current_time,
    1,
    v_current_time
  )
  on conflict (fingerprint) do update
  set
    window_started_at = case
      when private.document_verification_rate_limits.window_started_at
        <= v_current_time - make_interval(secs => p_window_seconds)
      then v_current_time
      else private.document_verification_rate_limits.window_started_at
    end,
    request_count = case
      when private.document_verification_rate_limits.window_started_at
        <= v_current_time - make_interval(secs => p_window_seconds)
      then 1
      else private.document_verification_rate_limits.request_count + 1
    end,
    updated_at = v_current_time
  returning request_count, window_started_at
  into current_count, current_window;

  -- Amortized cleanup keeps the private table bounded without a public cron endpoint.
  if substring(p_fingerprint from 1 for 2) = '00' then
    delete from private.document_verification_rate_limits
    where updated_at < v_current_time - interval '24 hours';
  end if;

  allowed := current_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (
        current_window + make_interval(secs => p_window_seconds) - v_current_time
      )))::integer
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_document_verification_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_document_verification_rate_limit(text, integer, integer) from anon;
revoke all on function public.consume_document_verification_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.consume_document_verification_rate_limit(text, integer, integer) to service_role;

comment on function public.consume_document_verification_rate_limit(text, integer, integer)
  is 'Atomically throttles public document verification requests using a salted, non-reversible request fingerprint.';

