alter table public.agency_settings
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.agency_settings.onboarding_completed_at is
  'Timestamp marking completion of the post-approval setup wizard for the agency or owner space.';
