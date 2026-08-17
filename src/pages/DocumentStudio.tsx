import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileClock,
  History,
  Save,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { useAuth } from '../contexts/AuthContext';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
import { ToastContainer } from '../components/ui/Toast';
import { DocumentTemplateEditor } from '../components/documents/DocumentTemplateEditor';
import { DocumentTemplatePreview } from '../components/documents/DocumentTemplatePreview';
import { useToast } from '../hooks/useToast';
import { useDocumentPreviewPdf } from '../hooks/useDocumentPreviewPdf';
import { loadAgencySettings } from '../lib/pdf';
import {
  stableTemplateStringify,
  validateDocumentTemplate,
} from '../lib/documents/templateEngine';
import {
  loadDocumentTemplateWorkspace,
  publishDocumentTemplate,
  restoreDocumentTemplateRevision,
  saveDocumentTemplateDraft,
} from '../services/documentTemplateService';
import type { AgencySettings } from '../types';
import {
  DOCUMENT_TEMPLATE_TYPES,
  type AgencyDocumentTemplateRow,
  type DocumentTemplateContent,
  type DocumentTemplateRevision,
  type DocumentTemplateType,
} from '../types/documentStudio';

const DOCUMENT_CHOICES: Array<{ type: DocumentTemplateType; label: string }> = [
  { type: 'contrat', label: 'Contrat' },
  { type: 'mandat', label: 'Mandat' },
  { type: 'quittance', label: 'Quittance' },
  { type: 'rapport_bailleur', label: 'Rapport bailleur' },
  { type: 'rapport_proprietaire', label: 'Rapport propriétaire' },
];

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('ADMIN_REQUIRED')) return 'Seul un administrateur peut modifier ou publier un modèle.';
  if (message.includes('TEMPLATE_CONFLICT')) return 'Le modèle a changé ailleurs. Rechargez avant de réessayer.';
  if (message.includes('42P01') || message.includes('agency_document_templates')) {
    return 'Le stockage du Studio documentaire doit être activé par la migration prévue.';
  }
  return message || 'Une erreur empêche cette action.';
}

function SimpleDocumentMode({
  content,
  onChange,
  onShowPreview,
  onDownloadTest,
}: {
  content: DocumentTemplateContent;
  onChange: (content: DocumentTemplateContent) => void;
  onShowPreview: () => void;
  onDownloadTest: () => void;
}) {
  const activeBlocks = content.blocks.filter((block) => block.enabled).length;
  const updateStyle = (key: keyof DocumentTemplateContent['style'], value: boolean) => {
    onChange({ ...content, style: { ...content.style, [key]: value } });
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-md border border-emerald-950/10 bg-white p-3">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-orange-600">Mode simple</p>
        <h2 className="mt-1 text-sm font-black text-slate-950">Réglages visibles du document</h2>
        <p className="mt-1 max-w-2xl text-[0.68rem] font-semibold leading-5 text-slate-500">
          Activez les éléments d’identité, vérifiez l’aperçu et générez un PDF test. Les clauses détaillées restent disponibles en mode avancé.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { key: 'showLogo', label: 'Logo agence', helper: 'Affiché dans l’en-tête.' },
            { key: 'showQr', label: 'QR Verify', helper: 'Authentification publique.' },
            { key: 'showSignature', label: 'Signature', helper: 'Bloc signature si configuré.' },
            { key: 'showStamp', label: 'Cachet', helper: 'Cachet officiel si configuré.' },
          ].map((option) => (
            <label key={option.key} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span>
                <span className="block text-xs font-black text-slate-900">{option.label}</span>
                <span className="mt-0.5 block text-[0.62rem] font-semibold text-slate-500">{option.helper}</span>
              </span>
              <input
                type="checkbox"
                checked={content.style[option.key as keyof typeof content.style] === true}
                onChange={(event) => updateStyle(option.key as keyof DocumentTemplateContent['style'], event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-800"
              />
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PremiumButton variant="primary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={onDownloadTest}>
            PDF test
          </PremiumButton>
          <PremiumButton variant="secondary" size="sm" onClick={onShowPreview}>
            Voir l’aperçu
          </PremiumButton>
        </div>
      </section>

      <aside className="rounded-md border border-emerald-950/10 bg-[#fffdf8] p-3">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-emerald-700">Structure active</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{activeBlocks}</p>
        <p className="mt-1 text-[0.66rem] font-semibold leading-5 text-slate-500">
          sections publiables. Les articles personnalisés et l’ordre des clauses se règlent en mode avancé.
        </p>
        <div className="mt-3 space-y-1">
          {content.blocks.slice(0, 5).map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-[0.62rem] font-bold text-slate-700">
              <span className="truncate">{block.title}</span>
              <span className={block.enabled ? 'text-emerald-700' : 'text-slate-400'}>{block.enabled ? 'Actif' : 'Masqué'}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function DocumentStudio() {
  const { accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [documentType, setDocumentType] = useState<DocumentTemplateType>(() => {
    const requested = searchParams.get('type');
    if (!requested || !(DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(requested)) return 'contrat';
    if (isIndividualOwner && requested === 'rapport_bailleur') return 'rapport_proprietaire';
    if (!isIndividualOwner && requested === 'rapport_proprietaire') return 'rapport_bailleur';
    return requested as DocumentTemplateType;
  });
  const [content, setContent] = useState<DocumentTemplateContent | null>(null);
  const [row, setRow] = useState<AgencyDocumentTemplateRow | null>(null);
  const [history, setHistory] = useState<DocumentTemplateRevision[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [activeView, setActiveView] = useState<'editor' | 'preview' | 'history'>('editor');
  const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>('simple');
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [settings, setSettings] = useState<Partial<AgencySettings>>({});
  const loadSequence = useRef(0);

  useEffect(() => {
    void loadAgencySettings().then(setSettings);
  }, []);

  const preview = useDocumentPreviewPdf(documentType, content, settings);

  const load = async (type: DocumentTemplateType) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const workspace = await loadDocumentTemplateWorkspace(type);
      if (sequence !== loadSequence.current) return;
      setRow(workspace.row);
      setContent(workspace.draft);
      setSavedFingerprint(stableTemplateStringify(workspace.draft));
      setHistory(workspace.history);
      setSelectedBlockId(workspace.draft.blocks[0]?.id ?? null);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      toast.error(getFriendlyError(error));
      setContent(null);
      setRow(null);
      setHistory([]);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(documentType);
    // toast callbacks are stable and deliberately excluded from route loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType]);

  const issues = useMemo(() => content ? validateDocumentTemplate(content) : [], [content]);
  const currentFingerprint = useMemo(
    () => content ? stableTemplateStringify(content) : '',
    [content],
  );
  const hasUnsavedChanges = Boolean(content) && currentFingerprint !== savedFingerprint;
  const canPublish = Boolean(content) && issues.length === 0 && !saving && !publishing;

  useEffect(() => {
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventAccidentalExit);
    return () => window.removeEventListener('beforeunload', preventAccidentalExit);
  }, [hasUnsavedChanges]);

  const confirmDiscard = () => (
    !hasUnsavedChanges
    || window.confirm('Ce brouillon contient des modifications non enregistrées. Les abandonner ?')
  );

  const saveDraft = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const saved = await saveDocumentTemplateDraft(documentType, content, row);
      setRow(saved);
      setSavedFingerprint(stableTemplateStringify(content));
      toast.success('Modèle enregistré.');
    } catch (error) {
      toast.error(getFriendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!content) return;
    setPublishing(true);
    try {
      let current = row;
      if (!current) {
        current = await saveDocumentTemplateDraft(documentType, content, null);
        setRow(current);
      }
      await publishDocumentTemplate(current, content, changeNote);
      setChangeNote('');
      await load(documentType);
      toast.success('Modèle publié. Les prochains documents utiliseront cette version.');
    } catch (error) {
      toast.error(getFriendlyError(error));
    } finally {
      setPublishing(false);
    }
  };

  const restore = async (revision: DocumentTemplateRevision) => {
    if (!row) return;
    setSaving(true);
    try {
      const saved = await restoreDocumentTemplateRevision(revision, row);
      setRow(saved);
      setContent(revision.content);
      setSavedFingerprint(stableTemplateStringify(revision.content));
      setSelectedBlockId(revision.content.blocks[0]?.id ?? null);
      setActiveView('editor');
      toast.success(`Révision ${revision.revision} restaurée dans le brouillon.`);
    } catch (error) {
      toast.error(getFriendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  const downloadTest = () => {
    if (!preview.doc) {
      toast.error(preview.supported ? "L'aperçu n'est pas encore prêt." : "Aperçu bientôt disponible pour ce type.");
      return;
    }
    // Télécharge exactement le PDF déjà affiché dans l'aperçu — aucune
    // référence n'est allouée, aucune écriture registre n'a lieu (previewMode).
    preview.doc.save(`TEST-${documentType.toUpperCase()}.pdf`);
  };

  return (
    <PageShell spacing="compact" variant="dataDense" tone="paper" verticalInset="compact" ariaLabel="Studio documentaire">
      <PremiumPageHeader
        variant="registry"
        density="ultraCompact"
        eyebrow="STUDIO DOCUMENTAIRE"
        title="Modèles & clauses"
        description="Adaptez les documents à vos pratiques, puis publiez une version traçable."
        mobileDescription="Modèles, clauses et aperçu."
        secondaryAction={
          <PremiumButton
            variant="secondary"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            onClick={() => {
              if (confirmDiscard()) navigate('/documents');
            }}
          >
            Documents
          </PremiumButton>
        }
        primaryAction={
          <PremiumButton variant="create" size="sm" icon={<Send className="h-3.5 w-3.5" />} disabled={!canPublish} onClick={publish}>
            {publishing ? 'Publication…' : 'Publier version active'}
          </PremiumButton>
        }
      />

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <section className="min-w-0 rounded-md border border-emerald-950/10 bg-[#fffdf8] shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-2.5">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {DOCUMENT_CHOICES.filter(c => isIndividualOwner ? c.type !== 'rapport_bailleur' : c.type !== 'rapport_proprietaire').map((choice) => (
                <button
                  type="button"
                  key={choice.type}
                  onClick={() => {
                    if (choice.type !== documentType && confirmDiscard()) setDocumentType(choice.type);
                  }}
                  className={`h-8 shrink-0 rounded-md px-2.5 text-[0.66rem] font-black transition ${
                    documentType === choice.type
                      ? 'bg-emerald-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
                {[
                  { id: 'editor', label: 'Éditeur' },
                  { id: 'preview', label: 'Aperçu' },
                  { id: 'history', label: `Historique ${history.length || ''}` },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setActiveView(item.id as typeof activeView)}
                    className={`h-7 rounded px-2 text-[0.62rem] font-bold ${activeView === item.id ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {activeView === 'editor' && (
                <div className="flex rounded-md border border-emerald-900/10 bg-emerald-50 p-0.5">
                  {[
                    { id: 'simple', label: 'Simple' },
                    { id: 'advanced', label: 'Avancé' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setEditorMode(item.id as typeof editorMode)}
                      className={`flex h-7 items-center gap-1 rounded px-2 text-[0.62rem] font-bold ${editorMode === item.id ? 'bg-emerald-950 text-white' : 'text-emerald-900'}`}
                    >
                      {item.id === 'advanced' && <SlidersHorizontal className="h-3 w-3" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.56rem] font-black uppercase text-amber-700">
                    Non enregistré
                  </span>
                )}
                <PremiumButton variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={downloadTest} disabled={!content || !preview.doc}>
                  PDF test
                </PremiumButton>
                <PremiumButton variant="primary" size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={saveDraft} disabled={!content || !hasUnsavedChanges || saving || publishing}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </PremiumButton>
              </div>
            </div>
          </div>

          <div className="p-2.5">
            {loading ? (
              <div className="flex min-h-[28rem] items-center justify-center text-xs font-semibold text-slate-500">
                Chargement du modèle…
              </div>
            ) : !content ? (
              <div className="flex min-h-[28rem] items-center justify-center rounded-md border border-dashed border-red-200 bg-red-50 p-6 text-center text-xs text-red-700">
                Le Studio ne peut pas charger ce modèle. Vérifiez la migration et vos droits.
              </div>
            ) : activeView === 'editor' ? (
              editorMode === 'simple' ? (
                <SimpleDocumentMode
                  content={content}
                  onChange={setContent}
                  onShowPreview={() => setActiveView('preview')}
                  onDownloadTest={downloadTest}
                />
              ) : (
                <DocumentTemplateEditor
                  content={content}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onChange={setContent}
                />
              )
            ) : activeView === 'preview' ? (
              <div className="h-[42rem]">
                <DocumentTemplatePreview
                  blobUrl={preview.blobUrl}
                  loading={preview.loading}
                  error={preview.error}
                  supported={preview.supported}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-white text-center">
                    <FileClock className="h-7 w-7 text-slate-300" />
                    <p className="mt-2 text-xs font-black text-slate-800">Aucune version publiée</p>
                    <p className="mt-1 max-w-sm text-[0.66rem] text-slate-500">La première publication créera une révision immuable et reproductible.</p>
                  </div>
                ) : history.map((revision) => (
                  <div key={revision.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                        <History className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900">Révision {revision.revision}</p>
                        <p className="truncate text-[0.62rem] text-slate-500">
                          {new Date(revision.published_at).toLocaleString('fr-FR')} · {revision.change_note || 'Publication'}
                        </p>
                      </div>
                    </div>
                    <PremiumButton variant="secondary" size="sm" onClick={() => restore(revision)}>
                      Restaurer
                    </PremiumButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-3">
          {content && (
            <div className="hidden h-[31rem] lg:block">
              <DocumentTemplatePreview
                blobUrl={preview.blobUrl}
                loading={preview.loading}
                error={preview.error}
                supported={preview.supported}
              />
            </div>
          )}
          <div className="rounded-md border border-emerald-950/10 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${issues.length ? 'text-orange-600' : 'text-emerald-700'}`} />
              <div>
                <p className="text-xs font-black text-slate-900">
                  {issues.length ? `${issues.length} point${issues.length > 1 ? 's' : ''} à corriger` : 'Modèle prêt à publier'}
                </p>
                <p className="text-[0.62rem] text-slate-500">
                  {row?.published_revision_id ? 'Une version est déjà utilisée en production.' : 'Le catalogue officiel reste actif tant que vous ne publiez pas.'}
                </p>
              </div>
            </div>
            {issues.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-md bg-orange-50 p-2 text-[0.62rem] text-orange-800">
                {issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${index}`}>• {issue.message}</li>)}
              </ul>
            )}
            {content && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {[
                  { key: 'showLogo', label: 'Logo' },
                  { key: 'showQr', label: 'QR public' },
                  { key: 'showSignature', label: 'Signature' },
                  { key: 'showStamp', label: 'Cachet' },
                ].map((option) => (
                  <label key={option.key} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[0.62rem] font-bold text-slate-700">
                    {option.label}
                    <input
                      type="checkbox"
                      checked={content.style[option.key as keyof typeof content.style] === true}
                      onChange={(event) => setContent({
                        ...content,
                        style: { ...content.style, [option.key]: event.target.checked },
                      })}
                      className="h-3.5 w-3.5 accent-emerald-800"
                    />
                  </label>
                ))}
              </div>
            )}
            <label className="mt-3 block">
              <span className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-slate-500">Note de publication</span>
              <input
                value={changeNote}
                maxLength={160}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Ex. Mise à jour des clauses de préavis"
                className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
          </div>
        </aside>
      </div>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </PageShell>
  );
}
