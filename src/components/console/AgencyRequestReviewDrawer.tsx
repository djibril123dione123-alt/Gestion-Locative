import { CheckCircle2, X } from 'lucide-react';
import { getAdminPlan } from '../../lib/admin/adminPricingCatalog';
import { formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import { AdminButton, AdminPanel, AdminStatusBadge } from './AdminPrimitives';
import type { AgencyCreationRequest, AdminAgency } from '../../services/admin/adminConsoleService';

export function AgencyRequestReviewDrawer({
  request,
  agencies,
  onClose,
  onApprove,
  onReject,
}: {
  request: AgencyCreationRequest | null;
  agencies: AdminAgency[];
  onClose: () => void;
  onApprove: (request: AgencyCreationRequest) => void;
  onReject: (request: AgencyCreationRequest) => void;
}) {
  if (!request) return null;
  const name = request.organization_name ?? request.agency_name ?? 'Organisation à créer';
  const email = request.requester_email ?? request.email ?? '';
  const plan = getAdminPlan(request.requested_plan ?? request.plan);
  const duplicates = agencies.filter((agency) => {
    const sameName = agency.name?.toLowerCase().trim() === name.toLowerCase().trim();
    const sameEmail = email && agency.email?.toLowerCase().trim() === email.toLowerCase().trim();
    return sameName || sameEmail;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer la demande" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-[#f7f3ea] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <AdminStatusBadge status={request.status} />
            <h2 className="mt-3 text-xl font-black text-slate-950">{name}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Demande reçue {formatAdminDate(request.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <AdminPanel title="Résumé demandeur" subtitle="Informations fournies pendant l'onboarding.">
            <div className="grid gap-2 text-sm">
              {[
                ['Email', textValue(email)],
                ['Téléphone', textValue(request.phone)],
                ['Type demandé', request.is_bailleur_account ? 'Bailleur individuel' : textValue(request.organization_type, 'Agence immobilière')],
                ['Plan initial', plan.name],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
                  <span className="text-right font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Checklist avant approbation" subtitle="Chaque validation est tracée dans le journal super-admin.">
            <div className="grid gap-2">
              {[
                ['Email exploitable', Boolean(email)],
                ['Nom organisation', Boolean(name)],
                ['Plan initial identifié', Boolean(plan.id)],
                ['Aucun doublon visible', duplicates.length === 0],
              ].map(([label, ok]) => (
                <div key={String(label)} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-bold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <span>{label}</span>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              ))}
              {duplicates.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  Doublon à vérifier : {duplicates.map((agency) => agency.name).join(', ')}
                </div>
              )}
            </div>
          </AdminPanel>

          {request.status === 'pending' && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton variant="danger" onClick={() => onReject(request)}>Rejeter</AdminButton>
              <AdminButton variant="primary" onClick={() => onApprove(request)}>Approuver</AdminButton>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
