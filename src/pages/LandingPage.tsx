import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, FileText, Users, TrendingUp, 
  Smartphone, CheckCircle2, Menu, X, ChevronRight, Lock, 
  Globe, Zap, BarChart3, Server, Download, QrCode, 
  ArrowRight, Play, Star
} from 'lucide-react';

// --- COMPOSANTS UI INTERNES (Pour éviter les dépendances externes) ---

const Button = ({ children, variant = 'primary', className = '', icon: Icon, ...props }: any) => {
  const baseStyle = "inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium transition-all duration-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-lg shadow-emerald-900/20 border border-transparent focus:ring-emerald-500",
    secondary: "bg-slate-900/50 hover:bg-slate-800/50 text-emerald-50 border border-emerald-500/30 backdrop-blur-sm focus:ring-emerald-500",
    outline: "bg-transparent hover:bg-emerald-950/30 text-emerald-100 border border-emerald-500/30 focus:ring-emerald-500",
    gold: "bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 hover:from-amber-100 hover:to-amber-300 text-emerald-950 shadow-lg shadow-amber-900/20 border border-amber-200/50"
  };

  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
      {Icon && <Icon className="ml-2 w-4 h-4" />}
    </button>
  );
};

const SectionHeading = ({ badge, title, subtitle, align = 'center' }: any) => (
  <div className={`mb-16 ${align === 'center' ? 'text-center' : 'text-left'} max-w-4xl mx-auto`}>
    {badge && (
      <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-emerald-300 uppercase bg-emerald-950/50 border border-emerald-500/20 rounded-full">
        {badge}
      </span>
    )}
    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
      {title}
    </h2>
    <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
      {subtitle}
    </p>
  </div>
);

const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
  <div className="group relative p-8 bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 rounded-2xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/10 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <div className="w-14 h-14 mb-6 rounded-xl bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-7 h-7 text-emerald-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  </div>
);

// --- SECTIONS PRINCIPALES ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Solution', href: '#solution' },
    { name: 'Fonctionnalités', href: '#features' },
    { name: 'Sécurité', href: '#security' },
    { name: 'Tarifs', href: '#pricing' },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/80 backdrop-blur-md border-b border-slate-800 py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Samay <span className="text-emerald-400">Këur</span></span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors">
                {link.name}
              </a>
            ))}
            <Button variant="primary" className="!py-2 !px-4 !text-xs">
              Connexion
            </Button>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-slate-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-slate-950 border-b border-slate-800 p-4 flex flex-col space-y-4 shadow-2xl">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-base font-medium text-slate-300 hover:text-emerald-400 py-2" onClick={() => setMobileMenuOpen(false)}>
              {link.name}
            </a>
          ))}
          <Button variant="primary" className="w-full justify-center">Connexion</Button>
        </div>
      )}
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-slate-950">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Nouvelle Génération Proptech
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            L'Infrastructure de <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-200">
              Confiance Immobilière
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-xl leading-relaxed">
            Passez du chaos administratif à la maîtrise totale. La première plateforme SaaS conçue pour les agences et bailleurs exigeants d'Afrique francophone.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button variant="gold" icon={ArrowRight}>
              Démarrer l'essai gratuit
            </Button>
            <Button variant="secondary" icon={Play}>
              Voir la démo
            </Button>
          </div>

          <div className="pt-8 flex items-center space-x-6 text-sm text-slate-500">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sans engagement</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Setup en 5 min</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Support local</span>
            </div>
          </div>
        </div>

        {/* Hero Visual / Dashboard Preview */}
        <div className="relative lg:h-[600px] w-full hidden lg:block perspective-1000">
          <div className="relative w-full h-full transform rotate-y-[-12deg] rotate-x-[5deg] transition-transform duration-700 hover:rotate-y-0 hover:rotate-x-0">
            {/* Main Dashboard Card */}
            <div className="absolute inset-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center px-6 space-x-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                </div>
                <div className="h-2 w-64 bg-slate-800 rounded-full ml-4" />
              </div>
              {/* Body */}
              <div className="flex-1 p-6 grid grid-cols-3 gap-6 bg-slate-900/50">
                {/* Sidebar */}
                <div className="col-span-1 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-10 bg-slate-800/50 rounded-lg w-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                {/* Content */}
                <div className="col-span-2 space-y-6">
                  <div className="flex justify-between">
                    <div className="h-8 w-32 bg-slate-800 rounded-lg" />
                    <div className="h-8 w-24 bg-emerald-900/30 border border-emerald-500/20 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-800/30 border border-slate-700 rounded-xl p-4">
                      <div className="h-2 w-12 bg-slate-700 rounded mb-4" />
                      <div className="h-8 w-24 bg-emerald-500/20 rounded" />
                    </div>
                    <div className="h-32 bg-slate-800/30 border border-slate-700 rounded-xl p-4">
                      <div className="h-2 w-12 bg-slate-700 rounded mb-4" />
                      <div className="h-8 w-24 bg-amber-500/20 rounded" />
                    </div>
                  </div>
                  <div className="h-40 bg-slate-800/30 border border-slate-700 rounded-xl mt-6 relative overflow-hidden">
                     <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-emerald-900/20 to-transparent" />
                     <div className="flex items-end justify-around h-full p-4 pb-0">
                        {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                          <div key={i} className="w-8 bg-emerald-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                        ))}
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -right-12 top-20 w-64 bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-2xl animate-bounce-slow">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Paiement Reçu</div>
                  <div className="text-sm font-bold text-white">250.000 FCFA</div>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-full bg-green-500" />
              </div>
            </div>

            <div className="absolute -left-8 bottom-32 w-56 bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-2xl animate-bounce-slow-delayed">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Contrat Signé</span>
                <QrCode className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-semibold text-white">Appartement V.I.P</div>
              <div className="text-xs text-slate-500 mt-1">Dakar, Plateau</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const TrustLogos = () => (
  <section className="py-10 border-y border-slate-800 bg-slate-950/50">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <p className="text-sm font-medium text-slate-500 mb-8 uppercase tracking-widest">Ils nous font confiance pour gérer leur patrimoine</p>
      <div className="flex flex-wrap justify-center items-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
        {['Wave', 'Orange Money', 'Djamo', 'CBAO', 'BICIS'].map((brand) => (
          <div key={brand} className="text-xl font-bold text-slate-300 flex items-center space-x-2">
            <Building2 className="w-6 h-6" />
            <span>{brand}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ProblemSolution = () => (
  <section id="solution" className="py-24 bg-slate-950 relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading 
        badge="Transformation"
        title="De l'artisanal à l'industriel"
        subtitle="L'immobilier africain change. Les outils doivent suivre. Samay Këur remplace vos fichiers Excel et vos chats WhatsApp par une infrastructure robuste."
      />

      <div className="grid md:grid-cols-2 gap-12 mt-16">
        {/* Before */}
        <div className="relative p-8 rounded-3xl bg-red-950/10 border border-red-900/30">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <X className="w-32 h-32 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-red-400 mb-6 flex items-center">
            <span className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center mr-3 text-sm">Avant</span>
            La gestion actuelle
          </h3>
          <ul className="space-y-4">
            {[
              'Paiements en cash non tracés',
              'Quittances manuelles sur Word',
              'Relances oubliées sur WhatsApp',
              'Données dispersées sur plusieurs téléphones',
              'Impossible de savoir qui doit quoi',
              'Risque élevé de fraude interne'
            ].map((item, i) => (
              <li key={i} className="flex items-start text-slate-400">
                <X className="w-5 h-5 text-red-500/50 mr-3 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* After */}
        <div className="relative p-8 rounded-3xl bg-emerald-950/20 border border-emerald-500/20 shadow-2xl shadow-emerald-900/10">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 className="w-32 h-32 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-400 mb-6 flex items-center">
            <span className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center mr-3 text-sm">Avec Samay Këur</span>
            L'excellence opérationnelle
          </h3>
          <ul className="space-y-4">
            {[
              'Encaissements Mobile Money & Cash tracés',
              'Génération automatique de quittances PDF',
              'Relances automatiques SMS & Email',
              'Centralisation cloud sécurisée (Offline-first)',
              'Tableau de bord financier en temps réel',
              'Audit trail complet et permissions rôles'
            ].map((item, i) => (
              <li key={i} className="flex items-start text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const FeaturesGrid = () => {
  const features = [
    {
      icon: FileText,
      title: "GED Documentaire Avancée",
      description: "Stockage, versioning et génération automatique de contrats, quittances et états des lieux. Vérification par QR Code."
    },
    {
      icon: Zap,
      title: "Paiements Hybrides",
      description: "Intégration native Wave, Orange Money, FMoney et suivi rigoureux du cash. Rapprochement bancaire automatique."
    },
    {
      icon: Smartphone,
      title: "Mode Offline-First",
      description: "Travaillez sans internet. Vos données se synchronisent automatiquement dès la reconnexion. Idéal pour le terrain."
    },
    {
      icon: Users,
      title: "Gestion Multi-Agences",
      description: "Architecture multi-tenant stricte. Gérez plusieurs agences, équipes et portefeuilles depuis un seul compte maître."
    },
    {
      icon: ShieldCheck,
      title: "Sécurité Bancaire",
      description: "Chiffrement des données, Row Level Security (RLS), backups quotidiens et journal d'audit complet de toutes les actions."
    },
    {
      icon: BarChart3,
      title: "Reporting Financier",
      description: "Suivi du taux d'occupation, recouvrement, churn locataire et prévisions de trésorerie. Export comptable simplifié."
    }
  ];

  return (
    <section id="features" className="py-24 bg-slate-950 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <SectionHeading 
          badge="Fonctionnalités"
          title="Une suite complète pour professionnels"
          subtitle="Tout ce dont vous avez besoin pour gérer, louer et entretenir votre patrimoine immobilier avec précision."
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

const SecuritySection = () => (
  <section id="security" className="py-24 bg-slate-900 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-900/5 blur-3xl" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="text-emerald-400 font-semibold tracking-wider uppercase text-sm">Confiance & Souveraineté</span>
          <h2 className="text-4xl font-bold text-white mt-4 mb-6">Vos données sont votre actif le plus précieux.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Nous avons conçu Samay Këur avec une architecture de sécurité de niveau enterprise. Chaque agence est isolée, chaque action est tracée, chaque donnée est sauvegardée.
          </p>
          
          <div className="space-y-6">
            {[
              { title: "Isolation Stricte", desc: "Row Level Security (RLS) assure qu'aucune agence ne peut voir les données d'une autre." },
              { title: "Traçabilité Totale", desc: "Qui a fait quoi et quand ? L'historique complet des modifications est conservé indéfiniment." },
              { title: "Backup Automatisé", desc: "Sauvegardes incrémentales toutes les heures. Restauration possible à n'importe quel point dans le temps." }
            ].map((item, i) => (
              <div key={i} className="flex space-x-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-emerald-950 border border-emerald-500/20 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">{item.title}</h4>
                  <p className="text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-amber-500 blur-2xl opacity-20 rounded-full" />
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <span className="text-xl font-bold text-white">Certification Sécurité</span>
              </div>
              <span className="px-3 py-1 bg-emerald-900/30 text-emerald-400 text-xs rounded-full border border-emerald-500/20">Niveau Enterprise</span>
            </div>
            
            <div className="space-y-4">
              {[
                "Chiffrement AES-256 au repos",
                "Transmission TLS 1.3",
                "Authentification 2FA disponible",
                "Hébergement redondant",
                "Conformité RGPD & Lois locales"
              ].map((check, i) => (
                <div key={i} className="flex items-center space-x-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>{check}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-800 flex justify-between items-center">
              <span className="text-sm text-slate-500">Dernier audit : Il y a 2 jours</span>
              <span className="text-emerald-400 font-mono text-sm">STATUT: SÉCURISÉ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Pricing = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-24 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading 
          badge="Offres Flexibles"
          title="Investissez dans la sérénité"
          subtitle="Des plans adaptés à la taille de votre portefeuille, sans frais cachés."
        />

        <div className="flex justify-center mb-16">
          <div className="bg-slate-900 p-1 rounded-xl inline-flex border border-slate-800">
            <button 
              onClick={() => setAnnual(false)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Mensuel
            </button>
            <button 
              onClick={() => setAnnual(true)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${annual ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Annuel <span className="ml-1 text-xs opacity-80">(-20%)</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Starter */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex flex-col hover:border-slate-600 transition-colors">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Starter</h3>
              <p className="text-slate-400 text-sm mt-2">Pour les petits bailleurs</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{annual ? '15.000' : '18.000'}</span>
              <span className="text-slate-500"> FCFA / mois</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Jusqu\'à 10 logements', 'Gestion locataires', 'Quittances PDF', 'Support email'].map((feat, i) => (
                <li key={i} className="flex items-center text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-slate-500 mr-3" /> {feat}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full">Commencer</Button>
          </div>

          {/* Pro - Highlighted */}
          <div className="relative bg-slate-900 border border-emerald-500/50 rounded-2xl p-8 flex flex-col shadow-2xl shadow-emerald-900/20 transform md:-scale-105 z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-amber-500 text-slate-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              Le plus populaire
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Agence Pro</h3>
              <p className="text-slate-400 text-sm mt-2">Pour les gestionnaires actifs</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{annual ? '45.000' : '55.000'}</span>
              <span className="text-slate-500"> FCFA / mois</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Jusqu\'à 50 logements', 'Paiements Mobile Money', 'Relances automatiques', 'GED Illimitée', 'Multi-utilisateurs (3)', 'Tableau de bord avancé'].map((feat, i) => (
                <li key={i} className="flex items-center text-white text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-3" /> {feat}
                </li>
              ))}
            </ul>
            <Button variant="gold" className="w-full">Essai Gratuit 14j</Button>
          </div>

          {/* Enterprise */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex flex-col hover:border-slate-600 transition-colors">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Entreprise</h3>
              <p className="text-slate-400 text-sm mt-2">Grands portefeuilles</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">Sur mesure</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Logements illimités', 'API dédiée', 'SSO & Permissions avancées', 'Account Manager dédié', 'Formation équipe', 'SLA Garanti'].map((feat, i) => (
                <li key={i} className="flex items-center text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-slate-500 mr-3" /> {feat}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full">Contactez-nous</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  
  const faqs = [
    { q: "Mes données sont-elles vraiment sécurisées ?", a: "Absolument. Nous utilisons le même niveau de sécurité que les banques (chiffrement AES-256, SSL/TLS). Chaque agence est isolée techniquement et vos données sont sauvegardées quotidiennement sur des serveurs redondants." },
    { q: "Que se passe-t-il si je n'ai pas internet ? ", a: "Samay Këur fonctionne en mode 'Offline-First'. Vous pouvez consulter vos dossiers, créer des quittances et enregistrer des paiements sans connexion. Tout se synchronisera automatiquement dès que vous retrouverez du réseau." },
    { q: "Puis-je importer mes données depuis Excel ? ", a: "Oui, nous proposons un outil d'importation guidée pour reprendre vos locataires, immeubles et historiques de paiement depuis vos fichiers Excel existants en quelques clics." },
    { q: "Comment fonctionnent les paiements Mobile Money ? ", a: "Nous sommes intégrés nativement avec Wave, Orange Money et FMoney. Vous recevez les fonds directement sur votre compte marchand, et le système rapproche automatiquement le paiement avec le bon locataire." }
  ];

  return (
    <section className="py-24 bg-slate-950 border-t border-slate-900">
      <div className="max-w-3xl mx-auto px-4">
        <SectionHeading title="Questions Fréquentes" subtitle="Tout ce que vous devez savoir avant de vous lancer." />
        
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-slate-900/50 transition-colors"
              >
                <span className="font-medium text-slate-200">{faq.q}</span>
                <ChevronRight className={`w-5 h-5 text-slate-500 transition-transform ${openIndex === i ? 'rotate-90' : ''}`} />
              </button>
              <div className={`px-6 overflow-hidden transition-all duration-300 ${openIndex === i ? 'max-h-40 pb-6' : 'max-h-0'}`}>
                <p className="text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-slate-950 border-t border-slate-900 pt-16 pb-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Samay <span className="text-emerald-400">Këur</span></span>
          </div>
          <p className="text-slate-400 max-w-sm mb-6">
            La première infrastructure numérique de confiance pour l'immobilier en Afrique francophone. Simplifiez, sécurisez,规模化.
          </p>
          <div className="flex space-x-4">
            {/* Social placeholders */}
            {[1, 2, 3].map(i => (
              <div key={i} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-emerald-500/50 hover:text-emerald-400 transition-colors cursor-pointer text-slate-400">
                <Globe className="w-5 h-5" />
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-white font-semibold mb-6">Produit</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Fonctionnalités</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Sécurité</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Tarifs</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Mises à jour</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-semibold mb-6">Entreprise</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-emerald-400 transition-colors">À propos</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Mentions légales</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Confidentialité</a></li>
          </ul>
        </div>
      </div>
      
      <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
        <p>&copy; 2024 Samay Këur. Tous droits réservés.</p>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <span>Fait avec ❤️ à Dakar</span>
        </div>
      </div>
    </div>
  </footer>
);

// --- COMPOSANT PRINCIPAL ---

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar />
      <main>
        <Hero />
        <TrustLogos />
        <ProblemSolution />
        <FeaturesGrid />
        <SecuritySection />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
      
      {/* Styles globaux pour animations personnalisées si non présents dans tailwind.config */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
        .animate-bounce-slow-delayed {
          animation: bounce-slow 4s infinite ease-in-out 1s;
        }
      `}</style>
    </div>
  );
}
