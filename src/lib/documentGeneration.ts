import type {
  GeneratedDocumentKind,
  GeneratedDocumentPayload,
} from './documentGenerated';

export type DocumentGenerationState =
  | 'idle'
  | 'loading-data'
  | 'building-document'
  | 'securing-document'
  | 'archiving-document'
  | 'loading-preview'
  | 'ready'
  | 'error';

export type DocumentGenerationStep = Exclude<
  DocumentGenerationState,
  'idle' | 'ready' | 'error'
>;

export type DocumentArchiveStatus =
  | 'not-applicable'
  | 'pending'
  | 'ready'
  | 'incomplete';

export type DocumentVerificationStatus =
  | 'not-applicable'
  | 'pending'
  | 'active'
  | 'unavailable';

export interface DocumentGenerationRequest {
  key: string;
  kind: GeneratedDocumentKind;
  title: string;
  source?: string;
  reference?: string;
  archiveExpected?: boolean;
  verificationExpected?: boolean;
  steps?: DocumentGenerationStep[];
}

export interface DocumentGenerationLifecycle {
  readonly key: string;
  report: (
    state: Exclude<DocumentGenerationState, 'idle' | 'ready' | 'error'>,
    patch?: Partial<
      Pick<
        DocumentGenerationSession,
        'reference' | 'archiveStatus' | 'verificationStatus'
      >
    >,
  ) => void;
}

export interface DocumentGenerationSession {
  id: string;
  key: string;
  kind: GeneratedDocumentKind;
  title: string;
  source?: string;
  reference?: string;
  steps?: DocumentGenerationStep[];
  state: DocumentGenerationState;
  archiveStatus: DocumentArchiveStatus;
  verificationStatus: DocumentVerificationStatus;
  startedAt: string;
  visible: boolean;
  payload?: GeneratedDocumentPayload;
  error?: string;
  retry?: () => Promise<unknown>;
}

type Listener = () => void;

let currentSession: DocumentGenerationSession | null = null;
const listeners = new Set<Listener>();
const inFlight = new Map<string, Promise<unknown>>();
const dismissedKeys = new Set<string>();
const revokedUrls = new Set<string>();

function emit() {
  listeners.forEach((listener) => listener());
}

function replaceSession(session: DocumentGenerationSession | null) {
  currentSession = session;
  emit();
}

function normalizeError(error: unknown): string {
  const fallback = "La génération du document n'a pas pu être terminée.";
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const message = error.message.trim();
  const technicalDetail =
    /\b(?:supabase|postgres|pgrst|jwt|storage bucket|row.level|stack trace|typeerror|relation .* does not exist|column .* does not exist|violates .* constraint)\b/i;

  if (technicalDetail.test(message) || message.length > 220) {
    return 'Le service documentaire est momentanément indisponible. Réessayez dans quelques instants.';
  }

  return message;
}

export function subscribeDocumentGeneration(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDocumentGenerationSnapshot() {
  return currentSession;
}

export function isDocumentGenerationInFlight(key: string) {
  return inFlight.has(key);
}

export function updateDocumentGeneration(
  key: string,
  state: Exclude<DocumentGenerationState, 'idle' | 'ready' | 'error'>,
  patch: Partial<
    Pick<
      DocumentGenerationSession,
      'reference' | 'archiveStatus' | 'verificationStatus'
    >
  > = {},
) {
  if (!currentSession || currentSession.key !== key) return;
  replaceSession({
    ...currentSession,
    ...patch,
    state,
    error: undefined,
  });
}

export async function runDocumentGeneration<T>(
  request: DocumentGenerationRequest,
  operation: (lifecycle: DocumentGenerationLifecycle) => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(request.key);
  if (existing) {
    dismissedKeys.delete(request.key);
    if (!currentSession || currentSession.key !== request.key) {
      replaceSession({
        id: `${request.key}:${Date.now()}`,
        key: request.key,
        kind: request.kind,
        title: request.title,
        source: request.source,
        reference: request.reference,
        steps: request.steps,
        state: 'loading-data',
        archiveStatus: request.archiveExpected ? 'pending' : 'not-applicable',
        verificationStatus: request.verificationExpected
          ? 'pending'
          : 'not-applicable',
        startedAt: new Date().toISOString(),
        visible: true,
        retry: () => existing,
      });
    }
    return existing as Promise<T>;
  }

  if (currentSession?.payload) disposeGeneratedDocument(currentSession.payload);
  dismissedKeys.delete(request.key);
  const retry = () => runDocumentGeneration(request, operation);
  const session: DocumentGenerationSession = {
    id: `${request.key}:${Date.now()}`,
    key: request.key,
    kind: request.kind,
    title: request.title,
    source: request.source,
    reference: request.reference,
    steps: request.steps,
    state: 'loading-data',
    archiveStatus: request.archiveExpected ? 'pending' : 'not-applicable',
    verificationStatus: request.verificationExpected ? 'pending' : 'not-applicable',
    startedAt: new Date().toISOString(),
    visible: true,
    retry,
  };
  replaceSession(session);

  const lifecycle: DocumentGenerationLifecycle = {
    key: request.key,
    report: (state, patch) =>
      updateDocumentGeneration(request.key, state, patch),
  };

  const promise = operation(lifecycle)
    .catch((error) => {
      if (currentSession?.key === request.key) {
        replaceSession({
          ...currentSession,
          state: 'error',
          archiveStatus:
            currentSession.state === 'archiving-document'
              ? 'incomplete'
              : currentSession.archiveStatus,
          verificationStatus:
            currentSession.verificationStatus === 'pending'
              ? 'unavailable'
              : currentSession.verificationStatus,
          error: normalizeError(error),
          retry,
        });
      }
      throw error;
    })
    .finally(() => {
      inFlight.delete(request.key);
    });

  inFlight.set(request.key, promise);
  return promise;
}

export function completeDocumentGeneration(payload: GeneratedDocumentPayload) {
  const key =
    payload.generationKey ??
    `${payload.kind}:${payload.reference ?? payload.fileName}`;

  if (dismissedKeys.has(key)) {
    disposeGeneratedDocument(payload);
    return;
  }

  const matchingSession = currentSession?.key === key ? currentSession : null;
  if (
    currentSession?.payload &&
    currentSession.payload.url !== payload.url
  ) {
    disposeGeneratedDocument(currentSession.payload);
  }
  replaceSession({
    id: matchingSession?.id ?? `${key}:${Date.now()}`,
    key,
    kind: payload.kind,
    title: payload.title,
    source: payload.source,
    reference: payload.reference,
    steps: matchingSession?.steps,
    state: 'ready',
    archiveStatus: payload.archiveStatus ?? 'not-applicable',
    verificationStatus: payload.verificationStatus ?? 'not-applicable',
    startedAt: matchingSession?.startedAt ?? payload.generatedAt,
    visible: matchingSession?.visible ?? true,
    payload,
  });
}

export function closeDocumentGeneration() {
  if (!currentSession) return;
  const session = currentSession;
  if (inFlight.has(session.key)) dismissedKeys.add(session.key);
  if (session.payload) disposeGeneratedDocument(session.payload);
  replaceSession(null);
}

export function disposeGeneratedDocument(payload: Pick<GeneratedDocumentPayload, 'url'>) {
  if (!payload.url.startsWith('blob:') || revokedUrls.has(payload.url)) return;
  revokedUrls.add(payload.url);
  URL.revokeObjectURL(payload.url);
}

export function resetDocumentGenerationForTests() {
  if (currentSession?.payload) disposeGeneratedDocument(currentSession.payload);
  currentSession = null;
  inFlight.clear();
  dismissedKeys.clear();
  revokedUrls.clear();
  emit();
}
