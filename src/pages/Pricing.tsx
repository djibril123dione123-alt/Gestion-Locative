import { useState } from 'react';
import {
  CheckCircle2, Zap, Building2, Crown, ArrowRight,
  Smartphone, Shield, Clock, ChevronDown, BarChart3,
  Star, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CheckoutModal } from '../components/billing/CheckoutModal';

interface PlanDef {
  id: 'starter' | 'pro' | 'business' | 'enterprise';
  name: string;
  price: number;
  priceLabel: string;
  tagline: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  badgeText?: string;
  badgeColor?: string;
  highlighted: boolean;
  features: string[];
  notIncluded?: string[];
  limits: { users: string; immeubles: string; unites: string };
  cta: string;
  ctaStyle: 'primary' | 'secondary' | 'outline' | 'contact';
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 5000,
    priceLabel: '5 000 FCFA',
    tagline: '≈ 7,50 €/mois',
    description: 'Pour les bailleurs qui démarrent leur digitalisation.',
    icon: Zap,
    color: '#475569',
    bgColor: '#F8FAFC',
    highlighted: false,
    features: [
      'Tableau de bord des loyers',
      'Saisie manuelle des paiements',
      'Quittances PDF à la demande',
      'Exports Excel basiques',
      'Rappels locataires email',
      'Support par email',
    ],
    notIncluded: ['Notifications bailleurs', 'Rapports mensuels auto', 'Alertes impayés auto'],
    limits: { users: '1 utilisateur', immeubles: '3 immeubles', unites: '10 unités' },
    cta: 'Commencer en Starter',
    ctaStyle: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15000,
    priceLabel: '15 000 FCFA',
    tagline: '≈ 22 €/mois',
    description: 'La solution complète pour bailleurs sérieux et petites agences.',
    icon: Building2,
    color: '#F58220',
    bgColor: '#FFF7ED',
    badgeText: '⭐ Le plus populaire',
    badgeColor: '#F58220',
    highlighted: true,
    features: [
      'Tout le plan Starter',
      'Notifications bailleurs auto',
      'Rapports PDF mensuels par bailleur',
      'Alertes impayés en temps réel',
      'Gestion des commissions agence',
      'Paiement Orange Money + Wave',
      'Exports Excel avancés',
      'Plusieurs utilisateurs',
      'Support prioritaire WhatsApp',
    ],
    limits: { users: '5 utilisateurs', immeubles: '20 immeubles', unites: '100 unités' },
    cta: 'Activer le plan Pro',
    ctaStyle: 'primary',
  },
  {
    id: 'business',
    name: 'Business',
    price: 35000,
    priceLabel: '35 000 FCFA',
    tagline: '≈ 53 €/mois',
    description: 'Pour les agences immobilières structurées avec équipe.',
    icon: BarChart3,
    color: '#0891B2',
    bgColor: '#ECFEFF',
    badgeText: '🚀 Pour agences',
    badgeColor: '#0891B2',
    highlighted: false,
    features: [
      'Tout le plan Pro',
      '15 utilisateurs inclus',
      'Jusqu\'à 500 unités',
      'Tableau de bord équipe',
      'Rapports de performance agents',
      'Gestion multi-portefeuilles',
      'API webhooks',
      'Onboarding guidé inclus',
      'Support dédié (temps de réponse < 4h)',
    ],
    limits: { users: '15 utilisateurs', immeubles: '100 immeubles', unites: '500 unités' },
    cta: 'Activer Business',
    ctaStyle: 'secondary',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    priceLabel: 'Sur devis',
    tagline: 'Personnalisé',
    description: 'Grands réseaux d\'agences, groupes immobiliers, multi-pays.',
    icon: Crown,
    color: '#7C3AED',
    bgColor: '#FAF5FF',
    highlighted: false,
    features: [
      'Tout le plan Business',
      'Utilisateurs et unités illimités',
      'White-label (votre marque)',
      'Intégration comptabilité sur mesure',
      'SLA garanti 99,9 %',
      'Account manager dédié',
      'Formation équipe sur site',
      'Facturation personnalisée',
      'Accès API complet',
    ],
    limits: { users: 'Illimité', immeubles: 'Illimité', unites: 'Illimité' },
    cta: 'Demander un devis',
    ctaStyle: 'contact',
  },
];

const COMPARISON_ROWS: { label: string; values: (boolean | string)[] }[] = [
  { label: 'Tableau de bord loyers',           values: [true, true, true, true] },
  { label: 'Quittances PDF',                   values: [true, true, true, true] },
  { label: 'Exports Excel',                    values: ['Basique', 'Avancé', 'Avancé', 'Avancé'] },
  { label: 'Rappels locataires (email)',        values: [true, true, true, true] },
  { label: 'Notifications bailleurs auto',      values: [false, true, true, true] },
  { label: 'Rapports PDF mensuels',            values: [false, true, true, true] },
  { label: 'Alertes impayés temps réel',       values: [false, true, true, true] },
  { label: 'Gestion commissions',              values: [false, true, true, true] },
  { label: 'Orange Money / Wave / Djamo',      values: [false, true, true, true] },
  { label: 'Rapports de performance agents',   values: [false, false, true, true] },
  { label: 'Gestion multi-portefeuilles',      values: [false, false, true, true] },
  { label: 'API webhooks',                     values: [false, false, true, true] },
  { label: 'White-label',                      values: [false, false, false, true] },
  { label: 'SLA garanti 99,9 %',              values: [false, false, false, true] },
  { label: 'Support',                          values: ['Email', 'WhatsApp prio.', '< 4h', 'Dédié'] },
];

const FAQS = [
  { q: 'Quels moyens de paiement sont acceptés ?', r: 'Orange Money Sénégal, Wave (Sénégal et Côte d\'Ivoire), Djamo, et carte bancaire (Visa / Mastercard) via PayDunya. Aucune carte requise pour Orange Money ou Wave.' },
  { q: 'Y a-t-il un engagement minimum ?', r: 'Non, zéro engagement. Chaque plan est mensuel. Vous pouvez changer, monter en gamme ou annuler à tout moment depuis votre espace abonnement.' },
  { q: 'L\'essai gratuit est-il limité ?', r: 'Vous disposez de 14 jours d\'essai complet sur le plan Pro. Aucun paiement requis pour démarrer. À la fin de l\'essai, choisissez votre plan ou passez en Starter gratuit.' },
  { q: 'Que se passe-t-il si je dépasse mes limites ?', r: 'L\'application vous avertit à 80 % d\'utilisation. Vous pouvez monter en gamme en quelques clics sans perdre aucune donnée.' },
  { q: 'Puis-je migrer mes données ?', r: 'Oui, à tout moment. Toutes vos données sont exportables en Excel et PDF. Aucun enfermement propriétaire.' },
  { q: 'La facturation est-elle disponible pour Côte d\'Ivoire / Mali ?', r: 'Oui. Wave fonctionne en Côte d\'Ivoire et au Sénégal. Orange Money couvre le Sénégal. Nous ajoutons de nouveaux pays progressivement.' },
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
  const [showComparison, setShowComparison] = useState(false);

  const handleCta = (plan: PlanDef) => {
    if (plan.ctaStyle === 'contact') {
      window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je souhaite un devis Enterprise pour Samay Këur.')}`, '_blank');
      return;
    }
    if (!profile) {
      onNavigate?.('auth');
      return;
    }
    setCheckoutPlan(plan);
  };

  return (
    <div className={embedded ? '' : 'min-h-screen'} style={{ background: embedded ? 'transparent' : 'linear-gradient(160deg, #FFF7ED 0%, #FFFFFF 35%, #F0F9FF 100%)' }}>

      {/* ── Hero ── */}
      {!embedded && (
        <div className="pt-14 pb-10 px-4 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-6"
            style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
            <Star className="w-4 h-4 fill-current" />
            14 jours d'essai Pro gratuit · Aucune carte requise
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
            Un plan pour chaque<br />
            <span style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              taille d'agence
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Paiement via <strong>Orange Money, Wave, Djamo</strong> ou carte bancaire.
            Sans engagement, sans carte requise. Passez d'un plan à l'autre à tout moment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500" />Données chiffrées</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-400" />Activation instantanée</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-purple-500" />Montée en gamme libre</span>
          </div>

          {/* Logos paiements */}
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <span className="text-xs text-slate-400 mr-1">Paiements acceptés :</span>
            {[
              { src: '/logo-orange-money.png', alt: 'Orange Money', bg: '#FFF4EE' },
              { src: '/logo-wave.png',         alt: 'Wave',         bg: '#EFF9FF' },
              { src: '/logo-djamo.png',        alt: 'Djamo',        bg: '#F5F5F5' },
            ].map(({ src, alt, bg }) => (
              <div key={alt} className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-sm border border-slate-100"
                style={{ backgroundColor: bg }}>
                <img src={src} alt={alt} className="w-7 h-7 object-contain" />
              </div>
            ))}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 shadow-sm border border-slate-100">
              <span className="text-xs font-bold text-blue-700 leading-tight text-center">VISA<br/>MC</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pb-12">

        {/* ── Grille des plans ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-2xl"
                style={{
                  border: plan.highlighted ? `2px solid ${plan.color}` : '2px solid #E2E8F0',
                  boxShadow: plan.highlighted ? `0 8px 40px ${plan.color}25` : undefined,
                  transform: plan.highlighted ? 'translateY(-6px)' : undefined,
                }}
              >
                {plan.badgeText && (
                  <div className="text-center py-2 text-xs font-extrabold text-white tracking-wide"
                    style={{ backgroundColor: plan.badgeColor }}>
                    {plan.badgeText}
                  </div>
                )}

                {/* Header */}
                <div className="p-5 pb-4" style={{ backgroundColor: plan.bgColor }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: plan.color + '20' }}>
                    <Icon className="w-5 h-5" style={{ color: plan.color }} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{plan.description}</p>

                  <div className="mt-3">
                    {plan.price > 0 ? (
                      <>
                        <span className="text-2xl font-extrabold text-slate-900">{plan.priceLabel}</span>
                        <span className="text-slate-400 text-xs ml-1">/ mois</span>
                        <div className="text-xs mt-0.5" style={{ color: plan.color }}>{plan.tagline}</div>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-extrabold text-slate-900">{plan.priceLabel}</span>
                        <div className="text-xs mt-0.5 text-slate-400">{plan.tagline}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Limites pills */}
                <div className="px-5 py-2.5 bg-white border-y border-slate-100 flex flex-wrap gap-1.5">
                  {Object.values(plan.limits).map((l, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: plan.color + '12', color: plan.color }}>
                      {l}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="flex-1 bg-white p-5">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span className="text-xs text-slate-700 leading-relaxed">{f}</span>
                      </li>
                    ))}
                    {plan.notIncluded?.map((f) => (
                      <li key={f} className="flex items-start gap-2 opacity-40">
                        <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center text-slate-400 text-sm leading-none">—</span>
                        <span className="text-xs text-slate-400 leading-relaxed line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="bg-white px-5 pb-5 pt-3">
                  <button
                    onClick={() => handleCta(plan)}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                    style={
                      plan.ctaStyle === 'primary'
                        ? { background: `linear-gradient(135deg, ${plan.color}, #C2410C)`, color: 'white', boxShadow: `0 4px 14px ${plan.color}40` }
                        : plan.ctaStyle === 'secondary'
                        ? { backgroundColor: plan.color, color: 'white' }
                        : plan.ctaStyle === 'contact'
                        ? { backgroundColor: plan.color + '15', color: plan.color, border: `1.5px solid ${plan.color}40` }
                        : { backgroundColor: 'white', color: plan.color, border: `2px solid ${plan.color}40` }
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

        {/* ── Comparatif ── */}
        {!embedded && (
          <div className="mt-12">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="flex items-center gap-2 mx-auto text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
              {showComparison ? 'Masquer' : 'Voir'} le tableau comparatif complet
            </button>

            {showComparison && (
              <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <th className="text-left py-4 px-5 font-semibold text-slate-700 w-2/5 border-b border-slate-200">Fonctionnalité</th>
                        {PLANS.map((p) => (
                          <th key={p.id} className="text-center py-4 px-3 font-extrabold border-b border-slate-200" style={{ color: p.color }}>
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map(({ label, values }) => (
                        <tr key={label} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="py-3 px-5 text-sm text-slate-700">{label}</td>
                          {values.map((v, i) => (
                            <td key={i} className="py-3 px-3 text-center">
                              {typeof v === 'boolean'
                                ? v
                                  ? <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: PLANS[i].color }} />
                                  : <span className="text-slate-300 text-lg font-light">—</span>
                                : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: PLANS[i].color + '15', color: PLANS[i].color }}>{v}</span>
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Convertisseur visuel : "Quel plan pour moi ?" ── */}
        {!embedded && (
          <div className="mt-12 rounded-2xl p-6 sm:p-8"
            style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '2px solid #FED7AA' }}>
            <h2 className="text-xl font-extrabold text-slate-900 mb-5 text-center">Quel plan vous correspond ?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { emoji: '🏠', label: 'Bailleur particulier', desc: '1 à 3 immeubles, gestion simple', plan: 'Starter', color: '#475569' },
                { emoji: '🏢', label: 'Bailleur sérieux', desc: '10–50 unités, notifications auto', plan: 'Pro', color: '#F58220' },
                { emoji: '🏗️', label: 'Agence immobilière', desc: 'Équipe + multi-portefeuilles', plan: 'Business', color: '#0891B2' },
                { emoji: '🌍', label: 'Réseau / Groupe', desc: 'Multi-agences, personnalisation', plan: 'Enterprise', color: '#7C3AED' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-4 text-center shadow-sm border border-slate-100">
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <p className="font-bold text-slate-900 text-sm">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{item.desc}</p>
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: item.color }}>
                    Plan {item.plan}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FAQ accordéon ── */}
        {!embedded && (
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900">Questions fréquentes</h2>
              <p className="text-slate-500 mt-2">Tout ce que vous devez savoir avant de vous lancer.</p>
            </div>
            <div className="space-y-3">
              {FAQS.map(({ q, r }, idx) => (
                <div key={q} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition"
                  >
                    <span className="font-semibold text-slate-900 pr-4 text-sm">{q}</span>
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

        {/* ── CTA final ── */}
        {!embedded && (
          <div className="mt-12 text-center rounded-3xl p-8 sm:p-14"
            style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)' }}>
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">Démarrez gratuitement</h2>
            <p className="text-slate-400 text-base mb-8 max-w-lg mx-auto">
              14 jours d'essai Pro complet. Aucune carte bancaire. Aucun engagement.
              Passez au plan payant quand vous êtes prêt.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onNavigate?.(profile ? 'dashboard' : 'auth')}
                className="px-8 py-4 rounded-2xl text-white font-extrabold text-base transition-all shadow-lg hover:shadow-xl active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F58220, #C2410C)' }}
              >
                Démarrer l'essai gratuit
              </button>
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux en savoir plus sur Samay Këur.')}`}
                target="_blank" rel="noopener noreferrer"
                className="px-8 py-4 rounded-2xl font-bold text-base transition-all text-slate-300 border border-slate-600 hover:border-slate-400 hover:text-white hover:bg-slate-800"
              >
                Parler à l'équipe
              </a>
            </div>
            <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
              <span className="text-slate-600 text-xs">Paiements acceptés :</span>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center overflow-hidden">
                  <img src="/logo-orange-money.png" alt="Orange Money" className="w-6 h-6 object-contain" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center overflow-hidden">
                  <img src="/logo-wave.png" alt="Wave" className="w-6 h-6 object-contain" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden">
                  <img src="/logo-djamo.png" alt="Djamo" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-slate-500 text-xs border border-slate-600 rounded px-1.5 py-0.5 font-medium">VISA · MC</span>
              </div>
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
