import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { WizardShell } from "../ui/WizardShell";
import { SmartCombobox } from "../ui/SmartCombobox";
import type { SmartComboboxOption } from "../ui/SmartCombobox";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_ENTITY_LABELS,
  formatStorageSize,
  validateDocumentFile,
  type RetentionPolicy,
  type UserDocumentCategory,
  type UserDocumentEntityType,
} from "../../services/documentStorage";

export interface DocumentEntityOption {
  id: string;
  label: string;
}

export interface DocumentUploadValue {
  file: File;
  name: string;
  category: UserDocumentCategory;
  entityType: UserDocumentEntityType | "";
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
  bailleurs: "bailleur",
  locataires: "locataire",
  immeubles: "immeuble",
  unites: "unite",
  contrats: "contrat",
};

const EMPTY_VALUE: Omit<DocumentUploadValue, "file"> & { file: File | null } = {
  file: null,
  name: "",
  category: "administratif",
  entityType: "",
  entityId: "",
  retentionPolicy: "standard",
  description: "",
  tags: "",
};

const WIZARD_STEPS = [
  { id: 1, label: "Fichier", shortLabel: "Fichier" },
  { id: 2, label: "Classement", shortLabel: "Classement" },
  { id: 3, label: "Confirmation", shortLabel: "Confirmer" },
];

const RETENTION_OPTIONS: SmartComboboxOption[] = [
  { value: "standard", label: "Standard", subtitle: "Durée légale habituelle" },
  { value: "critical", label: "Longue durée", subtitle: "Conservation renforcée" },
  { value: "temporary", label: "Temporaire", subtitle: "Court terme" },
];

const primaryActionClass =
  "inline-flex h-8 min-h-0 w-full min-w-[7rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-3 py-1 text-[0.72rem] font-semibold leading-none text-white shadow-[0_10px_22px_rgba(6,45,35,0.16)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] focus-visible:ring-2 focus-visible:ring-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const secondaryActionClass =
  "inline-flex h-8 min-h-0 w-full min-w-[6rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-950/10 bg-white/85 px-3 py-1 text-[0.72rem] font-semibold leading-none text-slate-600 shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700/20 disabled:opacity-50 sm:w-auto";

function fileTypeLabel(file: File) {
  if (file.type === "application/pdf") return "Document PDF";
  if (file.type.startsWith("image/")) return "Image";
  if (file.type.includes("sheet") || file.type.includes("excel")) return "Feuille Excel";
  if (file.type === "text/csv") return "Fichier CSV";
  return file.type || "Type non renseigné";
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
    if (!value.file?.type.startsWith("image/")) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const selectedEntityType = value.entityType || ENTITY_BY_CATEGORY[value.category] || "";
  const selectedOptions = selectedEntityType ? entityOptions[selectedEntityType] ?? [] : [];
  const selectedEntity = selectedOptions.find((option) => option.id === value.entityId);
  const classificationValid = !selectedEntityType || (selectedOptions.length > 0 && Boolean(value.entityId));

  const categoryLabel = (category: UserDocumentCategory) => {
    if (isIndividualOwner && category === "bailleurs") return "Propriétaire";
    return DOCUMENT_CATEGORY_LABELS[category];
  };
  const entityLabel = (entityType: UserDocumentEntityType) => {
    if (isIndividualOwner && entityType === "agency") return "Compte propriétaire";
    if (isIndividualOwner && entityType === "bailleur") return "Propriétaire";
    return DOCUMENT_ENTITY_LABELS[entityType];
  };

  const displayName = useMemo(
    () => value.name.trim() || value.file?.name || "Document sans nom",
    [value.file?.name, value.name]
  );

  const categoryOptions: SmartComboboxOption[] = categories.map((cat) => ({
    value: cat,
    label: categoryLabel(cat),
  }));

  const entityTypeOptions: SmartComboboxOption[] = [
    { value: "", label: "Aucun élément" },
    ...(Object.keys(DOCUMENT_ENTITY_LABELS) as UserDocumentEntityType[])
      .filter((id) => id !== "operation" && !(isIndividualOwner && id === "bailleur"))
      .map((id) => ({ value: id, label: entityLabel(id) })),
  ];

  const linkedItemOptions: SmartComboboxOption[] = selectedEntityType
    ? [
        { value: "", label: "Sélectionner" },
        ...selectedOptions.map((o) => ({ value: o.id, label: o.label })),
      ]
    : [{ value: "", label: "Aucun lien" }];

  const chooseFile = (file: File | null) => {
    if (!file) return;
    try {
      validateDocumentFile(file);
      setValue((current) => ({
        ...current,
        file,
        name: current.name || file.name.replace(/\.[^.]+$/, ""),
      }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Fichier non pris en charge.");
    }
  };

  const close = () => { if (!submitting) onClose(); };

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

  const currentStepIndex = step - 1;

  const secondaryAction = complete ? undefined : (
    <button
      type="button"
      onClick={() => step === 1 ? close() : setStep((step - 1) as 1 | 2)}
      disabled={submitting}
      className={secondaryActionClass}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {step === 1 ? "Annuler" : "Retour"}
    </button>
  );

  const primaryAction = complete ? (
    <button type="button" onClick={onClose} className={primaryActionClass}>
      <Check className="h-3.5 w-3.5" />
      Voir dans la GED
    </button>
  ) : step < 3 ? (
    <button
      type="button"
      onClick={() => setStep((step + 1) as 2 | 3)}
      disabled={(step === 1 && !value.file) || (step === 2 && !classificationValid)}
      className={primaryActionClass}
    >
      Continuer
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void submit()}
      disabled={submitting}
      className={primaryActionClass}
    >
      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      {submitting ? "Ajout au coffre..." : "Ajouter au coffre"}
    </button>
  );

  return (
    <WizardShell
      open={isOpen}
      title={complete ? "Document ajouté" : `Ajouter un document · ${step}/3`}
      eyebrow="DOCUMENTS GED"
      description="Ajoutez une preuve terrain et classez-la dans son contexte métier."
      steps={WIZARD_STEPS}
      currentStep={currentStepIndex}
      size="compact"
      variant="workstation"
      tone="documents"
      onClose={close}
      secondaryAction={secondaryAction}
      primaryAction={primaryAction}
      panelClassName="sm:!w-[min(90vw,600px)] sm:!max-w-[600px]"
      bodyClassName="!py-2.5 sm:!py-3"
      footerClassName="!py-1.5"
    >
      {complete ? (
        <div className="flex min-h-[14rem] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Coffre documentaire</p>
          <h3 className="mt-1.5 text-lg font-black text-slate-950">Document ajouté avec succès</h3>
          <p className="mt-2 max-w-sm text-xs font-semibold leading-5 text-slate-500">
            {displayName} est maintenant disponible dans la GED avec son classement métier.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700" role="alert">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-2.5">
              <div
                className="overflow-hidden rounded-2xl border border-dashed border-emerald-700/25 bg-emerald-50/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files?.[0] ?? null); }}
              >
                <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-xl bg-white/90 px-3 py-4 text-center shadow-sm ring-1 ring-white/80 transition hover:bg-emerald-50/40">
                  <Upload className="mb-2 h-6 w-6 text-emerald-800" />
                  <span className="block text-sm font-extrabold text-slate-950">Déposez ou sélectionnez un fichier</span>
                  <span className="mt-1 block text-[11px] font-semibold leading-5 text-slate-500">
                    PDF, PNG, JPG, WEBP, SVG, CSV ou Excel · 50 Mo max
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx"
                    onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              {value.file && (
                <div className="flex items-center gap-2.5 overflow-hidden rounded-2xl border border-emerald-200 bg-white/90 p-2.5 shadow-sm">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-800">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Aperçu du document" className="h-full w-full object-cover" />
                    ) : value.file.type.startsWith("image/") ? (
                      <FileImage className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 flex-shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-slate-950">{value.file.name}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                      {fileTypeLabel(value.file)} · {formatStorageSize(value.file.size)}
                    </p>
                  </div>
                  <ShieldCheck className="hidden h-4 w-4 flex-shrink-0 text-emerald-700 sm:block" />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid max-w-full gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2 min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Nom du document</p>
                <input
                  value={value.name}
                  onChange={(e) => setValue((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Ex : CNI locataire, titre foncier..."
                  className="!h-8 !min-h-8 w-full rounded-[0.6rem] border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600/15"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Dossier métier</p>
                <SmartCombobox
                  value={value.category}
                  options={categoryOptions}
                  onChange={(val) => {
                    const category = val as UserDocumentCategory;
                    setValue((c) => ({ ...c, category, entityType: ENTITY_BY_CATEGORY[category] ?? "", entityId: "" }));
                  }}
                  placeholder="Choisir un dossier"
                  searchPlaceholder="Rechercher un dossier..."
                  density="compact"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Conservation</p>
                <SmartCombobox
                  value={value.retentionPolicy}
                  options={RETENTION_OPTIONS}
                  onChange={(val) => setValue((c) => ({ ...c, retentionPolicy: val as RetentionPolicy }))}
                  placeholder="Durée de conservation"
                  searchPlaceholder="Rechercher..."
                  density="compact"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Lier à</p>
                <SmartCombobox
                  value={selectedEntityType}
                  options={entityTypeOptions}
                  onChange={(val) => setValue((c) => ({ ...c, entityType: val as UserDocumentEntityType | "", entityId: "" }))}
                  placeholder="Type d'entité"
                  searchPlaceholder="Rechercher un type..."
                  density="compact"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Élément lié</p>
                <SmartCombobox
                  value={value.entityId}
                  options={linkedItemOptions}
                  onChange={(val) => setValue((c) => ({ ...c, entityId: val }))}
                  placeholder={selectedEntityType ? "Sélectionner" : "Aucun lien"}
                  searchPlaceholder="Rechercher..."
                  density="compact"
                  disabled={!selectedEntityType || selectedOptions.length === 0}
                />
              </div>

              {selectedEntityType && selectedOptions.length === 0 && (
                <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Aucun élément disponible pour ce type de classement.
                </p>
              )}

              <div className="sm:col-span-2 min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Description courte</p>
                <textarea
                  value={value.description}
                  onChange={(e) => setValue((c) => ({ ...c, description: e.target.value }))}
                  rows={2}
                  maxLength={300}
                  className="w-full resize-none rounded-[0.6rem] border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600/15"
                  placeholder="Contexte, validité ou observation interne..."
                />
              </div>
            </div>
          )}

          {step === 3 && value.file && (
            <div className="space-y-2.5">
              <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white/90 px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Résumé avant ajout</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 mb-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-slate-950 truncate max-w-[24rem]">{displayName}</span>
                </div>
                <dl className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between gap-4 py-1.5"><dt className="font-semibold text-slate-500 shrink-0">Fichier</dt><dd className="min-w-0 truncate text-right font-bold text-slate-800">{value.file.name}</dd></div>
                  <div className="flex justify-between gap-4 py-1.5"><dt className="font-semibold text-slate-500 shrink-0">Taille</dt><dd className="font-bold text-slate-800">{formatStorageSize(value.file.size)}</dd></div>
                  <div className="flex justify-between gap-4 py-1.5"><dt className="font-semibold text-slate-500 shrink-0">Dossier</dt><dd className="font-bold text-slate-800">{categoryLabel(value.category)}</dd></div>
                  <div className="flex justify-between gap-4 py-1.5"><dt className="font-semibold text-slate-500 shrink-0">Contexte</dt><dd className="min-w-0 text-right font-bold text-slate-800">{selectedEntity?.label || "Document à classer"}</dd></div>
                  <div className="flex justify-between gap-4 py-1.5"><dt className="font-semibold text-slate-500 shrink-0">Statut initial</dt><dd className="font-bold text-emerald-700">{value.category === "archives" ? "Archivé" : (selectedEntity ? "Classé" : "À classer")}</dd></div>
                </dl>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-2.5 py-2 text-[0.7rem] font-semibold leading-5 text-emerald-900">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Le fichier reste privé. Son accès passe par une URL signée temporaire et les règles de votre organisation.
              </div>
            </div>
          )}
        </div>
      )}
    </WizardShell>
  );
}
