-- Keep deterministic demo users compatible with the current GoTrue email-change parser.
update auth.users
set
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, '')
where id between 'd3e10000-0000-4000-8000-000000000001'::uuid
             and 'd3e10000-0000-4000-8000-000000000008'::uuid;
