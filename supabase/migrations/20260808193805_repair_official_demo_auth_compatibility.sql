
update auth.users
set email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    updated_at = now()
where id in (
  'd3e10000-0000-4000-8000-000000000001'::uuid,
  'd3e10000-0000-4000-8000-000000000002'::uuid,
  'd3e10000-0000-4000-8000-000000000003'::uuid,
  'd3e10000-0000-4000-8000-000000000004'::uuid,
  'd3e10000-0000-4000-8000-000000000005'::uuid,
  'd3e10000-0000-4000-8000-000000000006'::uuid,
  'd3e10000-0000-4000-8000-000000000007'::uuid,
  'd3e10000-0000-4000-8000-000000000008'::uuid
);
;
