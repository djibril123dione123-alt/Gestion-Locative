import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from './Toast';
import {
  CheckCircle2,
  Building2,
  Home,
  Users,
  FileText,
  DollarSign,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X
} from 'lucide-react';

interface SetupWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface WizardData {
  bailleur?: any;
  immeuble?: any;
  unite?: any;
  locataire?: any;
  contrat?: any;
  paiement?: any;
}

const steps = [
  { id: 1, name: 'Bailleur', icon: Users, description: 'Propriétaire du bien' },
  { id: 2, name: 'Immeuble', icon: Building2, description: 'Bâtiment principal' },
  { id: 3, name: 'Unité', icon: Home, description: 'Appartement ou local' },
  { id: 4, name: 'Locataire', icon: Users, description: 'Personne qui loue' },
  { id: 5, name: 'Contrat', icon: FileText, description: 'Accord de location' },
  { id: 6, name: 'Paiement', icon: DollarSign, description: 'Premier loyer' }
];

export function SetupWizard({ onClose, onComplete }: SetupWizardProps) {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    bailleur: { nom: '', prenom: '', telephone: '', email: '' },
    immeuble: { nom: '', adresse: '' },
    unite: { nom: '', type_logement: 'appartement' },
    locataire: { nom: '', prenom: '', telephone: '', email: '' },
    contrat: { loyer_mensuel: '', commission: '10', date_debut: new Date().toISOString().split('T')[0] },
    paiement: { date_paiement: new Date().toISOString().split('T')[0], mode_paiement: 'especes' }
  });

  const handleStepSubmit = async (step: number) => {
    if (!profile?.agency_id) return;

    setLoading(true);
    try {
      switch (step) {
        case 1: {
          const { data, error } = await supabase
            .from('bailleurs')
            .insert({
              ...formData.bailleur,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;
          setWizardData({ ...wizardData, bailleur: data });
          success('Bailleur créé avec succès');
          setCurrentStep(2);
          break;
        }

        case 2: {
          const { data, error } = await supabase
            .from('immeubles')
            .insert({
              ...formData.immeuble,
              bailleur_id: wizardData.bailleur.id,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;
          setWizardData({ ...wizardData, immeuble: data });
          success('Immeuble créé avec succès');
          setCurrentStep(3);
          break;
        }

        case 3: {
          const { data, error } = await supabase
            .from('unites')
            .insert({
              ...formData.unite,
              immeuble_id: wizardData.immeuble.id,
              statut: 'libre',
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;
          setWizardData({ ...wizardData, unite: data });
          success('Unité créée avec succès');
          setCurrentStep(4);
          break;
        }

        case 4: {
          const { data, error } = await supabase
            .from('locataires')
            .insert({
              ...formData.locataire,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;
          setWizardData({ ...wizardData, locataire: data });
          success('Locataire créé avec succès');
          setCurrentStep(5);
          break;
        }

        case 5: {
          const { data, error } = await supabase
            .from('contrats')
            .insert({
              locataire_id: wizardData.locataire.id,
              unite_id: wizardData.unite.id,
              loyer_mensuel: parseFloat(formData.contrat.loyer_mensuel),
              commission: parseFloat(formData.contrat.commission),
              date_debut: formData.contrat.date_debut,
              statut: 'actif',
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;

          await supabase
            .from('unites')
            .update({ statut: 'loue' })
            .eq('id', wizardData.unite.id);

          setWizardData({ ...wizardData, contrat: data });
          success('Contrat créé avec succès');
          setCurrentStep(6);
          break;
        }

        case 6: {
          const montant = parseFloat(formData.contrat.loyer_mensuel);
          const commission = parseFloat(formData.contrat.commission);
          const partAgence = (montant * commission) / 100;
          const partBailleur = montant - partAgence;

          const { data, error } = await supabase
            .from('paiements')
            .insert({
              contrat_id: wizardData.contrat.id,
              montant_total: montant,
              mois_concerne: new Date().toISOString().split('T')[0].slice(0, 7) + '-01',
              date_paiement: formData.paiement.date_paiement,
              mode_paiement: formData.paiement.mode_paiement,
              statut: 'paye',
              part_agence: partAgence,
              part_bailleur: partBailleur,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) throw error;
          setWizardData({ ...wizardData, paiement: data });
          success('Premier paiement enregistré avec succès');
          setCurrentStep(7);
          break;
        }
      }
    } catch (error: any) {
      showError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
              <input
                type="text"
                required
                value={formData.bailleur.prenom}
                onChange={(e) => setFormData({
                  ...formData,
                  bailleur: { ...formData.bailleur, prenom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
              <input
                type="text"
                required
                value={formData.bailleur.nom}
                onChange={(e) => setFormData({
                  ...formData,
                  bailleur: { ...formData.bailleur, nom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Dupont"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
              <input
                type="tel"
                required
                value={formData.bailleur.telephone}
                onChange={(e) => setFormData({
                  ...formData,
                  bailleur: { ...formData.bailleur, telephone: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="+221 77 123 45 67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.bailleur.email}
                onChange={(e) => setFormData({
                  ...formData,
                  bailleur: { ...formData.bailleur, email: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="jean.dupont@email.com"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom de l'immeuble *</label>
              <input
                type="text"
                required
                value={formData.immeuble.nom}
                onChange={(e) => setFormData({
                  ...formData,
                  immeuble: { ...formData.immeuble, nom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Résidence Mermoz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Adresse *</label>
              <input
                type="text"
                required
                value={formData.immeuble.adresse}
                onChange={(e) => setFormData({
                  ...formData,
                  immeuble: { ...formData.immeuble, adresse: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Mermoz, Dakar, Sénégal"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom de l'unité *</label>
              <input
                type="text"
                required
                value={formData.unite.nom}
                onChange={(e) => setFormData({
                  ...formData,
                  unite: { ...formData.unite, nom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Appartement 101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
              <select
                value={formData.unite.type_logement}
                onChange={(e) => setFormData({
                  ...formData,
                  unite: { ...formData.unite, type_logement: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="appartement">Appartement</option>
                <option value="studio">Studio</option>
                <option value="maison">Maison</option>
                <option value="bureau">Bureau</option>
                <option value="commerce">Commerce</option>
              </select>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
              <input
                type="text"
                required
                value={formData.locataire.prenom}
                onChange={(e) => setFormData({
                  ...formData,
                  locataire: { ...formData.locataire, prenom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Marie"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
              <input
                type="text"
                required
                value={formData.locataire.nom}
                onChange={(e) => setFormData({
                  ...formData,
                  locataire: { ...formData.locataire, nom: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Martin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
              <input
                type="tel"
                required
                value={formData.locataire.telephone}
                onChange={(e) => setFormData({
                  ...formData,
                  locataire: { ...formData.locataire, telephone: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="+221 77 987 65 43"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.locataire.email}
                onChange={(e) => setFormData({
                  ...formData,
                  locataire: { ...formData.locataire, email: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="marie.martin@email.com"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loyer mensuel (F CFA) *</label>
              <input
                type="number"
                required
                value={formData.contrat.loyer_mensuel}
                onChange={(e) => setFormData({
                  ...formData,
                  contrat: { ...formData.contrat, loyer_mensuel: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="250000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Commission agence (%) *</label>
              <input
                type="number"
                required
                value={formData.contrat.commission}
                onChange={(e) => setFormData({
                  ...formData,
                  contrat: { ...formData.contrat, commission: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date de début *</label>
              <input
                type="date"
                required
                value={formData.contrat.date_debut}
                onChange={(e) => setFormData({
                  ...formData,
                  contrat: { ...formData.contrat, date_debut: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date du paiement *</label>
              <input
                type="date"
                required
                value={formData.paiement.date_paiement}
                onChange={(e) => setFormData({
                  ...formData,
                  paiement: { ...formData.paiement, date_paiement: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mode de paiement *</label>
              <select
                value={formData.paiement.mode_paiement}
                onChange={(e) => setFormData({
                  ...formData,
                  paiement: { ...formData.paiement, mode_paiement: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="virement">Virement</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800">
                <strong>Montant:</strong> {parseInt(formData.contrat.loyer_mensuel || '0').toLocaleString()} F CFA<br/>
                <strong>Commission agence:</strong> {((parseInt(formData.contrat.loyer_mensuel || '0') * parseFloat(formData.contrat.commission)) / 100).toLocaleString()} F CFA
              </p>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <Sparkles className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Félicitations !
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Vous avez créé votre premier flux complet. Votre plateforme est maintenant opérationnelle.
            </p>

            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-orange-900 mb-4">Ce que vous avez créé :</h3>
              <div className="grid grid-cols-2 gap-4 text-left text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Bailleur</p>
                    <p className="text-orange-700">{wizardData.bailleur?.prenom} {wizardData.bailleur?.nom}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Immeuble</p>
                    <p className="text-orange-700">{wizardData.immeuble?.nom}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Unité</p>
                    <p className="text-orange-700">{wizardData.unite?.nom}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Locataire</p>
                    <p className="text-orange-700">{wizardData.locataire?.prenom} {wizardData.locataire?.nom}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Contrat actif</p>
                    <p className="text-orange-700">{parseInt(formData.contrat.loyer_mensuel).toLocaleString()} F CFA/mois</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Premier paiement</p>
                    <p className="text-orange-700">Enregistré</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-bold text-lg flex items-center justify-center mx-auto shadow-lg hover:shadow-xl"
            >
              Voir mon tableau de bord
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.bailleur.nom && formData.bailleur.prenom && formData.bailleur.telephone;
      case 2:
        return formData.immeuble.nom && formData.immeuble.adresse;
      case 3:
        return formData.unite.nom;
      case 4:
        return formData.locataire.nom && formData.locataire.prenom && formData.locataire.telephone;
      case 5:
        return formData.contrat.loyer_mensuel && formData.contrat.commission && formData.contrat.date_debut;
      case 6:
        return formData.paiement.date_paiement;
      default:
        return false;
    }
  };

  if (currentStep === 7) {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {renderStepContent()}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-900">Configuration guidée</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              {steps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 font-medium ${
                      currentStep === step.id ? 'text-orange-600' : 'text-slate-500'
                    }`}>
                      {step.name}
                    </p>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded transition-all ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {steps[currentStep - 1]?.name}
              </h3>
              <p className="text-slate-600">
                {steps[currentStep - 1]?.description}
              </p>
            </div>

            {renderStepContent()}

            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={loading}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Retour
                </button>
              )}
              <button
                onClick={() => handleStepSubmit(currentStep)}
                disabled={!isStepValid() || loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    En cours...
                  </>
                ) : (
                  <>
                    {currentStep === 6 ? 'Terminer' : 'Continuer'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
