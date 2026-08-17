-- Supabase applique des privileges par defaut (ALTER DEFAULT PRIVILEGES) qui
-- accordent EXECUTE a anon/authenticated sur toute nouvelle fonction, quel
-- que soit le GRANT explicite pose a la creation. REVOKE ALL FROM PUBLIC ne
-- suffit pas a retirer ces grants directs par role — il faut les revoquer
-- explicitement. Corrige suite a l'avis de securite du linter Supabase
-- (anon_security_definer_function_executable) declenche par la migration
-- 20260817120000_founder_offer.sql.

-- founder_offer_enabled() : purement interne (appelee depuis
-- approve_agency_request, qui s'execute deja en SECURITY DEFINER). Aucune
-- raison qu'elle soit exposee via PostgREST a qui que ce soit.
REVOKE ALL ON FUNCTION public.founder_offer_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founder_offer_enabled() TO service_role;

-- set_founder_offer_enabled() : doit rester appelable par authenticated
-- (un super_admin l'utilise depuis la console), mais jamais par anon —
-- la garde is_super_admin() protege le contenu, pas l'exposition de la route.
REVOKE ALL ON FUNCTION public.set_founder_offer_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_founder_offer_enabled(boolean) TO authenticated;
