import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, MoreVertical, PlusSquare, Share, Home } from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { markInstallPromptDismissed, snoozeInstallPrompt } from '../../services/installPromptStorage';

interface InstallSamayKeurGuideProps {
    isOpen: boolean;
    onClose: () => void;
    // Callback utile si on veut par ex tracker l'événement d'installation dans Analytics
    onInstallSuccess?: () => void;
}

export function InstallSamayKeurGuide({ isOpen, onClose, onInstallSuccess }: InstallSamayKeurGuideProps) {
    const { platform, canPrompt, triggerPrompt, isInstalled } = usePwaInstall();

    // Si le modal est ouvert mais qu'entre temps l'app a été installée, on le ferme
    useEffect(() => {
        if (isOpen && isInstalled) {
            onClose();
            if (onInstallSuccess) onInstallSuccess();
        }
    }, [isInstalled, isOpen, onClose, onInstallSuccess]);

    // Fermeture avec Echap
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || isInstalled) return null;

    const handleDismiss = () => {
        markInstallPromptDismissed();
        onClose();
    };

    const handleSnooze = () => {
        snoozeInstallPrompt(7); // Plus tard (7 jours)
        onClose();
    };

    const handleNativeInstall = async () => {
        const accepted = await triggerPrompt();
        if (accepted) {
            if (onInstallSuccess) onInstallSuccess();
            onClose();
        }
    };

    // --- RENDUS SPÉCIFIQUES ---

    const renderNativePrompt = () => (
        <div className="flex flex-col gap-5 text-center mt-2">
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
                {platform === 'desktop' 
                    ? "Accédez à Samay Këur directement depuis votre ordinateur, comme une véritable application de bureau." 
                    : "Ajoutez Samay Këur à votre écran d'accueil pour y accéder plus rapidement, comme une application native."}
            </p>
            <button
                onClick={handleNativeInstall}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 shadow-lg shadow-brand-900/40 transition-colors"
            >
                <Download className="w-5 h-5" />
                Installer Samay Këur
            </button>
            <div className="flex items-center justify-center gap-4 mt-2">
                <button onClick={handleSnooze} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                    Plus tard
                </button>
                <span className="text-slate-700">•</span>
                <button onClick={handleDismiss} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                    Ne plus afficher
                </button>
            </div>
        </div>
    );

    const renderIosSafariGuide = () => (
        <div className="flex flex-col gap-6 mt-4">
            <p className="text-sm text-slate-300 text-center leading-relaxed">
                Ajoutez Samay Këur à votre écran d'accueil pour une expérience plein écran.
            </p>
            
            <div className="flex flex-col gap-3">
                <div className="flex items-start gap-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-brand-900/50 flex items-center justify-center text-brand-400 border border-brand-500/20">
                        <Share className="w-4 h-4" />
                    </div>
                    <div>
                        <strong className="block text-sm font-bold text-white mb-0.5">1. Menu Partager</strong>
                        <p className="text-xs text-slate-400">Appuyez sur l'icône Partager située en bas de votre écran.</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-brand-900/50 flex items-center justify-center text-brand-400 border border-brand-500/20">
                        <PlusSquare className="w-4 h-4" />
                    </div>
                    <div>
                        <strong className="block text-sm font-bold text-white mb-0.5">2. Écran d'accueil</strong>
                        <p className="text-xs text-slate-400">Faites défiler vers le bas et sélectionnez "Sur l'écran d'accueil".</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-brand-900/50 flex items-center justify-center text-brand-400 border border-brand-500/20">
                        <span className="font-bold text-xs">AJ</span>
                    </div>
                    <div>
                        <strong className="block text-sm font-bold text-white mb-0.5">3. Confirmez</strong>
                        <p className="text-xs text-slate-400">Appuyez enfin sur "Ajouter" en haut à droite.</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-2">
                <button onClick={handleDismiss} className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-2">
                    Ne plus afficher
                </button>
                <button onClick={onClose} className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-6 transition-colors">
                    J'ai compris
                </button>
            </div>
        </div>
    );

    const renderAndroidManualGuide = () => (
        <div className="flex flex-col gap-6 mt-4">
            <p className="text-sm text-slate-300 text-center leading-relaxed">
                Votre navigateur nécessite une installation manuelle.
            </p>
            
            <div className="flex flex-col gap-3">
                <div className="flex items-start gap-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-brand-900/50 flex items-center justify-center text-brand-400 border border-brand-500/20">
                        <MoreVertical className="w-4 h-4" />
                    </div>
                    <div>
                        <strong className="block text-sm font-bold text-white mb-0.5">1. Menu principal</strong>
                        <p className="text-xs text-slate-400">Ouvrez le menu du navigateur (les 3 points en haut à droite).</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-brand-900/50 flex items-center justify-center text-brand-400 border border-brand-500/20">
                        <Home className="w-4 h-4" />
                    </div>
                    <div>
                        <strong className="block text-sm font-bold text-white mb-0.5">2. Installer</strong>
                        <p className="text-xs text-slate-400">Appuyez sur "Installer l'application" ou "Ajouter à l'écran d'accueil".</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-2">
                <button onClick={handleDismiss} className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-2">
                    Ne plus afficher
                </button>
                <button onClick={onClose} className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-6 transition-colors">
                    J'ai compris
                </button>
            </div>
        </div>
    );

    // Détermination de ce qu'on affiche
    let contentToRender;
    if (canPrompt) {
        contentToRender = renderNativePrompt();
    } else if (platform === 'ios') {
        contentToRender = renderIosSafariGuide();
    } else if (platform === 'android') {
        contentToRender = renderAndroidManualGuide();
    } else {
        // Fallback Desktop manuel
        contentToRender = renderAndroidManualGuide(); 
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="install-title">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                    onClick={onClose}
                />
                
                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="relative w-full max-w-[440px] bg-[#0A1612] border border-slate-800 rounded-[28px] p-6 shadow-2xl overflow-hidden"
                >
                    {/* Decorative Top Accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-50" />

                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                        aria-label="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center mb-6 mt-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-900 to-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg mb-5">
                            <BrandMark size="md" tone="light" />
                        </div>
                        <h2 id="install-title" className="text-2xl font-black text-white text-center font-display tracking-tight">
                            Installer Samay Këur
                        </h2>
                    </div>

                    {contentToRender}

                </motion.div>
            </div>
        </AnimatePresence>
    );
}
