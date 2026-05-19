import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, Smartphone, TrendingUp, Menu, X, CheckCircle } from 'lucide-react';

// Composants internes simples pour éviter les erreurs d'import externes
const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105";
  const variants = {
    primary: "bg-emerald-900 text-white hover:bg-emerald-800 shadow-lg hover:shadow-emerald-900/30",
    outline: "border-2 border-emerald-900 text-emerald-900 hover:bg-emerald-50",
    gold: "bg-amber-600 text-white hover:bg-amber-700 shadow-lg hover:shadow-amber-600/30"
  };
  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="text-center mb-16">
    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{title}</h2>
    {subtitle && <p className="text-lg text-slate-600 max-w-2xl mx-auto">{subtitle}</p>}
    <div className="w-24 h-1 bg-amber-500 mx-auto mt-6 rounded-full"></div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, description }: any) => (
  <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition-shadow duration-300 border border-slate-100">
    <div className="w-14 h-14 bg-emerald-50 rounded-lg flex items-center justify-center mb-6 text-emerald-900">
      <Icon size={32} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-emerald-900" />
              <span className="text-2xl font-bold text-slate-900">Samay Këur</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-emerald-900 font-medium">Fonctionnalités</a>
              <a href="#security" className="text-slate-600 hover:text-emerald-900 font-medium">Sécurité</a>
              <a href="#pricing" className="text-slate-600 hover:text-emerald-900 font-medium">Tarifs</a>
              <Button onClick={() => navigate('/login')} variant="primary">Connexion</Button>
            </div>

            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t p-4 space-y-4">
            <a href="#features" className="block text-slate-600">Fonctionnalités</a>
            <a href="#security" className="block text-slate-600">Sécurité</a>
            <Button onClick={() => navigate('/login')} className="w-full">Connexion</Button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            L'Infrastructure Immobilière <br/>
            <span className="text-amber-400">de Confiance en Afrique</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
            Gérez vos biens, sécurisez vos revenus et automatisez votre gestion locative avec une plateforme professionnelle conçue pour l'exigence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate('/signup')} variant="gold" className="text-lg px-8 py-4">
              Commencer l'essai gratuit
            </Button>
            <Button onClick={() => window.open('https://samaykeur.com', '_blank')} variant="outline" className="text-lg px-8 py-4 border-white text-white hover:bg-white/10">
              Voir la démo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle 
            title="Une Suite Complète de Gestion" 
            subtitle="Tout ce dont vous avez besoin pour gérer votre patrimoine immobilier avec précision et sérénité."
          />
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={TrendingUp}
              title="Gestion Financière"
              description="Suivi rigoureux des paiements, ledger immuable, rapprochement bancaire automatique et reporting financier en temps réel."
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Sécurité & Conformité"
              description="Documents vérifiables par QR Code, archivage légal, permissions granulaires et conformité aux standards locaux."
            />
            <FeatureCard 
              icon={Smartphone}
              title="Mobile First & Offline"
              description="Travaillez partout, même sans connexion. Synchronisation automatique dès le retour en ligne."
            />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-12">Pourquoi les professionnels nous font confiance</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { label: "Biens gérés", value: "500+" },
              { label: "Paiements traités", value: "10k+" },
              { label: "Disponibilité", value: "99.9%" },
              { label: "Support", value: "24/7" }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="text-4xl font-bold text-emerald-900 mb-2">{stat.value}</div>
                <div className="text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-emerald-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-6">Prêt à moderniser votre gestion ?</h2>
          <p className="text-xl text-emerald-100 mb-10">Rejoignez les agences et propriétaires qui ont choisi l'excellence opérationnelle.</p>
          <Button onClick={() => navigate('/signup')} variant="gold" className="text-lg px-10 py-4">
            Créer mon compte gratuit
          </Button>
        </div>
      </section>

      {/* Footer Simple */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <p>&copy; 2026 Samay Këur. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
