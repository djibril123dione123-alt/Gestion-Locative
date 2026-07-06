-- Additive settings used by the premium Control Center.
-- Existing agency settings, RBAC and RLS policies stay unchanged.

alter table public.agency_settings
  add column if not exists enabled_modules jsonb not null default '{}'::jsonb;

alter table public.agency_settings
  add column if not exists document_preferences jsonb not null default '{
    "header_style": "institutionnel",
    "show_slogan": true,
    "numbering_format": "Q-YYYY-0001",
    "reset_numbering_yearly": true,
    "show_document_number": true,
    "prefixes": {
      "quittance": "QIT",
      "contrat": "CTR",
      "mandat": "MDT",
      "rapport": "RPT",
      "facture": "FAC"
    },
    "qr_documents": {
      "quittance": true,
      "contrat": true,
      "mandat": true,
      "rapport": true,
      "facture": false
    },
    "qr_text": "Scannez pour verifier l authenticite.",
    "qr_position": "bottom_right",
    "confidentiality_notice": "Document confidentiel reserve aux parties concernees.",
    "payment_notice": "Paiement attendu selon les modalites prevues au contrat.",
    "receipt_notice": "Quittance emise sous reserve d encaissement effectif.",
    "document_options": {
      "contrat": {
        "logo": true,
        "qr": true,
        "legalRepresentative": true,
        "taxIds": true,
        "penalties": true,
        "tribunal": true,
        "signatures": true,
        "annexes": true
      },
      "mandat": {
        "commission": true,
        "duration": true,
        "ownerDuties": true,
        "agencyDuties": true,
        "signatures": true,
        "qr": true
      },
      "quittance": {
        "period": true,
        "paymentMethod": true,
        "remainingDue": true,
        "qr": true,
        "receiptNotice": true,
        "stamp": false
      },
      "rapport": {
        "financialSummary": true,
        "payments": true,
        "remainingDue": true,
        "expenses": true,
        "commissions": true,
        "attachments": true,
        "qr": true,
        "footer": true
      },
      "facture": {
        "taxIds": true,
        "paymentTerms": true,
        "fiscalNotice": true,
        "qr": false
      }
    }
  }'::jsonb;

comment on column public.agency_settings.enabled_modules is
  'Optional module visibility flags controlled from the settings Control Center.';

comment on column public.agency_settings.document_preferences is
  'Document rendering preferences, numbering, QR visibility and legal notices.';
