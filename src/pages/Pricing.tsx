import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import { BrandLogo } from '../components/brand/BrandLogo';
import { PricingSections } from '../components/pricing/PricingSections';
import { useAuth } from '../contexts/AuthContext';
import {
  CONTACT_WHATSAPP,
  PRICING_PLAN_DEFINITIONS,
  type PricingPlanDefinition,
} from '../lib/pricingCatalog';

interface PricingProps {
  embedded?: boolean;
  onNavigate?: (page: string) => void;
}

function openPricingConversation(message: string) {
  window.open(
    `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`,
    '_blank',
    'noopener,noreferrer',
  );
}

export function Pricing({ embedded = false, onNavigate }: PricingProps) {
  const { profile } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlanDefinition | null>(null);

  const handlePlanSelection = (plan: PricingPlanDefinition) => {
    if (plan.id === 'enterprise') {
      openPricingConversation('Bonjour, je souhaite dimensionner un plan Entreprise Samay Këur.');
      return;
    }

    if (!profile) {
      onNavigate?.('auth');
      return;
    }

    setCheckoutPlan(plan);
  };

  if (embedded) {
    return (
      <>
        <PricingSections
          plans={PRICING_PLAN_DEFINITIONS}
          onSelectPlan={handlePlanSelection}
          onStart={() => onNavigate?.(profile ? 'abonnement' : 'auth')}
          onRequestDemo={() => openPricingConversation('Bonjour, je souhaite une démonstration de Samay Këur.')}
          compact
        />
        {checkoutPlan && (
          <CheckoutModal
            isOpen
            onClose={() => setCheckoutPlan(null)}
            planId={checkoutPlan.id}
            planName={checkoutPlan.name}
            priceXof={checkoutPlan.price_xof}
            onSuccess={() => {
              setCheckoutPlan(null);
              onNavigate?.('abonnement');
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e7] text-slate-950">
      <header className="border-b border-white/10 bg-emerald-950 px-4 py-3 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#/" aria-label="Accueil Samay Këur" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne">
            <BrandLogo size="sm" tone="dark" showTagline />
          </a>
          <div className="flex items-center gap-2">
            <a
              href="#plans"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-emerald-50/80 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Voir les plans
            </a>
            <button
              type="button"
              onClick={() => onNavigate?.(profile ? 'abonnement' : 'auth')}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              {profile ? 'Mon abonnement' : 'Se connecter'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-emerald-950 px-4 py-11 text-white sm:px-6 sm:py-14 lg:px-8 lg:py-18">
          <img
            src="/brand/marketing/landing-payments.jpg"
            alt="Suivi professionnel des encaissements avec Samay Këur"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-emerald-950/90" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-champagne-100">Tarifs Samay Këur</p>
              <h1 className="mt-4 text-3xl font-black !leading-[1.08] text-white sm:text-4xl lg:text-[2.8rem]">
                Un plan adapté à votre façon de gérer.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-6 text-emerald-50/80 sm:text-lg sm:leading-7">
                Bailleur indépendant, gestionnaire ou agence : choisissez la capacité adaptée à votre portefeuille et à votre équipe, avec le même socle métier pour suivre loyers, impayés, documents et rapports.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#plans"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-champagne-300 to-champagne px-5 py-2.5 text-sm font-black text-emerald-950 shadow-premium transition hover:from-champagne-100 hover:to-champagne-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Comparer les plans
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => openPricingConversation('Bonjour, je souhaite une démonstration de Samay Këur.')}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-100"
                >
                  Demander une démonstration
                </button>
              </div>
            </div>

            <div className="border-l border-white/20 pl-5 lg:justify-self-end">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">Une offre lisible</p>
              <ul className="mt-4 space-y-3 text-sm text-emerald-50/85">
                {[
                  'Prix mensuels en F CFA',
                  'Socle métier commun à tous les plans',
                  'Plans adaptés au portefeuille et à l’équipe',
                  'Changement de plan sans suppression de données',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-champagne-100" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs font-semibold text-emerald-100/70">
                Votre plan peut évoluer avec votre portefeuille, sans recommencer votre organisation.
              </p>
            </div>
          </div>
        </section>

        <PricingSections
          plans={PRICING_PLAN_DEFINITIONS}
          onSelectPlan={handlePlanSelection}
          onStart={() => onNavigate?.(profile ? 'abonnement' : 'auth')}
          onRequestDemo={() => openPricingConversation('Bonjour, je souhaite une démonstration de Samay Këur.')}
        />
      </main>

      <footer className="border-t border-white/10 bg-emerald-950 px-4 py-6 text-emerald-50/70 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs sm:flex-row sm:items-center">
          <p>Samay Këur · Gestion locative professionnelle</p>
          <p>Les capacités Entreprise sont confirmées uniquement après étude et contractualisation.</p>
        </div>
      </footer>

      {checkoutPlan && (
        <CheckoutModal
          isOpen
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan.id}
          planName={checkoutPlan.name}
          priceXof={checkoutPlan.price_xof}
          onSuccess={() => {
            setCheckoutPlan(null);
            onNavigate?.('abonnement');
          }}
        />
      )}
    </div>
  );
}
