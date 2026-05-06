/**
 * Edge Function: export-accounting-ledger
 *
 * Creates a signed CSV accounting export from ledger_entries and archives it
 * in Supabase Storage under the agency namespace.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const Schema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Token manquant" }, 401);
  }

  try {
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message ?? "Payload invalide" }, 422);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: "Token invalide" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.agency_id || !profile.actif) return json({ error: "Acces refuse" }, 403);
    if (profile.role === "bailleur") return json({ error: "Acces refuse" }, 403);

    const { date_from, date_to } = parsed.data;
    const toExclusive = new Date(`${date_to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const { data: entries, error } = await supabaseAdmin
      .from("ledger_entries")
      .select("id, created_at, type, direction, montant, reference_type, reference_id, description, created_by")
      .eq("agency_id", profile.agency_id)
      .gte("created_at", `${date_from}T00:00:00.000Z`)
      .lt("created_at", toExclusive.toISOString())
      .order("created_at", { ascending: true });

    if (error) return json({ error: error.message }, 500);

    const header = [
      "id",
      "date",
      "type",
      "direction",
      "montant_xof",
      "reference_type",
      "reference_id",
      "description",
      "created_by",
    ];
    const rows = (entries ?? []).map((entry) => [
      entry.id,
      entry.created_at,
      entry.type,
      entry.direction,
      entry.montant,
      entry.reference_type,
      entry.reference_id,
      entry.description,
      entry.created_by,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
    const hash = await sha256Hex(csv);
    const path = `${profile.agency_id}/accounting/ledger-${date_from}_${date_to}-${hash.slice(0, 12)}.csv`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("agency-archives")
      .upload(path, new Blob([csv], { type: "text/csv;charset=utf-8" }), {
        contentType: "text/csv;charset=utf-8",
        upsert: false,
      });

    if (uploadErr && !uploadErr.message.includes("already exists")) {
      return json({ error: uploadErr.message }, 500);
    }

    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from("agency-archives")
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signedErr || !signed?.signedUrl) {
      return json({ error: signedErr?.message ?? "URL signee indisponible" }, 500);
    }

    return json({
      path,
      sha256: hash,
      rows: rows.length,
      signed_url: signed.signedUrl,
    });
  } catch (err) {
    console.error("[export-accounting-ledger] unexpected error", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
