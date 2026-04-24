import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { UserPlus, Mail, Copy, Check, Shield, Users as UsersIcon } from 'lucide-react';

interface Member {
  id: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  role: string;
  actif: boolean;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

type RoleOption = 'admin' | 'agent' | 'comptable';

export function Equipe() {
  const { profile } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{ email: string; role: RoleOption }>({
    email: '',
    role: 'agent',
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, nom, prenom, email, role, actif, created_at')
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('invitations')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);
      if (membersRes.data) setMembers(membersRes.data as Member[]);
      if (invitationsRes.data) setInvitations(invitationsRes.data as Invitation[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) loadData();
  }, [profile?.agency_id, loadData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    if (!formData.email.trim()) {
      toast.warning('Veuillez saisir un email');
      return;
    }
    setSubmitting(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('invitations').insert({
        email: formData.email.trim().toLowerCase(),
        agency_id: profile.agency_id,
        role: formData.role,
        token,
        invited_by: profile.id,
        expires_at: expiresAt,
        status: 'pending',
      });
      if (error) throw error;
      const link = `${window.location.origin}/?token=${token}`;
      setGeneratedLink(link);
      toast.success('Invitation créée. Copiez le lien pour l\'envoyer.');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'invitation';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Lien copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ email: '', role: 'agent' });
    setGeneratedLink(null);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ actif: false })
        .eq('id', deactivateTarget.id);
      if (error) throw error;
      toast.success('Membre désactivé');
      setDeactivateTarget(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setDeactivating(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Shield}
          title="Accès réservé"
          description="Seuls les administrateurs peuvent gérer l'équipe."
        />
      </div>
    );
  }

  const memberColumns = [
    {
      key: 'nom',
      label: 'Membre',
      render: (m: Member) => (
        <div>
          <p className="font-medium text-slate-900">{m.prenom ?? ''} {m.nom ?? ''}</p>
          <p className="text-xs text-slate-500">{m.email ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (m: Member) => (
        <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 capitalize">
          {m.role}
        </span>
      ),
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (m: Member) => (
        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${m.actif ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {m.actif ? 'Actif' : 'Désactivé'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Ajouté le',
      render: (m: Member) => new Date(m.created_at).toLocaleDateString('fr-FR'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (m: Member) =>
        m.actif && m.id !== profile.id ? (
          <button
            type="button"
            onClick={() => setDeactivateTarget(m)}
            data-testid={`button-deactivate-${m.id}`}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Désactiver
          </button>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
          <p className="text-sm text-slate-600 mt-1">Gérez les membres de votre agence</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          data-testid="button-invite-member"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90"
          style={{ backgroundColor: '#F58220' }}
        >
          <UserPlus className="w-5 h-5" />
          Inviter un collaborateur
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Membres actuels ({members.length})</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500">Chargement…</div>
        ) : members.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Aucun membre" description="Invitez vos premiers collaborateurs." />
        ) : (
          <Table data={members} columns={memberColumns} />
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Mail className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Invitations en attente ({invitations.length})</h2>
        </div>
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Aucune invitation en attente</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((inv) => {
              const link = `${window.location.origin}/?token=${inv.token}`;
              return (
                <li key={inv.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900" data-testid={`text-invitation-email-${inv.id}`}>{inv.email}</p>
                    <p className="text-xs text-slate-500">
                      Rôle : <span className="capitalize font-medium">{inv.role}</span> · Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(link)}
                    data-testid={`button-copy-${inv.id}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                  >
                    <Copy className="w-4 h-4" /> Copier le lien
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Inviter un collaborateur">
        {generatedLink ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Invitation créée. Envoyez ce lien à votre collaborateur pour qu'il rejoigne l'agence :
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={generatedLink}
                data-testid="input-invite-link"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50"
              />
              <button
                type="button"
                onClick={() => copyLink(generatedLink)}
                data-testid="button-copy-generated"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: '#F58220' }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-invite-email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as RoleOption })}
                data-testid="select-invite-role"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="agent">Agent</option>
                <option value="comptable">Comptable</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="button-submit-invitation"
                className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#F58220' }}
              >
                {submitting ? 'Création…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title="Désactiver ce membre ?"
        message={`${deactivateTarget?.prenom ?? ''} ${deactivateTarget?.nom ?? ''} ne pourra plus accéder à l'agence.`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deactivating}
      />
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
