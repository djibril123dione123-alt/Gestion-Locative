/**
 * Edge Function : senepay-checkout
 *
 * Crée une session de paiement hébergée SenePay et une transaction en DB.
 * Contrairement à PayDunya, SenePay gère lui-même le choix de l'opérateur
 * (Wave / Orange / Free / carte) et la saisie du téléphone sur sa page
 * hébergée : on ne reproduit donc plus ici de logique de sélection de
 * provider ni de saisie de téléphone.
 *
 * SenePay API : POST https://api.sene-pay.com/api/v1/checkout/sessions
 * Doc : https://api.sene-pay.com/docs.html
 *
 * Retourne : { transaction_id, session_token, checkout_url }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SENEPAY_API_BASE = "https://api.sene-pay.com/api/v1";
const SENEPAY_API_KEY = Deno.env.get("SENEPAY_API_KEY") ?? "";
const SENEPAY_API_SECRET = Deno.env.get("SENEPAY_API_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.samaykeur.com";
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/senepay-webhook`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const senepayHeaders = {
  "Content-Type": "application/json",
  "X-Api-Key": SENEPAY_API_KEY,
  "X-Api-Secret": SENEPAY_API_SECRET,
};

const Schema = z.object({
  plan_id: z.string(),
  amount_xof: z.number().positive(),
  agency_id: z.string().uuid(),
  idempotency_key: z.string().min(12).max(120).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("Non authentifié", 401);

  try {
    if (!SENEPAY_API_KEY || !SENEPAY_API_SECRET) {
      console.error("[senepay-checkout] missing SenePay credentials");
      return err("Service de paiement mal configuré", 500);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return err("JSON invalide", 400);
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Données invalides");

    const { plan_id, amount_xof, agency_id } = parsed.data;
    const idempotencyKey = parsed.data.idempotency_key?.trim() || crypto.randomUUID();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérification JWT → agency ownership (avant toute lecture liée à agency_id,
    // pour ne jamais révéler à un tiers si une agence est éligible fondateur).
    const jwt = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user } } = await anonClient.auth.getUser(jwt);
    if (!user) return err("Token invalide", 401);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && (!profile.actif || profile.role === "bailleur")) {
      return err("Acces refuse", 403);
    }
    if (!profile || profile.agency_id !== agency_id) return err("Accès refusé", 403);

    // Idempotence : une tentative déjà initiée avec la même clé renvoie la même transaction.
    const { data: existingTxn, error: existingErr } = await supabase
      .from("payment_transactions")
      .select("id, invoice_token, status")
      .eq("agency_id", agency_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingErr) {
      console.error("[senepay-checkout] idempotency lookup error:", existingErr.message);
      return err("Erreur verification transaction", 500);
    }

    if (existingTxn) {
      if (existingTxn.status === "completed") {
        return json({ transaction_id: existingTxn.id, status: "completed", idempotent: true });
      }
      if (!existingTxn.invoice_token) {
        return err("Une tentative de paiement est déjà en cours pour cette action. Réessayez dans un instant.", 409);
      }
      // La session SenePay existe déjà : on va rechercher son checkoutUrl réel
      // au lieu d'en reconstruire un — SenePay interdit explicitement de
      // construire cette URL manuellement.
      const statusRes = await fetch(`${SENEPAY_API_BASE}/checkout/sessions/${existingTxn.invoice_token}`, {
        headers: senepayHeaders,
      });
      const statusData = await statusRes.json().catch(() => null);
      if (statusRes.ok && statusData?.checkoutUrl) {
        return json({
          transaction_id: existingTxn.id,
          session_token: existingTxn.invoice_token,
          checkout_url: statusData.checkoutUrl,
          status: existingTxn.status,
          idempotent: true,
        });
      }
      console.error("[senepay-checkout] impossible de retrouver la session existante", statusRes.status, statusData);
      return err("Session de paiement introuvable. Contactez le support.", 502);
    }

    // ── Vérification prix côté serveur ──────────────────────────────────────
    // Source unique : subscription_plans (prix public + prix fondateur), et
    // l'état fondateur réel de l'agence. Jamais de prix accepté depuis le
    // frontend sans revérification ici.
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("price_xof, founder_price_xof")
      .eq("id", plan_id)
      .maybeSingle();

    if (planErr) {
      console.error("[senepay-checkout] plan lookup error:", planErr.message);
      return err("Erreur vérification du plan", 500);
    }
    if (!plan) return err(`Plan inconnu : ${plan_id}`);
    if (!plan.price_xof || plan.price_xof <= 0) {
      return err("Ce plan ne peut pas etre paye automatiquement. Contactez le support.", 422);
    }

    const { data: agency, error: agencyErr } = await supabase
      .from("agencies")
      .select("founder_eligible, founder_paid_cycles_used, founder_cycles_total")
      .eq("id", agency_id)
      .maybeSingle();

    if (agencyErr) {
      console.error("[senepay-checkout] agency lookup error:", agencyErr.message);
      return err("Erreur vérification de l'agence", 500);
    }

    const isFounderCycle = Boolean(
      agency?.founder_eligible
      && plan.founder_price_xof
      && (agency.founder_paid_cycles_used ?? 0) < (agency.founder_cycles_total ?? 0),
    );
    const expectedPrice = isFounderCycle ? plan.founder_price_xof! : plan.price_xof;

    if (amount_xof !== expectedPrice) {
      return err(`Montant invalide pour le plan ${plan_id}. Attendu : ${expectedPrice} XOF`);
    }

    // Créer la transaction en DB (status=pending). orderReference SenePay = id
    // interne de la transaction : la recherche webhook n'aura donc jamais à
    // dépendre d'une valeur que SenePay choisit lui-même.
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .insert({
        agency_id,
        provider: "senepay",
        amount_xof: expectedPrice,
        plan_id,
        status: "pending",
        idempotency_key: idempotencyKey,
        is_founder_cycle: isFounderCycle,
      })
      .select("id")
      .single();

    if (txnErr || !txn) return err("Erreur création transaction", 500);

    // ── Créer la session de checkout hébergée SenePay ──────────────────────
    const sessionBody = {
      amount: expectedPrice,
      currency: "XOF",
      orderReference: txn.id,
      description: `Abonnement Samay Këur — Plan ${plan_id.charAt(0).toUpperCase() + plan_id.slice(1)}`,
      returnUrl: `${APP_URL}/#/abonnement?payment=return`,
      cancelUrl: `${APP_URL}/#/abonnement?payment=cancelled`,
      webhookUrl: WEBHOOK_URL,
      country: "SN",
      metadata: {
        organizationId: agency_id,
        subscriptionId: agency_id,
        planId: plan_id,
        internalPaymentId: txn.id,
      },
      expiresInMinutes: 60,
    };

    const spRes = await fetch(`${SENEPAY_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: senepayHeaders,
      body: JSON.stringify(sessionBody),
    });

    const spData = await spRes.json().catch(() => null);

    if (!spRes.ok || !spData?.sessionToken || !spData?.checkoutUrl) {
      console.error("[senepay-checkout] SenePay session error:", spRes.status, spData);
      // Pas de fallback silencieux ici (contrairement au mode test PayDunya) :
      // on ne renvoie jamais un lien de paiement qui ne correspond à aucune
      // session réelle chez le fournisseur.
      return err(spData?.message ?? spData?.error ?? "Erreur du service de paiement", 502);
    }

    await supabase
      .from("payment_transactions")
      .update({ invoice_token: spData.sessionToken, provider_ref: spData.sessionToken })
      .eq("id", txn.id);

    return json({
      transaction_id: txn.id,
      session_token: spData.sessionToken,
      checkout_url: spData.checkoutUrl,
    });
  } catch (error) {
    console.error("[senepay-checkout] Erreur:", error);
    return err("Erreur interne du serveur", 500);
  }
});
