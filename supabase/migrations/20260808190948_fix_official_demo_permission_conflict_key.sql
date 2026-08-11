-- Official, isolated and reproducible demonstration tenant for Samay Keur.
-- The function is intentionally service-role only. Financial and contract rows
-- are created through the canonical commands so ledger/read-model side effects
-- remain identical to normal application usage.

create or replace function public.verify_official_demo_agency()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_agency_id constant uuid := 'd3e00000-0000-4000-8000-000000000001'::uuid;
  v_result jsonb;
  v_orphans integer;
begin
  if not exists (
    select 1 from public.agencies
    where id = v_agency_id
      and 'official-demo' = any(tags)
  ) then
    raise exception 'Official demonstration agency is not seeded';
  end if;

  select
    (select count(*) from public.contrats c left join public.locataires l on l.id = c.locataire_id where c.agency_id = v_agency_id and l.id is null)
    + (select count(*) from public.contrats c left join public.unites u on u.id = c.unite_id where c.agency_id = v_agency_id and u.id is null)
    + (select count(*) from public.paiements p left join public.contrats c on c.id = p.contrat_id where p.agency_id = v_agency_id and c.id is null)
    + (select count(*) from public.unites u left join public.immeubles i on i.id = u.immeuble_id where u.agency_id = v_agency_id and i.id is null)
  into v_orphans;

  with active_contract_months as (
    select
      c.id,
      c.loyer_mensuel,
      month_start::date as month_start
    from public.contrats c
    cross join lateral generate_series(
      date_trunc('month', c.date_debut)::date,
      date_trunc('month', current_date)::date,
      interval '1 month'
    ) month_start
    where c.agency_id = v_agency_id
      and c.statut = 'actif'
  ), paid_by_month as (
    select contrat_id, mois_concerne, sum(montant_total) as paid
    from public.paiements
    where agency_id = v_agency_id and actif = true
    group by contrat_id, mois_concerne
  )
  select jsonb_build_object(
    'agency_id', v_agency_id,
    'agency_name', (select name from public.agencies where id = v_agency_id),
    'owners', (select count(*) from public.bailleurs where agency_id = v_agency_id and is_demo_data),
    'properties', (select count(*) from public.immeubles where agency_id = v_agency_id and is_demo_data),
    'units', (select count(*) from public.unites where agency_id = v_agency_id and is_demo_data),
    'occupied_units', (select count(*) from public.unites where agency_id = v_agency_id and statut = 'loue'),
    'occupancy_rate', (select round(100.0 * count(*) filter (where statut = 'loue') / nullif(count(*), 0), 1) from public.unites where agency_id = v_agency_id),
    'tenants', (select count(*) from public.locataires where agency_id = v_agency_id and is_demo_data),
    'active_tenants', (select count(*) from public.locataires where agency_id = v_agency_id and actif),
    'active_leases', (select count(*) from public.contrats where agency_id = v_agency_id and statut = 'actif'),
    'closed_leases', (select count(*) from public.contrats where agency_id = v_agency_id and statut in ('resilie', 'expire', 'archive')),
    'payments', (select count(*) from public.paiements where agency_id = v_agency_id and actif),
    'collected_xof', (select coalesce(sum(montant_total), 0) from public.paiements where agency_id = v_agency_id and actif),
    'arrears_xof', (
      select coalesce(sum(greatest(acm.loyer_mensuel - coalesce(pbm.paid, 0), 0)), 0)
      from active_contract_months acm
      left join paid_by_month pbm on pbm.contrat_id = acm.id and pbm.mois_concerne = acm.month_start
    ),
    'partial_months', (
      select count(*)
      from active_contract_months acm
      join paid_by_month pbm on pbm.contrat_id = acm.id and pbm.mois_concerne = acm.month_start
      where pbm.paid > 0 and pbm.paid < acm.loyer_mensuel
    ),
    'unpaid_months', (
      select count(*)
      from active_contract_months acm
      left join paid_by_month pbm on pbm.contrat_id = acm.id and pbm.mois_concerne = acm.month_start
      where coalesce(pbm.paid, 0) = 0
    ),
    'expenses', (select count(*) from public.depenses where agency_id = v_agency_id and actif),
    'expenses_xof', (select coalesce(sum(montant), 0) from public.depenses where agency_id = v_agency_id and actif),
    'commission_xof', (select coalesce(sum(part_agence), 0) from public.paiements where agency_id = v_agency_id and actif),
    'owner_net_xof', (select coalesce(sum(part_bailleur), 0) from public.paiements where agency_id = v_agency_id and actif),
    'documents', (select count(*) from public.documents where agency_id = v_agency_id and lifecycle_status = 'active'),
    'registry_documents', (select count(*) from public.document_registry where agency_id = v_agency_id and status = 'active'),
    'qr_verifications', (select count(*) from public.document_verifications where agency_id = v_agency_id and document_status = 'authentic'),
    'collaborators', (select count(*) from public.user_profiles where agency_id = v_agency_id and actif),
    'calendar_events', (select count(*) from public.evenements where agency_id = v_agency_id),
    'interventions', (select count(*) from public.interventions where agency_id = v_agency_id),
    'inventories', (select count(*) from public.inventaires where agency_id = v_agency_id),
    'notifications', (select count(*) from public.notifications where agency_id = v_agency_id),
    'audit_events', (select count(*) from public.audit_logs where agency_id = v_agency_id),
    'orphans', v_orphans,
    'verified_at', now()
  ) into v_result;

  if (v_result->>'owners')::integer <> 25
     or (v_result->>'properties')::integer <> 18
     or (v_result->>'units')::integer <> 78
     or (v_result->>'active_leases')::integer <> 68
     or (v_result->>'closed_leases')::integer <> 4
     or (v_result->>'collaborators')::integer <> 8
     or v_orphans <> 0 then
    raise exception 'Official demo verification failed: %', v_result;
  end if;

  return v_result;
end;
$function$;

create or replace function public.seed_official_demo_agency(p_mode text default 'seed')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_agency_id constant uuid := 'd3e00000-0000-4000-8000-000000000001'::uuid;
  v_admin_id constant uuid := 'd3e10000-0000-4000-8000-000000000001'::uuid;
  v_password constant text := 'TerangaDemo!2026';
  v_user_ids uuid[] := array[
    'd3e10000-0000-4000-8000-000000000001'::uuid,
    'd3e10000-0000-4000-8000-000000000002'::uuid,
    'd3e10000-0000-4000-8000-000000000003'::uuid,
    'd3e10000-0000-4000-8000-000000000004'::uuid,
    'd3e10000-0000-4000-8000-000000000005'::uuid,
    'd3e10000-0000-4000-8000-000000000006'::uuid,
    'd3e10000-0000-4000-8000-000000000007'::uuid,
    'd3e10000-0000-4000-8000-000000000008'::uuid
  ];
  v_user_emails text[] := array[
    'admin@demo.samaykeur.test', 'operations@demo.samaykeur.test',
    'comptabilite@demo.samaykeur.test', 'terrain@demo.samaykeur.test',
    'documents@demo.samaykeur.test', 'assistante@demo.samaykeur.test',
    'gestion@demo.samaykeur.test', 'direction@demo.samaykeur.test'
  ];
  v_user_first_names text[] := array['Aminata','Mamadou','Fatou','Ibrahima','Awa','Marieme','Cheikh','Sokhna'];
  v_user_last_names text[] := array['Ndiaye','Diop','Sow','Fall','Gueye','Ba','Faye','Sarr'];
  v_user_roles text[] := array['admin','agent','comptable','agent','agent','comptable','agent','admin'];
  v_owner_first text[] := array['Abdoulaye','Aissatou','Moussa','Fatou','Ibrahima','Aminata','Cheikh','Sokhna','Mamadou','Ndeye','Ousmane','Rokhaya','Babacar','Khady','Malick','Adama','Alioune','Mame','Modou','Astou','Pape','Dieynaba','Serigne','Coumba','Lamine'];
  v_owner_last text[] := array['Ndiaye','Diop','Fall','Ba','Sow','Gueye','Faye','Sarr','Diallo','Mbaye','Kane','Cisse','Seck','Sy','Thiam','Camara','Diagne','Ndour','Niang','Diouf','Dione','Tall','Samb','Lo','Ndao'];
  v_property_names text[] := array[
    'Residence des Almadies','Immeuble KÃ«r Yoff','Villa Mermoz Horizon','Residence Fann Baobab',
    'Immeuble Mixte Point E','Keur Mamelles','Residence LibertÃ© Six','Centre Ouest Foire',
    'Immeuble Hann Maristes','Villa Ngor Ocean','Residence Ouakam Renaissance','Keur Plateau',
    'Immeuble Sacre-Coeur','Residence Parcelles Unite 15','Domaine Keur Massar','Centre Diamniadio',
    'Residence Rufisque Est','Immeuble Guediawaye Soleil'
  ];
  v_quarters text[] := array['Almadies','Yoff','Mermoz','Fann','Point E','Mamelles','Liberte 6','Ouest Foire','Hann Maristes','Ngor','Ouakam','Plateau','Sacre-Coeur','Parcelles Assainies','Keur Massar','Diamniadio','Rufisque','Guediawaye'];
  v_first_names text[] := array['Amadou','Awa','Moussa','Fatou','Ibrahima','Aminata','Cheikh','Sokhna','Mamadou','Ndeye','Ousmane','Rokhaya','Babacar','Khady','Malick','Adama','Alioune','Marieme','Modou','Astou','Pape','Dieynaba','Serigne','Coumba','Lamine','Mame','Abdou','Bineta','Moustapha','Yacine'];
  v_last_names text[] := array['Ndiaye','Diop','Fall','Ba','Sow','Gueye','Faye','Sarr','Diallo','Mbaye','Kane','Cisse','Seck','Sy','Thiam','Camara','Diagne','Ndour','Niang','Diouf','Dione','Tall','Samb','Lo','Ndao','Ka','Diatta','Gomis'];
  v_pages text[] := array['dashboard','bailleurs','patrimoine','locations','paiements','loyers-impayes','depenses','documents','rapports','calendrier','maintenance','inventaires','parametres','equipe','abonnement'];
  v_roles text[] := array['admin','agent','comptable','agent','agent','comptable','agent','admin'];
  v_contract public.contrats%rowtype;
  v_owner_id uuid;
  v_property_id uuid;
  v_unit_id uuid;
  v_tenant_id uuid;
  v_contract_id uuid;
  v_month date;
  v_start date;
  v_end date;
  v_rent numeric;
  v_amount numeric;
  v_phone text;
  v_units integer;
  v_unit_index integer := 0;
  v_status text;
  v_mode text;
  v_access text;
  i integer;
  j integer;
  k integer;
begin
  if p_mode not in ('seed','reset','verify') then
    raise exception 'Unsupported demo seed mode: %', p_mode;
  end if;

  if p_mode = 'verify' then
    return public.verify_official_demo_agency();
  end if;

  insert into public.agencies (
    id, name, ninea, address, phone, email, website, plan, status,
    is_bailleur_account, tags, pilot_status, first_payment_at,
    first_contract_at, activation_at, payment_provider, payment_phone,
    last_payment_at, next_renewal_at, welcome_email_sent, demo_data_loaded,
    organization_type, created_at, updated_at
  ) values (
    v_agency_id, 'Teranga Gestion Immobiliere', '0098247 2T4',
    '18 avenue des Flamboyants, Mermoz, Dakar', '+221 33 860 42 18',
    'contact@teranga-gestion.example', 'https://teranga-gestion.example',
    'business', 'active', false, array['official-demo','fictitious-data','marketing-reference'],
    'active', current_date - interval '10 months', current_date - interval '11 months',
    current_date - interval '12 months', 'manual', '+221 77 612 48 35',
    current_date - interval '3 days', current_date + interval '27 days', true, false,
    'agency', current_date - interval '13 months', now()
  ) on conflict (id) do update set
    name = excluded.name, ninea = excluded.ninea, address = excluded.address,
    phone = excluded.phone, email = excluded.email, website = excluded.website,
    plan = excluded.plan, status = excluded.status, tags = excluded.tags,
    pilot_status = excluded.pilot_status, next_renewal_at = excluded.next_renewal_at,
    demo_data_loaded = false, organization_type = excluded.organization_type,
    updated_at = now();

  for i in 1..array_length(v_user_ids, 1) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid, v_user_ids[i],
      'authenticated', 'authenticated', v_user_emails[i],
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(), '', '', '', '', '', '',
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('email',v_user_emails[i],'email_verified',true,'first_name',v_user_first_names[i],'last_name',v_user_last_names[i]),
      false, current_date - interval '12 months' + (i || ' days')::interval, now(), false, false
    ) on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = now(),
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now(),
      deleted_at = null,
      banned_until = null;

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at,
      created_at, updated_at
    ) values (
      (md5('teranga-demo:identity:' || i::text))::uuid,
      v_user_emails[i], v_user_ids[i],
      jsonb_build_object('sub',v_user_ids[i]::text,'email',v_user_emails[i],'email_verified',true,'phone_verified',false),
      'email', now() - (i || ' hours')::interval,
      current_date - interval '12 months' + (i || ' days')::interval, now()
    ) on conflict (provider_id, provider) do update set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

    insert into public.user_profiles (
      id, email, nom, prenom, telephone, role, actif, agency_id,
      accepted_terms_at, accepted_privacy_at, terms_version, privacy_version,
      created_at, updated_at
    ) values (
      v_user_ids[i], v_user_emails[i], v_user_last_names[i], v_user_first_names[i],
      format('+221 %s %s %s %s', (array['77','76','78','70'])[((i - 1) % 4) + 1],
        lpad((410 + i * 7)::text,3,'0'), lpad((20 + i * 3)::text,2,'0'), lpad((30 + i * 5)::text,2,'0')),
      v_user_roles[i]::public.user_role, true, v_agency_id,
      current_date - interval '12 months', current_date - interval '12 months',
      '2026-01', '2026-01', current_date - interval '12 months' + (i || ' days')::interval, now()
    ) on conflict (id) do update set
      email = excluded.email, nom = excluded.nom, prenom = excluded.prenom,
      telephone = excluded.telephone, role = excluded.role, actif = true,
      agency_id = v_agency_id, updated_at = now();
  end loop;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if exists (select 1 from public.bailleurs where agency_id = v_agency_id)
     or exists (select 1 from public.immeubles where agency_id = v_agency_id) then
    perform public.reset_demo_data(v_agency_id);
  end if;

  delete from public.notifications where agency_id = v_agency_id;
  delete from public.audit_logs where agency_id = v_agency_id;
  delete from public.document_verifications where agency_id = v_agency_id;
  delete from public.document_registry where agency_id = v_agency_id;
  delete from public.documents where agency_id = v_agency_id;
  delete from public.inventaires where agency_id = v_agency_id;
  delete from public.interventions where agency_id = v_agency_id;
  delete from public.evenements where agency_id = v_agency_id;
  delete from public.depenses where agency_id = v_agency_id;
  delete from public.bilans_mensuels where agency_id = v_agency_id;
  delete from public.user_page_permissions where agency_id = v_agency_id;
  delete from public.subscriptions where agency_id = v_agency_id;

  if p_mode = 'reset' then
    update public.agencies set demo_data_loaded = false, updated_at = now() where id = v_agency_id;
    return jsonb_build_object('mode','reset','agency_id',v_agency_id,'reset_at',now());
  end if;

  insert into public.agency_settings (
    agency_id, nom_agence, couleur_primaire, couleur_secondaire, ninea, rc,
    adresse, city, telephone, email, site_web, commission_globale,
    commission_personnalisee_par_bailleur, penalite_retard_montant,
    penalite_retard_delai_jours, devise, qr_code_quittances,
    pied_page_personnalise, document_mode, enabled_modules, proprietaire_info,
    onboarding_completed_at, document_preferences, mode_avance_actif,
    module_depenses_actif, module_inventaires_actif, module_interventions_actif,
    wave_actif, wave_numero, orange_money_actif, orange_money_numero,
    email_notifications_actif, sms_notifications_actif,
    representant_nom, representant_fonction, manager_id_type, manager_id_number,
    mention_tribunal, mention_penalites, mention_frais_huissier,
    frais_huissier, mention_litige, signature_enabled, stamp_enabled,
    logo_position, created_at, updated_at
  ) values (
    v_agency_id, 'Teranga Gestion Immobiliere', '#064e3b', '#d97706',
    '0098247 2T4', 'SN-DKR-2026-B-18427', '18 avenue des Flamboyants, Mermoz',
    'Dakar', '+221 33 860 42 18', 'contact@teranga-gestion.example',
    'https://teranga-gestion.example', 8, true, 2500, 5, 'XOF', true,
    'Teranga Gestion Immobiliere - Gestion locative professionnelle - Dakar, Senegal',
    'professional',
    jsonb_build_object('ged',true,'qr_verify',true,'scanner',true,'maintenance',true,'inventaires',true,'rapports',true,'depenses_agence',true,'planning',true),
    jsonb_build_object('nom','Teranga Gestion Immobiliere','type','Agence immobiliere','pays','Senegal'),
    current_date - interval '12 months',
    jsonb_build_object('receipt_reserve_notice',true,'show_arrears',true,'qr_level','standard','qr_position','bottom_right','demo_profile','official'),
    true, true, true, true, true, '+221 77 612 48 35', true, '+221 77 612 48 35',
    true, true, 'Aminata Ndiaye', 'Gerante', 'CNI', '1 01 19860618 04217 3',
    'Tribunal de Commerce Hors Classe de Dakar',
    'Des penalites peuvent etre appliquees apres le delai contractuel.',
    'Les frais de recouvrement justifies restent imputables selon le contrat.',
    37500, 'Tout litige releve des juridictions competentes de Dakar.', false, false,
    'left', current_date - interval '13 months', now()
  ) on conflict (agency_id) do update set
    nom_agence = excluded.nom_agence, couleur_primaire = excluded.couleur_primaire,
    couleur_secondaire = excluded.couleur_secondaire, ninea = excluded.ninea,
    rc = excluded.rc, adresse = excluded.adresse, city = excluded.city,
    telephone = excluded.telephone, email = excluded.email, site_web = excluded.site_web,
    commission_globale = excluded.commission_globale,
    commission_personnalisee_par_bailleur = excluded.commission_personnalisee_par_bailleur,
    penalite_retard_montant = excluded.penalite_retard_montant,
    penalite_retard_delai_jours = excluded.penalite_retard_delai_jours,
    devise = excluded.devise, qr_code_quittances = excluded.qr_code_quittances,
    pied_page_personnalise = excluded.pied_page_personnalise,
    document_mode = excluded.document_mode, enabled_modules = excluded.enabled_modules,
    proprietaire_info = excluded.proprietaire_info,
    onboarding_completed_at = excluded.onboarding_completed_at,
    document_preferences = excluded.document_preferences,
    mode_avance_actif = true, module_depenses_actif = true,
    module_inventaires_actif = true, module_interventions_actif = true,
    updated_at = now();

  insert into public.subscriptions (
    id, agency_id, plan_id, status, current_period_start, current_period_end,
    cancel_at_period_end, created_at, updated_at
  ) values (
    'd3e20000-0000-4000-8000-000000000001'::uuid, v_agency_id, 'business', 'active',
    date_trunc('month', current_date), date_trunc('month', current_date) + interval '1 month',
    false, current_date - interval '12 months', now()
  ) on conflict (agency_id) do update set
    plan_id = 'business', status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false, updated_at = now();

  for i in 1..array_length(v_user_ids, 1) loop
    for j in 1..array_length(v_pages, 1) loop
      v_access := case
        when v_roles[i] = 'admin' then 'admin'
        when v_roles[i] = 'comptable' and v_pages[j] in ('dashboard','paiements','loyers-impayes','depenses','documents','rapports') then 'write'
        when v_roles[i] = 'agent' and v_pages[j] in ('dashboard','bailleurs','patrimoine','locations','documents','calendrier','maintenance','inventaires') then 'write'
        when v_pages[j] = 'dashboard' then 'read'
        else 'none'
      end;
      insert into public.user_page_permissions (
        agency_id,user_id,page,access_level,can_create,can_update,can_delete,
        can_export,can_manage,created_by,created_at,updated_at
      ) values (
        v_agency_id,v_user_ids[i],v_pages[j],v_access,
        v_access in ('write','admin'),v_access in ('write','admin'),v_access = 'admin',
        v_access in ('read','write','admin') and v_pages[j] in ('paiements','documents','rapports'),
        v_access = 'admin',v_admin_id,current_date - interval '11 months',now()
      ) on conflict (user_id,page) do update set
        agency_id=excluded.agency_id,
        access_level=excluded.access_level,can_create=excluded.can_create,
        can_update=excluded.can_update,can_delete=excluded.can_delete,
        can_export=excluded.can_export,can_manage=excluded.can_manage,updated_at=now();
    end loop;
  end loop;

  for i in 1..25 loop
    v_owner_id := (md5('teranga-demo:owner:' || i::text))::uuid;
    v_phone := format('+221 %s %s %s %s', (array['77','76','78','70'])[((i - 1) % 4) + 1],
      lpad((300 + i * 13)::text,3,'0'), lpad(((17 + i * 7) % 100)::text,2,'0'), lpad(((29 + i * 11) % 100)::text,2,'0'));
    insert into public.bailleurs (
      id,nom,prenom,telephone,email,adresse,piece_identite,notes,actif,
      created_at,updated_at,created_by,commission,debut_contrat,agency_id,
      is_account_owner,account_user_id,is_demo_data
    ) values (
      v_owner_id,v_owner_last[i],v_owner_first[i],v_phone,
      lower(v_owner_first[i] || '.' || v_owner_last[i] || i::text || '@proprietaires.example'),
      format('%s, Dakar - adresse fictive de demonstration', v_quarters[((i - 1) % 18) + 1]),
      format('DEMO-PI-%s',lpad(i::text,4,'0')),
      case when i in (3,8,15) then 'Proprietaire multi-immeubles, reporting mensuel prioritaire.' when i in (5,19) then 'Mandat avec suivi renforce des travaux.' else 'Dossier proprietaire complet - donnees fictives.' end,
      true,current_date - interval '13 months' + (i || ' days')::interval,now(),v_admin_id,
      case when i % 7 = 0 then 10 when i % 5 = 0 then 7.5 else 8 end,
      current_date - interval '13 months' + (i || ' days')::interval,v_agency_id,false,null,true
    );
  end loop;

  for i in 1..18 loop
    v_property_id := (md5('teranga-demo:property:' || i::text))::uuid;
    v_owner_id := (md5('teranga-demo:owner:' || (((i * 7 - 1) % 25) + 1)::text))::uuid;
    v_units := case when i <= 12 then 5 else 3 end;
    insert into public.immeubles (
      id,nom,adresse,quartier,ville,bailleur_id,nombre_unites,description,actif,
      created_at,updated_at,created_by,agency_id,is_demo_data
    ) values (
      v_property_id,v_property_names[i],
      format('%s, voie %s - adresse fictive',v_quarters[i],100 + i * 7),
      v_quarters[i],case when i=16 then 'Diamniadio' when i=17 then 'Rufisque' when i=18 then 'Guediawaye' else 'Dakar' end,
      v_owner_id,v_units,
      case when i in (5,8,16) then 'Immeuble mixte avec logements et espaces professionnels.' when i in (3,10) then 'Villa de standing avec dependance et stationnement.' else 'Residence locative suivie mensuellement par Teranga Gestion.' end,
      true,current_date - interval '12 months' + (i || ' days')::interval,now(),v_admin_id,v_agency_id,true
    );

    for j in 1..v_units loop
      v_unit_index := v_unit_index + 1;
      v_unit_id := (md5('teranga-demo:unit:' || v_unit_index::text))::uuid;
      v_rent := case
        when i in (3,10) then 625000 + j * 47500
        when i in (5,8,16) and j = v_units then 310000 + i * 8500
        when j = 1 then 115000 + i * 6500
        when j = 2 then 175000 + i * 7200
        when j = 3 then 235000 + i * 8300
        when j = 4 then 295000 + i * 9100
        else 365000 + i * 10500
      end;
      insert into public.unites (
        id,immeuble_id,nom,numero,etage,loyer_base,statut,superficie,description,
        actif,created_at,updated_at,created_by,agency_id,is_demo_data
      ) values (
        v_unit_id,v_property_id,
        case when i in (5,8,16) and j=v_units then format('Boutique RDC-%s',lpad(j::text,2,'0')) when j=1 then 'Studio A1' else format('Appartement %s%s',chr(64+j),j) end,
        format('%s-%s',lpad(i::text,2,'0'),lpad(j::text,2,'0')),
        case when j=1 then 'RDC' else (j-1)::text end,v_rent,'libre',
        case when j=1 then 32 + i when i in (3,10) then 155 + j*12 else 58 + j*14 + i end,
        case when i in (5,8,16) and j=v_units then 'Local professionnel avec acces rue et compteur individuel.' else 'Unite entretenue, compteur individuel et dossier technique disponible.' end,
        true,current_date - interval '12 months' + (v_unit_index || ' days')::interval,now(),v_admin_id,v_agency_id,true
      );
    end loop;
  end loop;

  for i in 1..72 loop
    v_tenant_id := (md5('teranga-demo:tenant:' || i::text))::uuid;
    v_phone := format('+221 %s %s %s %s', (array['77','76','78','70'])[((i + 1) % 4) + 1],
      lpad((200 + ((i * 17) % 700))::text,3,'0'), lpad(((31 + i * 9) % 100)::text,2,'0'), lpad(((43 + i * 13) % 100)::text,2,'0'));
    insert into public.locataires (
      id,nom,prenom,telephone,email,adresse_personnelle,piece_identite,notes,actif,
      created_at,updated_at,created_by,agency_id,is_demo_data,type_piece,numero_piece
    ) values (
      v_tenant_id,
      v_last_names[((i * 5 - 1) % array_length(v_last_names,1)) + 1],
      v_first_names[((i * 7 - 1) % array_length(v_first_names,1)) + 1],
      v_phone,
      lower(v_first_names[((i * 7 - 1) % array_length(v_first_names,1)) + 1] || '.' || v_last_names[((i * 5 - 1) % array_length(v_last_names,1)) + 1] || i::text || '@occupants.example'),
      format('%s, Dakar - adresse fictive',v_quarters[((i * 3 - 1) % 18) + 1]),
      format('DEMO-CNI-%s',lpad(i::text,5,'0')),
      case when i%11=0 then 'Activite professionnelle exercee depuis le logement avec accord.' when i in (46,50,53,57) then 'Suivi de recouvrement en cours.' else 'Dossier occupant complet - contact confirme.' end,
      i <= 68,current_date - interval '12 months' + (i || ' days')::interval,now(),v_admin_id,v_agency_id,true,
      case when i%9=0 then 'Passeport' else 'CNI' end,
      case when i%9=0 then format('DX%s',lpad((4200000+i*73)::text,7,'0')) else format('DEMO17%s',lpad(i::text,10,'0')) end
    );
  end loop;

  for i in 1..68 loop
    v_tenant_id := (md5('teranga-demo:tenant:' || i::text))::uuid;
    v_unit_id := (md5('teranga-demo:unit:' || i::text))::uuid;
    select loyer_base into v_rent from public.unites where id = v_unit_id;
    k := case when i <= 45 then 10 when i <= 55 then 7 when i <= 62 then 4 else 2 end;
    v_start := (date_trunc('month',current_date) - (k || ' months')::interval + ((i % 16) + 1) * interval '1 day')::date;
    v_end := (v_start + case when i%9=0 then interval '24 months' else interval '12 months' end)::date;
    select * into v_contract from public.fn_create_contrat_command(
      v_agency_id,v_admin_id,v_tenant_id,v_unit_id,v_start,v_end,v_rent,
      case when i%10=0 then 10 when i%7=0 then 7.5 else 8 end,
      v_rent * case when i%6=0 then 2 else 1 end,
      case when i%13=0 then 'Commercial' else 'Habitation' end,
      true
    );
    v_contract_id := v_contract.id;

    for v_month in select generate_series(date_trunc('month',v_start),date_trunc('month',current_date),interval '1 month')::date loop
      if (i between 46 and 49 and v_month = date_trunc('month',current_date)::date)
         or (i between 50 and 52 and v_month >= (date_trunc('month',current_date)-interval '1 month')::date) then
        continue;
      end if;

      v_amount := v_rent;
      if i between 53 and 56 and v_month = date_trunc('month',current_date)::date then v_amount := round(v_rent * 0.6); end if;
      if i = 57 and v_month = date_trunc('month',current_date)::date then v_amount := round(v_rent * 0.9); end if;
      if i = 10 and v_month = (date_trunc('month',current_date)-interval '3 months')::date then v_amount := round(v_rent * 0.6); end if;

      v_mode := (array['mobile_money','virement','especes','cheque'])[((i + extract(month from v_month)::integer) % 4) + 1];
      v_status := case when v_amount < v_rent then 'partiel' else 'paye' end;
      perform public.fn_create_paiement_financial(
        v_agency_id,v_admin_id,v_contract_id,v_amount,v_month,
        least(current_date,v_month + case when i%8=0 then 18 else 4 + (i%7) end),
        v_mode,v_status,
        format('TG-%s-%s',lpad(i::text,3,'0'),to_char(v_month,'YYYYMM')),
        case when v_amount < v_rent then 'Versement partiel suivi par le service recouvrement.' else 'Reglement mensuel confirme.' end,
        format('demo-contract-%s-%s-a',lpad(i::text,3,'0'),to_char(v_month,'YYYYMM')),
        true
      );

      if i = 10 and v_month = (date_trunc('month',current_date)-interval '3 months')::date then
        perform public.fn_create_paiement_financial(
          v_agency_id,v_admin_id,v_contract_id,v_rent-v_amount,v_month,
          least(current_date,(v_month+interval '24 days')::date),'virement','paye',
          format('TG-REG-%s-%s',lpad(i::text,3,'0'),to_char(v_month,'YYYYMM')),
          'Regularisation du reliquat apres relance amiable.',
          format('demo-contract-%s-%s-b',lpad(i::text,3,'0'),to_char(v_month,'YYYYMM')),true
        );
      end if;
    end loop;
  end loop;

  for i in 69..72 loop
    v_tenant_id := (md5('teranga-demo:tenant:' || i::text))::uuid;
    v_unit_id := (md5('teranga-demo:unit:' || i::text))::uuid;
    select loyer_base into v_rent from public.unites where id = v_unit_id;
    v_start := (date_trunc('month',current_date)-interval '16 months'+((i%10)+1)*interval '1 day')::date;
    select * into v_contract from public.fn_create_contrat_command(
      v_agency_id,v_admin_id,v_tenant_id,v_unit_id,v_start,(current_date+interval '2 months')::date,
      v_rent,8,v_rent,'Habitation',true
    );
    for v_month in select generate_series(date_trunc('month',v_start),date_trunc('month',current_date)-interval '5 months',interval '1 month')::date loop
      perform public.fn_create_paiement_financial(
        v_agency_id,v_admin_id,v_contract.id,v_rent,v_month,(v_month+interval '6 days')::date,
        'virement','paye',format('TG-OLD-%s-%s',i,to_char(v_month,'YYYYMM')),
        'Ancien bail solde avant sortie.',format('demo-old-%s-%s',i,to_char(v_month,'YYYYMM')),true
      );
    end loop;
    perform public.fn_update_contrat_command(
      v_agency_id,v_admin_id,v_contract.id,
      jsonb_build_object('statut','resilie','date_fin',(current_date-interval '4 months')::date,'resiliation_motif','Fin de bail reguliere','resiliation_observations','Etat des lieux de sortie archive.')
    );
  end loop;

  for i in 1..24 loop
    v_property_id := (md5('teranga-demo:property:' || (((i - 1) % 18) + 1)::text))::uuid;
    perform public.fn_finance_create_depense(
      v_agency_id,
      case when i in (7,18) then 485000 + i*2500 when i%5=0 then 185000 + i*1700 else 28000 + i*3900 end,
      (current_date - ((i * 11) || ' days')::interval)::date,
      (array['Plomberie','Electricite','Peinture','Gardiennage','Nettoyage','Serrurerie','Climatisation','Travaux'])[((i-1)%8)+1],
      (array['Remplacement robinetterie et controle fuite','Remise en service tableau electrique','Rafraichissement parties communes','Vacation gardiennage mensuelle','Nettoyage et evacuation encombrants','Remplacement serrure securisee','Entretien preventif climatisation','Refection etancheite toiture'])[((i-1)%8)+1],
      (array['Atelier Ndiaye Services','Sunu Elec','Couleurs du Sahel','Dakar Securite','Teranga Proprete','Keur Serrures','Clima Services','Bati Horizon'])[((i-1)%8)+1],
      v_property_id,null
    );
  end loop;

  for i in 1..18 loop
    v_property_id := (md5('teranga-demo:property:' || i::text))::uuid;
    insert into public.evenements (
      id,agency_id,titre,type,date,heure,immeuble_id,description,rappel,created_by,created_at
    ) values (
      (md5('teranga-demo:event:'||i::text))::uuid,v_agency_id,
      (array['Visite technique','Relance locataire','Etat des lieux','Renouvellement de bail','Rendez-vous bailleur','Controle maintenance'])[((i-1)%6)+1],
      (array['visite','relance','inventaire','contrat','rendez_vous','maintenance'])[((i-1)%6)+1],
      (current_date + ((i-7)||' days')::interval)::date,'09:30',v_property_id,
      'Evenement de demonstration planifie et rattache au portefeuille.',
      case when i%3=0 then '1 jour avant' else '2 heures avant' end,v_user_ids[((i-1)%8)+1],
      now()-((20-i)||' days')::interval
    );
  end loop;

  for i in 1..8 loop
    v_property_id := (md5('teranga-demo:property:' || i::text))::uuid;
    v_unit_id := (md5('teranga-demo:unit:' || (i*4)::text))::uuid;
    insert into public.interventions (
      id,agency_id,titre,description,immeuble_id,unite_id,categorie,urgence,
      demande_par,date_demande,date_souhaitee,assigne_a,prestataire_nom,
      prestataire_telephone,cout_estime,cout_reel,statut,date_intervention,date_fin,
      notes,created_by,created_at,updated_at
    ) values (
      (md5('teranga-demo:intervention:'||i::text))::uuid,v_agency_id,
      (array['Fuite sous evier','Verification compteur','Retouche peinture','Serrure entree','Entretien climatiseur','Reprise joint douche','Diagnostic eclairage','Controle toiture'])[((i-1)%8)+1],
      'Demande qualifiee, photos et compte rendu disponibles dans le dossier.',v_property_id,v_unit_id,
      (array['plomberie','electricite','peinture','serrurerie','climatisation','plomberie','electricite','autre'])[i],
      case when i in (1,4) then 'urgente' when i in (6,8) then 'basse' else 'normale' end,
      (array['locataire','agent','bailleur'])[((i-1)%3)+1],current_date-(i*9),current_date-(i*9)+2,
      v_user_ids[4],(array['Atelier Ndiaye Services','Sunu Elec','Couleurs du Sahel','Keur Serrures','Clima Services','Plomberie Diallo','Sunu Elec','Bati Horizon'])[i],
      format('+221 77 %s %s %s',lpad((430+i*7)::text,3,'0'),lpad((20+i)::text,2,'0'),lpad((40+i*3)::text,2,'0')),
      45000+i*12500,case when i<=5 then 42000+i*11800 else null end,
      case when i<=5 then 'termine' when i<=7 then 'en_cours' else 'a_faire' end,
      case when i<=7 then current_date-(i*9)+2 else null end,
      case when i<=5 then current_date-(i*9)+3 else null end,
      'Suivi terrain renseigne par le collaborateur assigne.',v_user_ids[2],now()-(i*9||' days')::interval,now()
    );
  end loop;

  for i in 1..8 loop
    select id into v_contract_id from public.contrats where agency_id=v_agency_id and statut='actif' order by created_at,id offset i-1 limit 1;
    insert into public.inventaires (
      id,agency_id,contrat_id,type,date,locataire_present,proprietaire_present,
      agent_present,pieces,equipements,compteurs,observations,reparations,
      caution_retenue,statut,created_by,created_at,updated_at
    ) values (
      (md5('teranga-demo:inventory:'||i::text))::uuid,v_agency_id,v_contract_id,
      case when i<=6 then 'entree' else 'sortie' end,current_date-(i*14),true,i%2=0,true,
      jsonb_build_array(jsonb_build_object('nom','Sejour','etat','bon'),jsonb_build_object('nom','Cuisine','etat',case when i=8 then 'a revoir' else 'bon' end)),
      jsonb_build_array(jsonb_build_object('nom','Climatisation','etat','fonctionnel'),jsonb_build_object('nom','Chauffe-eau','etat','fonctionnel')),
      jsonb_build_object('electricite',10240+i*127,'eau',640+i*19),
      'Etat contradictoire realise avec photos et observations detaillees.',
      case when i=8 then 'Retouche peinture du sejour a programmer.' else null end,
      case when i=8 then 35000 else 0 end,case when i=8 then 'litige' else 'termine' end,
      v_user_ids[4],now()-(i*14||' days')::interval,now()
    );
  end loop;

  for i in 1..12 loop
    insert into public.notifications (
      id,user_id,agency_id,type,title,message,link,read,created_at
    ) values (
      (md5('teranga-demo:notification:'||i::text))::uuid,
      v_user_ids[((i-1)%8)+1],v_agency_id,
      (array['payment','arrears','lease','maintenance','document','calendar'])[((i-1)%6)+1],
      (array['Paiement confirme','Reliquat a suivre','Bail proche echeance','Intervention mise a jour','Document enregistre','Rendez-vous demain'])[((i-1)%6)+1],
      'Notification de demonstration issue de l activite recente du portefeuille.',
      (array['/paiements','/loyers-impayes','/locations','/maintenance','/documents','/calendrier'])[((i-1)%6)+1],
      i>5,now()-(i*5||' hours')::interval
    );
  end loop;

  update public.agencies
  set demo_data_loaded=true, updated_at=now(), last_payment_at=(select max(date_paiement) from public.paiements where agency_id=v_agency_id)
  where id=v_agency_id;

  return public.verify_official_demo_agency();
end;
$function$;

revoke all on function public.verify_official_demo_agency() from public, anon, authenticated;
revoke all on function public.seed_official_demo_agency(text) from public, anon, authenticated;
grant execute on function public.verify_official_demo_agency() to service_role;
grant execute on function public.seed_official_demo_agency(text) to service_role;

comment on function public.seed_official_demo_agency(text) is
  'Seeds, resets or verifies the isolated official Samay Keur agency demonstration tenant. Service role only.';

;
