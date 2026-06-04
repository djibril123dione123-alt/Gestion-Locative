import { supabase } from '../../lib/supabase';

function getOnboardingKey(agencyId: string) {
  return `sk_onboarding_completed_${agencyId}`;
}

export function getTimezoneKey(agencyId: string) {
  return `sk_agency_timezone_${agencyId}`;
}

export function markOnboardingComplete(agencyId: string) {
  try {
    localStorage.setItem(getOnboardingKey(agencyId), 'true');
  } catch {
    /* noop */
  }
}

export function hasCompletedOnboarding(agencyId: string) {
  try {
    return localStorage.getItem(getOnboardingKey(agencyId)) === 'true';
  } catch {
    return false;
  }
}

export type OnboardingCompletionStatus = {
  completed: boolean;
  source: 'database' | 'local-fallback';
  error?: string;
};

export async function getOnboardingCompletionStatus(agencyId: string): Promise<OnboardingCompletionStatus> {
  try {
    const { data, error } = await supabase
      .from('agency_settings')
      .select('onboarding_completed_at')
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (error) throw error;

    const completed = Boolean(data?.onboarding_completed_at);
    if (completed) {
      markOnboardingComplete(agencyId);
    }
    return { completed, source: 'database' };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('onboarding_completed_at') || message.includes('column')) {
      return {
        completed: false,
        source: 'database',
        error: error instanceof Error ? error.message : 'Colonne onboarding indisponible',
      };
    }

    return {
      completed: hasCompletedOnboarding(agencyId),
      source: 'local-fallback',
      error: error instanceof Error ? error.message : 'Lecture onboarding indisponible',
    };
  }
}

export async function markOnboardingCompletePersisted(agencyId: string, completedAt = new Date().toISOString()) {
  const { error } = await supabase
    .from('agency_settings')
    .upsert({
      agency_id: agencyId,
      onboarding_completed_at: completedAt,
    });

  if (error) throw error;
  markOnboardingComplete(agencyId);
  return completedAt;
}
