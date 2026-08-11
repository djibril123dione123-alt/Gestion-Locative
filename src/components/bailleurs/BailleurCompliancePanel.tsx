import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Loader2, Pencil, Save, Scale, X } from 'lucide-react';
import { PremiumButton } from '../ui/PremiumButton';
import { SmartCombobox } from '../ui/SmartCombobox';
import {
  getLandlordComplianceProfile,
  saveLandlordComplianceProfile,
  type LandlordComplianceProfile,
} from '../../services/api/fiscalProfileApi';

interface BailleurCompliancePanelProps {
  bailleurId: string;
  editable: boolean;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

const partyTypes = [
  { value: 'unknown', label: 'À valider' },
  { value: 'individual', label: 'Personne physique' },
  { value: 'legal_entity', label: 'Personne morale' },
  { value: 'joint_ownership', label: 'Indivision' },
  { value: 'estate', label: 'Succession' },
  { value: 'other', label: 'Autre situation' },
];

const legalForms = [
  { value: 'unknown', label: 'À préciser' },
  { value: 'individual', label: 'Personne physique' },
  { value: 'sole_proprietorship', label: 'Entreprise individuelle' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sa', label: 'SA' },
  { value: 'sas', label: 'SAS' },
  { value: 'gie', label: 'GIE' },
  { value: 'association', label: 'Association' },
  { value: 'other', label: 'Autre forme' },
];

const documentRoles = [
  { value: 'principal', label: 'Bailleur principal' },
  { value: 'represented', label: 'Bailleur représenté' },
  { value: 'co_owner', label: 'Copropriétaire' },
  { value: 'beneficiary', label: 'Bénéficiaire' },
  { value: 'other', label: 'Autre rôle' },
];

const taxStatuses = [
  { value: 'unknown', label: 'À valider' },
  { value: 'not_subject', label: 'Non assujetti' },
  { value: 'subject', label: 'Assujetti' },
  { value: 'exempt', label: 'Exonéré' },
  { value: 'mixed', label: 'Situation mixte' },
];

const vatStatuses = [
  { value: 'unknown', label: 'À valider' },
  { value: 'not_registered', label: 'Non enregistré' },
  { value: 'registered', label: 'Enregistré' },
  { value: 'exempt', label: 'Exonéré' },
];

const taxTreatments = [
  { value: 'unknown', label: 'À valider' },
  { value: 'outside_scope', label: 'Hors champ' },
  { value: 'exempt', label: 'Exonéré' },
  { value: 'taxable', label: 'Taxable' },
  { value: 'mixed', label: 'Mixte' },
];

const fieldClass = 'h-8 w-full rounded-lg border border-slate-200 bg-[#fffdf8] px-2.5 text-[0.68rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const labelClass = 'mb-1 block text-[0.5rem] font-black uppercase tracking-[0.1em] text-slate-500';

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? 'À valider';
}

function Value({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5">
      <p className="text-[0.48rem] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-[0.65rem] font-bold text-slate-800">{value || 'Non renseigné'}</p>
    </div>
  );
}

export function BailleurCompliancePanel({ bailleurId, editable, onSaved, onError }: BailleurCompliancePanelProps) {
  const [profile, setProfile] = useState<LandlordComplianceProfile | null>(null);
  const [baseline, setBaseline] = useState<LandlordComplianceProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getLandlordComplianceProfile(bailleurId)
      .then((result) => {
        if (!active) return;
        setProfile(result);
        setBaseline(result);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Le profil de conformité est indisponible.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bailleurId]);

  const incomplete = useMemo(() => !profile
    || profile.legal.party_type === 'unknown'
    || profile.legal.legal_form === 'unknown'
    || profile.fiscal.tax_status === 'unknown'
    || profile.fiscal.default_rent_tax_treatment === 'unknown', [profile]);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveLandlordComplianceProfile(profile);
      setProfile(result);
      setBaseline(result);
      setEditing(false);
      onSaved?.('Profil juridique et fiscal du bailleur enregistré.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Le profil du bailleur n’a pas pu être enregistré.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-200 bg-white"><Loader2 className="h-4 w-4 animate-spin text-emerald-700" /></div>;
  if (!profile) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[0.65rem] font-semibold text-amber-950">{error || 'Profil indisponible.'}</div>;

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Scale className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <p className="text-[0.48rem] font-black uppercase tracking-[0.13em] text-emerald-700">Dossier bailleur</p>
            <h3 className="truncate text-[0.75rem] font-extrabold text-slate-950">Identité juridique & fiscalité</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[0.48rem] font-black uppercase ${incomplete ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{incomplete ? 'À valider' : 'Renseigné'}</span>
          {editable && !editing && <button type="button" onClick={() => setEditing(true)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      {!editing ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Value label="Nature" value={optionLabel(partyTypes, profile.legal.party_type)} />
            <Value label="Forme" value={optionLabel(legalForms, profile.legal.legal_form)} />
            <Value label="Rôle document" value={optionLabel(documentRoles, profile.legal.document_role)} />
            <Value label="Statut fiscal" value={optionLabel(taxStatuses, profile.fiscal.tax_status)} />
            <Value label="NINEA" value={profile.legal.ninea} />
            <Value label="RCCM" value={profile.legal.rccm} />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[0.58rem] font-semibold leading-snug text-slate-500"><BadgeCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />Ces informations alimentent les contrats, mandats et snapshots financiers. Aucun régime fiscal n’est déduit automatiquement.</p>
        </>
      ) : (
        <div className="mt-2 space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label><span className={labelClass}>Nature du bailleur</span><SmartCombobox density="dense" value={profile.legal.party_type} options={partyTypes} onChange={(value) => setProfile({ ...profile, legal: { ...profile.legal, party_type: value as LandlordComplianceProfile['legal']['party_type'] } })} /></label>
            <label><span className={labelClass}>Forme juridique</span><SmartCombobox density="dense" value={profile.legal.legal_form} options={legalForms} onChange={(value) => setProfile({ ...profile, legal: { ...profile.legal, legal_form: value as LandlordComplianceProfile['legal']['legal_form'] } })} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Dénomination légale</span><input className={fieldClass} value={profile.legal.legal_name ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, legal_name: event.target.value } })} /></label>
            <label><span className={labelClass}>NINEA</span><input className={fieldClass} value={profile.legal.ninea ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, ninea: event.target.value.toUpperCase() } })} /></label>
            <label><span className={labelClass}>RCCM</span><input className={fieldClass} value={profile.legal.rccm ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, rccm: event.target.value.toUpperCase() } })} /></label>
            <label><span className={labelClass}>Rôle documentaire</span><SmartCombobox density="dense" value={profile.legal.document_role} options={documentRoles} onChange={(value) => setProfile({ ...profile, legal: { ...profile.legal, document_role: value as LandlordComplianceProfile['legal']['document_role'] } })} /></label>
            <label><span className={labelClass}>Statut fiscal</span><SmartCombobox density="dense" value={profile.fiscal.tax_status} options={taxStatuses} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, tax_status: value as LandlordComplianceProfile['fiscal']['tax_status'] } })} /></label>
            <label><span className={labelClass}>Enregistrement TVA</span><SmartCombobox density="dense" value={profile.fiscal.vat_registration_status} options={vatStatuses} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, vat_registration_status: value as LandlordComplianceProfile['fiscal']['vat_registration_status'] } })} /></label>
            <label><span className={labelClass}>Traitement des loyers</span><SmartCombobox density="dense" value={profile.fiscal.default_rent_tax_treatment} options={taxTreatments} onChange={(value) => setProfile({ ...profile, fiscal: { ...profile.fiscal, default_rent_tax_treatment: value as LandlordComplianceProfile['fiscal']['default_rent_tax_treatment'] } })} /></label>
            <label><span className={labelClass}>Numéro TVA</span><input className={fieldClass} disabled={profile.fiscal.vat_registration_status !== 'registered'} value={profile.fiscal.vat_number ?? ''} onChange={(event) => setProfile({ ...profile, fiscal: { ...profile.fiscal, vat_number: event.target.value.toUpperCase() } })} /></label>
            <label><span className={labelClass}>Représentant</span><input className={fieldClass} value={profile.legal.representative_name ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, representative_name: event.target.value } })} /></label>
            <label><span className={labelClass}>Qualité</span><input className={fieldClass} value={profile.legal.representative_capacity ?? ''} onChange={(event) => setProfile({ ...profile, legal: { ...profile.legal, representative_capacity: event.target.value } })} /></label>
          </div>
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.58rem] font-semibold text-amber-950"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />Les choix fiscaux doivent être confirmés par un professionnel compétent.</div>
          {error && <p className="text-[0.6rem] font-semibold text-red-700">{error}</p>}
          <div className="flex justify-end gap-1.5">
            <PremiumButton size="sm" variant="secondary" icon={<X className="h-3.5 w-3.5" />} onClick={() => { setProfile(baseline); setEditing(false); setError(null); }} disabled={saving}>Annuler</PremiumButton>
            <PremiumButton size="sm" variant="primary" icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} onClick={() => void save()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</PremiumButton>
          </div>
        </div>
      )}
    </section>
  );
}
