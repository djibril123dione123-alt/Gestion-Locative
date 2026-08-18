const DISMISSED_KEY = 'sk_install_prompt_dismissed';
const SNOOZE_KEY = 'sk_install_prompt_snooze_until';

export function markInstallPromptDismissed(): void {
    try {
        localStorage.setItem(DISMISSED_KEY, 'true');
        localStorage.removeItem(SNOOZE_KEY);
    } catch {
        // Ignorer en mode privé
    }
}

export function snoozeInstallPrompt(days = 7): void {
    try {
        const snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
        localStorage.setItem(SNOOZE_KEY, String(snoozeUntil));
    } catch {
        // Ignorer
    }
}

export function clearInstallPromptState(): void {
    try {
        localStorage.removeItem(DISMISSED_KEY);
        localStorage.removeItem(SNOOZE_KEY);
    } catch {
        // Ignorer
    }
}

export function shouldShowInstallPrompt(): boolean {
    try {
        if (localStorage.getItem(DISMISSED_KEY) === 'true') {
            return false;
        }

        const snoozeTime = localStorage.getItem(SNOOZE_KEY);
        if (snoozeTime) {
            if (Date.now() < Number(snoozeTime)) {
                return false;
            } else {
                // Snooze expiré
                localStorage.removeItem(SNOOZE_KEY);
            }
        }
        return true;
    } catch {
        return true; // Par défaut, on montre si on ne peut pas lire
    }
}
