-- =============================================================================
-- Correctifs trouvés pendant l'audit Offre Fondateurs / SenePay :
--
-- 1. check_plan_limits ne gérait pas max_* = -1 (convention "illimité",
--    utilisée par le plan enterprise et déjà affichée comme "∞" côté
--    frontend) : `count < -1` est toujours faux, donc une agence enterprise
--    aurait été bloquée pour ajouter le moindre utilisateur/immeuble/unité.
--    Latent (aucune agence enterprise en base actuellement), corrigé avant
--    que ça n'arrive.
-- 2. subscription_plans conservait une ligne 'basic' orpheline (créée par la
--    migration phase2_selfserve, jamais utilisée depuis que 'starter' l'a
--    remplacée) — aucune agence/abonnement/transaction n'y fait référence
--    (vérifié). Supprimée pour ne plus induire en erreur.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_plan_limits(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  plan_record record;
  current_usage jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_agency_id is null
     or not (
       public.is_super_admin()
       or p_agency_id = public.current_user_agency_id()
     ) then
    raise exception 'TENANT_SCOPE_MISMATCH' using errcode = '42501';
  end if;

  select sp.*
    into plan_record
    from public.subscriptions s
    join public.subscription_plans sp on s.plan_id = sp.id
   where s.agency_id = p_agency_id
   order by
     case when s.status = 'active' then 0 when s.status = 'trial' then 1 else 2 end,
     s.created_at desc
   limit 1;

  if plan_record is null then
    select *
      into plan_record
      from public.subscription_plans
     where id = 'pro'
     limit 1;
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.user_profiles where agency_id = p_agency_id),
    'immeubles', (select count(*) from public.immeubles where agency_id = p_agency_id),
    'unites', (select count(*) from public.unites where agency_id = p_agency_id)
  ) into current_usage;

  if plan_record is null then
    return jsonb_build_object(
      'limits', jsonb_build_object(
        'max_users', 10,
        'max_immeubles', 50,
        'max_unites', 200
      ),
      'usage', current_usage,
      'can_add_user', true,
      'can_add_immeuble', true,
      'can_add_unite', true
    );
  end if;

  return jsonb_build_object(
    'limits', jsonb_build_object(
      'max_users', plan_record.max_users,
      'max_immeubles', plan_record.max_immeubles,
      'max_unites', plan_record.max_unites
    ),
    'usage', current_usage,
    'can_add_user', plan_record.max_users = -1 or (current_usage->>'users')::integer < plan_record.max_users,
    'can_add_immeuble', plan_record.max_immeubles = -1 or (current_usage->>'immeubles')::integer < plan_record.max_immeubles,
    'can_add_unite', plan_record.max_unites = -1 or (current_usage->>'unites')::integer < plan_record.max_unites
  );
end;
$function$;

DELETE FROM public.subscription_plans
WHERE id = 'basic'
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE plan_id = 'basic')
  AND NOT EXISTS (SELECT 1 FROM public.payment_transactions WHERE plan_id = 'basic')
  AND NOT EXISTS (SELECT 1 FROM public.agencies WHERE plan = 'basic');
