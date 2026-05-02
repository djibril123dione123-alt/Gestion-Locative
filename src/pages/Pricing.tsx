import { useState } from 'react';
import { CheckCircle2, X, Zap, Building2, Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CheckoutModal } from '../components/billing/CheckoutModal';

interface Plan {
  id: 'basic' | 'pro' | 'enterprise';
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  icon: typeof Zap;
  color: string;
  badge?: string;
  features: string[];
  limits: { users: string; immeubles: string; unites: string };
  cta: string;
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Essai gratuit',
    price: 0,
    priceLabel: 'Gratuit',
    description: '14 jours pour découvrir la plateforme sans engagement.',
    icon: Zap,
    color: 'slate',
    features: [
      'Tableau de bord complet',
      'Jusqu\'à 3 immeubles',
      'Jusqu\'à 10 unités',
      '1 utilisateur',
      'Exports PDF et Excel',
      'Support par email',
    ],
    limits: { users: '1 utilisateur', immeubles: '3 immeubles', unites: '10 unités' },
    cta: 'Commencer gratuitement',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15000,
    priceLabel: '15 000 XOF',
    description: 'Tout ce dont vous avez besoin pour gérer votre activité locative.',
    icon: Building2,
    color: 'orange',
    badge: 'Le plus populaire',
    features: [
      'Immeubles et unités illimités',
      'Utilisateurs illimités',
      'Notifications bailleurs automatiques',
      'Rapports mensuels PDF bailleurs',
      'Rappels locataires automatiques',
      'Alertes impayés agents',
      'Exports Excel avancés',
      'Gestion des commissions',
      'Paiement Orange Money',
      'Support prioritaire',
    ],
    limits: { users: 'Illimité', immeubles: 'Illimité', unites: 'Illimité' },
    cta: 'Activer le plan Pro',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    priceLabel: 'Sur devis',
    description: 'Pour les grands portefeuilles et les réseaux d\'agences.',
    icon: Crown,
    color: 'purple',
    features: [
      'Tout le plan Pro',
      'White-label (votre marque)',
      'API dédiée',
      'Intégration comptabilité',
      'SLA garanti 99.9%',
      'Account manager dédié',
      'Formation sur site',
      'Facturation personnalisée',
    ],
    limits: { users: 'Illimité', immeubles: 'Illimité', unites: 'Illimité' },
    cta: 'Contacter l\'équipe',
    highlighted: false,
  },
];

const COLOR_MAP: Record<string, { card: string; badge: string; cta: string; icon: string; check: string }> = {
  slate: {
    card: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    cta: 'bg-slate-900 hover:bg-slate-800 text-white',
    icon: 'bg-slate-100 text-slate-600',
    check: 'text-slate-500',
  },
  orange: {
    card: 'border-orange-400 ring-2 ring-orange-400 ring-offset-2',
    badge: 'bg-orange-500 text-white',
    cta: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-200',
    icon: 'bg-orange-100 text-orange-600',
    check: 'text-orange-500',
  },
  purple: {
    card: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    cta: 'bg-purple-600 hover:bg-purple-700 text-white',
    icon: 'bg-purple-100 text-purple-600',
    check: 'text-purple-500',
  },
};

interface PricingProps {
  embedded?: boolean;
  onNavigate?: (page: string) => void;
}

export function Pricing({ embedded = false, onNavigate }: PricingProps) {
  const { profile } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  const handleCta = (plan: Plan) => {
    if (plan.id === 'basic') {
      if (profile) {
        onNavigate?.('dashboard');
      } else {
        onNavigate?.('auth');
      }
      return;
    }
    if (plan.id === 'enterprise') {
      window.open('mailto:contact@samaykeur.sn?subject=Enterprise%20%E2%80%94%20Demande%20de%20devis', '_blank');
      return;
    }
    setCheckoutPlan(plan);
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50'} py-12 px-4`}>
      {!embedded && (
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Zap className="w-4 h-4" />
            Essai gratuit 14 jours — Aucune carte requise
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Gérez vos locations,<br />
            <span className="bg-gradient-to-r from-orange-500 to-orange-700 bg-clip-text text-transparent">
              payez ce que vous utilisez
            </span>
          </h1>
          <p className="text-xl text-slate-600">
            Une plateforme complète pour les agences immobilières d'Afrique francophone.
            Paiement via Orange Money. Aucune carte bancaire.
          </p>
        </div>
      )}

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const colors = COLOR_MAP[plan.color];
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col gap-5 transition-shadow hover:shadow-xl ${colors.card} ${plan.highlighted ? 'md:-mt-4 md:pb-10' : ''}`}
            >
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
                  {plan.badge}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className={`p-3 rounded-xl ${colors.icon}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="text-slate-500 text-sm mt-1">{plan.description}</p>
              </div>

              <div>
                <span className="text-3xl font-bold text-slate-900">{plan.priceLabel}</span>
                {plan.price > 0 && <span className="text-slate-500 text-sm ml-1">/ mois</span>}
              </div>

              <div className="flex flex-wrap gap-2 py-3 border-y border-slate-100">
                {Object.values(plan.limits).map((l, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{l}</span>
                ))}
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.check}`} />
                    <span className="text-sm text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(plan)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${colors.cta}`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {!embedded && (
        <div className="max-w-3xl mx-auto mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Questions fréquentes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            {[
              { q: 'Comment fonctionne le paiement ?', r: 'Vous payez directement via Orange Money depuis l\'application. Aucune carte bancaire requise. Le plan est activé instantanément après confirmation.' },
              { q: 'Mes données sont-elles sécurisées ?', r: 'Oui. Toutes les données sont chiffrées et stockées en Europe. Chaque agence est isolée (multi-tenant). Vous pouvez exporter vos données à tout moment.' },
              { q: 'Que se passe-t-il à la fin de l\'essai ?', r: 'À la fin des 14 jours, vous pouvez activer le plan Pro pour continuer. Vos données sont conservées pendant 30 jours supplémentaires.' },
              { q: 'Y a-t-il un contrat d\'engagement ?', r: 'Non. Le plan Pro est mensuel, sans engagement. Vous pouvez annuler à tout moment depuis votre espace abonnement.' },
            ].map(({ q, r }) => (
              <div key={q} className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="font-semibold text-slate-900 mb-2">{q}</p>
                <p className="text-sm text-slate-600">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkoutPlan && (
        <CheckoutModal
          isOpen
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan.id}
          planName={checkoutPlan.name}
          priceXof={checkoutPlan.price}
          onSuccess={() => {
            setCheckoutPlan(null);
            onNavigate?.('abonnement');
          }}
        />
      )}
    </div>
  );
}
