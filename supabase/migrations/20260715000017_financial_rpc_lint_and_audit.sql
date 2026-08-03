-- Remove inert lock receivers without weakening row locks, and ensure payment
-- corrections retain their actor in the immutable event trail.

do $repair_payment_rpc_lint$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.fn_create_paiement_financial(uuid,uuid,uuid,numeric,date,date,text,text,text,text,text,boolean)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_old := E'  v_lock_id uuid;\n';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected create payment declaration; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, '');

  v_old := E'  SELECT p.id\n  INTO v_lock_id\n  FROM public.paiements p\n  WHERE p.agency_id = p_agency_id\n    AND p.contrat_id = p_contrat_id\n    AND p.mois_concerne = p_mois_concerne\n    AND p.deleted_at IS NULL\n  ORDER BY p.created_at, p.id\n  LIMIT 1\n  FOR UPDATE;';
  v_new := E'  PERFORM p.id\n  FROM public.paiements p\n  WHERE p.agency_id = p_agency_id\n    AND p.contrat_id = p_contrat_id\n    AND p.mois_concerne = p_mois_concerne\n    AND p.deleted_at IS NULL\n  ORDER BY p.created_at, p.id\n  LIMIT 1\n  FOR UPDATE;';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected create payment lock; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;

  select pg_get_functiondef(
    'public.fn_update_paiement_financial(uuid,uuid,uuid,numeric,text,text,date,text,text)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_old := E'  v_lock_id uuid;\n';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected update payment declaration; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, '');

  v_old := E'  SELECT p.id\n  INTO v_lock_id\n  FROM public.paiements p\n  WHERE p.agency_id = p_agency_id\n    AND p.contrat_id = v_existing.contrat_id\n    AND p.mois_concerne = v_existing.mois_concerne\n    AND p.deleted_at IS NULL\n  ORDER BY p.created_at, p.id\n  LIMIT 1\n  FOR UPDATE;';
  v_new := E'  PERFORM p.id\n  FROM public.paiements p\n  WHERE p.agency_id = p_agency_id\n    AND p.contrat_id = v_existing.contrat_id\n    AND p.mois_concerne = v_existing.mois_concerne\n    AND p.deleted_at IS NULL\n  ORDER BY p.created_at, p.id\n  LIMIT 1\n  FOR UPDATE;';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected update payment lock; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'BEGIN\n  SELECT *';
  v_new := E'BEGIN\n  IF p_user_id IS NULL THEN\n    RAISE EXCEPTION ''PAYMENT_ACTOR_REQUIRED'';\n  END IF;\n\n  SELECT *';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected update payment entrypoint; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'  PERFORM public.fn_recompute_paiement_echeance(\n    p_agency_id,\n    v_existing.contrat_id,\n    v_existing.mois_concerne\n  );';
  v_new := E'  INSERT INTO public.event_log (\n    agency_id,\n    event_type,\n    entity_type,\n    entity_id,\n    payload,\n    created_by\n  ) VALUES (\n    p_agency_id,\n    ''paiement.updated'',\n    ''paiements'',\n    v_existing.id,\n    jsonb_build_object(\n      ''previous_amount'', v_existing.montant_total,\n      ''new_amount'', v_updated.montant_total,\n      ''previous_status'', v_existing.statut,\n      ''new_status'', v_updated.statut,\n      ''lifecycle'', jsonb_build_object(''action'', ''payment_correction'')\n    ),\n    p_user_id\n  );\n\n  PERFORM public.fn_recompute_paiement_echeance(\n    p_agency_id,\n    v_existing.contrat_id,\n    v_existing.mois_concerne\n  );';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected update payment recompute block; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$repair_payment_rpc_lint$;
