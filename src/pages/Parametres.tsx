import React, { useState, useEffect } from 'react';
import {
  Save,
  Upload,
  AlertCircle,
  Settings,
  FileText,
  Palette,
  Building,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { AgencySettings, DEFAULT_AGENCY_SETTINGS } from '../types/agency';
import { ToastContainer } from '../components/ui/Toast';

type SettingsState = Omit<AgencySettings, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

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
};

export function Parametres() {
  const { profile } = useAuth();
  const { showToast, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'documents' | 'appearance'>('general');
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    if (profile?.agency_id) {
      loadSettings(profile.agency_id);
    }
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
        setSettings(data as SettingsState);
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      } else {
        const created = await createDefaultSettings(agencyId);
        if (created) {
          setSettings(created as SettingsState);
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

      const rowToInsert = {
        ...EMPTY_SETTINGS,
        agency_id: agencyId,
        nom_agence: agency?.name ?? DEFAULT_AGENCY_SETTINGS.nom_agence ?? 'Mon Agence',
        adresse: agency?.address ?? '',
        telephone: agency?.phone ?? '',
        email: agency?.email ?? '',
        ninea: agency?.ninea ?? '',
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
      const dataToSave: Omit<AgencySettings, 'created_at' | 'updated_at'> = {
        agency_id: profile.agency_id,
        nom_agence: settings.nom_agence ?? '',
        adresse: settings.adresse ?? '',
        telephone: settings.telephone ?? '',
        email: settings.email ?? '',
        site_web: settings.site_web ?? '',
        ninea: settings.ninea ?? '',
        rc: settings.rc ?? '',
        representant_nom: settings.representant_nom ?? '',
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
      };

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
      showToast('Paramètres enregistrés avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde paramètres:', msg);
      showToast(`Erreur : ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.agency_id || !settings) return;

    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast("L'image ne doit pas dépasser 2 Mo", 'error');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.agency_id}-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('agency-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('agency-assets')
        .getPublicUrl(filePath);

      setSettings({ ...settings, logo_url: publicUrl.publicUrl });
      setLogoPreview(publicUrl.publicUrl);
      showToast('Logo uploadé avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erreur upload logo:", msg);
      showToast("Erreur lors de l'upload du logo", 'error');
    }
  };

  const tabs = [
    { id: 'general', label: 'Informations générales', icon: Building },
    { id: 'documents', label: 'Modèles de documents', icon: FileText },
    { id: 'appearance', label: 'Apparence', icon: Palette },
  ];

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Settings className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramètres de l'agence</h1>
            <p className="text-slate-600">
              Personnalisez vos documents et l'identité de votre agence
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Enregistrer
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-4 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'general' | 'documents' | 'appearance')}
                  className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
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

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom de l'agence
                  </label>
                  <input
                    type="text"
                    value={settings.nom_agence ?? ''}
                    onChange={(e) => setSettings({ ...settings, nom_agence: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={settings.telephone ?? ''}
                    onChange={(e) => setSettings({ ...settings, telephone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
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
                  <input
                    type="text"
                    value={settings.adresse ?? ''}
                    onChange={(e) => setSettings({ ...settings, adresse: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">NINEA</label>
                  <input
                    type="text"
                    value={settings.ninea ?? ''}
                    onChange={(e) => setSettings({ ...settings, ninea: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Registre de Commerce (RC)
                  </label>
                  <input
                    type="text"
                    value={settings.rc ?? ''}
                    onChange={(e) => setSettings({ ...settings, rc: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom du représentant
                  </label>
                  <input
                    type="text"
                    value={settings.representant_nom ?? ''}
                    onChange={(e) => setSettings({ ...settings, representant_nom: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fonction du représentant
                  </label>
                  <input
                    type="text"
                    value={settings.representant_fonction ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, representant_fonction: e.target.value })
                    }
                    placeholder="ex: Gérant, Directeur"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type de pièce d'identité du représentant
                  </label>
                  <select
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
                    Ville de l'agence
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
                    <p className="font-medium mb-1">Informations du représentant légal</p>
                    <p className="text-orange-700">
                      Ces informations apparaîtront dans les contrats de location et mandats de
                      gérance. Assurez-vous qu'elles sont exactes et à jour.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tribunal compétent
                </label>
                <input
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
                <textarea
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
                <input
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
                    Frais d'huissier (FCFA)
                  </label>
                  <input
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
                    Pénalité par jour (FCFA)
                  </label>
                  <input
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
                  <input
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
                      Tous ces paramètres sont automatiquement utilisés dans les contrats, mandats
                      et factures générés par le système.
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
                  Logo de l'agence
                </label>
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <label className="block">
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-orange-500 transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 mb-1">
                          Cliquez pour télécharger un logo
                        </p>
                        <p className="text-xs text-slate-500">PNG, JPG jusqu'à 2 Mo</p>
                      </div>
                    </label>
                  </div>

                  {logoPreview && (
                    <div className="flex-shrink-0">
                      <p className="text-sm font-medium text-slate-700 mb-2">Aperçu</p>
                      <div className="w-48 h-32 border border-slate-300 rounded-lg p-4 bg-slate-50 flex items-center justify-center">
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
                    <input
                      type="color"
                      value={settings.couleur_primaire ?? '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input
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
                    <input
                      type="color"
                      value={settings.couleur_secondaire ?? '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input
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
        </div>
      </div>
    </div>
  );
}
