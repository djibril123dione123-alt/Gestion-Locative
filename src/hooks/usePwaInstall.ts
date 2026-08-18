import { useState, useEffect, useCallback } from 'react';

// Étend l'interface Window pour TypeScript
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
        appinstalled: Event;
    }
    interface Navigator {
        standalone?: boolean;
    }
}

export type PlatformType = 'ios' | 'android' | 'desktop' | 'unknown';
export type BrowserType = 'safari' | 'chrome' | 'edge' | 'firefox' | 'unknown';

export function usePwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [platform, setPlatform] = useState<PlatformType>('unknown');
    const [browser, setBrowser] = useState<BrowserType>('unknown');

    useEffect(() => {
        // Détection de l'installation (Standalone mode)
        const checkStandalone = () => {
            const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = window.navigator.standalone === true;
            setIsInstalled(isStandaloneMedia || isIOSStandalone);
        };
        checkStandalone();

        // Écouter les changements de display-mode
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => {
            setIsInstalled(e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);

        // Détection basique OS/Navigateur
        const ua = navigator.userAgent.toLowerCase();
        
        // Plateforme
        if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
        else if (/android/.test(ua)) setPlatform('android');
        else setPlatform('desktop');

        // Navigateur (simplifiée)
        if (ua.includes('edg/')) setBrowser('edge');
        else if (ua.includes('chrome') && !ua.includes('edg/')) setBrowser('chrome');
        else if (ua.includes('safari') && !ua.includes('chrome')) setBrowser('safari');
        else if (ua.includes('firefox')) setBrowser('firefox');

        // Capture du prompt natif d'installation
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Capture de l'événement d'installation réussie
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            console.log('[PWA] Application installée avec succès');
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const triggerPrompt = useCallback(async () => {
        if (!deferredPrompt) return false;
        
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        
        setDeferredPrompt(null); // On ne peut l'utiliser qu'une fois
        return outcome === 'accepted';
    }, [deferredPrompt]);

    return {
        isInstalled,
        canPrompt: deferredPrompt !== null,
        triggerPrompt,
        platform,
        browser,
    };
}
