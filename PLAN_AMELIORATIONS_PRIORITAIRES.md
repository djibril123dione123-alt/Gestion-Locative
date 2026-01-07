# 🎯 PLAN D'AMÉLIORATIONS PRIORITAIRES

## Application : Gestion Locative / Confort Immo Archi
## Score actuel : 78/100 (après corrections P0)
## Objectif : 95/100 en 8 semaines

---

## 📊 PRIORISATION DES AMÉLIORATIONS

### Priorité P0 (Critique - Bloquant) ✅ COMPLÉTÉ
- [x] Corriger typo `comission` → `commission`
- [x] Ajouter colonnes manquantes en DB
- [x] Créer table `agency_settings`
- [x] Implémenter soft delete
- [x] Activer audit automatique
- [x] Optimiser requêtes dashboard

### Priorité P1 (Majeure - Impact utilisateur fort) 🔥
- [ ] Module Inventaires / États des lieux
- [ ] Module Interventions / Maintenance
- [ ] Page Paramètres Agence (frontend)
- [ ] Messages d'erreur traduits
- [ ] Confirmations sécurisées
- [ ] Tests responsive mobile
- [ ] Module Documents (upload fichiers)

### Priorité P2 (Mineure - Qualité du code)
- [ ] Refactoring types TypeScript
- [ ] Centraliser fonction `formatCurrency`
- [ ] Tests unitaires (70% couverture)
- [ ] Documentation technique
- [ ] Accessibilité (ARIA labels)

### Priorité P3 (Intégrations - Nice to have)
- [ ] API Mobile Money
- [ ] QR Codes sur quittances
- [ ] Notifications email/SMS
- [ ] Exports Excel avancés
- [ ] CI/CD automatisé

---

## 🚀 SPRINT 2 : UX & INTERFACES (Semaine 2)

### Objectif : Améliorer expérience utilisateur et traduire messages

#### Tâche 2.1 : Page Paramètres Agence ⏱️ 1 jour

**Fichier à créer** : `src/pages/ParametresAgence.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AgencySettings {
  nom_agence: string;
  logo_url: string;
  couleur_primaire: string;
  ninea: string;
  commission_globale: number;
  devise: string;
  // ... tous les autres champs
}

export function ParametresAgence() {
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('agency_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    // Logique de sauvegarde
  };

  return (
    <div className="p-6">
      <h1>Paramètres de l'agence</h1>

      {/* Section 1 : Identité */}
      <section className="mb-8">
        <h2>Identité de l'agence</h2>
        {/* Formulaire nom, logo, couleur, NINEA */}
      </section>

      {/* Section 2 : Financier */}
      <section className="mb-8">
        <h2>Paramètres financiers</h2>
        {/* Commission, pénalités, devise */}
      </section>

      {/* Section 3 : Documents */}
      <section className="mb-8">
        <h2>Personnalisation documents</h2>
        {/* QR codes, signature, pied de page */}
      </section>

      {/* Section 4 : Modules */}
      <section className="mb-8">
        <h2>Modules activés</h2>
        {/* Checkboxes mode avancé, dépenses, inventaires */}
      </section>

      <button onClick={handleSave}>
        <Save /> Enregistrer
      </button>
    </div>
  );
}
```

**Ajouter dans** : `src/App.tsx` ligne 47
```typescript
{currentPage === 'parametres' && <ParametresAgence />}
```

**Ajouter dans** : `src/components/layout/Sidebar.tsx` ligne 43
```typescript
{ id: 'parametres', label: 'Paramètres', icon: Settings, roles: ['admin'] },
```

---

#### Tâche 2.2 : Messages d'erreur traduits ⏱️ 0.5 jour

**Fichier à créer** : `src/lib/messages.ts`

```typescript
export const messages = {
  error: {
    generic: "Une erreur s'est produite. Veuillez réessayer.",
    notFound: "Enregistrement introuvable.",
    saveError: "Impossible de sauvegarder les modifications.",
    deleteError: "Impossible de supprimer cet enregistrement.",
    networkError: "Erreur de connexion. Vérifiez votre réseau.",
    unauthorized: "Vous n'avez pas les droits nécessaires.",
    validation: {
      required: "Ce champ est obligatoire.",
      email: "Email invalide.",
      phone: "Numéro de téléphone invalide.",
      positive: "La valeur doit être positive.",
      dateInvalid: "Date invalide.",
      dateRange: "La date de fin doit être après la date de début.",
    }
  },
  success: {
    saved: "Enregistrement réussi !",
    deleted: "Suppression réussie.",
    updated: "Mise à jour effectuée.",
  },
  confirm: {
    delete: "Êtes-vous sûr de vouloir supprimer cet élément ?",
    deletePermanent: "Cette action est irréversible. Confirmer la suppression ?",
    cancel: "Annuler les modifications non sauvegardées ?",
  }
};

// Fonction helper pour afficher un message
export function showError(message: string) {
  // Remplacer alert() par un toast moderne
  alert(message); // Temporaire, à remplacer par react-toastify
}

export function showSuccess(message: string) {
  alert(message);
}
```

**Remplacer dans tous les fichiers** :
```typescript
// AVANT
alert('Erreur lors de la sauvegarde');

// APRÈS
import { messages, showError } from '../lib/messages';
showError(messages.error.saveError);
```

---

#### Tâche 2.3 : Composant ConfirmModal ⏱️ 0.5 jour

**Fichier à créer** : `src/components/ui/ConfirmModal.tsx`

```typescript
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  danger = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {danger && (
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            )}
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-600 mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Utiliser dans les pages** :
```typescript
// Exemple dans Bailleurs.tsx
const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

// Dans le JSX
<ConfirmModal
  isOpen={!!confirmDelete}
  title="Supprimer le bailleur"
  message="Cette action est irréversible. Le bailleur et ses contrats seront supprimés."
  onConfirm={() => {
    handleDelete(confirmDelete!);
    setConfirmDelete(null);
  }}
  onCancel={() => setConfirmDelete(null)}
  danger
/>

// Remplacer confirm() par
onClick={() => setConfirmDelete(bailleur.id)}
```

---

#### Tâche 2.4 : Tests responsive mobile ⏱️ 0.5 jour

**Checklist de test** :

- [ ] iPhone 12/13 (390x844)
- [ ] Samsung Galaxy S21 (360x800)
- [ ] iPad (768x1024)

**Composants à tester** :
1. `Sidebar` : Hamburger menu sur mobile
2. `Table` : Scroll horizontal ou mode cards
3. `Modal` : Hauteur max-height avec scroll
4. Formulaires : 1 champ par ligne

**Breakpoints Tailwind à utiliser** :
```css
/* sm: 640px - Mobile landscape */
/* md: 768px - Tablet */
/* lg: 1024px - Desktop */
/* xl: 1280px - Large desktop */
```

**Exemple de refactoring** :
```tsx
// AVANT (Table non responsive)
<table className="w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>

// APRÈS (Responsive cards sur mobile)
<div className="hidden md:block">
  <table className="w-full">...</table>
</div>
<div className="md:hidden space-y-4">
  {bailleurs.map(b => (
    <div key={b.id} className="bg-white p-4 rounded-lg shadow">
      <div className="font-bold">{b.nom} {b.prenom}</div>
      <div className="text-sm text-slate-600">{b.telephone}</div>
      {/* ... */}
    </div>
  ))}
</div>
```

---

## 🗂️ SPRINT 3 : MODULES MANQUANTS (Semaine 3-4)

### Objectif : Ajouter fonctionnalités critiques absentes

#### Tâche 3.1 : Module Inventaires ⏱️ 2 jours

**Migrations SQL** :
```sql
-- Table inventaires
CREATE TABLE inventaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid REFERENCES contrats(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  date_inventaire date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  signature_locataire text,
  signature_bailleur text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Table items d'inventaire
CREATE TABLE inventaire_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventaire_id uuid REFERENCES inventaires(id) ON DELETE CASCADE,
  categorie text NOT NULL, -- Cuisine, Salon, Chambre, SDB
  element text NOT NULL, -- Évier, Porte, Fenêtre
  etat text NOT NULL CHECK (etat IN ('Neuf', 'Bon', 'Moyen', 'Mauvais', 'Absent')),
  quantite integer DEFAULT 1,
  observations text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE inventaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_items ENABLE ROW LEVEL SECURITY;

-- Policies (agents et admins uniquement)
CREATE POLICY "Agents can manage inventaires"
  ON inventaires FOR ALL
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents can manage inventaire items"
  ON inventaire_items FOR ALL
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());
```

**Page frontend** : `src/pages/Inventaires.tsx`

**Fonctionnalités** :
- Liste des inventaires avec filtres (type, date, contrat)
- Création inventaire entrée (checklist pré-remplie par type d'unité)
- Création inventaire sortie (comparaison avec inventaire entrée)
- Génération PDF inventaire avec photos (si upload activé)
- Signature électronique locataire/bailleur

---

#### Tâche 3.2 : Module Interventions ⏱️ 2 jours

**Migrations SQL** :
```sql
-- Table interventions
CREATE TABLE interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unite_id uuid REFERENCES unites(id) ON DELETE CASCADE,
  locataire_id uuid REFERENCES locataires(id),
  titre text NOT NULL,
  description text,
  categorie text NOT NULL, -- Plomberie, Électricité, Serrurerie
  priorite text NOT NULL CHECK (priorite IN ('Basse', 'Moyenne', 'Haute', 'Urgente')),
  statut text NOT NULL CHECK (statut IN ('Demandée', 'Planifiée', 'En cours', 'Terminée', 'Annulée')),
  date_demande date NOT NULL DEFAULT CURRENT_DATE,
  date_planifiee date,
  date_realisation date,
  cout_estime decimal(12,2),
  cout_reel decimal(12,2),
  prestataire text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Photos interventions
CREATE TABLE intervention_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES interventions(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  legende text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage interventions"
  ON interventions FOR ALL
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());
```

**Page frontend** : `src/pages/Interventions.tsx`

**Fonctionnalités** :
- Tableau de bord interventions (par statut, priorité)
- Création demande intervention (depuis locataire ou agent)
- Planification avec sélection prestataire
- Suivi temps réel (statuts)
- Historique interventions par unité
- Export PDF rapport intervention

---

#### Tâche 3.3 : Module Documents ⏱️ 1 jour

**Configuration Supabase Storage** :
```typescript
// 1. Créer bucket dans Supabase Dashboard
// Settings → Storage → Create bucket "documents"

// 2. Policies storage
// INSERT: authenticated users can upload
// SELECT: authenticated users can view
// UPDATE: only admin can update
// DELETE: only admin can delete

// 3. Intégration frontend
import { supabase } from '../lib/supabase';

export async function uploadDocument(
  file: File,
  type: 'cni' | 'justificatif' | 'photo',
  entityId: string
) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${type}_${entityId}_${Date.now()}.${fileExt}`;
  const filePath = `${type}s/${fileName}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (error) throw error;

  // Retourner URL publique
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
```

**Composant Upload** :
```tsx
// src/components/ui/FileUpload.tsx
export function FileUpload({
  label,
  accept = "image/*,.pdf",
  onUpload
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadDocument(file, 'photo', uuid());
      onUpload(url);
    } catch (error) {
      alert('Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label>{label}</label>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={uploading}
      />
      {uploading && <p>Upload en cours...</p>}
    </div>
  );
}
```

**Intégration dans formulaires** :
- Bailleurs : Upload CNI, Justificatif domicile
- Locataires : Upload CNI, Fiche de paie
- Paiements : Upload justificatif paiement
- Interventions : Upload photos avant/après

---

## 📱 SPRINT 4 : INTÉGRATIONS (Semaine 5-6)

### Tâche 4.1 : API Mobile Money ⏱️ 3 jours

**Wave Money API** :
```typescript
// src/lib/wavemoney.ts
import axios from 'axios';

interface WavePaymentRequest {
  amount: number;
  currency: 'XOF';
  phone: string;
  description: string;
}

export async function initiateWavePayment({
  amount,
  phone,
  description
}: WavePaymentRequest) {
  try {
    const response = await axios.post(
      'https://api.wave.com/v1/checkout/sessions',
      {
        amount: amount * 100, // Convertir en centimes
        currency: 'XOF',
        success_url: `${window.location.origin}/paiements/success`,
        cancel_url: `${window.location.origin}/paiements/cancel`,
        customer_phone_number: phone,
        description
      },
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_WAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.wave_launch_url;
  } catch (error) {
    console.error('Wave payment error:', error);
    throw new Error('Erreur initialisation paiement Wave');
  }
}

// Webhook handler (Supabase Edge Function)
export async function handleWaveWebhook(event: any) {
  if (event.type === 'checkout.session.completed') {
    // Mettre à jour le paiement en DB
    const { payment_id, amount, status } = event.data;

    await supabase
      .from('paiements')
      .update({
        statut: status === 'success' ? 'paye' : 'annule',
        reference: payment_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', event.metadata.paiement_id);
  }
}
```

**Intégration dans Paiements.tsx** :
```tsx
const handleMobileMoneyPayment = async () => {
  if (formData.mode_paiement !== 'mobile_money') return;

  const phoneNumber = prompt('Numéro Wave du locataire :');
  if (!phoneNumber) return;

  try {
    const paymentUrl = await initiateWavePayment({
      amount: parseFloat(formData.montant_total),
      phone: phoneNumber,
      description: `Loyer ${formData.mois_display} - ${contrat?.unites?.nom}`
    });

    window.open(paymentUrl, '_blank');
  } catch (error) {
    alert('Erreur paiement Mobile Money');
  }
};
```

---

### Tâche 4.2 : QR Codes sur quittances ⏱️ 0.5 jour

**Installation** :
```bash
npm install qrcode
```

**Intégration dans pdf.ts** :
```typescript
import QRCode from 'qrcode';

export async function generatePaiementFacturePDF(paiement: any) {
  // ... code existant

  const settings = await loadAgencySettings();

  if (settings.qr_code_quittances) {
    // Générer QR code avec URL de vérification
    const verifyUrl = `https://votre-domaine.com/verify/${paiement.id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    // Ajouter au PDF (coin supérieur droit)
    doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - 40, 15, 25, 25);
  }

  // ... reste du code
}
```

**Page publique vérification** :
```tsx
// src/pages/VerifyReceipt.tsx
export function VerifyReceipt() {
  const { id } = useParams();
  const [paiement, setPaiement] = useState(null);

  useEffect(() => {
    // Requête publique (sans auth) via API publique
    fetch(`/api/verify/${id}`)
      .then(res => res.json())
      .then(data => setPaiement(data));
  }, [id]);

  if (!paiement) return <div>Vérification...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1>✅ Quittance Authentique</h1>
      <p>Référence : {paiement.reference}</p>
      <p>Montant : {formatCurrency(paiement.montant_total)}</p>
      <p>Date : {new Date(paiement.date_paiement).toLocaleDateString()}</p>
      <p>Statut : {paiement.statut}</p>
    </div>
  );
}
```

---

### Tâche 4.3 : Notifications Email ⏱️ 2 jours

**Supabase Edge Function** :
```typescript
// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { to, subject, html } = await req.json();

  // Utiliser Sendgrid, Mailgun, ou service email de votre choix
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@votre-agence.com' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });

  return new Response(JSON.stringify({ sent: response.ok }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Templates emails** :
```typescript
// src/lib/email-templates.ts
export const emailTemplates = {
  rappelLoyer: (locataire: string, montant: number, mois: string) => `
    <h2>Rappel de paiement de loyer</h2>
    <p>Bonjour ${locataire},</p>
    <p>Nous vous rappelons que votre loyer de ${formatCurrency(montant)} pour le mois de ${mois} est en attente de paiement.</p>
    <p>Merci de régulariser votre situation dans les plus brefs délais.</p>
    <p>Cordialement,<br/>Votre agence</p>
  `,

  contratExpire: (locataire: string, dateExpiration: string) => `
    <h2>Votre contrat arrive à échéance</h2>
    <p>Bonjour ${locataire},</p>
    <p>Votre contrat de location arrive à échéance le ${dateExpiration}.</p>
    <p>Veuillez nous contacter pour discuter du renouvellement.</p>
  `
};
```

**Déclenchement automatique (cron job)** :
```typescript
// supabase/functions/scheduled-notifications/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  // Exécuté quotidiennement via cron

  // 1. Trouver loyers impayés depuis > 5 jours
  const impayes = await getLoyersImpayes(1);

  // 2. Envoyer email rappel pour chaque locataire
  for (const impaye of impayes) {
    await sendEmail({
      to: impaye.locataire_email,
      subject: 'Rappel paiement loyer',
      html: emailTemplates.rappelLoyer(
        impaye.locataire_nom,
        impaye.montant_impaye,
        impaye.mois_impaye
      )
    });
  }

  // 3. Trouver contrats expirant dans 30 jours
  // ...

  return new Response(JSON.stringify({ sent: impayes.length }));
});
```

---

## 🧪 SPRINT 5 : TESTS & QUALITÉ (Semaine 7-8)

### Tâche 5.1 : Tests unitaires ⏱️ 3 jours

**Installation** :
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Configuration** : `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts'
  }
});
```

**Tests prioritaires** :
```typescript
// src/tests/utils/currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../lib/utils';

describe('formatCurrency', () => {
  it('should format XOF correctly', () => {
    expect(formatCurrency(1000000, 'XOF')).toBe('1 000 000 F CFA');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0, 'XOF')).toBe('0 F CFA');
  });

  it('should handle negative numbers', () => {
    expect(formatCurrency(-5000, 'XOF')).toBe('-5 000 F CFA');
  });
});

// src/tests/components/ConfirmModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

describe('ConfirmModal', () => {
  it('should render when open', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should call onConfirm when clicking confirm', () => {
    const mockConfirm = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={mockConfirm}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Confirmer'));
    expect(mockConfirm).toHaveBeenCalledOnce();
  });
});
```

**Objectif** : 70% couverture

---

### Tâche 5.2 : Tests E2E ⏱️ 2 jours

**Installation** :
```bash
npm install -D @playwright/test
npx playwright install
```

**Tests critiques** :
```typescript
// tests/e2e/contrat-flow.spec.ts
import { test, expect } from '@playwright/test';

test('should create a complete contract', async ({ page }) => {
  // 1. Login
  await page.goto('http://localhost:5173');
  await page.fill('[name="email"]', 'admin@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 2. Navigate to Contrats
  await page.click('text=Contrats');

  // 3. Click Nouveau contrat
  await page.click('text=Nouveau contrat');

  // 4. Fill form
  await page.selectOption('[name="locataire_id"]', { index: 1 });
  await page.selectOption('[name="unite_id"]', { index: 1 });
  await page.fill('[name="date_debut"]', '2026-01-01');
  await page.fill('[name="loyer_mensuel"]', '250000');

  // 5. Submit
  await page.click('text=Enregistrer');

  // 6. Verify success
  await expect(page.locator('text=Contrat créé avec succès')).toBeVisible();
});

test('should record a payment', async ({ page }) => {
  // Test complet enregistrement paiement
  // ...
});
```

---

## 📝 DOCUMENTATION TECHNIQUE

### Fichiers à créer :

1. **`/docs/schema-database.md`** : Diagramme ERD complet
2. **`/docs/api-endpoints.md`** : Liste des endpoints Supabase
3. **`/docs/deployment.md`** : Guide de déploiement
4. **`/docs/contributing.md`** : Guide pour contributeurs
5. **`/docs/user-manual.md`** : Manuel utilisateur (français)

---

## 📊 INDICATEURS DE SUCCÈS

### Métriques cibles après 8 semaines :

| Critère | Actuel | Cible | Priorité |
|---------|--------|-------|----------|
| Score qualité global | 78/100 | 95/100 | P1 |
| Couverture tests | 0% | 70% | P1 |
| Modules critiques | 8/11 | 11/11 | P0 |
| Temps chargement dashboard | ~2s | <500ms | P2 |
| Messages traduits | 30% | 100% | P1 |
| Responsive mobile | 40% | 95% | P1 |
| Documentation | 20% | 90% | P2 |
| Erreurs production/jour | N/A | <5 | P1 |

---

## 💰 ESTIMATION TEMPS & RESSOURCES

### Temps total estimé : **25 jours de développement**

- Sprint 2 (UX) : 2.5 jours
- Sprint 3 (Modules) : 5 jours
- Sprint 4 (Intégrations) : 5.5 jours
- Sprint 5 (Tests) : 5 jours
- Documentation : 2 jours
- Buffer/imprévus : 5 jours (20%)

### Ressources nécessaires :

1. **Développeur fullstack TypeScript/React** : 1 personne
2. **Designer UI/UX** (optionnel) : 0.25 ETP
3. **QA Tester** (optionnel) : 0.25 ETP

### Coûts estimés (services externes) :

- SendGrid (email) : 15 USD/mois
- Wave Money API : Gratuit + frais transactions
- Supabase (plan Pro) : 25 USD/mois
- Domaine + SSL : 15 USD/an
- **Total mensuel** : ~40-50 USD

---

## ✅ CHECKLIST DE PROGRESSION

### Sprint 2 (Semaine 2)
- [ ] Page Paramètres Agence créée et fonctionnelle
- [ ] Tous les messages traduits en français
- [ ] ConfirmModal implémenté partout
- [ ] Tests responsive OK sur 3 devices

### Sprint 3 (Semaine 3-4)
- [ ] Module Inventaires opérationnel
- [ ] Module Interventions opérationnel
- [ ] Upload documents configuré (Supabase Storage)
- [ ] PDFs générés avec documents

### Sprint 4 (Semaine 5-6)
- [ ] Paiement Wave Money fonctionnel
- [ ] QR Codes sur quittances
- [ ] Emails notifications envoyés automatiquement
- [ ] Cron jobs configurés

### Sprint 5 (Semaine 7-8)
- [ ] Tests unitaires 70% couverture
- [ ] Tests E2E sur parcours critiques
- [ ] Documentation technique complète
- [ ] CI/CD pipeline configuré

---

**Auteur** : Claude Sonnet 4.5
**Date** : 2026-01-07
**Révision** : v1.0
