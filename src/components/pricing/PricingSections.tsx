import { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  HelpCircle,
  FileCheck2,
  HandCoins,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { PricingPlanDefinition } from '../../lib/pricingCatalog';
import {
  PRICING_BENEFITS,
  PRICING_COMPARISON,
  PRICING_FAQ,
  PRICING_FOUNDATION,
} from '../../lib/pricingPresentation';
import { PricingPlanCard } from './PricingPlanCard';

const FOUNDATION_ICONS = [Building2, ReceiptText, FileCheck2, Landmark, Users, ShieldCheck];
const BENEFIT_ICONS = [HandCoins, FileCheck2, Briefcase, CalendarDays];

interface PricingSectionsProps {
  plans: PricingPlanDefinition[];
  onSelectPlan: (plan: PricingPlanDefinition) => void;
  onStart: () => void;
  onRequestDemo: () => void;
  compact?: boolean;
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-orange-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{text}</p>
    </div>
  );
}

function PlanGrid({ plans, onSelectPlan }: Pick<PricingSectionsProps, 'plans' | 'onSelectPlan'>) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <PricingPlanCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
      ))}
    </div>
  );
}

export function PricingSections({ plans, onSelectPlan, onStart, onRequestDemo, compact = false }: PricingSectionsProps) {
  const [openFaq, setOpenFaq] = useState(0);

  if (compact) {
    return (
      <div className="space-y-5">
        <PlanGrid plans={plans} onSelectPlan={onSelectPlan} />
        <p className="text-center text-xs leading-5 text-slate-500">
          Les fonctions disponibles restent soumises au rôle, au type de compte et aux modules activés par l’organisation.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="border-y border-emerald-950/10 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Le cœur de Samay Këur"
            title="La gestion locative essentielle est incluse dans chaque plan."
            text="Choisissez une capacité adaptée à votre portefeuille et à votre équipe. Le cœur du produit reste cohérent, sans puzzle d’options incompréhensibles."
          />
          <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING_FOUNDATION.map((item, index) => {
              const Icon = FOUNDATION_ICONS[index];
              return (
                <div key={item.title} className="flex gap-3 border-t border-emerald-950/10 pt-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="plans" className="bg-[#f4f0e7] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Plans"
              title="Choisissez selon votre volume et votre organisation."
              text="Les fonctions métier restent accessibles selon votre rôle et vos modules. Le plan adapte surtout la capacité à votre portefeuille et à votre équipe."
            />
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              Tous les prix sont mensuels. Le plan Entreprise est dimensionné après échange avec votre équipe.
            </p>
          </div>
          <div className="mt-8">
            <PlanGrid plans={plans} onSelectPlan={onSelectPlan} />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Repères de choix"
            title="Le bon plan se reconnaît à votre manière de travailler."
            text="Pas besoin de comparer chaque ligne technique pour prendre une première décision."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan)}
                className="group rounded-lg border border-emerald-950/10 bg-[#fbfaf6] p-5 text-left transition hover:border-emerald-800/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                <span className="text-xs font-black uppercase tracking-[0.1em] text-emerald-800">{plan.name}</span>
                <strong className="mt-2 block text-base text-slate-950">{plan.bestFor}</strong>
                <span className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-800">
                  {plan.id === 'enterprise' ? 'Échanger avec nous' : 'Voir ce plan'}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-emerald-950 px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-orange-300">Valeur métier</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black sm:text-3xl">Ce que votre agence gagne au quotidien.</h2>
          <div className="mt-8 grid gap-7 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_BENEFITS.map((benefit, index) => {
              const Icon = BENEFIT_ICONS[index];
              return (
                <div key={benefit.title} className="border-t border-white/15 pt-5">
                  <Icon className="h-5 w-5 text-orange-300" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-black">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/70">{benefit.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Comparaison métier"
            title="Comparez ce qui compte vraiment pour l’exploitation."
            text="Le socle reste volontairement commun. Les différences portent principalement sur la capacité, le travail en équipe et l’accompagnement."
          />

          <div className="mt-8 hidden space-y-3 md:block">
            {PRICING_COMPARISON.map((section) => (
              <details
                key={section.title}
                className="overflow-hidden rounded-lg border border-emerald-950/10 bg-white"
              >
                <summary className="cursor-pointer list-none bg-[#f4f0e7] px-4 py-3 text-sm font-black text-slate-950">
                  <span className="flex items-center justify-between gap-3">
                    {section.title}
                    <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  </span>
                </summary>
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead className="border-t border-emerald-950/10 bg-emerald-950 text-white">
                    <tr>
                      <th className="w-[28%] px-4 py-3 font-bold">Fonction</th>
                      {plans.map((plan) => (
                        <th key={plan.id} className="px-3 py-3 font-bold">{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={`${section.title}-${row.label}`} className="border-t border-emerald-950/10">
                        <th className="px-4 py-3 font-semibold text-slate-800">{row.label}</th>
                        {plans.map((plan) => (
                          <td key={plan.id} className="px-3 py-3 text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              {(row.values[plan.id] === 'Inclus' || row.values[plan.id] === 'Disponible') && (
                                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                              )}
                              {row.values[plan.id]}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>

          <div className="mt-8 space-y-3 md:hidden">
            {plans.map((plan) => (
              <details key={plan.id} className="rounded-lg border border-emerald-950/10 bg-[#fbfaf6] p-4">
                <summary className="cursor-pointer list-none text-sm font-black text-slate-950">
                  <span className="flex items-center justify-between gap-3">
                    {plan.name}
                    <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  {PRICING_COMPARISON.map((section) => (
                    <div key={section.title}>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-emerald-800">{section.title}</p>
                      <dl className="mt-2 space-y-2">
                        {section.rows.map((row) => (
                          <div key={row.label} className="flex justify-between gap-4 border-t border-emerald-950/10 pt-2 text-sm">
                            <dt className="text-slate-600">{row.label}</dt>
                            <dd className="text-right font-semibold text-slate-900">{row.values[plan.id]}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <details className="mt-5 rounded-lg border border-emerald-950/10 bg-slate-50 p-4">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
              <span className="flex items-center justify-between gap-3">
                Voir les limites techniques détaillées
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <div key={plan.id} className="border-t border-slate-200 pt-3">
                  <p className="text-sm font-black text-slate-950">{plan.name}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {plan.infrastructure.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Les limites servent à préserver la qualité de service. Elles n’effacent jamais les données déjà enregistrées. Le stockage du plan Entreprise est défini au contrat.
            </p>
          </details>
        </div>
      </section>

      <section className="border-t border-emerald-950/10 bg-[#f4f0e7] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <HelpCircle className="h-6 w-6 text-emerald-800" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">Questions avant de choisir</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Des réponses directes sur les plans, le changement d’abonnement et les capacités réellement disponibles.
            </p>
          </div>
          <div className="space-y-2">
            {PRICING_FAQ.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.question} className="rounded-lg border border-emerald-950/10 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-black text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700"
                    aria-expanded={isOpen}
                  >
                    {item.question}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {isOpen && <p className="border-t border-emerald-950/10 px-4 py-3 text-sm leading-6 text-slate-600">{item.answer}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-lg border border-emerald-900/20 bg-emerald-50 p-6 sm:p-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-orange-700">Passez à une gestion maîtrisée</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Prêt à reprendre le contrôle de votre gestion locative ?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Commencez avec le plan adapté ou demandez une démonstration centrée sur votre portefeuille et votre manière de travailler.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            >
              Commencer maintenant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRequestDemo}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-950/15 bg-white px-5 py-2.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            >
              Demander une démonstration
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
