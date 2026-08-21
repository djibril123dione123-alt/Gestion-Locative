-- Deduplication des evenements webhook Resend par svix-id.
--
-- resend-webhook/index.ts ne deduplique aujourd'hui aucun evenement : un
-- retry Resend (declenche par toute reponse non-2xx, ou par un simple
-- doublon reseau) peut donc reappliquer le meme evenement plusieurs fois.
-- L'update actuel (UPDATE notification_queue SET status = X) est
-- idempotent en lui-meme, mais rien n'empeche un evenement recu en retard
-- (ex: "sent" retente apres qu'un "bounced" plus recent ait deja ete
-- traite) d'ecraser un statut plus a jour. Le claim atomique ci-dessous
-- garantit qu'un svix-id donne n'est jamais traite deux fois, quel que
-- soit l'ordre ou le nombre de livraisons.
--
-- Table interne, jamais lue/ecrite par le client -- RLS active sans
-- policy pour authenticated/anon (deny-all par defaut), seul le
-- service_role de l'edge function y accede (bypass RLS natif Supabase).

CREATE TABLE IF NOT EXISTS resend_webhook_events (
  svix_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resend_webhook_events ENABLE ROW LEVEL SECURITY;
