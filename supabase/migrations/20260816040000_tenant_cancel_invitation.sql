-- L'action "Annuler" sur une invitation en attente ne fonctionnait jamais :
-- la table invitations n'a aucune policy RLS de suppression, et le frontend
-- tentait un delete() client direct qui échouait silencieusement à chaque fois.
-- Cette RPC mirror tenant_create_invitation (assert_agency_admin, idempotency,
-- event_log) et supprime l'invitation côté serveur, en SECURITY DEFINER,
-- strictement scopée à l'agence de l'admin appelant et aux invitations
-- encore en attente.

create or replace function public.tenant_cancel_invitation(
  p_invitation_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_agency_admin();
  v_payload jsonb;
  v_replay jsonb;
  v_invitation public.invitations%rowtype;
begin
  v_payload := jsonb_build_object('invitation_id', p_invitation_id);
  v_replay := samay_tenant.command_replay(
    'tenant_cancel_invitation', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  select *
    into v_invitation
    from public.invitations
   where id = p_invitation_id
     and agency_id = v_agency_id
   for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING' using errcode = '22023';
  end if;

  delete from public.invitations where id = p_invitation_id;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'team.invitation_cancelled', 'invitations', v_invitation.id,
    jsonb_build_object('email', v_invitation.email, 'role', v_invitation.role),
    v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('id', v_invitation.id, 'cancelled', true)
  );
end;
$function$;

grant execute on function public.tenant_cancel_invitation(uuid, text) to authenticated;
