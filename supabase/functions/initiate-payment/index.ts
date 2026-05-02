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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const IS_LIVE = Deno.env.get("PAYDUNYA_ENV") === "live";
const MASTER_KEY    = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_TOKEN")       : Deno.env.get("PAYDUNYA_TEST_TOKEN");
const PRIVATE_KEY   = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_PRIVATE_KEY") : Deno.env.get("PAYDUNYA_TEST_PRIVATE_KEY");
const PUBLIC_KEY    = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_PUBLIC_KEY")  : Deno.env.get("PAYDUNYA_TEST_PUBLIC_KEY");
const TOKEN         = IS_LIVE ? Deno.env.get("PAYDUNYA_LIVE_TOKEN")       : Deno.env.get("PAYDUNYA_TEST_TOKEN");
const PAYDUNYA_BASE = "https://app.paydunya.com";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL              = Deno.env.get("APP_URL") ?? "https://samaykeur.replit.app";
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

const PLAN_PRICES: Record<string, number> = {
  starter:    5000,
  pro:        15000,
  business:   35000,
  enterprise: 0,    // sur devis — bypass price check
};

const Schema = z.object({
  plan_id:    z.string(),
  provider:   z.enum(["orange_money", "wave", "djamo", "card"]),
  phone:      z.string().optional(),
  amount_xof: z.number().positive(),
  agency_id:  z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("Non authentifié", 401);

  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Données invalides");

    const { plan_id, provider, phone, amount_xof, agency_id } = parsed.data;

    // Vérification prix côté serveur
    const expectedPrice = PLAN_PRICES[plan_id];
    if (expectedPrice === undefined) return err(`Plan inconnu : ${plan_id}`);
    if (expectedPrice > 0 && amount_xof !== expectedPrice) {
      return err(`Montant invalide pour le plan ${plan_id}. Attendu : ${expectedPrice} XOF`);
    }

    // Pour les paiements mobile, le téléphone est requis
    if (provider !== "card" && !phone) {
      return err("Numéro de téléphone requis pour ce moyen de paiement");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérification JWT → agency ownership
    const jwt = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user } } = await anonClient.auth.getUser(jwt);
    if (!user) return err("Token invalide", 401);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.agency_id !== agency_id) return err("Accès refusé", 403);

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

    const pdRes = await fetch(`${PAYDUNYA_BASE}/api/v1/checkout-invoice/create`, {
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
        return json({ transaction_id: txn.id, invoice_token: fakeToken, test_mode: true });
      }

      return err(`PayDunya : ${pdData.response_text ?? "Erreur inconnue"}`, 502);
    }

    const invoiceToken: string = pdData.token;
    await supabase.from("payment_transactions").update({ invoice_token: invoiceToken, provider_ref: pdData.token }).eq("id", txn.id);

    // ── Paiement carte : retourner l'URL de checkout PayDunya ──────────────
    if (provider === "card") {
      const checkoutUrl = `${PAYDUNYA_BASE}/checkout/invoice/${invoiceToken}`;
      return json({ transaction_id: txn.id, invoice_token: invoiceToken, checkout_url: checkoutUrl });
    }

    // ── Paiement mobile : déclencher le softpay (push sur le téléphone) ────
    const softpaySlug = SOFTPAY_SLUGS[provider] ?? "orange-money-senegal";
    const softpayRes = await fetch(`${PAYDUNYA_BASE}/api/v1/softpay/${softpaySlug}`, {
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
        checkout_url: `${PAYDUNYA_BASE}/checkout/invoice/${invoiceToken}`,
      });
    }

    return json({ transaction_id: txn.id, invoice_token: invoiceToken });

  } catch (error) {
    console.error("[initiate-payment] Erreur:", error);
    return err("Erreur interne du serveur", 500);
  }
});
