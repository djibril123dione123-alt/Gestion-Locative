import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDocumentGeneration,
  completeDocumentGeneration,
  getDocumentGenerationSnapshot,
  resetDocumentGenerationForTests,
  runDocumentGeneration,
} from '../documentGeneration';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function readyPayload(key: string, url = 'blob:document-test') {
  return {
    kind: 'contrat' as const,
    title: 'Contrat de location',
    fileName: 'contrat.pdf',
    url,
    mimeType: 'application/pdf',
    generatedAt: new Date().toISOString(),
    generationKey: key,
    reference: 'CTR-001',
    archiveStatus: 'ready' as const,
    verificationStatus: 'active' as const,
  };
}

describe('documentGeneration', () => {
  beforeEach(() => {
    resetDocumentGenerationForTests();
    vi.restoreAllMocks();
  });

  it('ouvre immédiatement une session avant la fin de la génération', async () => {
    const pending = deferred<void>();
    const task = runDocumentGeneration(
      {
        key: 'contrat:1',
        kind: 'contrat',
        title: 'Préparation du contrat',
      },
      () => pending.promise,
    );

    expect(getDocumentGenerationSnapshot()).toMatchObject({
      key: 'contrat:1',
      state: 'loading-data',
      visible: true,
    });

    pending.resolve();
    await task;
  });

  it('conserve uniquement les étapes réellement disponibles pour le flux', async () => {
    const pending = deferred<void>();
    const task = runDocumentGeneration(
      {
        key: 'document:archive',
        kind: 'document',
        title: 'Préparation du document',
        steps: ['loading-data', 'loading-preview'],
      },
      () => pending.promise,
    );

    expect(getDocumentGenerationSnapshot()?.steps).toEqual([
      'loading-data',
      'loading-preview',
    ]);

    pending.resolve();
    await task;
  });

  it('réutilise le travail en cours lors d’un double clic', async () => {
    const pending = deferred<string>();
    const operation = vi.fn(() => pending.promise);
    const request = {
      key: 'quittance:1',
      kind: 'quittance' as const,
      title: 'Génération de la quittance',
    };

    const first = runDocumentGeneration(request, operation);
    const second = runDocumentGeneration(request, operation);
    expect(operation).toHaveBeenCalledOnce();

    pending.resolve('ready');
    await expect(Promise.all([first, second])).resolves.toEqual([
      'ready',
      'ready',
    ]);
  });

  it('rouvre le viewer sur la même promesse après une fermeture', async () => {
    const pending = deferred<string>();
    const operation = vi.fn(() => pending.promise);
    const request = {
      key: 'quittance:reopen',
      kind: 'quittance' as const,
      title: 'Génération de la quittance',
    };

    const first = runDocumentGeneration(request, operation);
    closeDocumentGeneration();
    const second = runDocumentGeneration(request, operation);

    expect(operation).toHaveBeenCalledOnce();
    expect(getDocumentGenerationSnapshot()).toMatchObject({
      key: 'quittance:reopen',
      state: 'loading-data',
      visible: true,
    });

    pending.resolve('ready');
    await expect(Promise.all([first, second])).resolves.toEqual([
      'ready',
      'ready',
    ]);
  });

  it('progresse selon les étapes rapportées puis devient consultable', async () => {
    const key = 'mandat:1';
    await runDocumentGeneration(
      {
        key,
        kind: 'mandat',
        title: 'Préparation du mandat',
        archiveExpected: true,
        verificationExpected: true,
      },
      async (lifecycle) => {
        lifecycle.report('building-document', { reference: 'MDT-001' });
        expect(getDocumentGenerationSnapshot()?.state).toBe(
          'building-document',
        );
        lifecycle.report('securing-document');
        expect(getDocumentGenerationSnapshot()?.state).toBe(
          'securing-document',
        );
        lifecycle.report('archiving-document', { archiveStatus: 'pending' });
        expect(getDocumentGenerationSnapshot()?.state).toBe(
          'archiving-document',
        );
        lifecycle.report('loading-preview', {
          archiveStatus: 'ready',
          verificationStatus: 'active',
        });
        completeDocumentGeneration(readyPayload(key));
      },
    );

    expect(getDocumentGenerationSnapshot()).toMatchObject({
      state: 'ready',
      archiveStatus: 'ready',
      verificationStatus: 'active',
      payload: { fileName: 'contrat.pdf' },
    });
  });

  it('expose une erreur claire et permet un nouvel essai', async () => {
    const key = 'rapport:1';
    let attempt = 0;
    const operation = vi.fn(async (lifecycle) => {
      attempt += 1;
      lifecycle.report('building-document');
      if (attempt === 1) throw new Error('Archivage indisponible');
      completeDocumentGeneration(readyPayload(key));
      return 'ready';
    });

    await expect(
      runDocumentGeneration(
        {
          key,
          kind: 'bilan',
          title: 'Préparation du rapport bailleur',
        },
        operation,
      ),
    ).rejects.toThrow('Archivage indisponible');

    const failed = getDocumentGenerationSnapshot();
    expect(failed).toMatchObject({
      state: 'error',
      error: 'Archivage indisponible',
    });
    await expect(failed?.retry?.()).resolves.toBe('ready');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(getDocumentGenerationSnapshot()?.state).toBe('ready');
  });

  it('masque les détails techniques Supabase dans les erreurs visibles', async () => {
    await expect(
      runDocumentGeneration(
        {
          key: 'document:technical-error',
          kind: 'document',
          title: 'Préparation du document',
        },
        async () => {
          throw new Error(
            'PGRST204: column registry_hash does not exist in Supabase',
          );
        },
      ),
    ).rejects.toThrow('PGRST204');

    expect(getDocumentGenerationSnapshot()?.error).toBe(
      'Le service documentaire est momentanément indisponible. Réessayez dans quelques instants.',
    );
  });

  it('révoque les Blob URLs à la fermeture du viewer', () => {
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    completeDocumentGeneration(readyPayload('contrat:2'));

    closeDocumentGeneration();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:document-test');
    expect(getDocumentGenerationSnapshot()).toBeNull();
  });

  it('révoque l’aperçu précédent avant une nouvelle préparation', async () => {
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    completeDocumentGeneration(readyPayload('contrat:ancien'));

    await runDocumentGeneration(
      {
        key: 'contrat:nouveau',
        kind: 'contrat',
        title: 'Préparation du nouveau contrat',
      },
      async () => 'ready',
    );

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:document-test');
  });

  it('ne présente pas un QR indisponible comme actif', () => {
    completeDocumentGeneration({
      ...readyPayload('contrat:3', 'https://example.test/contrat.pdf'),
      verificationStatus: 'unavailable',
    });

    expect(getDocumentGenerationSnapshot()?.verificationStatus).toBe(
      'unavailable',
    );
  });
});
