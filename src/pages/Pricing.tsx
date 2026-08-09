import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
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
          <a href="#/" aria-label="Accueil Samay Këur" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
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
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {profile ? 'Mon abonnement' : 'Se connecter'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-emerald-950 px-4 py-14 text-white sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <img
            src="/brand/marketing/landing-documents.jpg"
            alt="Gestion locative et documents professionnels Samay Këur"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-emerald-950/88" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-300">Tarifs Samay Këur</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl lg:text-[3.35rem]">
                Le bon plan pour professionnaliser votre gestion locative.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                Centralisez patrimoine, loyers, impayés, documents et rapports. Choisissez une capacité adaptée à votre portefeuille, sans renoncer au socle métier essentiel.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#plans"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-400 px-5 py-2.5 text-sm font-black text-emerald-950 transition hover:bg-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Comparer les plans
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => openPricingConversation('Bonjour, je souhaite une démonstration de Samay Këur.')}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
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
                  'Capacités alignées sur les limites appliquées',
                  'Changement de plan sans suppression de données',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-100/70">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Les activations manuelles restent soumises à validation du support.
              </p>
            </div>
          </div>
        </section>

        <PricingSections
          plans={PRICING_PLAN_DEFINITIONS}
          onSelectPlan={handlePlanSelection}
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
