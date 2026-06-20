import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_ENTITY_LABELS,
  formatStorageSize,
  validateDocumentFile,
  type RetentionPolicy,
  type UserDocumentCategory,
  type UserDocumentEntityType,
} from '../../services/documentStorage';

export interface DocumentEntityOption {
  id: string;
  label: string;
}

export interface DocumentUploadValue {
  file: File;
  name: string;
  category: UserDocumentCategory;
  entityType: UserDocumentEntityType | '';
  entityId: string;
  retentionPolicy: RetentionPolicy;
  description: string;
  tags: string;
}

interface DocumentUploadWizardProps {
  isOpen: boolean;
  isIndividualOwner: boolean;
  categories: UserDocumentCategory[];
  entityOptions: Record<UserDocumentEntityType, DocumentEntityOption[]>;
  onClose: () => void;
  onUpload: (value: DocumentUploadValue) => Promise<void>;
}

const ENTITY_BY_CATEGORY: Partial<Record<UserDocumentCategory, UserDocumentEntityType>> = {
  bailleurs: 'bailleur',
  locataires: 'locataire',
  immeubles: 'immeuble',
  unites: 'unite',
  contrats: 'contrat',
};

const EMPTY_VALUE: Omit<DocumentUploadValue, 'file'> & { file: File | null } = {
  file: null,
  name: '',
  category: 'administratif',
  entityType: '',
  entityId: '',
  retentionPolicy: 'standard',
  description: '',
  tags: '',
};

const STEPS = [
  { id: 1, label: 'Fichier' },
  { id: 2, label: 'Classement' },
  { id: 3, label: 'Confirmation' },
] as const;

function fileTypeLabel(file: File) {
  if (file.type === 'application/pdf') return 'Document PDF';
  if (file.type.startsWith('image/')) return 'Image';
  if (file.type.includes('sheet') || file.type.includes('excel')) return 'Feuille Excel';
  if (file.type === 'text/csv') return 'Fichier CSV';
  return file.type || 'Type non renseigné';
}

export function DocumentUploadWizard({
  isOpen,
  isIndividualOwner,
  categories,
  entityOptions,
  onClose,
  onUpload,
}: DocumentUploadWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [value, setValue] = useState(EMPTY_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setValue(EMPTY_VALUE);
    setError(null);
    setSubmitting(false);
    setComplete(false);
  }, [isOpen]);

  useEffect(() => {
    if (!value.file?.type.startsWith('image/')) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const selectedEntityType = value.entityType || ENTITY_BY_CATEGORY[value.category] || '';
  const selectedOptions = selectedEntityType ? entityOptions[selectedEntityType] ?? [] : [];
  const selectedEntity = selectedOptions.find((option) => option.id === value.entityId);
  const classificationValid = !selectedEntityType || (selectedOptions.length > 0 && Boolean(value.entityId));

  const title = complete ? 'Document ajouté' : `Ajouter un document · ${step}/3`;
  const categoryLabel = (category: UserDocumentCategory) => {
    if (isIndividualOwner && category === 'bailleurs') return 'Propriétaire';
    return DOCUMENT_CATEGORY_LABELS[category];
  };
  const entityLabel = (entityType: UserDocumentEntityType) => {
    if (isIndividualOwner && entityType === 'agency') return 'Compte propriétaire';
    if (isIndividualOwner && entityType === 'bailleur') return 'Propriétaire';
    return DOCUMENT_ENTITY_LABELS[entityType];
  };

  const displayName = useMemo(
    () => value.name.trim() || value.file?.name || 'Document sans nom',
    [value.file?.name, value.name]
  );

  const chooseFile = (file: File | null) => {
    if (!file) return;
    try {
      validateDocumentFile(file);
      setValue((current) => ({
        ...current,
        file,
        name: current.name || file.name.replace(/\.[^.]+$/, ''),
      }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Fichier non pris en charge.');
    }
  };

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!value.file || !classificationValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onUpload({ ...value, file: value.file, entityType: selectedEntityType });
      setComplete(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible d'ajouter le document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={title}
      description="Ajoutez une preuve terrain et classez-la dans son contexte métier."
    >
      {complete ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Coffre documentaire</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">Document ajouté avec succès</h3>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">
            {displayName} est maintenant disponible dans la GED avec son classement métier.
          </p>
          <button type="button" onClick={onClose} className="sk-action sk-action-primary mt-6 justify-center">
            <Check className="h-4 w-4" />
            Voir dans la GED
          </button>
        </div>
      ) : (
        <form className="flex min-h-[31rem] flex-col" onSubmit={(event) => event.preventDefault()}>
          <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Progression de l’ajout">
            {STEPS.map((item) => {
              const active = item.id === step;
              const done = item.id < step;
              return (
                <li key={item.id} className="min-w-0">
                  <div className={`h-1 rounded-full ${active || done ? 'bg-emerald-700' : 'bg-slate-200'}`} />
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black ${done ? 'bg-emerald-700 text-white' : active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? <Check className="h-3 w-3" /> : item.id}
                    </span>
                    <span className={`truncate text-[10px] font-black uppercase tracking-[0.05em] sm:text-xs ${active ? 'text-slate-950' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold leading-5 text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex-1">
            {step === 1 && (
              <div className="space-y-4">
                <div
                  className="rounded-2xl border border-dashed border-emerald-700/30 bg-emerald-50/50 p-3"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    chooseFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <label className="flex min-h-[12rem] cursor-pointer flex-col items-center justify-center rounded-xl bg-white px-4 py-5 text-center shadow-sm transition hover:bg-emerald-50/40">
                    <Upload className="h-8 w-8 text-emerald-800" />
                    <span className="mt-3 text-sm font-black text-slate-950">Déposer ou sélectionner un fichier</span>
                    <span className="mt-1 max-w-sm text-xs font-semibold leading-5 text-slate-500">
                      PDF, PNG, JPG, WEBP, SVG, CSV ou Excel · 50 Mo maximum
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx"
                      onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                </div>

                {value.file && (
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-emerald-800">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Aperçu du document" className="h-full w-full object-cover" />
                      ) : value.file.type.startsWith('image/') ? (
                        <FileImage className="h-6 w-6" />
                      ) : (
                        <FileText className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{value.file.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {fileTypeLabel(value.file)} · {formatStorageSize(value.file.size)}
                      </p>
                    </div>
                    <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-700" />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Nom du document</span>
                  <input
                    value={value.name}
                    onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex : CNI locataire, titre foncier..."
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700">Dossier métier</span>
                  <select
                    value={value.category}
                    onChange={(event) => {
                      const category = event.target.value as UserDocumentCategory;
                      setValue((current) => ({
                        ...current,
                        category,
                        entityType: ENTITY_BY_CATEGORY[category] ?? '',
                        entityId: '',
                      }));
                    }}
                  >
                    {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700">Conservation</span>
                  <select
                    value={value.retentionPolicy}
                    onChange={(event) => setValue((current) => ({ ...current, retentionPolicy: event.target.value as RetentionPolicy }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="critical">Longue durée</option>
                    <option value="temporary">Temporaire</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700">Lier à</span>
                  <select
                    value={selectedEntityType}
                    onChange={(event) => setValue((current) => ({ ...current, entityType: event.target.value as UserDocumentEntityType | '', entityId: '' }))}
                  >
                    <option value="">Aucun élément</option>
                    {(Object.keys(DOCUMENT_ENTITY_LABELS) as UserDocumentEntityType[])
                      .filter((id) => id !== 'operation' && !(isIndividualOwner && id === 'bailleur'))
                      .map((id) => <option key={id} value={id}>{entityLabel(id)}</option>)}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700">Élément lié</span>
                  <select
                    value={value.entityId}
                    disabled={!selectedEntityType || selectedOptions.length === 0}
                    onChange={(event) => setValue((current) => ({ ...current, entityId: event.target.value }))}
                  >
                    <option value="">{selectedEntityType ? 'Sélectionner' : 'Aucun lien'}</option>
                    {selectedOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>

                {selectedEntityType && selectedOptions.length === 0 && (
                  <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Aucun élément disponible pour ce type de classement.
                  </p>
                )}

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Description courte</span>
                  <textarea
                    value={value.description}
                    onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}
                    rows={2}
                    maxLength={300}
                    placeholder="Contexte, validité ou observation interne..."
                  />
                </label>
              </div>
            )}

            {step === 3 && value.file && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Résumé avant ajout</p>
                  <h3 className="mt-2 break-words text-lg font-black text-slate-950">{displayName}</h3>
                  <dl className="mt-4 divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-slate-500">Fichier</dt><dd className="min-w-0 truncate text-right font-bold text-slate-800">{value.file.name}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-slate-500">Taille</dt><dd className="font-bold text-slate-800">{formatStorageSize(value.file.size)}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-slate-500">Dossier</dt><dd className="font-bold text-slate-800">{categoryLabel(value.category)}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-slate-500">Contexte</dt><dd className="min-w-0 text-right font-bold text-slate-800">{selectedEntity?.label || 'Document à classer'}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-slate-500">Statut initial</dt><dd className="font-bold text-emerald-700">{selectedEntity ? 'Classé' : 'À classer'}</dd></div>
                  </dl>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold leading-5 text-emerald-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Le fichier reste privé. Son accès passe par une URL signée temporaire et les règles de votre organisation.
                </div>
              </div>
            )}
          </div>

          <div className="sticky -bottom-4 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-4 pb-1 pt-3 backdrop-blur sm:-bottom-5 sm:-mx-6 sm:flex-row sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={() => step === 1 ? close() : setStep((step - 1) as 1 | 2)}
              disabled={submitting}
              className="sk-action sk-action-secondary justify-center"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? 'Annuler' : 'Retour'}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={(step === 1 && !value.file) || (step === 2 && !classificationValid)}
                className="sk-action sk-action-primary justify-center disabled:cursor-not-allowed disabled:opacity-45"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="sk-action sk-action-financial justify-center disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {submitting ? 'Ajout au coffre...' : 'Ajouter au coffre'}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
