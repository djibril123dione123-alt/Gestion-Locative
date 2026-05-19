import React, { useState } from 'react';

// --- COMPOSANTS INTERNES (SVG directement dans le code pour éviter les imports manquants) ---

const IconBuilding = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/>
  </svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconPhone = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/>
  </svg>
);

const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
  </svg>
);

const IconMenu = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);

const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

// --- COMPOSANT PRINCIPAL ---

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Gestionnaire de clic sécurisé
  const handleNav = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    if (target.startsWith('#')) {
      const element = document.querySelector(target);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    } else if (target === '/login' || target === '/signup') {
      // Redirection simple si le router n'est pas dispo
      window.location.href = target;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* NAVIGATION */}
      <nav className="fixed w-full bg-white/95 backdrop-blur-sm z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => handleNav(e, '#')}>
              <div className="text-emerald-900"><IconBuilding /></div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">Samay Këur</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" onClick={(e) => handleNav(e, '#features')} className="text-slate-600 hover:text-emerald-900 font-medium transition-colors">Solutions</a>
              <a href="#security" onClick={(e) => handleNav(e, '#security')} className="text-slate-600 hover:text-emerald-900 font-medium transition-colors">Sécurité</a>
              <a href="#pricing" onClick={(e) => handleNav(e, '#pricing')} className="text-slate-600 hover:text-emerald-900 font-medium transition-colors">Tarifs</a>
              <button onClick={(e) => handleNav(e, '/login')} className="px-5 py-2.5 rounded-lg bg-emerald-900 text-white font-semibold hover:bg-emerald-800 transition-all shadow-md hover:shadow-lg">
                Connexion
              </button>
            </div>

            {/* Mobile Toggle */}
            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 absolute w-full shadow-xl">
            <div className="px-4 pt-2 pb-6 space-y-2">
              <a href="#features" onClick={(e) => handleNav(e, '#features')} className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50">Solutions</a>
              <a href="#security" onClick={(e) => handleNav(e, '#security')} className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50">Sécurité</a>
              <a href="#pricing" onClick={(e) => handleNav(e, '#pricing')} className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50">Tarifs</a>
              <button onClick={(e) => handleNav(e, '/login')} className="w-full mt-4 px-5 py-3 rounded-lg bg-emerald-900 text-white font-semibold">
                Connexion
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-900">
        {/* Background Decor */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900"></div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Nouvelle version 2.0 disponible
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight">
            L'Infrastructure Immobilière <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
              de Confiance en Afrique
            </span>
          </h1>
          
          <p className="mt-6 text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            Centralisez vos biens, sécurisez vos revenus et automatisez votre gestion locative. 
            La plateforme professionnelle conçue pour l'exigence des marchés africains.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={(e) => handleNav(e, '/signup')} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-500 text-slate-900 font-bold text-lg hover:bg-amber-400 transition-all shadow-lg hover:shadow-amber-500/25 transform hover:-translate-y-1">
              Commencer l'essai gratuit
            </button>
            <button onClick={(e) => handleNav(e, '#features')} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 text-white font-semibold text-lg hover:bg-white/20 transition-all border border-white/10 backdrop-blur-sm">
              Découvrir les fonctionnalités
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase">Fonctionnalités</h2>
            <p className="mt-2 text-4xl font-extrabold text-slate-900 tracking-tight">Tout pour gérer, rien à subir</p>
            <p className="mt-4 max-w-2xl text-xl text-slate-500 mx-auto">
              Une suite complète d'outils pour remplacer Excel, WhatsApp et les cahiers de recettes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Card 1 */}
            <div className="group relative bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 mb-6 group-hover:scale-110 transition-transform">
                <IconChart />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Finance & Comptabilité</h3>
              <p className="text-slate-600 leading-relaxed">
                Suivi rigoureux des paiements, grand livre immuable, rapprochement bancaire automatique et états financiers en temps réel.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 mb-6 group-hover:scale-110 transition-transform">
                <IconShield />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Sécurité & Conformité</h3>
              <p className="text-slate-600 leading-relaxed">
                Documents légaux générés automatiquement, vérifiables par QR Code, archivage cloud sécurisé et permissions granulaires.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 mb-6 group-hover:scale-110 transition-transform">
                <IconPhone />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Mobile & Offline</h3>
              <p className="text-slate-600 leading-relaxed">
                Travaillez sur le terrain sans connexion. Vos données se synchronisent automatiquement dès le retour en ligne.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS / TRUST */}
      <section className="py-20 bg-slate-900 text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-12">La confiance chiffrée</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Biens gérés", value: "500+" },
              { label: "Paiements/mois", value: "2,500+" },
              { label: "Disponibilité", value: "99.9%" },
              { label: "Données sécurisées", value: "100%" }
            ].map((stat, i) => (
              <div key={i} className="p-4">
                <div className="text-4xl md:text-5xl font-bold text-amber-400 mb-2">{stat.value}</div>
                <div className="text-slate-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">Prêt à professionnaliser votre gestion ?</h2>
          <p className="text-xl text-slate-600 mb-10">
            Rejoignez les agences et propriétaires qui ont choisi la stabilité et la modernité.
          </p>
          <button onClick={(e) => handleNav(e, '/signup')} className="px-10 py-5 rounded-xl bg-emerald-900 text-white font-bold text-lg hover:bg-emerald-800 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1">
            Créer mon compte gratuitement
          </button>
          <p className="mt-6 text-sm text-slate-500">Aucune carte de crédit requise • Annulable anytime</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500">
          <div className="flex items-center justify-center gap-2 mb-4 text-slate-900">
            <IconBuilding />
            <span className="font-bold text-xl">Samay Këur</span>
          </div>
          <p>&copy; 2026 Samay Këur. Tous droits réservés.</p>
          <p className="mt-2 text-sm">Dakar • Abidjan • Lomé</p>
        </div>
      </footer>
    </div>
  );
}
