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
