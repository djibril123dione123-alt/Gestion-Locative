import {
  Check,
  Circle,
  FileCheck2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type {
  DocumentGenerationSession,
  DocumentGenerationState,
} from '../../lib/documentGeneration';

interface DocumentGenerationProgressProps {
  session: DocumentGenerationSession;
}

const PROGRESS_STEPS: Array<{
  state: Exclude<DocumentGenerationState, 'idle' | 'ready' | 'error'>;
  label: string;
  message: string;
  icon: typeof FileCheck2;
}> = [
  {
    state: 'loading-data',
    label: 'Données officielles',
    message: 'Récupération du snapshot et des données canoniques…',
    icon: FileCheck2,
  },
  {
    state: 'building-document',
    label: 'Composition du PDF',
    message: 'Mise en page et composition du document…',
    icon: Loader2,
  },
  {
    state: 'securing-document',
    label: 'Contrôles documentaires',
    message: 'Création de l’empreinte et du QR lorsque le modèle le prévoit…',
    icon: ShieldCheck,
  },
  {
    state: 'archiving-document',
    label: 'Enregistrement documentaire',
    message: 'Enregistrement dans la GED et le registre documentaire…',
    icon: FileCheck2,
  },
  {
    state: 'loading-preview',
    label: 'Préparation de l’aperçu',
    message: 'Chargement de la version consultable…',
    icon: Loader2,
  },
];

function getStepIndex(
  state: DocumentGenerationState,
  steps: typeof PROGRESS_STEPS,
) {
  if (state === 'ready') return steps.length;
  if (state === 'error') return -1;
  return steps.findIndex((step) => step.state === state);
}

export function DocumentGenerationProgress({
  session,
}: DocumentGenerationProgressProps) {
  const visibleSteps = PROGRESS_STEPS.filter(
    (step) =>
      (session.steps ? session.steps.includes(step.state) : true) &&
      (step.state !== 'archiving-document' ||
        session.archiveStatus !== 'not-applicable'),
  );
  const currentIndex = getStepIndex(session.state, visibleSteps);
  const currentStep = visibleSteps[Math.max(currentIndex, 0)];
  const progress =
    session.state === 'ready'
      ? 100
      : Math.max(8, ((currentIndex + 0.35) / visibleSteps.length) * 100);

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      aria-live="polite"
      aria-busy={session.state !== 'ready' && session.state !== 'error'}
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
            Préparation sécurisée du document
          </p>
          <span className="text-xs font-bold tabular-nums text-slate-500">
            {Math.round(progress)} %
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-700 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {visibleSteps.map((step, index) => {
          const completed = index < currentIndex || session.state === 'ready';
          const active = index === currentIndex;
          const StepIcon = step.icon;

          return (
            <div
              key={step.state}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors motion-reduce:transition-none ${
                active
                  ? 'border-emerald-300 bg-emerald-50/80'
                  : completed
                    ? 'border-emerald-100 bg-white'
                    : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  completed
                    ? 'bg-emerald-700 text-white'
                    : active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-white text-slate-400'
                }`}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : active ? (
                  <StepIcon className="h-4 w-4 motion-safe:animate-pulse" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold ${
                    active || completed ? 'text-slate-950' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                {active ? (
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    {currentStep.message}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
