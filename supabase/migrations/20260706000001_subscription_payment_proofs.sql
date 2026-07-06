-- Additive registry for manual subscription payment proofs.
-- RLS is enabled because this table lives in the exposed public schema.

create table if not exists public.subscription_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  plan_key text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'XOF',
  method text not null,
  reference text null,
  payment_date date null,
  proof_file_url text null,
  proof_storage_path text null,
  comment text null,
  status text not null default 'pending',
  submitted_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payment_proofs_plan_key_check
    check (plan_key in ('starter', 'pro', 'business', 'enterprise')),
  constraint subscription_payment_proofs_method_check
    check (method in ('orange_money', 'wave', 'djamo', 'card', 'bank_transfer', 'cash', 'manual_support', 'other')),
  constraint subscription_payment_proofs_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists idx_subscription_payment_proofs_agency_created
  on public.subscription_payment_proofs (agency_id, created_at desc);

create index if not exists idx_subscription_payment_proofs_status
  on public.subscription_payment_proofs (status);

drop trigger if exists update_subscription_payment_proofs_updated_at on public.subscription_payment_proofs;
create trigger update_subscription_payment_proofs_updated_at
  before update on public.subscription_payment_proofs
  for each row
  execute function public.update_updated_at_column();

alter table public.subscription_payment_proofs enable row level security;

revoke all on table public.subscription_payment_proofs from anon;
grant select, insert, update on table public.subscription_payment_proofs to authenticated;
grant select, insert, update, delete on table public.subscription_payment_proofs to service_role;

drop policy if exists "Agency users can view subscription proofs" on public.subscription_payment_proofs;
create policy "Agency users can view subscription proofs"
  on public.subscription_payment_proofs
  for select
  to authenticated
  using (
    agency_id in (
      select user_profiles.agency_id
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and coalesce(user_profiles.actif, true) = true
    )
  );

drop policy if exists "Agency admins can submit subscription proofs" on public.subscription_payment_proofs;
create policy "Agency admins can submit subscription proofs"
  on public.subscription_payment_proofs
  for insert
  to authenticated
  with check (
    agency_id in (
      select user_profiles.agency_id
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role in ('admin', 'super_admin')
        and coalesce(user_profiles.actif, true) = true
    )
    and submitted_by = (select auth.uid())
  );

drop policy if exists "Super admins can review subscription proofs" on public.subscription_payment_proofs;
create policy "Super admins can review subscription proofs"
  on public.subscription_payment_proofs
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
