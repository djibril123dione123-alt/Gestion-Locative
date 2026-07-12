import { CheckCircle2 } from 'lucide-react';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
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
  const name = request.organization_name ?? request.agency_name ?? 'Organisation a creer';
  const email = request.requester_email ?? request.email ?? '';
  const plan = getAdminPlan(request.requested_plan ?? request.plan);
  const duplicates = agencies.filter((agency) => {
    const sameName = agency.name?.toLowerCase().trim() === name.toLowerCase().trim();
    const sameEmail = email && agency.email?.toLowerCase().trim() === email.toLowerCase().trim();
    return sameName || sameEmail;
  });

  return (
    <PremiumDrawerShell
      open={!!request}
      onClose={onClose}
      size="standard"
      density="compact"
      desktopMode="floating"
      desktopAt="lg"
      className="h-full lg:!w-full"
      eyebrow={<AdminStatusBadge status={request.status} />}
      title={name}
      description={`Demande reçue ${formatAdminDate(request.created_at)}`}
    >
      <div className="grid gap-3">
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
    </PremiumDrawerShell>
  );
}
