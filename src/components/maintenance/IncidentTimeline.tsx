import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { Incident } from '../../types/maintenance';
import { WizardShell } from '../ui/WizardShell';
import { formatCurrency, formatInternationalPhone } from '../../lib/formatters';
import { Wrench, MapPin, Calendar, Clock, AlertTriangle, CheckCircle2, ChevronRight, Phone, FileText, FileCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface IncidentTimelineProps {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function IncidentTimeline({ incident, isOpen, onClose, onUpdate }: IncidentTimelineProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!incident) return null;

  const updateStatus = async (newStatus: Incident['statut']) => {
    setSubmitting(true);
    try {
      const payload: Partial<Incident> = { statut: newStatus };
      if (newStatus === 'en_cours') payload.started_at = new Date().toISOString();
      if (newStatus === 'resolu') payload.resolved_at = new Date().toISOString();
      if (newStatus === 'annule') payload.resolved_at = new Date().toISOString();

      const { error } = await supabase.from('interventions').update(payload).eq('id', incident.id);
      if (error) throw error;
      toast.success('Statut mis à jour');
      onUpdate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const approveQuote = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('interventions').update({
        approval_status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        statut: 'autorise'
      }).eq('id', incident.id);
      if (error) throw error;
      toast.success('Devis approuvé');
      onUpdate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const generateExpense = () => {
    const cost = incident.final_cost || incident.approved_cost || incident.cout_estime || '';
    const desc = incident.reference ? `Règlement suite incident ${incident.reference} - ${incident.titre}` : `Règlement incident - ${incident.titre}`;
    const bienId = incident.immeuble_id || '';
    toast.info('Redirection vers la création de dépense...');
    window.location.href = `/depenses?action=create&montant=${cost}&description=${encodeURIComponent(desc)}&bienId=${bienId}`;
  };

  const statusMap: Record<Incident['statut'], { label: string, color: string }> = {
    signale: { label: 'Signalé', color: 'bg-slate-100 text-slate-800' },
    a_qualifier: { label: 'À qualifier', color: 'bg-amber-100 text-amber-800' },
    planifie: { label: 'Planifié', color: 'bg-blue-100 text-blue-800' },
    devis_a_valider: { label: 'Devis à valider', color: 'bg-purple-100 text-purple-800' },
    autorise: { label: 'Autorisé', color: 'bg-emerald-100 text-emerald-800' },
    en_cours: { label: 'En cours', color: 'bg-orange-100 text-orange-800' },
    resolu: { label: 'Résolu', color: 'bg-green-100 text-green-800' },
    annule: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
  };

  return (
    <WizardShell
      open={isOpen}
      onClose={onClose}
      size="large"
      variant="classic"
      title={`Incident ${incident.reference || 'N/A'}`}
      description={incident.titre}
      primaryAction={
        incident.statut !== 'resolu' && incident.statut !== 'annule' ? (
          <button
            type="button"
            onClick={() => updateStatus('resolu')}
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
          >
            Marquer comme résolu
          </button>
        ) : incident.statut === 'resolu' ? (
           <button
            type="button"
            onClick={generateExpense}
            className="rounded-xl bg-blue-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
          >
            Générer une dépense
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne de gauche: Détails */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusMap[incident.statut].color}`}>
                {statusMap[incident.statut].label}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Créé le {format(parseISO(incident.date_demande), 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>

            <h3 className="font-bold text-slate-800 text-lg mb-2">{incident.titre}</h3>
            {incident.description && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{incident.description}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              {incident.immeubles?.nom && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Localisation</p>
                    <p className="text-sm font-medium text-slate-800">
                      {incident.immeubles.nom}
                      {incident.unites?.nom ? ` - ${incident.unites.nom}` : ''}
                    </p>
                  </div>
                </div>
              )}
              {incident.categorie && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500">Catégorie</p>
                  <p className="text-sm font-medium text-slate-800 capitalize">{incident.categorie}</p>
                </div>
              )}
            </div>
          </div>

          {/* Prestataire & Finances */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-600" />
              Intervention & Prestataire
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Prestataire</p>
                {incident.prestataire_nom ? (
                  <div className="text-sm font-medium text-slate-800">
                    <p>{incident.prestataire_nom}</p>
                    {incident.prestataire_telephone && (
                      <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatInternationalPhone(incident.prestataire_telephone)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Non assigné</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Coûts</p>
                <div className="space-y-1 text-sm font-medium">
                  {incident.cout_estime && (
                    <p className="flex justify-between text-slate-600">
                      <span>Estimé:</span> <span>{formatCurrency(incident.cout_estime)}</span>
                    </p>
                  )}
                  {incident.approved_cost && (
                    <p className="flex justify-between text-emerald-600 font-bold">
                      <span>Approuvé:</span> <span>{formatCurrency(incident.approved_cost)}</span>
                    </p>
                  )}
                  {incident.final_cost && (
                    <p className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-1 mt-1">
                      <span>Final:</span> <span>{formatCurrency(incident.final_cost)}</span>
                    </p>
                  )}
                  {!incident.cout_estime && !incident.approved_cost && !incident.final_cost && (
                    <p className="text-slate-400 italic">Aucun coût défini</p>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Bailleur Workflow */}
            {incident.approval_required && (
              <div className="mt-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">Validation requise</p>
                      <p className="text-[10px] text-amber-700">Le devis nécessite l'accord du bailleur ou de l'administrateur.</p>
                    </div>
                  </div>
                  {incident.approval_status === 'pending' && (
                    <button
                      type="button"
                      onClick={approveQuote}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition"
                    >
                      Approuver
                    </button>
                  )}
                  {incident.approval_status === 'approved' && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approuvé
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colonne de droite: Workflow Actions & Timeline */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-3 text-sm">Changer le statut</h4>
            <div className="flex flex-col gap-2">
              {(['signale', 'a_qualifier', 'devis_a_valider', 'autorise', 'en_cours', 'resolu', 'annule'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(s)}
                  disabled={incident.statut === s || submitting}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    incident.statut === s 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700'
                  }`}
                >
                  {statusMap[s].label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Chronologie
            </h4>
            <div className="relative pl-3 border-l-2 border-slate-200 space-y-4">
              <div className="relative">
                <div className="absolute w-2 h-2 bg-slate-300 rounded-full -left-[17px] top-1.5" />
                <p className="text-xs font-bold text-slate-800">Signalement</p>
                <p className="text-[10px] text-slate-500">{format(parseISO(incident.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
              </div>
              
              {incident.approved_at && (
                <div className="relative">
                  <div className="absolute w-2 h-2 bg-amber-400 rounded-full -left-[17px] top-1.5" />
                  <p className="text-xs font-bold text-slate-800">Devis approuvé</p>
                  <p className="text-[10px] text-slate-500">{format(parseISO(incident.approved_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                </div>
              )}
              
              {incident.started_at && (
                <div className="relative">
                  <div className="absolute w-2 h-2 bg-blue-400 rounded-full -left-[17px] top-1.5" />
                  <p className="text-xs font-bold text-slate-800">Intervention débutée</p>
                  <p className="text-[10px] text-slate-500">{format(parseISO(incident.started_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                </div>
              )}
              
              {incident.resolved_at && (
                <div className="relative">
                  <div className="absolute w-2 h-2 bg-emerald-500 rounded-full -left-[17px] top-1.5" />
                  <p className="text-xs font-bold text-slate-800">{incident.statut === 'annule' ? 'Annulé' : 'Résolu'}</p>
                  <p className="text-[10px] text-slate-500">{format(parseISO(incident.resolved_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
