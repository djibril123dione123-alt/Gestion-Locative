import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viewerSource = readFileSync(
  new URL('../../components/documents/DocumentGeneratedModal.tsx', import.meta.url),
  'utf8',
);
const progressSource = readFileSync(
  new URL('../../components/documents/DocumentGenerationProgress.tsx', import.meta.url),
  'utf8',
);

describe('DocumentGenerationViewer', () => {
  it('propose un réessai et une fermeture après erreur', () => {
    expect(viewerSource).toContain('Réessayer');
    expect(viewerSource).toContain('Aucune version incomplète');
    expect(viewerSource).toContain('Fermer');
  });

  it('respecte la réduction des animations', () => {
    expect(viewerSource).toContain('motion-reduce:animate-none');
    expect(progressSource).toContain('motion-reduce:transition-none');
  });

  it('ne promet pas une certification juridique', () => {
    expect(viewerSource.toLowerCase()).not.toContain('certifié juridiquement');
    expect(viewerSource.toLowerCase()).not.toContain('horodatage certifié');
  });

  it('adapte le viewer aux petits écrans', () => {
    expect(viewerSource).toContain('max-h-[92dvh]');
    expect(viewerSource).toContain('lg:grid-cols-');
    expect(viewerSource).toContain('overflow-y-auto');
  });

  it('masque l’étape d’archivage quand elle ne s’applique pas', () => {
    expect(progressSource).toContain(
      "session.archiveStatus !== 'not-applicable'",
    );
  });
});
