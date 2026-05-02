import { useState } from 'react';
import {
  CheckCircle2, Zap, Building2, Crown, ArrowRight,
  Smartphone, Shield, Clock, HelpCircle, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CheckoutModal } from '../components/billing/CheckoutModal';

interface PlanDef {
  id: 'starter' | 'pro' | 'agence';
  name: string;
  price: number;
  priceLabel: string;
  tagline: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bgGradient: string;
  badge?: string;
  highlighted: boolean;
  features: string[];
  limits: { users: string; immeubles: string; unites: string };
  cta: string;
  ctaType: 'checkout' | 'contact' | 'register';
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9900,
    priceLabel: '9 900 XOF',
    tagline: '~15 €/mois',
    description: 'Idéal pour les petites agences qui démarrent leur digitalisation.',
    icon: Zap,
    color: '#475569',
    bgGradient: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
    highlighted: false,
    features: [
      'Tableau de bord complet',
      'Gestion des loyers & quittances',
      'Exports PDF et Excel',
      'Rappels locataires automatiques',
      'Historique des paiements',
      'Support par email',
    ],
    limits: { users: '3 utilisateurs', immeubles: '10 immeubles', unites: '30 unités' },
    cta: 'Commencer en Starter',
    ctaType: 'checkout',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19900,
    priceLabel: '19 900 XOF',
    tagline: '~30 €/mois',
    description: 'La solution complète pour les agences en pleine croissance.',
    icon: Building2,
    color: '#F58220',
    bgGradient: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    badge: 'Le plus populaire',
    highlighted: true,
    features: [
      'Tout le plan Starter',
      'Notifications bailleurs automatiques',
      'Rapports PDF mensuels par bailleur',
      'Alertes impayés en temps réel',
      'Gestion des commissions agence',
      'Paiement Orange Money intégré',
      'Exports Excel avancés',
      'Support prioritaire WhatsApp',
    ],
    limits: { users: '10 utilisateurs', immeubles: '50 immeubles', unites: '150 unités' },
    cta: 'Activer le plan Pro',
    ctaType: 'checkout',
  },
  {
    id: 'agence',
    name: 'Agence',
    price: 39900,
    priceLabel: '39 900 XOF',
    tagline: '~60 €/mois',
    description: 'Pour les grands réseaux et portefeuilles immobiliers.',
    icon: Crown,
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
    highlighted: false,
    features: [
      'Tout le plan Pro',
      'Utilisateurs illimités',
      'Immeubles et unités illimités',
      'Onboarding dédié sur site',
      'Accès API complet',
      'SLA garanti 99,9 %',
      'Account manager dédié',
      'Facturation personnalisée',
    ],
    limits: { users: 'Illimité', immeubles: 'Illimité', unites: 'Illimité' },
    cta: 'Contacter l\'équipe',
    ctaType: 'contact',
  },
];

const FAQS = [
  {
    q: 'Comment fonctionne le paiement ?',
    r: 'Vous payez directement via Orange Money depuis l\'application. Aucune carte bancaire requise. Votre plan est activé instantanément après confirmation du paiement.',
  },
  {
    q: 'Y a-t-il un engagement ?',
    r: 'Non, aucun engagement. Chaque plan est mensuel, renouvelable automatiquement. Vous pouvez changer ou annuler à tout moment depuis votre espace abonnement.',
  },
  {
    q: 'Puis-je commencer avec l\'essai gratuit ?',
    r: 'Oui, tout nouveau compte bénéficie de 14 jours d\'essai gratuit sur le plan Pro. Aucune carte bancaire ni paiement requis pour commencer.',
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    r: 'Absolument. Toutes les données sont chiffrées et hébergées en Europe (PostgreSQL via Supabase). Chaque agence est totalement isolée des autres (architecture multi-tenant).',
  },
  {
    q: 'Que se passe-t-il si je dépasse mes limites ?',
    r: 'L\'application vous avertit quand vous approchez des limites. Vous pouvez monter en plan à tout moment en quelques clics, sans perdre aucune donnée.',
  },
  {
    q: 'Le plan Agence est-il négociable ?',
    r: 'Oui. Le plan Agence peut être adapté à vos besoins spécifiques : nombre d\'utilisateurs, intégrations sur mesure, formation, etc. Contactez-nous sur WhatsApp pour un devis personnalisé.',
  },
];

const CONTACT_WHATSAPP = '221774000000';

interface PricingProps {
  embedded?: boolean;
  onNavigate?: (page: string) => void;
}

export function Pricing({ embedded = false, onNavigate }: PricingProps) {
  const { profile } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDef | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCta = (plan: PlanDef) => {
    if (plan.ctaType === 'contact') {
      window.open(
        `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux en savoir plus sur le plan Agence de Samay Këur.')}`,
        '_blank',
      );
      return;
    }
    if (plan.ctaType === 'register') {
      if (profile) onNavigate?.('dashboard');
      else onNavigate?.('auth');
      return;
    }
    setCheckoutPlan(plan);
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'}`} style={{ background: embedded ? 'transparent' : 'linear-gradient(160deg, #FFF7ED 0%, #FFFFFF 40%, #FAF5FF 100%)' }}>

      {/* ─── Hero ─── */}
      {!embedded && (
        <div className="pt-16 pb-12 px-4 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-6"
            style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
            <Zap className="w-4 h-4" />
            14 jours d'essai gratuit · Aucune carte requise
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
            Le bon plan pour<br />
            <span style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              chaque agence
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Paiement exclusivement via <strong>Orange Money</strong>. Sans carte bancaire, sans engagement.
            Passez d'un plan à l'autre à tout moment.
          </p>

          {/* Garanties */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500" />Données chiffrées</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-500" />Activation instantanée</span>
            <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-orange-500" />Orange Money uniquement</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" />Sans engagement</span>
          </div>
        </div>
      )}

      {/* ─── Cards plans ─── */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-2xl"
                style={{
                  border: plan.highlighted ? `2px solid ${plan.color}` : '2px solid #E2E8F0',
                  boxShadow: plan.highlighted ? `0 8px 32px ${plan.color}28` : undefined,
                  transform: plan.highlighted ? 'translateY(-4px)' : undefined,
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: plan.color }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Card header */}
                <div className="p-6" style={{ background: plan.bgGradient }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: plan.color + '20' }}>
                    <Icon className="w-6 h-6" style={{ color: plan.color }} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-4">{plan.description}</p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{plan.priceLabel}</span>
                    <span className="text-slate-400 text-sm">/ mois</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: plan.color }}>{plan.tagline}</p>
                </div>

                {/* Limits pills */}
                <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap gap-1.5">
                  {Object.values(plan.limits).map((l, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: plan.color + '12', color: plan.color }}>
                      {l}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="flex-1 bg-white p-6">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span className="text-sm text-slate-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="bg-white px-6 pb-6 pt-2">
                  <button
                    onClick={() => handleCta(plan)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                    style={
                      plan.highlighted
                        ? { background: `linear-gradient(135deg, ${plan.color} 0%, #C2410C 100%)`, color: 'white' }
                        : { backgroundColor: plan.color + '14', color: plan.color }
                    }
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Tableau comparatif condensé ─── */}
        {!embedded && (
          <div className="mt-16">
            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-8">Ce qui est inclus dans chaque plan</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-4 px-5 font-semibold text-slate-700 w-2/5">Fonctionnalité</th>
                      {PLANS.map((p) => (
                        <th key={p.id} className="text-center py-4 px-3 font-bold" style={{ color: p.color }}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Tableau de bord', true, true, true],
                      ['Gestion des loyers', true, true, true],
                      ['Exports PDF & Excel', true, true, true],
                      ['Rappels locataires', true, true, true],
                      ['Notifications bailleurs', false, true, true],
                      ['Rapports PDF mensuels', false, true, true],
                      ['Alertes impayés', false, true, true],
                      ['Commissions agence', false, true, true],
                      ['Paiement Orange Money', false, true, true],
                      ['Support prioritaire', false, true, true],
                      ['Unités illimitées', false, false, true],
                      ['API access', false, false, true],
                      ['SLA 99,9 %', false, false, true],
                      ['Onboarding sur site', false, false, true],
                    ].map(([label, starter, pro, agence]) => (
                      <tr key={String(label)} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-5 text-slate-700">{label}</td>
                        {[starter, pro, agence].map((v, i) => (
                          <td key={i} className="py-3 px-3 text-center">
                            {v
                              ? <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: PLANS[i].color }} />
                              : <span className="text-slate-300 text-lg">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── FAQ ─── */}
        {!embedded && (
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3"
                style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                <HelpCircle className="w-4 h-4" />
                Questions fréquentes
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900">Vous avez des questions ?</h2>
            </div>
            <div className="space-y-3">
              {FAQS.map(({ q, r }, idx) => (
                <div
                  key={q}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-semibold text-slate-900 pr-4">{q}</span>
                    <ChevronDown
                      className="w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-200"
                      style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                      {r}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CTA final ─── */}
        {!embedded && (
          <div
            className="mt-16 rounded-3xl p-8 sm:p-12 text-center"
            style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FEF3C7 100%)', border: '2px solid #FED7AA' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)' }}>
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-3">Prêt à démarrer ?</h2>
            <p className="text-slate-600 text-lg mb-6 max-w-xl mx-auto">
              Rejoignez les agences immobilières qui modernisent leur gestion locative avec Samay Këur.
              14 jours gratuits, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onNavigate?.('auth')}
                className="px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)' }}
              >
                Démarrer gratuitement
              </button>
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, j\'aimerais en savoir plus sur Samay Këur.')}`}
                target="_blank" rel="noopener noreferrer"
                className="px-8 py-4 rounded-2xl font-bold text-lg transition-all border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white"
              >
                Parler à l'équipe
              </a>
            </div>
          </div>
        )}
      </div>

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
