import type { ReactNode } from 'react';
import { FileCheck2, QrCode, Stamp } from 'lucide-react';
import { getSystemBlockPublicLabel } from '../../lib/documents/templateCatalog';
import {
  getSampleTemplateVariables,
  renderDocumentTemplate,
} from '../../lib/documents/templateEngine';
import type {
  DocumentSystemBlockKey,
  DocumentTemplateContent,
  DocumentTemplateType,
} from '../../types/documentStudio';

type PreviewRow = [string, string];

const MONEY = 'F CFA';

function DocumentBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-800/15 bg-emerald-50 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-[0.1em] text-emerald-800">
      {children}
    </span>
  );
}

function KeyValueGrid({ rows }: { rows: PreviewRow[] }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-0.5 truncate text-[0.66rem] font-extrabold text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PreviewTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div
        className="grid bg-[#f8faf8] text-[0.5rem] font-black uppercase tracking-[0.08em] text-slate-500"
        style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0, 1fr))` }}
      >
        {head.map((item) => <div key={item} className="border-b border-slate-200 px-2 py-1.5">{item}</div>)}
      </div>
      {rows.map((row, rowIndex) => (
        <div
          key={row.join('-') || rowIndex}
          className="grid text-[0.58rem] font-semibold text-slate-700"
          style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, index) => (
            <div key={`${cell}-${index}`} className="min-w-0 border-b border-slate-100 px-2 py-1.5 last:border-b-0">
              <span className="block truncate">{cell}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MoneyStrip({ items }: { items: Array<{ label: string; value: string; tone?: 'emerald' | 'orange' | 'red' | 'slate' }> }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    orange: 'bg-orange-50 text-orange-900 border-orange-100',
    red: 'bg-red-50 text-red-900 border-red-100',
    slate: 'bg-slate-50 text-slate-900 border-slate-200',
  };
  return (
    <div className="grid gap-1.5 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={`rounded-md border px-2 py-1.5 ${tones[item.tone ?? 'slate']}`}>
          <p className="text-[0.5rem] font-black uppercase tracking-[0.1em] opacity-70">{item.label}</p>
          <p className="mt-0.5 text-[0.7rem] font-extrabold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function renderSystemBlock(systemKey: DocumentSystemBlockKey | undefined, documentType: DocumentTemplateType) {
  switch (systemKey) {
    case 'payment_summary':
      return (
        <MoneyStrip
          items={[
            { label: 'Période', value: 'Juillet 2026', tone: 'slate' },
            { label: 'Encaissé', value: `300 000 ${MONEY}`, tone: 'emerald' },
            { label: 'Statut', value: 'Soldé', tone: 'emerald' },
          ]}
        />
      );
    case 'tenant_identity':
      return <KeyValueGrid rows={[['Locataire', 'Fatou Sarr'], ['Téléphone', '77 000 12 34'], ['Pièce', '2 01 19940112 00456 7'], ['Adresse', 'Ouakam, Dakar']]} />;
    case 'property_identity':
      return <KeyValueGrid rows={[['Bien', 'Résidence Alima'], ['Unité', 'Appartement F4'], ['Adresse', 'Dakar - Ouakam'], ['Référence bail', 'CTR-2026-014']]} />;
    case 'payment_breakdown':
      return <PreviewTable head={['Libellé', 'Attendu', 'Réglé']} rows={[['Loyer mensuel', `300 000 ${MONEY}`, `300 000 ${MONEY}`], ['Reliquat', `0 ${MONEY}`, `0 ${MONEY}`]]} />;
    case 'owner_summary':
      return (
        <div className="space-y-2">
          <MoneyStrip
            items={[
              { label: 'Encaissements', value: `1 250 000 ${MONEY}`, tone: 'emerald' },
              { label: 'Reliquats', value: `120 000 ${MONEY}`, tone: 'orange' },
              { label: documentType === 'rapport_proprietaire' ? 'Net propriétaire' : 'Net à reverser', value: `980 000 ${MONEY}`, tone: 'emerald' },
            ]}
          />
          <p className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[0.62rem] leading-5 text-slate-600">
            Sur la période juillet 2026, le portefeuille présente des loyers encaissés, un reliquat prioritaire et un net clarifié pour reversement.
          </p>
        </div>
      );
    case 'occupancy':
      return (
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <div className="flex items-center justify-between text-[0.62rem] font-bold text-slate-700">
            <span>7 unités occupées / 8</span>
            <span className="text-emerald-800">88%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[88%] rounded-full bg-emerald-600" />
          </div>
        </div>
      );
    case 'collections':
      return <PreviewTable head={['Date', 'Locataire', 'Unité', 'Montant']} rows={[['05/07', 'Fatou Sarr', 'F4', `300 000 ${MONEY}`], ['11/07', 'Anta Diagne', 'Studio', `175 000 ${MONEY}`], ['18/07', 'Mouhamed Diop', 'F3', `250 000 ${MONEY}`]]} />;
    case 'expenses':
      return <PreviewTable head={['Date', 'Nature', 'Affectation', 'Montant']} rows={[['09/07', 'Plomberie', 'Résidence Alima', `45 000 ${MONEY}`], ['15/07', 'Électricité communs', 'Immeuble Keur', `18 000 ${MONEY}`]]} />;
    case 'commissions':
      return <KeyValueGrid rows={[['Base encaissée', `1 250 000 ${MONEY}`], ['Taux moyen', '10%'], ['Commission agence', `125 000 ${MONEY}`], ['Part bailleur', `1 125 000 ${MONEY}`]]} />;
    case 'arrears':
      return <PreviewTable head={['Locataire', 'Période', 'Restant dû']} rows={[['Ndeye Camara', 'Juillet 2026', `120 000 ${MONEY}`]]} />;
    case 'documents':
      return <KeyValueGrid rows={[['Quittances', '3 générées'], ['Justificatifs', '2 archivés'], ['Rapport', 'Prêt'], ['Coffre', 'Synchronisé']]} />;
    case 'qr_verification':
      return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-emerald-800 shadow-inner">
            <QrCode className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.66rem] font-extrabold text-emerald-950">Preuve vérifiable</p>
            <p className="mt-0.5 text-[0.58rem] leading-4 text-emerald-800">Référence publique enregistrée et consultable par QR Verify.</p>
          </div>
        </div>
      );
    default:
      return (
        <p className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[0.62rem] leading-5 text-slate-600">
          Cette section sera alimentée automatiquement par les données validées.
        </p>
      );
  }
}

export function DocumentTemplatePreview({ content }: { content: DocumentTemplateContent }) {
  let rendered;
  try {
    rendered = renderDocumentTemplate(content, getSampleTemplateVariables(content.documentType));
  } catch {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-amber-300/70 bg-amber-50/70 p-6 text-center">
        <div className="max-w-sm">
          <FileCheck2 className="mx-auto h-7 w-7 text-amber-700" />
          <h3 className="mt-3 text-sm font-black text-slate-900">Aperçu temporairement indisponible</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Corrigez les éléments signalés dans l’éditeur pour rétablir l’aperçu fidèle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto rounded-md border border-slate-900/10 bg-slate-100/80 p-3">
      <article className="mx-auto min-h-[46rem] max-w-[44rem] bg-white px-7 py-6 shadow-[0_18px_46px_rgba(15,23,42,0.12)]">
        <header className="border-t-2 border-emerald-800 pb-4 pt-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-orange-600">
                Aperçu fidèle du document
              </p>
              <h2 className="mt-1 font-serif text-xl font-black text-slate-950">{rendered.title}</h2>
              <p className="mt-1 text-[0.68rem] text-slate-500">Keur Gestion · Dakar · Réf. SK-2026-001</p>
            </div>
            {content.style.showLogo && (
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-900/10 bg-emerald-50">
                <FileCheck2 className="h-5 w-5 text-emerald-800" />
              </div>
            )}
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <DocumentBadge>Données fictives</DocumentBadge>
          {content.style.showQr && <DocumentBadge>QR Verify</DocumentBadge>}
          {content.style.showSignature && <DocumentBadge>Signature</DocumentBadge>}
          {content.style.showStamp && <DocumentBadge>Cachet</DocumentBadge>}
        </div>

        <div className="space-y-3.5">
          {rendered.blocks.map((block) => (
            <section key={block.id} className="break-inside-avoid">
              <h3 className="text-[0.68rem] font-black uppercase text-emerald-900">
                {block.kind === 'system' ? getSystemBlockPublicLabel(block.systemKey, block.title) : block.title}
              </h3>
              {block.kind === 'system' ? (
                <div className="mt-1.5">
                  {renderSystemBlock(block.systemKey, content.documentType)}
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-line text-[0.68rem] leading-[1.55] text-slate-700">
                  {block.content}
                </p>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-8 flex items-end justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-[0.58rem] text-slate-500">
            {content.style.showSignature && <Stamp className="h-4 w-4 text-emerald-700" />}
            <span>Document de prévisualisation · rendu conforme au modèle publié</span>
          </div>
          {content.style.showQr && <QrCode className="h-8 w-8 text-slate-800" />}
        </footer>
      </article>
    </div>
  );
}
