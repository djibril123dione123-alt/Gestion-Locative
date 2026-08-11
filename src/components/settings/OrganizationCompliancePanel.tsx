import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, Loader2, ReceiptText, Save, Scale } from 'lucide-react';
import { PremiumButton } from '../ui/PremiumButton';
import { SmartCombobox } from '../ui/SmartCombobox';
import {
  getOrganizationComplianceProfile,
  saveOrganizationComplianceProfile,
  type OrganizationComplianceProfile,
} from '../../services/api/fiscalProfileApi';

interface OrganizationCompliancePanelProps {
  agencyId: string;
  editable?: boolean;
  isIndividualOwner?: boolean;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

const LEGAL_FORMS = [
  { value: 'unknown', label: 'À préciser', subtitle: 'Aucune qualification juridique appliquée' },
  { value: 'individual', label: 'Personne physique' },
  { value: 'sole_proprietorship', label: 'Entreprise individuelle' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sa', label: 'SA' },
  { value: 'sas', label: 'SAS' },
  { value: 'gie', label: 'GIE' },
  { value: 'association', label: 'Association' },
  { value: 'other', label: 'Autre forme' },
];

const DOCUMENT_ROLES = [
  { value: 'unknown', label: 'À préciser' },
  { value: 'principal', label: 'Émetteur principal' },
  { value: 'agent', label: 'Mandataire' },
  { value: 'representative', label: 'Représentant' },
  { value: 'manager_on_behalf', label: 'Gestionnaire pour le compte du bailleur' },
];

const TAX_STATUSES = [
  { value: 'unknown', label: 'À valider' },
  { value: 'not_subject', label: 'Non assujetti' },
  { value: 'subject', label: 'Assujetti' },
  { value: 'exempt', label: 'Exonéré' },
  { value: 'mixed', label: 'Régime mixte' },
];

const TAX_TREATMENTS = [
  { value: 'unknown', label: 'À valider' },
  { value: 'outside_scope', label: 'Hors champ' },
  { value: 'exempt', label: 'Exonéré' },
  { value: 'taxable', label: 'Taxable' },
  { value: 'mixed', label: 'Traitement mixte' },
];

const ACTIVITIES = [
  ['real_estate_management', 'Gestion locative'],
  ['property_leasing', 'Mise en location'],
  ['property_sales', 'Transaction immobilière'],
  ['consulting', 'Conseil'],
] as const;

const fieldClass = 'h-8 w-full rounded-lg border border-emerald-950/12 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
const labelClass = 'mb-1 block text-[0.56rem] font-black uppercase tracking-[0.12em] text-slate-500';

function displayLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? 'À préciser';
}

export function OrganizationCompliancePanel({
  agencyId,
  editable = false,
  isIndividualOwner = false,
  onSaved,
  onError,
}: OrganizationCompliancePanelProps) {
  const [profile, setProfile] = useState<OrganizationComplianceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getOrganizationComplianceProfile(agencyId)
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : 'Le profil juridique et fiscal est indisponible.';
        if (active) setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agencyId]);

  const incomplete = useMemo(() => {
    if (!profile) return true;
    return profile.legal.legal_form === 'unknown'
      || profile.legal.document_role === 'unknown'
      || profile.fiscal.tax_status === 'unknown'
      || profile.fiscal.rent_tax_treatment === 'unknown';
  }, [profile]);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveOrganizationComplianceProfile(profile);
      setProfile(saved);
      onSaved?.('Profil juridique et fiscal enregistré. Les règles restent à valider avec votre conseil.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Le profil n’a pas pu être enregistré.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-24 items-center justify-center rounded-xl border border-emerald-950/10 bg-white">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-label="Chargement du profil juridique et fiscal" />
      </section>
    );
  }

  if (error && !profile) {
    return (
      <section className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-xs font-extrabold">Profil juridique et fiscal indisponible</p>
          <p className="mt-0.5 text-[0.66rem] font-semibold leading-snug">{error}</p>
        </div>
      </section>
    );
  }

  if (!profile) return null;

  if (!editable) {
    return (
      <section className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Scale className="h-3.5 w-3.5" /></span>
            <div>
              <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Conformité documentaire</p>
              <h3 className="text-[0.78rem] font-extrabold text-slate-950">Profil juridique & fiscal</h3>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ${incomplete ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {incomplete ? 'À valider' : 'Renseigné'}
          </span>
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <ComplianceValue label="Forme juridique" value={displayLabel(LEGAL_FORMS, profile.legal.legal_form)} />
          <ComplianceValue label="Rôle documentaire" value={displayLabel(DOCUMENT_ROLES, profile.legal.document_role)} />
          <ComplianceValue label="Statut fiscal" value={displayLabel(TAX_STATUSES, profile.fiscal.tax_status)} />
          <ComplianceValue label="Montants saisis" value={profile.fiscal.price_input_mode === 'ht' ? 'Hors taxes' : 'Toutes taxes comprises'} />
        </div>
        <p className="mt-2 text-[0.61rem] font-semibold leading-snug text-slate-500">
          Ces réglages sont figés dans le snapshot de chaque échéance. Samay Këur n’applique jamais automatiquement une TVA non validée.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-white to-emerald-50/30 p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Scale className="h-4 w-4" /></span>
          <div>
            <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-emerald-700">Conformité documentaire</p>
            <h3 className="text-[0.82rem] font-extrabold text-slate-950">Profil juridique & fiscal</h3>
            <p className="text-[0.62rem] font-semibold text-slate-500">Distinguez la forme juridique, l’activité et le traitement fiscal.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.52rem] font-black uppercase tracking-[0.08em] text-amber-800">
          <AlertTriangle className="h-3 w-3" /> Validation professionnelle requise
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-emerald-700" /><h4 className="text-xs font-extrabold text-slate-900">Identité juridique</h4></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label><span className={labelClass}>Forme juridique</span><SmartCombobox density="compact" value={profile.legal.legal_form} options={LEGAL_FORMS} onChange={(value) => setProfile({ ...profile, legal: { ...profile.legal, legal_form: value as OrganizationComplianceProfile['legal']['legal_form'] } })} /></label>
            <label><span className={labelClass}>Rôle dans les documents</span><SmartCombobox density="compact" value={profile.legal.document_role} options={DOCUMENT_ROLES} onChange={(value) => setProfile({ ...profile, legal: { ...profile.legal, document_role: value as OrganizationComplianceProfile['legal']['document_role'] } })} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Dénomination légale</span><input className={fieldClass} value={profile.legal.legal_name ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, legal_name: event.target.value } })} placeholder={isIndividualOwner ? 'Nom légal du propriétaire' : 'Dénomination inscrite au registre'} /></label>
            <label><span className={labelClass}>Siège enregistré</span><input className={fieldClass} value={profile.legal.registered_office ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, registered_office: event.target.value } })} /></label>
            <label><span className={labelClass}>Référence du mandat</span><input className={fieldClass} value={profile.legal.mandate_reference ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, mandate_reference: event.target.value } })} /></label>
          </div>
          <div className="mt-2">
            <span className={labelClass}>Activités exercées</span>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITIES.map(([value, label]) => {
                const selected = profile.legal.business_activities.includes(value);
                return <button key={value} type="button" onClick={() => setProfile({ ...profile, legal: { ...profile.legal, business_activities: selected ? profile.legal.business_activities.filter((item) => item !== value) : [...profile.legal.business_activities, value] } })} className={`rounded-full border px-2 py-1 text-[0.58rem] font-bold transition ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}>{selected ? '✓ ' : ''}{label}</button>;
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="mb-2 flex items-center gap-1.5"><ReceiptText className="h-3.5 w-3.5 text-orange-600" /><h4 className="text-xs font-extrabold text-slate-900">Traitement fiscal</h4></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label><span className={labelClass}>Statut fiscal</span><SmartCombobox density="compact" value={profile.fiscal.tax_status} options={TAX_STATUSES} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, tax_status: value as OrganizationComplianceProfile['fiscal']['tax_status'] } })} /></label>
            <label><span className={labelClass}>Saisie des prix</span><SmartCombobox density="compact" value={profile.fiscal.price_input_mode} options={[{ value: 'ttc', label: 'TTC' }, { value: 'ht', label: 'HT' }]} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, price_input_mode: value as 'ht' | 'ttc' } })} /></label>
            <label><span className={labelClass}>Traitement des loyers</span><SmartCombobox density="compact" value={profile.fiscal.rent_tax_treatment} options={TAX_TREATMENTS} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, rent_tax_treatment: value as OrganizationComplianceProfile['fiscal']['rent_tax_treatment'] } })} /></label>
            <label><span className={labelClass}>Traitement des commissions</span><SmartCombobox density="compact" value={profile.fiscal.commission_tax_treatment} options={TAX_TREATMENTS.filter((option) => option.value !== 'mixed')} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, commission_tax_treatment: value as OrganizationComplianceProfile['fiscal']['commission_tax_treatment'] } })} /></label>
            <label><span className={labelClass}>Enregistrement TVA</span><SmartCombobox density="compact" value={profile.fiscal.vat_registration_status} options={[{ value: 'unknown', label: 'À valider' }, { value: 'not_registered', label: 'Non enregistré' }, { value: 'registered', label: 'Enregistré' }, { value: 'exempt', label: 'Exonéré' }]} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, vat_registration_status: value as OrganizationComplianceProfile['fiscal']['vat_registration_status'] } })} /></label>
            <label><span className={labelClass}>Identifiant TVA</span><input className={fieldClass} value={profile.fiscal.vat_number ?? ''} onChange={(event) => setProfile({ ...profile, fiscal: { ...profile.fiscal, vat_number: event.target.value } })} disabled={profile.fiscal.vat_registration_status !== 'registered'} placeholder="Si applicable" /></label>
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-950">
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-[0.61rem] font-semibold leading-snug">Le taux normal du catalogue reste informatif tant que son applicabilité au bail et au bailleur n’est pas validée.</p>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-[0.64rem] font-semibold text-red-700">{error}</p>}
      <div className="mt-3 flex justify-end">
        <PremiumButton variant="create" size="sm" onClick={save} disabled={saving} icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}>
          {saving ? 'Enregistrement…' : 'Enregistrer le profil fiscal'}
        </PremiumButton>
      </div>
    </section>
  );
}

function ComplianceValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2"><p className="text-[0.5rem] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-0.5 truncate text-[0.68rem] font-extrabold text-slate-900">{value}</p></div>;
}
