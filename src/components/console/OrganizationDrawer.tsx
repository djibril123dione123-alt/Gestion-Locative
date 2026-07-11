import { CalendarDays, CreditCard, FileText, ShieldAlert, Users, X } from 'lucide-react';
import { getAdminPlan } from '../../lib/admin/adminPricingCatalog';
import { formatAdminCurrency, formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import { computeOrganizationHealth } from '../../lib/admin/adminRiskScoring';
import { AdminButton, AdminMetricCard, AdminPanel, AdminStatusBadge } from './AdminPrimitives';
import type { AdminAgency, AdminSubscription, AdminUser, SubscriptionPaymentProof } from '../../services/admin/adminConsoleService';

export function OrganizationDrawer({
  agency,
  users,
  subscriptions,
  proofs,
  onClose,
  onChangeStatus,
  onChangePlan,
  onExtendTrial,
  onDelete,
}: {
  agency: AdminAgency | null;
  users: AdminUser[];
  subscriptions: AdminSubscription[];
  proofs: SubscriptionPaymentProof[];
  onClose: () => void;
  onChangeStatus: (agency: AdminAgency, nextStatus: 'active' | 'suspended') => void;
  onChangePlan: (agency: AdminAgency, subscription: AdminSubscription | undefined, plan: string) => void;
  onExtendTrial: (agency: AdminAgency, days: number) => void;
  onDelete: (agency: AdminAgency) => void;
}) {
  if (!agency) return null;
  const activeSub = subscriptions[0];
  const plan = getAdminPlan(activeSub?.plan_id ?? agency.plan);
  const health = computeOrganizationHealth(agency, activeSub, proofs);
  const typeLabel = agency.is_bailleur_account || agency.organization_type === 'individual_landlord'
    ? 'Bailleur individuel'
    : agency.organization_type === 'property_manager'
      ? 'Gestionnaire'
      : 'Agence immobilière';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer la fiche organisation" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-[#f7f3ea] p-3 shadow-2xl sm:p-4">
        <div className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-slate-200 bg-[#f7f3ea]/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:-mt-4 sm:px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <AdminStatusBadge status={agency.status} />
                <AdminStatusBadge tone={health.level === 'healthy' ? 'emerald' : health.level === 'watch' ? 'amber' : 'red'}>{health.label}</AdminStatusBadge>
                <AdminStatusBadge tone="slate">{typeLabel}</AdminStatusBadge>
              </div>
              <h2 className="truncate text-xl font-black text-slate-950">{agency.name}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Créée {formatAdminDate(agency.created_at)} · Dernière activité {formatAdminDate(agency.derniere_activite)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard label="Score santé" value={`${health.score}/100`} icon={ShieldAlert} tone={health.level === 'healthy' ? 'emerald' : 'amber'} />
          <AdminMetricCard label="Plan" value={plan.name} helper={plan.priceLabel} icon={CreditCard} tone="orange" />
          <AdminMetricCard label="Utilisateurs" value={agency.nb_users ?? users.length} icon={Users} />
          <AdminMetricCard label="Documents" value={agency.total_documents ?? 0} icon={FileText} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <AdminPanel title="Résumé opérationnel" subtitle="Identité, contact et signaux de santé.">
            <div className="grid gap-2 text-sm">
              {[
                ['Type', typeLabel],
                ['Email', textValue(agency.email)],
                ['Téléphone', textValue(agency.phone)],
                ['Statut', agency.status ?? 'active'],
                ['Plan actif', plan.name],
                ['Renouvellement / essai', formatAdminDate(activeSub?.current_period_end ?? agency.trial_ends_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
                  <span className="text-right font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Risques détectés" subtitle="Signaux à traiter avant friction client.">
            <div className="space-y-2">
              {health.reasons.map((reason) => (
                <div key={reason} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                  {reason}
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminPanel title="Abonnement & paiements" subtitle="Plan, preuves manuelles et volumes." action={<AdminStatusBadge status={activeSub?.status ?? agency.status} />}>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.11em] text-slate-500">MRR estimé</p>
                <p className="mt-1 text-lg font-black text-slate-950">{formatAdminCurrency(plan.price_xof)}</p>
              </div>
              {proofs.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">Aucune preuve manuelle liée à cette organisation.</p>
              ) : proofs.slice(0, 4).map((proof) => (
                <div key={proof.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">{formatAdminCurrency(proof.amount)} · {proof.method}</p>
                    <p className="text-xs font-semibold text-slate-500">{proof.reference ?? 'Référence non renseignée'}</p>
                  </div>
                  <AdminStatusBadge status={proof.status} />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Utilisateurs rattachés" subtitle="Admins, agents et comptes actifs.">
            <div className="space-y-2">
              {users.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">Aucun utilisateur rattaché détecté.</p>
              ) : users.slice(0, 6).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{`${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
                  </div>
                  <AdminStatusBadge status={user.actif === false ? 'suspended' : 'active'}>{user.role}</AdminStatusBadge>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="Actions sensibles" subtitle="Audit strict obligatoire avant mutation." className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {['starter', 'pro', 'business', 'enterprise'].map((planId) => (
              <AdminButton key={planId} disabled={plan.id === planId} onClick={() => onChangePlan(agency, activeSub, planId)}>
                Plan {getAdminPlan(planId).name}
              </AdminButton>
            ))}
            <AdminButton onClick={() => onExtendTrial(agency, 14)}>
              <CalendarDays className="h-3.5 w-3.5" />
              +14 jours
            </AdminButton>
            <AdminButton variant={agency.status === 'suspended' ? 'primary' : 'danger'} onClick={() => onChangeStatus(agency, agency.status === 'suspended' ? 'active' : 'suspended')}>
              {agency.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
            </AdminButton>
            <AdminButton variant="danger" onClick={() => onDelete(agency)}>
              Supprimer
            </AdminButton>
          </div>
        </AdminPanel>
      </aside>
    </div>
  );
}
