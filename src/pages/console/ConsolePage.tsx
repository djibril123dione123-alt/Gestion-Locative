import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, UserPlus } from 'lucide-react';
import {
  CreateConsoleAgencyWizard,
  InviteConsoleUserWizard,
} from '../../components/console/ConsoleCreationWizards';
import { ToastContainer } from '../../components/ui/Toast';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { AdminActionDialog, type AdminActionRequest } from '../../components/console/AdminActionDialog';
import { AdminGlobalSearch } from '../../components/console/AdminGlobalSearch';
import { AdminLoadingState } from '../../components/console/AdminPrimitives';
import { AgencyRequestReviewDrawer } from '../../components/console/AgencyRequestReviewDrawer';
import { OrganizationDrawer } from '../../components/console/OrganizationDrawer';
import { PaymentValidationDrawer } from '../../components/console/PaymentValidationDrawer';
import { UserAccessDrawer } from '../../components/console/UserAccessDrawer';
import { getConsoleRoute, getConsoleSpaceFromHash, type ConsoleSpace } from '../../lib/admin/adminNavigation';
import {
  approveAgencyRequest,
  approvePaymentProof,
  changeAgencyPlan,
  changeAgencyStatus,
  changeUserRole,
  changeUserStatus,
  createAdminNote,
  createMaintenanceAnnouncement,
  createSupportTicket,
  closeAgencyAccount,
  extendAgencyTrial,
  recordIncident,
  rejectAgencyRequest,
  rejectPaymentProof,
  resolveIncident,
  toggleFeatureFlag,
  updateSupportTicket,
} from '../../services/admin/adminActionsService';
import {
  loadAdminConsoleData,
  type AdminAgency,
  type AdminConsoleData,
  type AdminIncident,
  type AdminTicket,
  type AdminUser,
  type AgencyCreationRequest,
  type SubscriptionPaymentProof,
} from '../../services/admin/adminConsoleService';
import { BillingTab } from './tabs/BillingTab';
import { OrganizationsTab } from './tabs/OrganizationsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SupportOpsTab } from './tabs/SupportOpsTab';
import { SystemConfigTab } from './tabs/SystemConfigTab';
import { UsersAccessTab } from './tabs/UsersAccessTab';
import { ConsoleShell } from './ConsoleShell';

export function Console() {
  const { profile, signOut } = useAuth();
  const toast = useToast();
  const [space, setSpace] = useState<ConsoleSpace>(() => getConsoleSpaceFromHash(window.location.hash));
  const [data, setData] = useState<AdminConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AdminAgency | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AgencyCreationRequest | null>(null);
  const [selectedProof, setSelectedProof] = useState<SubscriptionPaymentProof | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<AdminActionRequest | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [createAgencyOpen, setCreateAgencyOpen] = useState(false);
  const [inviteUserOpen, setInviteUserOpen] = useState(false);

  const auditContext = useMemo(() => ({
    actorId: profile?.id ?? null,
    actorEmail: profile?.email ?? null,
  }), [profile?.email, profile?.id]);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'initial') setLoading(true);
    setRefreshing(true);
    try {
      const nextData = await loadAdminConsoleData();
      setData(nextData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement console impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const clearDetail = useCallback(() => {
    setSelectedAgency(null);
    setSelectedRequest(null);
    setSelectedProof(null);
    setSelectedUser(null);
  }, []);

  useEffect(() => {
    const handler = () => {
      const next = getConsoleSpaceFromHash(window.location.hash);
      setSpace((current) => {
        if (current !== next) clearDetail();
        return next;
      });
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [clearDetail]);

  const changeSpace = (next: ConsoleSpace) => {
    clearDetail();
    setCreateAgencyOpen(false);
    setInviteUserOpen(false);
    setSpace(next);
    window.history.replaceState(null, '', getConsoleRoute(next));
  };

  const selectAgency = (agency: AdminAgency | null) => {
    setSelectedRequest(null);
    setSelectedProof(null);
    setSelectedUser(null);
    setSelectedAgency(agency);
  };

  const selectRequest = (request: AgencyCreationRequest | null) => {
    setSelectedAgency(null);
    setSelectedProof(null);
    setSelectedUser(null);
    setSelectedRequest(request);
  };

  const selectProof = (proof: SubscriptionPaymentProof | null) => {
    setSelectedAgency(null);
    setSelectedRequest(null);
    setSelectedUser(null);
    setSelectedProof(proof);
  };

  const selectUser = (user: AdminUser | null) => {
    setSelectedAgency(null);
    setSelectedRequest(null);
    setSelectedProof(null);
    setSelectedUser(user);
  };

  const runAction = (request: AdminActionRequest) => setAction(request);
  const closeAction = () => {
    setAction(null);
    setActionBusy(false);
  };

  const withRefresh = async (fn: () => Promise<void>, success: string) => {
    await fn();
    toast.success(success);
    await load();
  };

  const openAgencyById = (agencyId: string | null | undefined) => {
    if (!agencyId || !data) return;
    const agency = data.agencies.find((item) => item.id === agencyId);
    if (agency) selectAgency(agency);
  };

  const openProofById = (proofId: string | null | undefined) => {
    if (!proofId || !data) return;
    const proof = data.proofs.find((item) => item.id === proofId);
    if (proof) selectProof(proof);
  };

  const handleUpdateTicket = (ticket: AdminTicket, status: string, note: string) => {
    runAction({
      title: status === 'resolved' ? 'Résoudre ce ticket support ?' : 'Mettre à jour ce ticket support ?',
      message: 'Le statut et la note interne seront enregistrés dans la console support.',
      confirmLabel: status === 'resolved' ? 'Résoudre le ticket' : 'Mettre à jour',
      onConfirm: (reason) => withRefresh(
        () => updateSupportTicket(ticket.id, status, note, reason, auditContext),
        'Ticket support mis à jour.',
      ),
    });
  };

  const handleRecordIncident = (payload: { type: string; severity: string; message: string; organizationId: string | null }) => {
    runAction({
      title: 'Enregistrer cet incident ?',
      message: 'L’incident sera visible dans le suivi opérationnel super-admin et l’audit.',
      confirmLabel: 'Enregistrer incident',
      destructive: payload.severity === 'critical' || payload.severity === 'blocking',
      onConfirm: (reason) => withRefresh(
        () => recordIncident(payload.type, payload.severity, payload.message, payload.organizationId, reason, auditContext),
        'Incident enregistré.',
      ),
    });
  };

  const handleResolveIncident = (incident: AdminIncident, resolution: string) => {
    runAction({
      title: 'Résoudre cet incident ?',
      message: 'La résolution sera conservée dans le suivi incident et l’audit.',
      confirmLabel: 'Marquer résolu',
      onConfirm: (reason) => withRefresh(
        () => resolveIncident(incident.id, resolution, reason, auditContext),
        'Incident résolu.',
      ),
    });
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe4] p-4">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-3 text-xl font-black text-slate-950">Accès super-admin requis</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Cette console pilote toute la plateforme Samay Këur et reste réservée aux propriétaires autorisés.
          </p>
        </div>
      </div>
    );
  }

  const selectedSubscriptions = data?.subscriptions.filter((sub) => sub.agency_id === selectedAgency?.id) ?? [];
  const selectedUsers = data?.users.filter((user) => user.agency_id === selectedAgency?.id) ?? [];
  const selectedProofs = data?.proofs.filter((proof) => proof.agency_id === selectedAgency?.id) ?? [];
  const selectedNotes = data?.notes.filter((note) => note.organization_id === selectedAgency?.id) ?? [];
  const selectedTickets = data?.tickets.filter((ticket) => ticket.organization_id === selectedAgency?.id) ?? [];
  const selectedIncidents = data?.incidents.filter((incident) => incident.organization_id === selectedAgency?.id) ?? [];
  const selectedDocuments = data?.documentRegistry.filter((document) => document.agency_id === selectedAgency?.id) ?? [];
  const selectedVerifications = data?.documentVerifications.filter((verification) => verification.agency_id === selectedAgency?.id) ?? [];
  const selectedMetrics = data?.organizationMetrics.find((metric) => metric.organization_id === selectedAgency?.id);
  const selectedAuditLogs = data?.auditLogs.filter((log) => log.target_organization_id === selectedAgency?.id) ?? [];

  const renderSpace = () => {
    if (!data || loading) return <AdminLoadingState />;
    if (space === 'overview') {
      return (
        <OverviewTab
          data={data}
          onOpenAgency={selectAgency}
          onOpenProof={openProofById}
          onNavigate={changeSpace}
        />
      );
    }
    if (space === 'organizations') return <OrganizationsTab data={data} onOpenAgency={selectAgency} selectedAgencyId={selectedAgency?.id ?? null} />;
    if (space === 'billing') {
      return (
        <BillingTab
          data={data}
          onOpenProof={selectProof}
          onOpenAgencyById={openAgencyById}
          selectedProofId={selectedProof?.id ?? null}
        />
      );
    }
    if (space === 'users-access') return <UsersAccessTab data={data} onOpenUser={selectUser} selectedUserId={selectedUser?.id ?? null} />;
    if (space === 'support-ops') {
      return (
        <SupportOpsTab
          data={data}
          onOpenRequest={selectRequest}
          selectedRequestId={selectedRequest?.id ?? null}
          onUpdateTicket={handleUpdateTicket}
          onCreateTicket={(payload) => runAction({
            title: 'Créer ce ticket support ?',
            message: 'Le ticket sera rattaché à l’organisation et suivi dans Support & opérations.',
            confirmLabel: 'Créer ticket',
            onConfirm: (reason) => withRefresh(
              () => createSupportTicket(payload.organizationId, payload.subject, payload.category, payload.priority, payload.description, reason, auditContext),
              'Ticket support créé.',
            ),
          })}
          onRecordIncident={handleRecordIncident}
          onResolveIncident={handleResolveIncident}
        />
      );
    }
    return (
      <SystemConfigTab
        data={data}
        onOpenAgencyById={openAgencyById}
        onToggleFlag={(flag, nextActive) => runAction({
          title: nextActive ? 'Activer cette fonctionnalité ?' : 'Désactiver cette fonctionnalité ?',
          message: 'La modification passe par la gouvernance des fonctionnalités et sera tracée avant mutation.',
          confirmLabel: nextActive ? 'Activer' : 'Désactiver',
          destructive: !nextActive,
          onConfirm: (reason) => withRefresh(() => toggleFeatureFlag(flag, nextActive, reason, auditContext), 'Fonctionnalité mise à jour.'),
        })}
        onCreateAnnouncement={(title, message, status) => runAction({
          title: 'Créer cette annonce plateforme ?',
          message: 'L’annonce sera enregistrée comme communication opérationnelle super-admin.',
          confirmLabel: 'Créer annonce',
          onConfirm: (reason) => withRefresh(
            () => createMaintenanceAnnouncement(title, message, status, reason, auditContext),
            'Annonce plateforme créée.',
          ),
        })}
      />
    );
  };

  const detailSlot = !data ? null : selectedAgency ? (
      <OrganizationDrawer
      agency={selectedAgency}
      users={selectedUsers}
      subscriptions={selectedSubscriptions}
      proofs={selectedProofs}
      notes={selectedNotes}
      tickets={selectedTickets}
      incidents={selectedIncidents}
      documents={selectedDocuments}
      verifications={selectedVerifications}
      metrics={selectedMetrics}
      auditLogs={selectedAuditLogs}
      onClose={() => setSelectedAgency(null)}
      onChangeStatus={(agency, nextStatus) => runAction({
        title: nextStatus === 'suspended' ? 'Suspendre cette organisation ?' : 'Réactiver cette organisation ?',
        message: "Cette action impacte l'accès client et sera tracée avant mutation.",
        confirmLabel: nextStatus === 'suspended' ? 'Suspendre' : 'Réactiver',
        destructive: nextStatus === 'suspended',
        onConfirm: (reason) => withRefresh(() => changeAgencyStatus(agency, nextStatus, reason, auditContext), 'Statut de l’organisation mis à jour.'),
      })}
      onChangePlan={(agency, subscription, plan) => runAction({
        title: `Changer le plan vers ${plan} ?`,
        message: "Le plan de l’organisation et l’abonnement actif seront alignés si une souscription existe.",
        confirmLabel: 'Changer le plan',
        onConfirm: (reason) => withRefresh(() => changeAgencyPlan(agency, subscription, plan, reason, auditContext), 'Plan de l’organisation mis à jour.'),
      })}
      onExtendTrial={(agency, days) => runAction({
        title: `Prolonger l'essai de ${days} jours ?`,
        message: "La période d’essai sera recalculée depuis aujourd’hui.",
        confirmLabel: 'Prolonger',
        onConfirm: (reason) => withRefresh(() => extendAgencyTrial(agency, days, reason, auditContext), 'Essai prolongé.'),
      })}
      onDelete={(agency) => runAction({
        title: 'Clôturer cette organisation ?',
        message: "Les accès seront révoqués et l'abonnement annulé. Les contrats, paiements, documents, snapshots et journaux financiers resteront conservés pour audit et restitution.",
        confirmLabel: "Clôturer l'organisation",
        destructive: true,
        requireText: agency.name,
        minReasonLength: 12,
        onConfirm: (reason) => withRefresh(() => closeAgencyAccount(agency, reason, auditContext), 'Organisation clôturée et accès révoqués.'),
      })}
      onCreateNote={(agency, note, visibility) => runAction({
        title: 'Ajouter cette note interne ?',
        message: 'La note sera rattachée à la fiche organisation et visible selon sa catégorie.',
        confirmLabel: 'Ajouter note',
        onConfirm: (reason) => withRefresh(
          () => createAdminNote(agency.id, note, visibility, reason, auditContext),
          'Note interne ajoutée.',
        ),
      })}
      onCreateTicket={(agency, subject, category, priority, description) => runAction({
        title: 'Créer ce ticket support ?',
        message: "Le ticket sera rattaché à l'organisation et suivi dans Support & opérations.",
        confirmLabel: 'Créer ticket',
        onConfirm: (reason) => withRefresh(
          () => createSupportTicket(agency.id, subject, category, priority, description, reason, auditContext),
          'Ticket support créé.',
        ),
      })}
    />
  ) : selectedRequest ? (
    <AgencyRequestReviewDrawer
      request={selectedRequest}
      agencies={data.agencies}
      onClose={() => setSelectedRequest(null)}
      onApprove={(request) => runAction({
        title: 'Approuver la demande ?',
        message: "L’approbation créera l’espace selon la logique serveur existante.",
        confirmLabel: 'Approuver',
        onConfirm: (reason) => withRefresh(() => approveAgencyRequest(request.id, reason, auditContext), 'Demande approuvée.'),
      })}
      onReject={(request) => runAction({
        title: 'Rejeter la demande ?',
        message: "Le motif sera transmis au service de rejet et conservé dans le journal d’audit.",
        confirmLabel: 'Rejeter',
        destructive: true,
        onConfirm: (reason) => withRefresh(() => rejectAgencyRequest(request.id, reason, auditContext), 'Demande rejetée.'),
      })}
    />
  ) : selectedProof ? (
    <PaymentValidationDrawer
      proof={selectedProof}
      onClose={() => setSelectedProof(null)}
      onApprove={(proof) => runAction({
        title: 'Valider cette preuve ?',
        message: "Le plan sera activé après mise à jour de la preuve, de l’abonnement et de l’organisation.",
        confirmLabel: 'Valider et activer',
        onConfirm: (reason) => withRefresh(() => approvePaymentProof(proof, reason, auditContext), 'Preuve validée et plan activé.'),
      })}
      onReject={(proof) => runAction({
        title: 'Rejeter cette preuve ?',
        message: 'Le plan ne sera pas activé. Le motif restera visible dans le suivi support.',
        confirmLabel: 'Rejeter la preuve',
        destructive: true,
        onConfirm: (reason) => withRefresh(() => rejectPaymentProof(proof, reason, auditContext), 'Preuve rejetée.'),
      })}
    />
  ) : selectedUser ? (
    <UserAccessDrawer
      user={selectedUser}
      users={data.users}
      onClose={() => setSelectedUser(null)}
      onChangeRole={(user, nextRole) => runAction({
        title: `Changer le rôle vers ${nextRole} ?`,
        message: 'Le rôle impacte les pages visibles et les capacités dans le tenant. Les garde-fous bloquent le retrait du dernier admin actif.',
        confirmLabel: 'Changer le rôle',
        destructive: user.role === 'admin' && nextRole !== 'admin',
        onConfirm: (reason) => withRefresh(() => changeUserRole(user, data.users, nextRole, reason, auditContext), 'Rôle utilisateur mis à jour.'),
      })}
      onChangeStatus={(user, nextActive) => runAction({
        title: nextActive ? 'Réactiver ce compte ?' : 'Désactiver ce compte ?',
        message: "Le profil est conservé. La désactivation bloque l'exploitation côté agence et reste auditée.",
        confirmLabel: nextActive ? 'Réactiver' : 'Désactiver',
        destructive: !nextActive,
        onConfirm: (reason) => withRefresh(() => changeUserStatus(user, data.users, nextActive, reason, auditContext), 'Statut utilisateur mis a jour.'),
      })}
    />
  ) : null;

  const primaryAction = space === 'organizations' ? (
    <PremiumButton
      variant="primary"
      size="sm"
      onClick={() => setCreateAgencyOpen(true)}
      icon={<Building2 className="h-3.5 w-3.5" />}
    >
      Nouvelle agence
    </PremiumButton>
  ) : space === 'users-access' ? (
    <PremiumButton
      variant="primary"
      size="sm"
      onClick={() => setInviteUserOpen(true)}
      icon={<UserPlus className="h-3.5 w-3.5" />}
    >
      Inviter
    </PremiumButton>
  ) : undefined;

  return (
    <>
      <ConsoleShell
        activeSpace={space}
        onSpaceChange={changeSpace}
        onRefresh={() => void load()}
        refreshing={refreshing}
        onSignOut={() => void signOut()}
        lastLoadedAt={data?.generatedAt}
        primaryAction={primaryAction}
        detailSlot={detailSlot}
        isDetailOpen={Boolean(detailSlot)}
        searchSlot={data ? (
          <AdminGlobalSearch
            data={data}
            onOpenAgency={selectAgency}
            onOpenProof={selectProof}
            onOpenRequest={selectRequest}
            onOpenUser={selectUser}
            onOpenAgencyById={openAgencyById}
            onChangeSpace={changeSpace}
          />
        ) : null}
      >
        {renderSpace()}
      </ConsoleShell>

      <CreateConsoleAgencyWizard
        open={createAgencyOpen}
        onClose={() => setCreateAgencyOpen(false)}
        onCreated={async () => {
          toast.success('Espace agence créé. Vous pouvez maintenant inviter son administrateur.');
          await load();
        }}
      />
      <InviteConsoleUserWizard
        open={inviteUserOpen}
        agencies={(data?.agencies ?? []).map((agency) => ({
          id: agency.id,
          name: agency.name,
          plan: agency.plan,
          status: agency.status,
        }))}
        onClose={() => setInviteUserOpen(false)}
        onInvited={async () => {
          toast.success('Invitation créée. Le lien est prêt à être partagé.');
          await load();
        }}
      />

      <AdminActionDialog
        action={action}
        busy={actionBusy}
        onClose={closeAction}
        onConfirm={async (reason) => {
          if (!action) return;
          setActionBusy(true);
          try {
            await action.onConfirm(reason);
            closeAction();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Action impossible.');
            setActionBusy(false);
          }
        }}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </>
  );
}

export default Console;
