do $$
declare
  t text;
  p record;
begin
  foreach t in array array['bailleurs','immeubles','unites','locataires','contrats','paiements']
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy bailleurs_tenant_select
on public.bailleurs
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy bailleurs_tenant_insert
on public.bailleurs
for insert
to authenticated
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy bailleurs_tenant_update
on public.bailleurs
for update
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy bailleurs_tenant_delete
on public.bailleurs
for delete
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_admin());

create policy immeubles_tenant_select
on public.immeubles
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy immeubles_tenant_insert
on public.immeubles
for insert
to authenticated
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy immeubles_tenant_update
on public.immeubles
for update
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy immeubles_tenant_delete
on public.immeubles
for delete
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_admin());

create policy unites_tenant_select
on public.unites
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy unites_tenant_insert
on public.unites
for insert
to authenticated
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy unites_tenant_update
on public.unites
for update
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy unites_tenant_delete
on public.unites
for delete
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_admin());

create policy locataires_tenant_select
on public.locataires
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy locataires_tenant_insert
on public.locataires
for insert
to authenticated
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy locataires_tenant_update
on public.locataires
for update
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy locataires_tenant_delete
on public.locataires
for delete
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_admin());

create policy contrats_tenant_select
on public.contrats
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy contrats_tenant_insert
on public.contrats
for insert
to authenticated
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy contrats_tenant_update
on public.contrats
for update
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

create policy contrats_tenant_delete
on public.contrats
for delete
to authenticated
using (agency_id = public.current_user_agency_id() and public.is_admin());

create policy paiements_tenant_select
on public.paiements
for select
to authenticated
using (agency_id = public.current_user_agency_id() or public.is_super_admin());

create policy paiements_no_client_insert
on public.paiements
for insert
to authenticated
with check (false);

create policy paiements_no_client_update
on public.paiements
for update
to authenticated
using (false)
with check (false);

create policy paiements_no_client_delete
on public.paiements
for delete
to authenticated
using (false);
