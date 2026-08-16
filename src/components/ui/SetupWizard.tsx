import { useState, useEffect } from 'react';
import { ensureE164, formatCurrency, isValidInternationalPhone } from '../../lib/formatters';
import { PhoneInput } from './PhoneInput';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from './Toast';
import { SmartCombobox } from './SmartCombobox';
import { reloadUserProfile } from '../../lib/agencyHelper';
import { createContratViaEdge } from '../../services/api/contratApi';
import { createPaiementViaEdge } from '../../services/api/paiementApi';
import { getOrCreateIndividualOwnerBailleur } from '../../services/individualOwner';
import {
  CheckCircle2,
  Building2,
  Home,
  Users,
  FileText,
  DollarSign,
  Sparkles,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { WizardShell, type WizardStep } from './WizardShell';
import { Modal } from './Modal';
import { BrandMark } from '../brand/BrandLogo';

interface SetupWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface WizardRecord {
  id: string;
  nom?: string | null;
  prenom?: string | null;
}

interface WizardData {
  bailleur?: WizardRecord;
  immeuble?: WizardRecord;
  unite?: WizardRecord;
  locataire?: WizardRecord;
  contrat?: WizardRecord;
  paiement?: WizardRecord;
}

const steps: (WizardStep & { name: string; iconComponent: React.ElementType })[] = [
  { id: 1, label: 'Bailleur', name: 'Bailleur', shortLabel: 'Bailleur', iconComponent: Users, description: 'Propriétaire du bien', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 2, label: 'Immeuble', name: 'Immeuble', shortLabel: 'Immeuble', iconComponent: Building2, description: 'Bâtiment principal', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 3, label: 'Unité', name: 'Unité', shortLabel: 'Unité', iconComponent: Home, description: 'Appartement ou local', icon: <Home className="h-3.5 w-3.5" /> },
  { id: 4, label: 'Locataire', name: 'Locataire', shortLabel: 'Locataire', iconComponent: Users, description: 'Personne qui loue', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 5, label: 'Contrat', name: 'Contrat', shortLabel: 'Contrat', iconComponent: FileText, description: 'Accord de location', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 6, label: 'Paiement', name: 'Paiement', shortLabel: 'Paiement', iconComponent: DollarSign, description: 'Premier loyer', icon: <DollarSign className="h-3.5 w-3.5" /> }
];

function SetupWizardRail({ stepsList, currentStepIdx }: { stepsList: (WizardStep & { iconComponent: React.ElementType })[]; currentStepIdx: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">Configuration guidée</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Démarrage rapide</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">Configurez votre premier bailleur, immeuble, unité, locataire et contrat.</p>
      </div>
      <div className="relative mt-3 space-y-1">
        {stepsList.map((step, index) => {
          const isActive = index === currentStepIdx;
          const isComplete = index < currentStepIdx;
          const IconComp = step.iconComponent;
          return (
            <div key={step.id} className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${isActive ? 'border-amber-100/16 bg-white/[0.038] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]' : isComplete ? 'border-white/10 bg-emerald-300/[0.038] text-emerald-50/[0.78]' : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'}`}>
              <span className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${isActive ? 'bg-[#fff3ce]/94 text-emerald-950 ring-1 ring-amber-100/55' : isComplete ? 'bg-emerald-300/[0.12] text-emerald-50' : 'bg-white/[0.1] text-emerald-50/[0.84]'}`}>
                {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <IconComp className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">Étape {index + 1}</span>
                <span className="block truncate text-[0.67rem] font-semibold">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-auto pt-4 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">SAMAY KËUR</p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">Le parcours guidé prépare l&apos;environnement pour votre premier encaissement de loyer.</p>
      </div>
    </div>
  );
}

export function SetupWizard({ onClose, onComplete }: SetupWizardProps) {
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { success, error: showError, toasts, removeToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [loading, setLoading] = useState(false);

  // Reload profile when wizard opens to ensure fresh data
  useEffect(() => {
    reloadUserProfile();
  }, []);

  const [formData, setFormData] = useState({
    bailleur: { nom: '', prenom: '', telephone: '', email: '' },
    immeuble: { nom: '', adresse: '', ville: '', quartier: '' },
    unite: { nom: '' },
    locataire: { nom: '', prenom: '', telephone: '', email: '' },
    contrat: { loyer_mensuel: '', commission: '10', date_debut: new Date().toISOString().split('T')[0] },
    paiement: { date_paiement: new Date().toISOString().split('T')[0], mode_paiement: 'especes' }
  });

  const handleStepSubmit = async (step: number) => {
    if (!profile?.agency_id) {
      showError('Votre profil n\'est pas correctement chargé. Veuillez rafraîchir la page.');
      return;
    }

    const canCreateWizardData = isIndividualOwner || (profile.role && ['admin', 'agent'].includes(profile.role));
    if (!canCreateWizardData) {
      showError('Vous n\'avez pas les permissions nécessaires pour créer des données.');
      return;
    }

    setLoading(true);
    try {
      switch (step) {
        case 1: {
          if (isIndividualOwner) {
            const ownerBailleur = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
            setWizardData({ ...wizardData, bailleur: ownerBailleur });
            success('Profil proprietaire rattache automatiquement');
            setCurrentStep(2);
            break;
          }

          const normalizedPhone = ensureE164(formData.bailleur.telephone);
          if (!isValidInternationalPhone(normalizedPhone)) {
            throw new Error('Le téléphone du bailleur doit être un numéro valide, par exemple 77 123 45 67.');
          }
          const { data, error } = await supabase
            .from('bailleurs')
            .insert({
              ...formData.bailleur,
              telephone: normalizedPhone,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Erreur lors de la création du bailleur: ${error.message}`);
          }
          setWizardData({ ...wizardData, bailleur: data });
          success('Bailleur créé avec succès');
          setCurrentStep(2);
          break;
        }

        case 2: {
          if (!wizardData.bailleur?.id) {
            throw new Error('Le bailleur n\'a pas été créé correctement. Veuillez recommencer.');
          }

          const { data, error } = await supabase
            .from('immeubles')
            .insert({
              ...formData.immeuble,
              bailleur_id: wizardData.bailleur.id,
              agency_id: profile.agency_id
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Erreur lors de la création de l'immeuble: ${error.message}`);
          }
          setWizardData({ ...wizardData, immeuble: data });
          success('Immeuble créé avec succès');
          setCurrentStep(3);
          break;
        }

        case 3: {
          if (!wizardData.immeuble?.id) {
            throw new Error('L\'immeuble n\'a pas été créé correctement. Veuillez recommencer.');
          }

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

          if (error) {
            throw new Error(`Erreur lors de la création de l'unité: ${error.message}`);
          }
          setWizardData({ ...wizardData, unite: data });
          success('Unité créée avec succès');
          setCurrentStep(4);
          break;
        }

        case 4: {
          const normalizedPhone = ensureE164(formData.locataire.telephone);
          if (!isValidInternationalPhone(normalizedPhone)) {
            throw new Error('Le téléphone du locataire doit être un numéro valide, par exemple 77 123 45 67.');
          }
          const { data, error } = await supabase
            .from('locataires')
            .insert({
              ...formData.locataire,
              telephone: normalizedPhone,
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
          if (!wizardData.locataire?.id || !wizardData.unite?.id) {
            throw new Error('Le locataire ou l\'unité n\'a pas été créé correctement. Veuillez recommencer.');
          }

          const data = await createContratViaEdge({
              locataire_id: wizardData.locataire.id,
              unite_id: wizardData.unite.id,
              loyer_mensuel: parseFloat(formData.contrat.loyer_mensuel),
              commission: isIndividualOwner ? 0 : parseFloat(formData.contrat.commission),
              date_debut: formData.contrat.date_debut,
              statut: 'actif'
            });

          setWizardData({ ...wizardData, contrat: data });
          success('Contrat créé avec succès');
          setCurrentStep(6);
          break;
        }

        case 6: {
          if (!wizardData.contrat?.id) {
            throw new Error('Le contrat n\'a pas été créé correctement. Veuillez recommencer.');
          }

          const montant = parseFloat(formData.contrat.loyer_mensuel);
          const data = await createPaiementViaEdge({
              contrat_id: wizardData.contrat.id,
              montant_total: montant,
              mois_concerne: new Date().toISOString().split('T')[0].slice(0, 7) + '-01',
              date_paiement: formData.paiement.date_paiement,
              mode_paiement: formData.paiement.mode_paiement as 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre',
              statut: 'paye',
              idempotency_key: `setup:${profile.agency_id}:${wizardData.contrat.id}:${Date.now()}`,
            });
          setWizardData({ ...wizardData, paiement: data });
          success('Premier paiement enregistré avec succès');
          setCurrentStep(7);
          break;
        }
      }
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        if (isIndividualOwner) {
          return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <p className="font-bold">Votre profil proprietaire sera utilise automatiquement.</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Vous n'avez pas besoin de creer ou selectionner un bailleur. Vos biens, contrats,
                paiements et documents seront rattaches a votre profil.
              </p>
            </div>
          );
        }

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
              <PhoneInput
                label="Téléphone"
                required
                value={formData.bailleur.telephone}
                onChange={(value) => setFormData({
                  ...formData,
                  bailleur: { ...formData.bailleur, telephone: value }
                })}
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
                placeholder="Rue 12 x 13"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ville *</label>
                <input
                  type="text"
                  required
                  value={formData.immeuble.ville}
                  onChange={(e) => setFormData({
                    ...formData,
                    immeuble: { ...formData.immeuble, ville: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Dakar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quartier</label>
                <input
                  type="text"
                  value={formData.immeuble.quartier}
                  onChange={(e) => setFormData({
                    ...formData,
                    immeuble: { ...formData.immeuble, quartier: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Mermoz"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        // Note : le champ `type_logement` est volontairement absent du formulaire.
        // Il est filtré côté insert (cf. ligne ~100) car la colonne n'existe pas
        // dans le schéma `unites`. À réactiver si la colonne est ajoutée.
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
              <PhoneInput
                label="Téléphone"
                required
                value={formData.locataire.telephone}
                onChange={(value) => setFormData({
                  ...formData,
                  locataire: { ...formData.locataire, telephone: value }
                })}
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
            {!isIndividualOwner && (
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
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date de début *</label>
              <input
                type="date"
                required
                aria-label="Date de début"
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
                aria-label="Date du paiement"
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
              <SmartCombobox
                value={formData.paiement.mode_paiement}
                options={[
                  { value: 'especes', label: 'Especes' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'virement', label: 'Virement' },
                  { value: 'mobile_money', label: 'Mobile Money' },
                ]}
                onChange={(value) => setFormData({
                  ...formData,
                  paiement: { ...formData.paiement, mode_paiement: value }
                })}
                placeholder="Mode de paiement"
                searchPlaceholder="Especes, cheque, virement..."
              />
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800">
                <strong>Montant:</strong> {formatCurrency(parseInt(formData.contrat.loyer_mensuel || '0'))}<br/>
                {!isIndividualOwner && (
                  <>
                    <strong>Commission agence:</strong> {formatCurrency(Math.round((parseInt(formData.contrat.loyer_mensuel || '0') * parseFloat(formData.contrat.commission)) / 100))}
                  </>
                )}
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
                    <p className="text-orange-700">{formatCurrency(parseInt(formData.contrat.loyer_mensuel) || 0)}/mois</p>
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
              className="mx-auto flex items-center justify-center rounded-xl border border-[#0A3F30]/70 bg-gradient-to-r from-[#072F24] to-[#041812] px-8 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/20 transition-all hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-xl"
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
        return isIndividualOwner || (formData.bailleur.nom && formData.bailleur.prenom && formData.bailleur.telephone);
      case 2:
        return formData.immeuble.nom && formData.immeuble.adresse && formData.immeuble.ville;
      case 3:
        return formData.unite.nom;
      case 4:
        return formData.locataire.nom && formData.locataire.prenom && formData.locataire.telephone;
      case 5:
        return formData.contrat.loyer_mensuel && (isIndividualOwner || formData.contrat.commission) && formData.contrat.date_debut;
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
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Configuration terminée"
          description="Félicitations, votre espace est prêt !"
        >
          <div className="p-2">
            {renderStepContent()}
          </div>
        </Modal>
      </>
    );
  }

  const currentStepObj = steps[currentStep - 1] || steps[0];

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <WizardShell
        open={true}
        onClose={onClose}
        size="standard"
        variant="workstation"
        tone="owner"
        eyebrow="CONFIGURATION GUIDÉE"
        title={currentStepObj.label}
        description={currentStepObj.description}
        steps={steps}
        currentStep={currentStep - 1}
        contentDescription={currentStepObj.description}
        rail={
          <SetupWizardRail
            stepsList={steps}
            currentStepIdx={currentStep - 1}
          />
        }
        primaryAction={
          <button
            type="button"
            onClick={() => handleStepSubmit(currentStep)}
            disabled={!isStepValid() || loading}
            className="flex items-center justify-center rounded-xl border border-[#0A3F30]/70 bg-gradient-to-r from-[#072F24] to-[#041812] px-6 py-2.5 font-semibold text-white transition-all hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50 text-xs shadow-md"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                En cours...
              </>
            ) : (
              <>
                {currentStep === 6 ? 'Terminer' : 'Continuer'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        }
        secondaryAction={
          currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 font-semibold text-xs flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Retour
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 font-semibold text-xs"
            >
              Annuler
            </button>
          )
        }
      >
        <div className="py-2">
          {renderStepContent()}
        </div>
      </WizardShell>
    </>
  );
}
