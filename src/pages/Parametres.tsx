import React, { useState, useEffect } from 'react';
import {
  Save,
  Upload,
  Image as ImageIcon,
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

interface AgencySettings {
  id: string;
  agency_id: string;
  nom_agence: string;
  adresse: string;
  telephone: string;
  email: string;
  site_web: string;
  ninea: string;
  rc: string;
  representant_nom: string;
  representant_fonction: string;
  logo_url: string;
  logo_position: 'left' | 'center' | 'right';
  couleur_primaire: string;
  couleur_secondaire: string;
  mention_tribunal: string;
  mention_penalites: string;
  pied_page_personnalise: string;
  frais_huissier: number;
  commission_globale: number;
  penalite_retard_montant: number;
  penalite_retard_delai_jours: number;
  devise: string;
}

export function Parametres() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'documents' | 'appearance'>('general');
  const [settings, setSettings] = useState<Partial<AgencySettings>>({
    nom_agence: '',
    adresse: '',
    telephone: '',
    email: '',
    site_web: '',
    ninea: '',
    rc: '',
    representant_nom: '',
    representant_fonction: 'Gérant',
    logo_url: '',
    logo_position: 'left',
    couleur_primaire: '#F58220',
    couleur_secondaire: '#333333',
    mention_tribunal: 'Tribunal de commerce de Dakar',
    mention_penalites: "À défaut de paiement d'un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours), des pénalités qui s'élèvent à 1000 FCFA par jour de retard seront appliquées pendant 03 jours. Passé ce délai, la procédure judiciaire sera enclenchée.",
    pied_page_personnalise: 'Gestion Locative - Dakar, Sénégal',
    frais_huissier: 37500,
    commission_globale: 10,
    penalite_retard_montant: 1000,
    penalite_retard_delai_jours: 3,
    devise: 'XOF',
  });
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, [profile?.agency_id]);

  const loadSettings = async () => {
    if (!profile?.agency_id) return;

    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      } else {
        await createDefaultSettings();
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
      showToast('Erreur lors du chargement des paramètres', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!profile?.agency_id) return;

    try {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name, phone, email, address, ninea')
        .eq('id', profile.agency_id)
        .single();

      const defaultSettings = {
        agency_id: profile.agency_id,
        nom_agence: agency?.name || 'Mon Agence',
        adresse: agency?.address || '',
        telephone: agency?.phone || '',
        email: agency?.email || '',
        ninea: agency?.ninea || '',
        ...settings,
      };

      const { data, error } = await supabase
        .from('agency_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (error) {
      console.error('Erreur création paramètres:', error);
    }
  };

  const handleSave = async () => {
    if (!profile?.agency_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_settings')
        .upsert({
          ...settings,
          agency_id: profile.agency_id,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      showToast('Paramètres enregistrés avec succès', 'success');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      showToast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.agency_id) return;

    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('L\'image ne doit pas dépasser 2 Mo', 'error');
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
    } catch (error) {
      console.error('Erreur upload logo:', error);
      showToast('Erreur lors de l\'upload du logo', 'error');
    }
  };

  const tabs = [
    { id: 'general', label: 'Informations générales', icon: Building },
    { id: 'documents', label: 'Modèles de documents', icon: FileText },
    { id: 'appearance', label: 'Apparence', icon: Palette },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                  onClick={() => setActiveTab(tab.id as any)}
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
                    value={settings.nom_agence || ''}
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
                    value={settings.telephone || ''}
                    onChange={(e) => setSettings({ ...settings, telephone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={settings.email || ''}
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
                    value={settings.site_web || ''}
                    onChange={(e) => setSettings({ ...settings, site_web: e.target.value })}
                    placeholder="https://www.example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={settings.adresse || ''}
                    onChange={(e) => setSettings({ ...settings, adresse: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">NINEA</label>
                  <input
                    type="text"
                    value={settings.ninea || ''}
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
                    value={settings.rc || ''}
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
                    value={settings.representant_nom || ''}
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
                    value={settings.representant_fonction || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, representant_fonction: e.target.value })
                    }
                    placeholder="ex: Gérant, Directeur"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
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
                  value={settings.mention_tribunal || ''}
                  onChange={(e) => setSettings({ ...settings, mention_tribunal: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Texte des pénalités de retard
                </label>
                <textarea
                  value={settings.mention_penalites || ''}
                  onChange={(e) => setSettings({ ...settings, mention_penalites: e.target.value })}
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
                  value={settings.pied_page_personnalise || ''}
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
                    value={settings.frais_huissier || 0}
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
                    value={settings.penalite_retard_montant || 0}
                    onChange={(e) =>
                      setSettings({ ...settings, penalite_retard_montant: Number(e.target.value) })
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
                    value={settings.penalite_retard_delai_jours || 0}
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
                          alt="Logo"
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
                      value={settings.couleur_primaire || '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.couleur_primaire || '#F58220'}
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
                      value={settings.couleur_secondaire || '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.couleur_secondaire || '#333333'}
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
