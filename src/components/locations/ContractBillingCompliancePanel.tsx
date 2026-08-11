import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, Loader2, Pencil, Save, X } from 'lucide-react';
import { PremiumButton } from '../ui/PremiumButton';
import { SmartCombobox } from '../ui/SmartCombobox';
import {
  getContractBillingComplianceSettings,
  listTaxRateVersions,
  saveContractBillingComplianceSettings,
  type ContractBillingComplianceSettings,
  type TaxRateVersion,
} from '../../services/api/fiscalProfileApi';

interface ContractBillingCompliancePanelProps {
  contractId: string;
  editable: boolean;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

const documentPolicies = [
  { value: 'notice', label: 'Avis d’échéance', subtitle: 'Document d’appel avant règlement' },
  { value: 'invoice', label: 'Facture', subtitle: 'À utiliser lorsque la facturation est requise' },
  { value: 'automatic', label: 'Selon le profil fiscal', subtitle: 'Choix issu du réglage validé du bail' },
];
const allocationStrategies = [
  { value: 'oldest_first', label: 'Plus ancienne échéance' },
  { value: 'current_period', label: 'Période courante' },
  { value: 'manual', label: 'Affectation manuelle' },
];
const leaseDestinations = [
  { value: 'unknown', label: 'À valider' },
  { value: 'residential', label: 'Habitation' },
  { value: 'professional', label: 'Usage professionnel' },
  { value: 'commercial', label: 'Usage commercial' },
  { value: 'mixed', label: 'Usage mixte' },
  { value: 'other', label: 'Autre usage' },
];
const taxTreatments = [
  { value: 'unknown', label: 'À valider' },
  { value: 'outside_scope', label: 'Hors champ' },
  { value: 'exempt', label: 'Exonéré' },
  { value: 'taxable', label: 'Taxable' },
];
const documentIssuers = [
  { value: 'unknown', label: 'À valider' },
  { value: 'agency', label: 'Agence' },
  { value: 'landlord', label: 'Bailleur' },
  { value: 'agency_on_behalf_of_landlord', label: 'Agence pour le compte du bailleur' },
];
const registrationStatuses = [
  { value: 'unknown', label: 'À valider' },
  { value: 'to_register', label: 'À enregistrer' },
  { value: 'registered', label: 'Enregistré' },
  { value: 'not_applicable', label: 'Non applicable' },
];
const invoiceOptions = [
  { value: 'unknown', label: 'À valider' },
  { value: 'yes', label: 'Facture requise' },
  { value: 'no', label: 'Facture non requise' },
];
const channels = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'manual', label: 'Remise manuelle' },
];

const fieldClass = 'h-8 w-full rounded-lg border border-slate-200 bg-[#fffdf8] px-2.5 text-[0.68rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const labelClass = 'mb-1 block text-[0.5rem] font-black uppercase tracking-[0.1em] text-slate-500';

function labelOf(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? 'À valider';
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5"><p className="text-[0.48rem] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p><p className="mt-0.5 truncate text-[0.65rem] font-bold text-slate-800">{value}</p></div>;
}

export function ContractBillingCompliancePanel({ contractId, editable, onSaved, onError }: ContractBillingCompliancePanelProps) {
  const [settings, setSettings] = useState<ContractBillingComplianceSettings | null>(null);
  const [baseline, setBaseline] = useState<ContractBillingComplianceSettings | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateVersion[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([getContractBillingComplianceSettings(contractId), listTaxRateVersions()])
      .then(([loadedSettings, rates]) => {
        if (!active) return;
        setSettings(loadedSettings);
        setBaseline(loadedSettings);
        setTaxRates(rates);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Les règles du bail sont indisponibles.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [contractId]);

  const validationError = useMemo(() => {
    if (!settings) return null;
    const dueDay = settings.billing.due_day;
    const leadDays = settings.billing.generation_lead_days;
    if (dueDay !== null && (dueDay < 1 || dueDay > 28)) return 'Le jour d’échéance doit être compris entre 1 et 28.';
    if (leadDays !== null && (leadDays < 0 || leadDays > 62)) return 'L’anticipation doit être comprise entre 0 et 62 jours.';
    if (settings.fiscal.rent_tax_treatment === 'taxable' && !settings.fiscal.rent_tax_rate_id) return 'Sélectionnez le taux applicable au loyer taxable.';
    if (settings.fiscal.commission_tax_treatment === 'taxable' && !settings.fiscal.commission_tax_rate_id) return 'Sélectionnez le taux applicable à la commission taxable.';
    return null;
  }, [settings]);

  const incomplete = useMemo(() => !settings
    || settings.fiscal.lease_destination === 'unknown'
    || settings.fiscal.document_issuer === 'unknown'
    || settings.fiscal.rent_tax_treatment === 'unknown', [settings]);

  const save = async () => {
    if (!settings || saving || validationError) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveContractBillingComplianceSettings(settings);
      setSettings(result);
      setBaseline(result);
      setEditing(false);
      onSaved?.('Règles de facturation et de conformité du bail enregistrées.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Les règles du bail n’ont pas pu être enregistrées.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-200 bg-white"><Loader2 className="h-4 w-4 animate-spin text-emerald-700" /></div>;
  if (!settings) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[0.65rem] font-semibold text-amber-950">{error || 'Règles indisponibles.'}</div>;

  const rateOptions = [
    { value: '', label: 'Aucun taux sélectionné' },
    ...taxRates.map((rate) => ({ value: rate.id, label: `${rate.label} · ${Number(rate.rate)} %`, subtitle: rate.validation_status === 'validated' ? 'Taux validé' : 'Applicabilité à confirmer' })),
  ];

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><CalendarClock className="h-3.5 w-3.5" /></span><div><p className="text-[0.48rem] font-black uppercase tracking-[0.13em] text-blue-700">Cycle du bail</p><h3 className="text-[0.75rem] font-extrabold text-slate-950">Facturation & conformité</h3></div></div>
        <div className="flex items-center gap-1.5"><span className={`rounded-full border px-2 py-0.5 text-[0.48rem] font-black uppercase ${incomplete ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{incomplete ? 'À valider' : 'Configuré'}</span>{editable && !editing && <button type="button" title="Modifier" onClick={() => setEditing(true)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>}</div>
      </div>

      {!editing ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <SummaryValue label="Échéance" value={settings.billing.due_day ? `Le ${settings.billing.due_day} du mois` : 'Réglage agence'} />
            <SummaryValue label="Document" value={labelOf(documentPolicies, settings.billing.document_policy)} />
            <SummaryValue label="Destination" value={labelOf(leaseDestinations, settings.fiscal.lease_destination)} />
            <SummaryValue label="Émetteur" value={labelOf(documentIssuers, settings.fiscal.document_issuer)} />
            <SummaryValue label="Loyer" value={labelOf(taxTreatments, settings.fiscal.rent_tax_treatment)} />
            <SummaryValue label="Enregistrement" value={labelOf(registrationStatuses, settings.fiscal.lease_registration_status)} />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[0.58rem] font-semibold leading-snug text-slate-500"><BadgeCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />Ces règles sont capturées dans chaque échéance émise. Elles ne modifient pas rétroactivement les documents déjà enregistrés.</p>
        </>
      ) : (
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1.5 text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-500">Cycle de facturation</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label><span className={labelClass}>Jour d’échéance</span><input type="number" min={1} max={28} className={fieldClass} value={settings.billing.due_day ?? ''} placeholder="Réglage agence" onChange={(event) => setSettings({ ...settings, billing: { ...settings.billing, due_day: event.target.value ? Number(event.target.value) : null } })} /></label>
              <label><span className={labelClass}>Anticipation (jours)</span><input type="number" min={0} max={62} className={fieldClass} value={settings.billing.generation_lead_days ?? ''} placeholder="0" onChange={(event) => setSettings({ ...settings, billing: { ...settings.billing, generation_lead_days: event.target.value ? Number(event.target.value) : null } })} /></label>
              <label><span className={labelClass}>Document d’appel</span><SmartCombobox density="dense" value={settings.billing.document_policy} options={documentPolicies} onChange={(value) => setSettings({ ...settings, billing: { ...settings.billing, document_policy: value as ContractBillingComplianceSettings['billing']['document_policy'] } })} /></label>
              <label><span className={labelClass}>Affectation paiement</span><SmartCombobox density="dense" value={settings.billing.allocation_strategy} options={allocationStrategies} onChange={(value) => setSettings({ ...settings, billing: { ...settings.billing, allocation_strategy: value as ContractBillingComplianceSettings['billing']['allocation_strategy'] } })} /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {channels.map((channel) => { const selected = settings.billing.delivery_channels.includes(channel.value); return <button key={channel.value} type="button" onClick={() => setSettings({ ...settings, billing: { ...settings.billing, delivery_channels: selected ? settings.billing.delivery_channels.filter((item) => item !== channel.value) : [...settings.billing.delivery_channels, channel.value] } })} className={`rounded-full border px-2 py-1 text-[0.56rem] font-bold ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>{selected ? '✓ ' : ''}{channel.label}</button>; })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <p className="mb-1.5 text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-500">Qualification fiscale</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label><span className={labelClass}>Destination du bail</span><SmartCombobox density="dense" value={settings.fiscal.lease_destination} options={leaseDestinations} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, lease_destination: value as ContractBillingComplianceSettings['fiscal']['lease_destination'] } })} /></label>
              <label><span className={labelClass}>Facture requise</span><SmartCombobox density="dense" value={settings.fiscal.invoice_required === null ? 'unknown' : settings.fiscal.invoice_required ? 'yes' : 'no'} options={invoiceOptions} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, invoice_required: value === 'unknown' ? null : value === 'yes' } })} /></label>
              <label><span className={labelClass}>Traitement du loyer</span><SmartCombobox density="dense" value={settings.fiscal.rent_tax_treatment} options={taxTreatments} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, rent_tax_treatment: value as ContractBillingComplianceSettings['fiscal']['rent_tax_treatment'], rent_tax_rate_id: value === 'taxable' ? settings.fiscal.rent_tax_rate_id : null } })} /></label>
              <label><span className={labelClass}>Taux du loyer</span><SmartCombobox density="dense" disabled={settings.fiscal.rent_tax_treatment !== 'taxable'} value={settings.fiscal.rent_tax_rate_id ?? ''} options={rateOptions} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, rent_tax_rate_id: value || null } })} /></label>
              <label><span className={labelClass}>Traitement commission</span><SmartCombobox density="dense" value={settings.fiscal.commission_tax_treatment} options={taxTreatments} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, commission_tax_treatment: value as ContractBillingComplianceSettings['fiscal']['commission_tax_treatment'], commission_tax_rate_id: value === 'taxable' ? settings.fiscal.commission_tax_rate_id : null } })} /></label>
              <label><span className={labelClass}>Taux commission</span><SmartCombobox density="dense" disabled={settings.fiscal.commission_tax_treatment !== 'taxable'} value={settings.fiscal.commission_tax_rate_id ?? ''} options={rateOptions} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, commission_tax_rate_id: value || null } })} /></label>
              <label><span className={labelClass}>Émetteur du document</span><SmartCombobox density="dense" value={settings.fiscal.document_issuer} options={documentIssuers} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, document_issuer: value as ContractBillingComplianceSettings['fiscal']['document_issuer'] } })} /></label>
              <label><span className={labelClass}>Enregistrement du bail</span><SmartCombobox density="dense" value={settings.fiscal.lease_registration_status} options={registrationStatuses} onChange={(value) => setSettings({ ...settings, fiscal: { ...settings.fiscal, lease_registration_status: value as ContractBillingComplianceSettings['fiscal']['lease_registration_status'] } })} /></label>
              <label><span className={labelClass}>Référence d’enregistrement</span><input className={fieldClass} value={settings.fiscal.lease_registration_reference ?? ''} onChange={(event) => setSettings({ ...settings, fiscal: { ...settings.fiscal, lease_registration_reference: event.target.value } })} /></label>
              <label><span className={labelClass}>Date d’enregistrement</span><input type="date" className={fieldClass} value={settings.fiscal.lease_registration_date ?? ''} onChange={(event) => setSettings({ ...settings, fiscal: { ...settings.fiscal, lease_registration_date: event.target.value || null } })} /></label>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-[0.62rem] font-bold text-slate-700"><input type="checkbox" checked={settings.billing.auto_issue} onChange={(event) => setSettings({ ...settings, billing: { ...settings.billing, auto_issue: event.target.checked } })} className="h-3.5 w-3.5 accent-emerald-700" />Émettre automatiquement lorsque le moteur d’échéances de l’agence est activé.</label>
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.58rem] font-semibold text-amber-950"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />La qualification fiscale doit être confirmée par un professionnel. Samay Këur n’applique aucun taux inconnu automatiquement.</div>
          {(validationError || error) && <p className="text-[0.6rem] font-semibold text-red-700">{validationError || error}</p>}
          <div className="flex justify-end gap-1.5"><PremiumButton size="sm" variant="secondary" icon={<X className="h-3.5 w-3.5" />} onClick={() => { setSettings(baseline); setEditing(false); setError(null); }} disabled={saving}>Annuler</PremiumButton><PremiumButton size="sm" variant="primary" icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} onClick={() => void save()} disabled={saving || Boolean(validationError)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</PremiumButton></div>
        </div>
      )}
    </section>
  );
}
