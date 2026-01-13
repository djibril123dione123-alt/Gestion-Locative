import React, { useState } from 'react';
import { Building2, User, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { reloadUserProfile } from '../lib/agencyHelper';

type AccountType = 'agency' | 'bailleur';

export default function Welcome() {
  const { user } = useAuth();
  const { showToast, toasts, removeToast } = useToast();
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: user?.email || '',
    address: '',
    ninea: '',
    nbImmeubles: '1-5',
    devise: 'XOF',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountType || !user) {
      showToast('Données manquantes pour la création du compte', 'error');
      return;
    }

    setLoading(true);

    try {
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          ninea: formData.ninea || null,
          plan: 'pro',
          status: 'trial',
          trial_ends_at: trialEndsAt,
          is_bailleur_account: accountType === 'bailleur',
        })
        .select()
        .single();

      if (agencyError) {
        throw new Error(`Impossible de créer votre compte : ${agencyError.message}`);
      }

      if (!agency) {
        throw new Error('Une erreur est survenue lors de la création de votre compte');
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          agency_id: agency.id,
          role: accountType === 'agency' ? 'admin' : 'bailleur'
        })
        .eq('id', user.id);

      if (profileError) {
        throw new Error(`Erreur lors de la configuration de votre profil : ${profileError.message}`);
      }

      const { error: settingsError } = await supabase
        .from('agency_settings')
        .insert({
          agency_id: agency.id,
          nom_agence: formData.name,
          telephone: formData.phone,
          email: formData.email,
          adresse: formData.address,
          ninea: formData.ninea || null,
          devise: formData.devise,
        });

      if (settingsError) {
        throw new Error(`Erreur lors de la configuration de votre compte : ${settingsError.message}`);
      }

      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          agency_id: agency.id,
          plan_id: 'pro',
          status: 'active',
          current_period_end: trialEndsAt,
        });

      if (subscriptionError) {
        throw new Error(`Erreur lors de l'activation de votre essai gratuit : ${subscriptionError.message}`);
      }

      showToast('Compte créé avec succès ! Redirection en cours...', 'success');

      const updatedProfile = await reloadUserProfile();

      if (updatedProfile && updatedProfile.agency_id) {
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = '/';
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = '/';
      }
    } catch (error: any) {
      const userMessage = error.message || 'Une erreur inattendue est survenue. Veuillez réessayer ou contacter le support.';
      showToast(userMessage, 'error');
      console.error('Erreur création compte:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 0 && !accountType) return;
    if (step === 1 && !formData.name.trim()) return;
    if (step === 2 && !formData.phone.trim()) return;
    if (step >= 3) return;
    setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="max-w-4xl w-full animate-fadeIn">
            <div className="text-center mb-12 animate-slideInUp">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-4">
                Bienvenue sur Gestion Locative
              </h1>
              <p className="text-lg md:text-xl text-gray-700">
                Choisissez le type de compte qui vous correspond
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => { setAccountType('agency'); nextStep(); }}
                className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all text-left group hover:scale-105"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mb-6 group-hover:bg-orange-200 transition-colors">
                  <Building2 className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Agence Immobilière</h2>
                <p className="text-gray-600 mb-6">
                  Gérez plusieurs propriétaires et leurs biens immobiliers. Idéal pour les agences de gestion locative.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />
                    Gestion multi-bailleurs
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />
                    Équipe collaborative
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />
                    Rapports personnalisés
                  </li>
                </ul>
                <div className="flex items-center text-orange-600 font-semibold">
                  Choisir ce type
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => { setAccountType('bailleur'); nextStep(); }}
                className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all text-left group hover:scale-105"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Bailleur Individuel</h2>
                <p className="text-gray-600 mb-6">
                  Gérez vos propres biens immobiliers en toute autonomie. Solution simple et efficace.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2" />
                    Gestion de vos biens
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2" />
                    Suivi des loyers
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2" />
                    Tableaux de bord clairs
                  </li>
                </ul>
                <div className="flex items-center text-blue-600 font-semibold">
                  Choisir ce type
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-gray-500">
                🎉 Essai gratuit Pro de 30 jours - Sans carte bancaire requise
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={prevStep}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Retour
                </button>
                <span className="text-sm text-gray-500">Étape 1 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {accountType === 'agency' ? 'Nom de votre agence' : 'Votre nom complet'}
              </h2>
              <p className="text-gray-600">
                {accountType === 'agency'
                  ? 'Comment s\'appelle votre agence immobilière ?'
                  : 'Quel est votre nom complet ?'}
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="text"
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder={accountType === 'agency' ? 'Ex: Immobilier Premium Dakar' : 'Ex: Moussa Diop'}
                onKeyPress={(e) => e.key === 'Enter' && formData.name.trim() && nextStep()}
              />

              <button
                onClick={nextStep}
                disabled={!formData.name.trim()}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
              >
                Continuer
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={prevStep}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Retour
                </button>
                <span className="text-sm text-gray-500">Étape 2 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Numéro de téléphone
              </h2>
              <p className="text-gray-600">
                Pour que vos locataires et bailleurs puissent vous joindre
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="tel"
                autoFocus
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder="+221 77 123 45 67"
                onKeyPress={(e) => e.key === 'Enter' && formData.phone.trim() && nextStep()}
              />

              <button
                onClick={nextStep}
                disabled={!formData.phone.trim()}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
              >
                Continuer
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={prevStep}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Retour
                </button>
                <span className="text-sm text-gray-500">Étape 3 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Prêt à commencer !
              </h2>
              <p className="text-gray-600">
                Profitez de 30 jours d'essai gratuit du plan Pro
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-6 border-2 border-orange-200">
                <h3 className="font-bold text-orange-900 mb-3 text-lg">Plan Essai Pro Gratuit</h3>
                <ul className="space-y-2 text-sm text-orange-800">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-orange-600" />
                    30 jours d'essai gratuit du plan Pro
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-orange-600" />
                    Immeubles et unités illimités
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-orange-600" />
                    Toutes les fonctionnalités incluses
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-orange-600" />
                    Sans carte bancaire requise
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Création en cours...
                  </>
                ) : (
                  <>
                    Créer mon compte
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 flex items-center justify-center p-4">
        {renderStepContent()}
      </div>
    </>
  );
}
