import React, { useEffect, useState } from 'react';
import { Clock, Zap, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function TrialBanner() {
  const { profile } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrialInfo();
  }, [profile?.agency_id]);

  const loadTrialInfo = async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    try {
      const { data: agency, error } = await supabase
        .from('agencies')
        .select('trial_ends_at, status, plan')
        .eq('id', profile.agency_id)
        .single();

      if (error) throw error;

      if (agency && agency.trial_ends_at && agency.status === 'trial') {
        const trialEnd = new Date(agency.trial_ends_at);
        const now = new Date();
        const diffTime = trialEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        setDaysLeft(diffDays);
        setIsExpired(diffDays <= 0);
      } else {
        setDaysLeft(null);
      }
    } catch (error) {
      console.error('Error loading trial info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || daysLeft === null || isDismissed) {
    return null;
  }

  if (isExpired) {
    return (
      <div className="bg-red-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900">
                  Votre essai gratuit a expiré
                </p>
                <p className="text-xs text-red-700">
                  Passez au plan Pro pour continuer à utiliser toutes les fonctionnalités
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {}}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold whitespace-nowrap"
              >
                Passer au plan Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getColorScheme = () => {
    if (daysLeft <= 3) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-500',
        text: 'text-red-900',
        subtext: 'text-red-700',
        button: 'bg-red-600 hover:bg-red-700',
      };
    } else if (daysLeft <= 7) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        iconBg: 'bg-orange-500',
        text: 'text-orange-900',
        subtext: 'text-orange-700',
        button: 'bg-orange-600 hover:bg-orange-700',
      };
    } else {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-500',
        text: 'text-blue-900',
        subtext: 'text-blue-700',
        button: 'bg-blue-600 hover:bg-blue-700',
      };
    }
  };

  const colors = getColorScheme();

  return (
    <div className={`${colors.bg} border-b ${colors.border}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`flex-shrink-0 w-8 h-8 ${colors.iconBg} rounded-full flex items-center justify-center`}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${colors.text}`}>
                Essai Pro gratuit - {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
              </p>
              <p className={`text-xs ${colors.subtext}`}>
                Profitez de toutes les fonctionnalités sans limite
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className={`px-4 py-2 ${colors.button} text-white rounded-lg transition-colors text-sm font-semibold whitespace-nowrap`}
            >
              Passer au plan Pro
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className={`p-2 rounded-lg ${colors.subtext} hover:bg-black/5 transition-colors`}
              title="Masquer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
