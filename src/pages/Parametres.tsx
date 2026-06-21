import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Upload,
  AlertCircle,
  FileText,
  Palette,
  Building,
  CheckCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { AgencySettings, DEFAULT_AGENCY_SETTINGS } from '../types/agency';
import { ToastContainer } from '../components/ui/Toast';
import { invalidateAgencySettingsCache } from '../lib/pdf';
import { PageSkeleton } from '../components/ui/Skeleton';
import { formatSenegalPhone, formatSenegalPhoneInput, normalizeSenegalPhone } from '../lib/formatters';

type SettingsState = Omit<AgencySettings, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

type SettingsTab = 'general' | 'documents' | 'appearance' | 'modules';
type LogoUploadState = 'idle' | 'preview' | 'uploading' | 'done';

const AGENCY_ASSETS_BUCKET = 'agency-assets';
const LOGO_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const LOGO_COMPRESSION_THRESHOLD = 1.4 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 1200;

const EMPTY_SETTINGS: Omit<SettingsState, 'agency_id'> = {
  nom_agence: '',
  adresse: '',
  telephone: '',
  email: '',
  site_web: '',
  ninea: '',
  rc: '',
  representant_nom: '',
  representant_fonction: DEFAULT_AGENCY_SETTINGS.representant_fonction ?? 'Gérant',
  manager_id_type: DEFAULT_AGENCY_SETTINGS.manager_id_type ?? 'CNI',
  manager_id_number: '',
  city: DEFAULT_AGENCY_SETTINGS.city ?? 'Dakar',
  logo_url: '',
  logo_position: DEFAULT_AGENCY_SETTINGS.logo_position ?? 'left',
  couleur_primaire: DEFAULT_AGENCY_SETTINGS.couleur_primaire ?? '#F58220',
  couleur_secondaire: DEFAULT_AGENCY_SETTINGS.couleur_secondaire ?? '#333333',
  devise: DEFAULT_AGENCY_SETTINGS.devise ?? 'XOF',
  pied_page_personnalise: DEFAULT_AGENCY_SETTINGS.pied_page_personnalise ?? '',
  signature_url: null,
  qr_code_quittances: true,
  mention_tribunal: DEFAULT_AGENCY_SETTINGS.mention_tribunal ?? '',
  mention_penalites: DEFAULT_AGENCY_SETTINGS.mention_penalites ?? '',
  mention_frais_huissier: DEFAULT_AGENCY_SETTINGS.mention_frais_huissier ?? '',
  mention_litige: DEFAULT_AGENCY_SETTINGS.mention_litige ?? '',
  frais_huissier: DEFAULT_AGENCY_SETTINGS.frais_huissier ?? 37500,
  commission_globale: DEFAULT_AGENCY_SETTINGS.commission_globale ?? 10,
  penalite_retard_montant: DEFAULT_AGENCY_SETTINGS.penalite_retard_montant ?? 1000,
  penalite_retard_delai_jours: DEFAULT_AGENCY_SETTINGS.penalite_retard_delai_jours ?? 3,
  commission_personnalisee_par_bailleur: false,
  mode_avance_actif: false,
  module_depenses_actif: true,
  module_inventaires_actif: false,
  module_interventions_actif: false,
  wave_actif: false,
  wave_numero: null,
  orange_money_actif: false,
  orange_money_numero: null,
  free_money_actif: false,
  free_money_numero: null,
  email_notifications_actif: false,
  sms_notifications_actif: false,
  champs_personnalises_locataire: 0,
  onboarding_completed_at: null,
};

function getLogoExtension(file: File) {
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  return 'png';
}

function extractAgencyAssetPath(url: string | null | undefined, agencyId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AGENCY_ASSETS_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPath = url.slice(markerIndex + marker.length).split('?')[0];
  const path = decodeURIComponent(rawPath);
  if (path.startsWith(`${agencyId}/logos/`) || path.startsWith(`logos/${agencyId}-logo.`)) {
    return path;
  }
  return null;
}

async function compressLogoFile(file: File): Promise<File> {
  if (file.type === 'image/svg+xml' || file.size <= LOGO_COMPRESSION_THRESHOLD) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const ratio = Math.min(1, LOGO_MAX_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92);
    });

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function Parametres() {
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { showToast, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploadState, setLogoUploadState] = useState<LogoUploadState>('idle');

  const getOwnerNameFallback = () => {
    const profileName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim();
    return profileName || agency?.name || DEFAULT_AGENCY_SETTINGS.nom_agence || 'Proprietaire';
  };

  useEffect(() => {
    if (profile?.agency_id) {
      loadSettings(profile.agency_id);
    }
  // `loadSettings` is intentionally kept as a local workflow because it may create defaults.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  const loadSettings = async (agencyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('*')
        .eq('agency_id', agencyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const nextSettings = data as SettingsState;
        if (isIndividualOwner) {
          const ownerName = nextSettings.representant_nom || nextSettings.nom_agence || getOwnerNameFallback();
          nextSettings.representant_nom = ownerName;
          nextSettings.nom_agence = nextSettings.nom_agence || ownerName;
          nextSettings.representant_fonction = nextSettings.representant_fonction || 'Proprietaire';
        }
        setSettings(nextSettings);
        setLastSavedSnapshot(JSON.stringify(nextSettings));
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      } else {
        const created = await createDefaultSettings(agencyId);
        if (created) {
          setSettings(created as SettingsState);
          setLastSavedSnapshot(JSON.stringify(created));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur chargement paramètres:', msg);
      showToast('Erreur lors du chargement des paramètres', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async (agencyId: string): Promise<AgencySettings | null> => {
    try {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name, phone, email, address, ninea')
        .eq('id', agencyId)
        .maybeSingle();

      const ownerName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim()
        || agency?.name
        || DEFAULT_AGENCY_SETTINGS.nom_agence
        || 'Proprietaire';

      const rowToInsert = {
        ...EMPTY_SETTINGS,
        agency_id: agencyId,
        nom_agence: isIndividualOwner ? ownerName : agency?.name ?? DEFAULT_AGENCY_SETTINGS.nom_agence ?? 'Mon Agence',
        adresse: agency?.address ?? '',
        telephone: normalizeSenegalPhone(agency?.phone ?? '') ?? agency?.phone ?? '',
        email: agency?.email ?? '',
        ninea: agency?.ninea ?? '',
        representant_nom: isIndividualOwner ? ownerName : '',
        representant_fonction: isIndividualOwner ? 'Proprietaire' : EMPTY_SETTINGS.representant_fonction,
      };

      const { data, error } = await supabase
        .from('agency_settings')
        .insert(rowToInsert)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const { data: existing, error: fetchError } = await supabase
            .from('agency_settings')
            .select('*')
            .eq('agency_id', agencyId)
            .single();
          if (fetchError) throw fetchError;
          return existing as AgencySettings;
        }
        throw error;
      }
      return data as AgencySettings;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur création paramètres par défaut:', msg);
      return null;
    }
  };

  const handleSave = async () => {
    if (!profile?.agency_id || !settings) return;

    setSaving(true);
    try {
      const normalizedPhone = settings.telephone ? normalizeSenegalPhone(settings.telephone) : null;
      if (settings.telephone && !normalizedPhone) {
        showToast('Le téléphone de l’agence doit être un numéro sénégalais valide, par exemple 77 123 45 67.', 'error');
        setSaving(false);
        return;
      }
      const ownerNameForDocuments = isIndividualOwner
        ? (settings.representant_nom || settings.nom_agence || getOwnerNameFallback()).trim()
        : '';
      const dataToSave: Omit<AgencySettings, 'created_at' | 'updated_at'> = {
        agency_id: profile.agency_id,
        nom_agence: isIndividualOwner ? ownerNameForDocuments : settings.nom_agence ?? '',
        adresse: settings.adresse ?? '',
        telephone: normalizedPhone ?? '',
        email: settings.email ?? '',
        site_web: settings.site_web ?? '',
        ninea: settings.ninea ?? '',
        rc: settings.rc ?? '',
        representant_nom: isIndividualOwner ? ownerNameForDocuments : settings.representant_nom ?? '',
        representant_fonction: settings.representant_fonction ?? 'Gérant',
        manager_id_type: settings.manager_id_type ?? 'CNI',
        manager_id_number: settings.manager_id_number ?? '',
        city: settings.city ?? 'Dakar',
        logo_url: settings.logo_url ?? '',
        logo_position: settings.logo_position ?? 'left',
        couleur_primaire: settings.couleur_primaire ?? '#F58220',
        couleur_secondaire: settings.couleur_secondaire ?? '#333333',
        mention_tribunal: settings.mention_tribunal ?? '',
        mention_penalites: settings.mention_penalites ?? '',
        mention_frais_huissier: settings.mention_frais_huissier ?? '',
        mention_litige: settings.mention_litige ?? '',
        pied_page_personnalise: settings.pied_page_personnalise ?? '',
        frais_huissier: settings.frais_huissier ?? 37500,
        commission_globale: settings.commission_globale ?? 10,
        penalite_retard_montant: settings.penalite_retard_montant ?? 1000,
        penalite_retard_delai_jours: settings.penalite_retard_delai_jours ?? 3,
        devise: settings.devise ?? 'XOF',
        signature_url: settings.signature_url ?? null,
        qr_code_quittances: settings.qr_code_quittances ?? true,
        commission_personnalisee_par_bailleur: settings.commission_personnalisee_par_bailleur ?? false,
        mode_avance_actif: settings.mode_avance_actif ?? false,
        module_depenses_actif: settings.module_depenses_actif ?? true,
        module_inventaires_actif: settings.module_inventaires_actif ?? false,
        module_interventions_actif: settings.module_interventions_actif ?? false,
        wave_actif: settings.wave_actif ?? false,
        wave_numero: settings.wave_numero ?? null,
        orange_money_actif: settings.orange_money_actif ?? false,
        orange_money_numero: settings.orange_money_numero ?? null,
        free_money_actif: settings.free_money_actif ?? false,
        free_money_numero: settings.free_money_numero ?? null,
        email_notifications_actif: settings.email_notifications_actif ?? false,
        sms_notifications_actif: settings.sms_notifications_actif ?? false,
        champs_personnalises_locataire: settings.champs_personnalises_locataire ?? 0,
        onboarding_completed_at: settings.onboarding_completed_at ?? null,
      };

      if ('document_mode' in settings) {
        dataToSave.document_mode = settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional');
      }
      if ('enabled_modules' in settings) {
        dataToSave.enabled_modules = settings.enabled_modules ?? {};
      }
      if ('proprietaire_info' in settings) {
        dataToSave.proprietaire_info = settings.proprietaire_info ?? {};
      }

      const { data: savedData, error } = await supabase
        .from('agency_settings')
        .upsert(dataToSave, { onConflict: 'agency_id', ignoreDuplicates: false })
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase upsert:', error);
        throw new Error(error.message);
      }

      if (!savedData) {
        throw new Error(
          'Sauvegarde bloquée par les permissions. Vérifiez votre rôle ou contactez l\'administrateur.'
        );
      }

      setSettings(savedData as SettingsState);
      setLastSavedSnapshot(JSON.stringify(savedData));
      invalidateAgencySettingsCache(profile.agency_id);
      showToast('Paramètres enregistrés avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde paramètres:', msg);
      showToast(`Erreur : ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const validateLogoFile = (file: File): string | null => {
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Formats acceptés : PNG, SVG, JPG ou WEBP.';
    }
    if (file.size > LOGO_MAX_UPLOAD_SIZE) {
      return "L'image ne doit pas dépasser 5 Mo.";
    }
    return null;
  };

  const uploadLogoFile = async (file: File) => {
    if (!file || !profile?.agency_id || !settings) return;

    const validationError = validateLogoFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const previousPreview = logoPreview;
    const previousLogoUrl = settings.logo_url;
    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);
    setLogoUploadState('preview');

    try {
      setLogoUploadState('uploading');
      const uploadFile = await compressLogoFile(file);
      const fileExt = getLogoExtension(uploadFile);
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${profile.agency_id}/logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AGENCY_ASSETS_BUCKET)
        .upload(filePath, uploadFile, {
          cacheControl: '31536000',
          contentType: uploadFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(AGENCY_ASSETS_BUCKET)
        .getPublicUrl(filePath);

      const versionedLogoUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
      const { data: savedSettings, error: updateError } = await supabase
        .from('agency_settings')
        .update({ logo_url: versionedLogoUrl })
        .eq('agency_id', profile.agency_id)
        .select()
        .maybeSingle();

      if (updateError) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([filePath]);
        throw updateError;
      }

      if (!savedSettings) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([filePath]);
        throw new Error("Logo uploadé, mais la sauvegarde des paramètres a été refusée par les permissions.");
      }

      const oldAssetPath = extractAgencyAssetPath(previousLogoUrl, profile.agency_id);
      if (oldAssetPath && oldAssetPath !== filePath) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([oldAssetPath]);
      }

      setSettings(savedSettings as SettingsState);
      setLastSavedSnapshot(JSON.stringify(savedSettings));
      setLogoPreview(versionedLogoUrl);
      setLogoUploadState('done');
      invalidateAgencySettingsCache(profile.agency_id);
      showToast('Logo uploadé et sauvegardé avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erreur upload logo:", msg);
      setLogoUploadState('idle');
      setLogoPreview(previousPreview);
      showToast(`Erreur upload logo : ${msg}`, 'error');
    } finally {
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadLogoFile(file);
    e.target.value = '';
  };

  const handleLogoDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadLogoFile(file);
  };

  const tabs = [
    { id: 'general', label: 'Informations générales', icon: Building },
    { id: 'documents', label: 'Modèles de documents', icon: FileText },
    { id: 'appearance', label: 'Apparence', icon: Palette },
    { id: 'modules', label: 'Modules / pages', icon: SlidersHorizontal },
  ];

  const hasUnsavedChanges = useMemo(
    () => Boolean(settings && JSON.stringify(settings) !== lastSavedSnapshot),
    [settings, lastSavedSnapshot]
  );

  if (loading || !settings) {
    return <PageSkeleton title="Paramètres" variant="form" />;
  }

  const supportsDocumentMode = 'document_mode' in settings;

  return (
    <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-0 sm:py-0">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="sticky top-0 z-30 -mx-4 border-b border-emerald-950/10 bg-brand-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-white/85 sm:px-4 sm:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {hasUnsavedChanges ? 'Modifications non enregistrées' : 'Paramètres à jour'}
          </p>
          <p className="hidden text-xs font-semibold text-slate-500 sm:block">
            {isIndividualOwner ? 'Espace propriétaire' : 'Identité, documents et modules'}
          </p>
        </div>
        <div className="hidden">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 sm:h-14 sm:w-14">
            <span />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
              {isIndividualOwner ? 'Paramètres du compte' : "Paramètres de l'agence"}
            </h1>
            <p className="text-sm leading-6 text-slate-600 sm:text-base">
              {isIndividualOwner
                ? 'Personnalisez vos documents et votre identité propriétaire'
                : "Personnalisez vos documents et l'identité de votre agence"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-3.5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-950/18 transition-colors hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-none disabled:bg-slate-300 disabled:shadow-none sm:px-5"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Enregistrement...
            </>
          ) : !hasUnsavedChanges ? (
            <>
              <Save className="w-5 h-5" />
              A jour
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Sauvegarder
            </>
          )}
        </button>
      </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:gap-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors sm:px-4 sm:py-4 ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Nom affiché sur les documents' : "Nom de l'agence"}
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={isIndividualOwner ? settings.representant_nom ?? settings.nom_agence ?? '' : settings.nom_agence ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSettings(isIndividualOwner
                        ? { ...settings, representant_nom: value, nom_agence: value }
                        : { ...settings, nom_agence: value });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  {isIndividualOwner && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Ce nom sert aussi de nom affiché sur les documents propriétaire.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={formatSenegalPhone(settings.telephone, '')}
                    onChange={(e) => setSettings({ ...settings, telephone: formatSenegalPhoneInput(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input aria-label="Champ de saisie"
                    type="email"
                    value={settings.email ?? ''}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Site web
                  </label>
                  <input
                    type="url"
                    value={settings.site_web ?? ''}
                    onChange={(e) => setSettings({ ...settings, site_web: e.target.value })}
                    placeholder="https://www.example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.adresse ?? ''}
                    onChange={(e) => setSettings({ ...settings, adresse: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">NINEA</label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.ninea ?? ''}
                    onChange={(e) => setSettings({ ...settings, ninea: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Registre de Commerce (RC)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.rc ?? ''}
                    onChange={(e) => setSettings({ ...settings, rc: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Nom du propriétaire' : 'Nom du représentant'}
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.representant_nom ?? ''}
                    onChange={(e) => setSettings({ ...settings, representant_nom: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Qualité sur les documents' : 'Fonction du représentant'}
                  </label>
                  <input
                    type="text"
                    value={settings.representant_fonction ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, representant_fonction: e.target.value })
                    }
                    placeholder={isIndividualOwner ? 'ex: Propriétaire' : 'ex: Gérant, Directeur'}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? "Type de pièce d'identité" : "Type de pièce d'identité du représentant"}
                  </label>
                  <select aria-label="Sélection"
                    value={settings.manager_id_type ?? 'CNI'}
                    onChange={(e) =>
                      setSettings({ ...settings, manager_id_type: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="CNI">CNI (Carte Nationale d'Identité)</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Carte consulaire">Carte consulaire</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Numéro de pièce d'identité
                  </label>
                  <input
                    type="text"
                    value={settings.manager_id_number ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, manager_id_number: e.target.value })
                    }
                    placeholder="ex: 1761198600458"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Ville' : "Ville de l'agence"}
                  </label>
                  <input
                    type="text"
                    value={settings.city ?? ''}
                    onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    placeholder="ex: Dakar, Thiès, Saint-Louis"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">
                      {isIndividualOwner ? 'Informations propriétaire' : 'Informations du représentant légal'}
                    </p>
                    <p className="text-orange-700">
                      {isIndividualOwner
                        ? "Ces informations apparaîtront dans les contrats et quittances. Aucun mandat de gérance n'est nécessaire pour vos propres biens."
                        : "Ces informations apparaîtront dans les contrats de location et mandats de gérance. Assurez-vous qu'elles sont exactes et à jour."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              {supportsDocumentMode && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <label className="block text-sm font-black text-emerald-950 mb-2">
                    Mode documentaire
                  </label>
                  <select aria-label="Sélection"
                    value={settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional')}
                    onChange={(e) => setSettings({ ...settings, document_mode: e.target.value as AgencySettings['document_mode'] })}
                    className="w-full px-4 py-2 border border-emerald-200 bg-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="simple">Simple - proprietaire individuel</option>
                    <option value="professional">Professionnel - agence ou cabinet</option>
                    <option value="legal">Juridique renforce</option>
                  </select>
                  <p className="mt-2 text-xs leading-5 text-emerald-800">
                    Ce reglage prepare les variantes de documents sans modifier vos regles metier.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tribunal compétent
                </label>
                <input aria-label="Champ de saisie"
                  type="text"
                  value={settings.mention_tribunal ?? ''}
                  onChange={(e) => setSettings({ ...settings, mention_tribunal: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Texte des pénalités de retard
                </label>
                <textarea aria-label="Zone de texte"
                  value={settings.mention_penalites ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, mention_penalites: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pied de page des documents
                </label>
                <input aria-label="Champ de saisie"
                  type="text"
                  value={settings.pied_page_personnalise ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, pied_page_personnalise: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Frais d'huissier (F CFA)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.frais_huissier ?? 0}
                    onChange={(e) =>
                      setSettings({ ...settings, frais_huissier: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pénalité par jour (F CFA)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.penalite_retard_montant ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        penalite_retard_montant: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Délai pénalités (jours)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.penalite_retard_delai_jours ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        penalite_retard_delai_jours: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Variables disponibles dans les documents</p>
                    <p className="text-blue-700">
                      {isIndividualOwner
                        ? 'Ces paramètres sont automatiquement utilisés dans vos contrats, quittances et factures générés par le système.'
                        : 'Tous ces paramètres sont automatiquement utilisés dans les contrats, mandats et factures générés par le système.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  {isIndividualOwner ? 'Logo ou signature visuelle' : "Logo de l'agence"}
                </label>
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <label
                      className="block"
                      onDrop={handleLogoDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="group rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-orange-50/60 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/60 sm:p-8">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-lg shadow-emerald-100 ring-1 ring-emerald-100 transition-transform group-hover:scale-105">
                          {logoUploadState === 'uploading' ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-orange-500" />
                          ) : (
                            <Upload className="h-7 w-7" />
                          )}
                        </div>
                        <p className="mb-1 text-sm font-black text-slate-900">
                          {logoUploadState === 'uploading'
                            ? 'Upload du logo en cours...'
                            : 'Glissez le logo ici ou cliquez pour uploader'}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          PNG, SVG, JPG, WEBP jusqu'à 2 Mo
                        </p>
                      </div>
                    </label>
                  </div>

                  {logoPreview && (
                    <div className="flex-shrink-0">
                      <p className="text-sm font-medium text-slate-700 mb-2">Aperçu</p>
                      <div className="flex h-32 w-48 items-center justify-center rounded-2xl border border-emerald-100 bg-[radial-gradient(circle_at_top,#ecfdf5,white_55%,#fff7ed)] p-4 shadow-inner">
                        <img
                          src={logoPreview}
                          alt="Logo agence"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Position du logo dans les documents
                </label>
                <div className="flex gap-4">
                  {(['left', 'center', 'right'] as const).map((position) => (
                    <button
                      key={position}
                      onClick={() => setSettings({ ...settings, logo_position: position })}
                      className={`flex-1 px-4 py-3 border-2 rounded-lg transition-colors ${
                        settings.logo_position === position
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {position === 'left' && 'Gauche'}
                      {position === 'center' && 'Centre'}
                      {position === 'right' && 'Droite'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Couleur primaire
                  </label>
                  <div className="flex gap-3">
                    <input aria-label="Champ de saisie"
                      type="color"
                      value={settings.couleur_primaire ?? '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input aria-label="Champ de saisie"
                      type="text"
                      value={settings.couleur_primaire ?? '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Couleur secondaire
                  </label>
                  <div className="flex gap-3">
                    <input aria-label="Champ de saisie"
                      type="color"
                      value={settings.couleur_secondaire ?? '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input aria-label="Champ de saisie"
                      type="text"
                      value={settings.couleur_secondaire ?? '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">Personnalisation de l'identité visuelle</p>
                    <p className="text-green-700">
                      Ces couleurs seront utilisées dans les en-têtes de vos documents (contrats,
                      mandats, factures) pour refléter votre identité de marque.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-xl shadow-emerald-950/10 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
                      Modules visibles
                    </p>
                    <h3 className="mt-2 text-2xl font-black">Gestion modules/pages</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">
                      Activez uniquement les espaces utiles à votre agence. Les pages désactivées
                      disparaissent de la navigation et deviennent inaccessibles aux rôles standards.
                    </p>
                  </div>
                  <SlidersHorizontal className="h-8 w-8 text-orange-300" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  {
                    key: 'module_depenses_actif',
                    title: 'Dépenses',
                    desc: 'Suivi des charges, dépenses bailleurs et justificatifs.',
                  },
                  {
                    key: 'module_inventaires_actif',
                    title: 'États des lieux',
                    desc: 'Inventaires, entrées, sorties et documents associés.',
                  },
                  {
                    key: 'module_interventions_actif',
                    title: 'Maintenance',
                    desc: 'Demandes d’intervention, suivi technique et priorités.',
                  },
                  {
                    key: 'mode_avance_actif',
                    title: 'Mode avancé',
                    desc: 'Options expertes pour équipes structurées et workflow complet.',
                  },
                ].map((module) => {
                  const key = module.key as keyof Pick<
                    SettingsState,
                    | 'module_depenses_actif'
                    | 'module_inventaires_actif'
                    | 'module_interventions_actif'
                    | 'mode_avance_actif'
                  >;
                  const enabled = Boolean(settings[key]);

                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => setSettings({ ...settings, [key]: !enabled })}
                      className={`rounded-2xl border p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                        enabled
                          ? 'border-emerald-200 bg-emerald-50 shadow-emerald-100/70'
                          : 'border-slate-200 bg-white shadow-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-black text-slate-950">{module.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{module.desc}</p>
                        </div>
                        <span
                          className={`relative mt-1 inline-flex h-7 w-12 flex-shrink-0 rounded-full p-1 transition-colors ${
                            enabled ? 'bg-emerald-700' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </div>
                      <p
                        className={`mt-4 text-xs font-black uppercase tracking-[0.18em] ${
                          enabled ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {enabled ? 'Actif' : 'Masqué'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
