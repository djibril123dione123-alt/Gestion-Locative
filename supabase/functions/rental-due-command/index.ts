import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const DocumentTypes = [
  "due_notice",
  "rent_invoice",
  "partial_payment_receipt",
  "rent_receipt",
  "credit_note",
] as const;

const CommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("generate"),
    contract_id: z.string().uuid(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("generate-bulk"),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("preview-bulk"),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("prepare-document"),
    due_id: z.string().uuid(),
    document_type: z.enum(DocumentTypes),
  }),
  z.object({
    command: z.literal("backfill"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("reconcile"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("activate"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    command: z.literal("schedule-reminders"),
    due_id: z.string().uuid(),
  }),
  z.object({
    command: z.literal("cancel"),
    due_id: z.string().uuid(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.object({
    command: z.literal("record-delivery"),
    due_id: z.string().uuid(),
    document_id: z.string().uuid(),
    channel: z.enum(["download", "manual"]),
    recipient: z.string().trim().max(320).optional(),
  }),
]);

type Command = z.infer<typeof CommandSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function fail(message: string, status = 400, code = "INVALID_REQUEST") {
  return json({ error: message, code }, status);
}

function mapDatabaseError(message: string) {
  const mappings: Array<[string, string, number]> = [
    ["DUE_COMMAND_FORBIDDEN", "Vous n'avez pas l'autorisation de générer cette échéance.", 403],
    ["DUE_BACKFILL_FORBIDDEN", "Le rattrapage est réservé aux administrateurs.", 403],
    ["DUE_ACTIVATION_FORBIDDEN", "L'activation est réservée aux administrateurs.", 403],
    ["DUE_DOCUMENT_FORBIDDEN", "Vous n'avez pas l'autorisation de générer ce document.", 403],
    ["DUE_RECONCILIATION_FORBIDDEN", "Le rapprochement est réservé aux administrateurs.", 403],
    ["DUE_PREVIEW_FORBIDDEN", "La préparation mensuelle est réservée aux administrateurs.", 403],
    ["DUE_CANCEL_FORBIDDEN", "L'annulation est réservée aux administrateurs.", 403],
    ["DUE_DELIVERY_FORBIDDEN", "Vous n'avez pas l'autorisation de remettre ce document.", 403],
    ["DUE_REMINDER_FORBIDDEN", "Vous n'avez pas l'autorisation de planifier ces relances.", 403],
    ["CONTRACT_NOT_FOUND", "Contrat introuvable ou inaccessible.", 404],
    ["DUE_NOT_FOUND", "Échéance introuvable ou inaccessible.", 404],
    ["DUE_RECONCILIATION_REQUIRED", "Le rapprochement présente encore un écart. Corrigez-le avant activation.", 409],
    ["DUE_BACKFILL_REQUIRES_DISABLED_ENGINE", "Désactivez le moteur avant un nouveau rattrapage.", 409],
    ["PARTIAL_RECEIPT_REQUIRES_PARTIAL_DUE", "Un reçu partiel exige une échéance partiellement réglée.", 409],
    ["RENT_RECEIPT_REQUIRES_PAID_DUE", "Une quittance exige une échéance entièrement réglée.", 409],
    ["DUE_PREVIEW_PERIOD_INVALID", "La période demandée n'est pas autorisée.", 422],
    ["DUE_CANCEL_REASON_REQUIRED", "Indiquez un motif d'annulation précis.", 422],
    ["DUE_CANCEL_REQUIRES_PAYMENT_REVERSAL", "Annulez d'abord les paiements ou crédits affectés à cette échéance.", 409],
    ["DUE_CANCEL_REQUIRES_CREDIT_NOTE", "Émettez d'abord un avoir avant d'annuler cette échéance facturée.", 409],
    ["DUE_DOCUMENT_CANCELLED", "Aucun nouveau document ne peut être émis pour une échéance annulée.", 409],
    ["DUE_BILLING_DOCUMENT_REQUIRES_OPEN_DUE", "Cette échéance est déjà soldée ; utilisez la quittance correspondante.", 409],
    ["CREDIT_NOTE_REQUIRES_ISSUED_BILL", "Un avoir exige une facture ou un avis d'échéance déjà émis.", 409],
    ["CREDIT_NOTE_ALREADY_ISSUED", "Un avoir a déjà été émis pour cette échéance.", 409],
    ["DUE_DOCUMENT_NOT_ISSUED", "Le document doit être émis avant d'enregistrer sa remise.", 409],
    ["DUE_DELIVERY_CHANNEL_UNAVAILABLE", "Ce canal de remise n'est pas encore disponible.", 422],
    ["DUE_REMINDER_NOT_APPLICABLE", "Cette échéance ne peut plus être relancée.", 409],
  ];
  const match = mappings.find(([code]) => message.includes(code));
  if (match) return { code: match[0], message: match[1], status: match[2] };
  return {
    code: "DUE_COMMAND_FAILED",
    message: "L'opération sur les échéances n'a pas pu être terminée.",
    status: 422,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Méthode non autorisée.", 405, "METHOD_NOT_ALLOWED");

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return fail("Session requise.", 401, "NOT_AUTHENTICATED");
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return fail("Session invalide ou expirée.", 401, "INVALID_TOKEN");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return fail("Profil ou organisation introuvable.", 403, "PROFILE_NOT_FOUND");
    }
    if (profile.actif === false) return fail("Ce compte est désactivé.", 403, "ACCOUNT_DISABLED");

    const body = await req.json().catch(() => null);
    const parsed = CommandSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        parsed.error.issues.map((issue) => issue.message).join("; "),
        422,
        "VALIDATION_ERROR",
      );
    }

    const input: Command = parsed.data;
    const agencyId = profile.agency_id as string;
    const actorId = authData.user.id;
    const isAdmin = ["admin", "super-admin", "super_admin"].includes(String(profile.role));

    if (["preview-bulk", "generate-bulk", "backfill", "reconcile", "activate", "cancel"].includes(input.command) && !isAdmin) {
      return fail("Cette opération est réservée aux administrateurs.", 403, "ADMIN_REQUIRED");
    }

    let rpc: string;
    let args: Record<string, unknown>;
    switch (input.command) {
      case "generate":
        rpc = "fn_generate_rental_due_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_contract_id: input.contract_id, p_period_start: input.period_start };
        break;
      case "generate-bulk":
        rpc = "fn_generate_rental_dues_bulk_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_period_start: input.period_start };
        break;
      case "preview-bulk":
        rpc = "fn_preview_rental_due_generation_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_period_start: input.period_start };
        break;
      case "prepare-document":
        rpc = "fn_prepare_rental_due_document_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_due_id: input.due_id, p_document_type: input.document_type };
        break;
      case "backfill":
        rpc = "fn_backfill_rental_dues_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_from: input.from, p_to: input.to };
        break;
      case "reconcile":
        rpc = "fn_reconcile_rental_dues";
        args = { p_agency_id: agencyId, p_from: input.from, p_to: input.to };
        break;
      case "activate":
        rpc = "fn_activate_rental_due_engine_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_from: input.from, p_to: input.to };
        break;
      case "schedule-reminders":
        rpc = "fn_schedule_rental_due_reminders";
        args = { p_due_id: input.due_id, p_actor_id: actorId };
        break;
      case "cancel":
        rpc = "fn_cancel_rental_due_command";
        args = { p_agency_id: agencyId, p_actor_id: actorId, p_due_id: input.due_id, p_reason: input.reason };
        break;
      case "record-delivery":
        rpc = "fn_record_rental_due_delivery_command";
        args = {
          p_agency_id: agencyId,
          p_actor_id: actorId,
          p_due_id: input.due_id,
          p_document_id: input.document_id,
          p_channel: input.channel,
          p_recipient: input.recipient ?? null,
        };
        break;
    }

    const { data, error } = await admin.rpc(rpc, args);
    if (error) {
      console.error("[rental-due-command]", input.command, error.code, error.message);
      const mapped = mapDatabaseError(error.message);
      return fail(mapped.message, mapped.status, mapped.code);
    }
    return json({ data, command: input.command });
  } catch (error) {
    console.error("[rental-due-command] unexpected", error);
    return fail("Une erreur serveur inattendue est survenue.", 500, "INTERNAL_ERROR");
  }
});
