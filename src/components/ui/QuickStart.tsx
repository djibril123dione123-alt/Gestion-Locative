import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, X, Building2, Users, Home, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ElementType;
  action?: () => void;
}

interface QuickStartProps {
  onNavigate?: (page: string) => void;
}

export function QuickStart({ onNavigate }: QuickStartProps) {
  const { profile } = useAuth();
  const [steps, setSteps] = useState<QuickStartStep[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();

    const dismissed = localStorage.getItem('quickstart_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, [profile?.agency_id]);

  const loadProgress = async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    try {
      const [
        { count: bailleursCount },
        { count: immeublesCount },
        { count: unitesCount },
        { count: locatairesCount },
        { count: contratsCount },
      ] = await Promise.all([
        supabase.from('bailleurs').select('*', { count: 'exact', head: true }).eq('agency_id', profile.agency_id),
        supabase.from('immeubles').select('*', { count: 'exact', head: true }).eq('agency_id', profile.agency_id),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('agency_id', profile.agency_id),
        supabase.from('locataires').select('*', { count: 'exact', head: true }).eq('agency_id', profile.agency_id),
        supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('agency_id', profile.agency_id),
      ]);

      const newSteps: QuickStartStep[] = [
        {
          id: 'bailleur',
          title: 'Ajouter un bailleur',
          description: 'Enregistrez votre premier propriétaire',
          completed: (bailleursCount || 0) > 0,
          icon: Users,
          action: () => onNavigate?.('bailleurs'),
        },
        {
          id: 'immeuble',
          title: 'Ajouter un immeuble',
          description: 'Créez votre premier bien immobilier',
          completed: (immeublesCount || 0) > 0,
          icon: Building2,
          action: () => onNavigate?.('immeubles'),
        },
        {
          id: 'unite',
          title: 'Créer une unité',
          description: 'Ajoutez un appartement ou local',
          completed: (unitesCount || 0) > 0,
          icon: Home,
          action: () => onNavigate?.('unites'),
        },
        {
          id: 'locataire',
          title: 'Enregistrer un locataire',
          description: 'Ajoutez votre premier locataire',
          completed: (locatairesCount || 0) > 0,
          icon: Users,
          action: () => onNavigate?.('locataires'),
        },
        {
          id: 'contrat',
          title: 'Créer un contrat',
          description: 'Générez votre premier contrat de location',
          completed: (contratsCount || 0) > 0,
          icon: FileText,
          action: () => onNavigate?.('contrats'),
        },
      ];

      setSteps(newSteps);

      const allCompleted = newSteps.every(step => step.completed);
      if (allCompleted) {
        setIsDismissed(true);
        localStorage.setItem('quickstart_dismissed', 'true');
      }
    } catch (error) {
      console.error('Error loading quick start progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('quickstart_dismissed', 'true');
  };

  if (loading || isDismissed) {
    return null;
  }

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progress = (completedCount / totalCount) * 100;

  if (isCollapsed) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all">
        <div onClick={() => setIsCollapsed(false)} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">Guide de démarrage</p>
              <p className="text-white/80 text-sm">{completedCount}/{totalCount} étapes complétées</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Démarrage rapide</h3>
            <p className="text-white/90 text-sm">
              Configurez votre plateforme en quelques étapes simples
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            title="Masquer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-white/90 text-sm mb-2">
            <span>Progression</span>
            <span className="font-semibold">{completedCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={step.action}
                disabled={step.completed}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all ${
                  step.completed
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-slate-50 border border-slate-200 hover:bg-orange-50 hover:border-orange-200'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  step.completed
                    ? 'bg-green-500'
                    : 'bg-slate-200'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-semibold ${
                    step.completed ? 'text-green-900 line-through' : 'text-slate-900'
                  }`}>
                    {step.title}
                  </p>
                  <p className={`text-sm ${
                    step.completed ? 'text-green-700' : 'text-slate-600'
                  }`}>
                    {step.description}
                  </p>
                </div>
                {!step.completed && (
                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {completedCount === totalCount && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
            <p className="text-green-900 font-semibold text-center">
              🎉 Félicitations ! Vous avez terminé la configuration initiale
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
