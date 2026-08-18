/**
 * Edge Function : initiate-payment
 *
 * Crée une facture PayDunya et une transaction en DB.
 * Supporte : Orange Money, Wave, Djamo, Carte bancaire.
 *
 * PayDunya API : POST https://app.paydunya.com/api/v1/checkout-invoice/create
 * Softpay (mobile push) : POST https://app.paydunya.com/api/v1/softpay/{provider}
 *
 * Retourne : { transaction_id, invoice_token, checkout_url?, test_mode? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getAppUrl } from "../_shared/app-url.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const IS_LIVE = Deno.env.get("PAYDUNYA_ENV") === "live";
const MASTER_KEY  = Deno.env.get("PAYDUNYA_MASTER_KEY") ?? "";
const PRIVATE_KEY = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_PRIVATE_KEY") : Deno.env.get("PAYDUNYA_TEST_PRIVATE_KEY");
const PUBLIC_KEY  = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_PUBLIC_KEY")  : Deno.env.get("PAYDUNYA_TEST_PUBLIC_KEY");
const TOKEN       = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_TOKEN")       : Deno.env.get("PAYDUNYA_TEST_TOKEN");

// PayDunya utilise deux bases URL distinctes selon l'environnement :
//   - Test  : https://app.paydunya.com/sandbox-api/v1  (checkout: /sandbox-checkout/invoice/<token>)
//   - Live  : https://app.paydunya.com/api/v1          (checkout: /checkout/invoice/<token>)
const PAYDUNYA_API_BASE      = IS_LIVE ? "https://app.paydunya.com/api/v1"         : "https://app.paydunya.com/sandbox-api/v1";
const PAYDUNYA_CHECKOUT_BASE = IS_LIVE ? "https://paydunya.com/checkout/invoice"   : "https://paydunya.com/sandbox-checkout/invoice";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL              = getAppUrl();
const WEBHOOK_URL          = `${SUPABASE_URL}/functions/v1/paydunya-webhook`;

// Softpay provider slugs PayDunya
const SOFTPAY_SLUGS: Record<string, string> = {
  orange_money: "orange-money-senegal",
  wave:         "wave-senegal",
  djamo:        "djamo",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const Schema = z.object({
  plan_id:    z.string(),
  provider:   z.enum(["orange_money", "wave", "djamo", "card"]),
  phone:      z.string().optional(),
  amount_xof: z.number().positive(),
  agency_id:  z.string().uuid(),
  idempotency_key: z.string().min(12).max(120).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("Non authentifié", 401);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return err("JSON invalide", 400);
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Données invalides");

    const { plan_id, provider, phone, amount_xof, agency_id } = parsed.data;
    const idempotencyKey = parsed.data.idempotency_key?.trim() || crypto.randomUUID();

    // Pour les paiements mobile, le téléphone est requis
    if (provider !== "card" && !phone) {
      return err("Numéro de téléphone requis pour ce moyen de paiement");
    }

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
      console.error("[initiate-payment] idempotency lookup error:", existingErr.message);
      return err("Erreur verification transaction", 500);
    }

    if (existingTxn) {
      const checkoutUrl = existingTxn.invoice_token
        ? `${PAYDUNYA_CHECKOUT_BASE}/${existingTxn.invoice_token}`
        : undefined;
      return json({
        transaction_id: existingTxn.id,
        invoice_token: existingTxn.invoice_token,
        checkout_url: checkoutUrl,
        status: existingTxn.status,
        idempotent: true,
      });
    }

    // ── Vérification prix côté serveur ──────────────────────────────────────
    // Source unique : subscription_plans (prix public + prix fondateur), et
    // l'état fondateur réel de l'agence (agencies.founder_eligible /
    // founder_paid_cycles_used / founder_cycles_total). Jamais de prix accepté
    // depuis le frontend sans revérification ici.
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("price_xof, founder_price_xof")
      .eq("id", plan_id)
      .maybeSingle();

    if (planErr) {
      console.error("[initiate-payment] plan lookup error:", planErr.message);
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
      console.error("[initiate-payment] agency lookup error:", agencyErr.message);
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

    // Créer la transaction en DB (status=pending)
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .insert({
        agency_id,
        provider: "paydunya",
        amount_xof,
        plan_id,
        status: "pending",
        phone: phone ?? null,
        idempotency_key: idempotencyKey,
        is_founder_cycle: isFounderCycle,
      })
      .select("id")
      .single();

    if (txnErr || !txn) return err("Erreur création transaction", 500);

    const paydunyaHeaders = {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY":  MASTER_KEY  ?? "",
      "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY ?? "",
      "PAYDUNYA-PUBLIC-KEY":  PUBLIC_KEY  ?? "",
      "PAYDUNYA-TOKEN":       TOKEN       ?? "",
    };

    // ── Créer l'invoice PayDunya ────────────────────────────────────────────
    const invoiceBody = {
      invoice: {
        total_amount: amount_xof,
        description: `Abonnement Samay Këur — Plan ${plan_id.charAt(0).toUpperCase() + plan_id.slice(1)}`,
      },
      store: {
        name:           "Samay Këur",
        tagline:        "Gestion locative simplifiée",
        phone:          "0000000000",
        postal_address: "Dakar, Sénégal",
        logo_url:       `${APP_URL}/logo.png`,
        website_url:    APP_URL,
      },
      actions: {
        cancel_url:   `${APP_URL}/#/abonnement?payment=cancelled`,
        return_url:   `${APP_URL}/#/abonnement?payment=success`,
        callback_url: WEBHOOK_URL,
      },
      custom_data: {
        transaction_id: txn.id,
        agency_id,
        plan_id,
      },
    };

    const pdRes = await fetch(`${PAYDUNYA_API_BASE}/checkout-invoice/create`, {
      method: "POST",
      headers: paydunyaHeaders,
      body: JSON.stringify(invoiceBody),
    });

    const pdData = await pdRes.json();

    if (!pdRes.ok || pdData.response_code !== "00") {
      console.error("[initiate-payment] PayDunya invoice error:", pdData);

      if (!IS_LIVE) {
        // Mode test : simuler un token pour dev
        const fakeToken = `test_${txn.id}`;
        await supabase.from("payment_transactions").update({ invoice_token: fakeToken }).eq("id", txn.id);
        return json({
          transaction_id: txn.id,
          invoice_token: fakeToken,
          test_mode: true,
          activation_required: "verified_webhook_or_admin_validation",
        });
      }

      return err(`PayDunya : ${pdData.response_text ?? "Erreur inconnue"}`, 502);
    }

    const invoiceToken: string = pdData.token;
    await supabase.from("payment_transactions").update({ invoice_token: invoiceToken, provider_ref: pdData.token }).eq("id", txn.id);

    // ── Paiement carte : retourner l'URL de checkout PayDunya ──────────────
    if (provider === "card") {
      const checkoutUrl = `${PAYDUNYA_CHECKOUT_BASE}/${invoiceToken}`;
      return json({ transaction_id: txn.id, invoice_token: invoiceToken, checkout_url: checkoutUrl });
    }

    // ── Paiement mobile : déclencher le softpay (push sur le téléphone) ────
    const softpaySlug = SOFTPAY_SLUGS[provider] ?? "orange-money-senegal";
    const softpayRes = await fetch(`${PAYDUNYA_API_BASE}/softpay/${softpaySlug}`, {
      method: "POST",
      headers: paydunyaHeaders,
      body: JSON.stringify({
        invoice_token: invoiceToken,
        phone_number: phone,
      }),
    });

    const softpayData = await softpayRes.json();

    if (!softpayRes.ok || softpayData.response_code !== "00") {
      console.error("[initiate-payment] Softpay error:", softpayData);
      // L'invoice est créée mais le push a échoué — on retourne quand même le token
      // Le client peut basculer vers la page de paiement carte en fallback
      return json({
        transaction_id: txn.id,
        invoice_token: invoiceToken,
        softpay_error: softpayData.response_text ?? "Envoi push échoué",
        checkout_url: `${PAYDUNYA_CHECKOUT_BASE}/${invoiceToken}`,
      });
    }

    return json({ transaction_id: txn.id, invoice_token: invoiceToken });

  } catch (error) {
    console.error("[initiate-payment] Erreur:", error);
    return err("Erreur interne du serveur", 500);
  }
});
