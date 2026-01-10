import React, { useState } from 'react';
import { Building2, User, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { reloadUserProfile } from '../lib/agencyHelper';

type AccountType = 'agency' | 'bailleur';

export default function Welcome() {
  const { user } = useAuth();
  const { addToast } = useToast();
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

    console.log('🎯 Button clicked - Form submitted!');
    console.log('📊 Current state:', {
      accountType,
      hasUser: !!user,
      loading,
      formData
    });

    if (!accountType || !user) {
      const errorMsg = 'Données manquantes pour la création du compte';
      console.error('❌ Missing required data:', { accountType, user: !!user });
      alert(errorMsg);
      addToast(errorMsg, 'error');
      return;
    }

    setLoading(true);
    console.log('🚀 Starting agency creation...', { userId: user.id, accountType });

    try {
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      console.log('📝 Step 1: Creating agency...');
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
        console.error('❌ Agency creation error:', agencyError);
        const errorMsg = `Erreur de création d'agence: ${agencyError.message}`;
        alert(errorMsg);
        addToast(errorMsg, 'error');
        throw agencyError;
      }

      if (!agency) {
        const errorMsg = 'Agence non créée - aucune donnée retournée';
        console.error('❌', errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Agency created:', agency.id);
      addToast('Agence créée avec succès', 'success');

      console.log('📝 Step 2: Updating user profile...');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          agency_id: agency.id,
          role: accountType === 'agency' ? 'admin' : 'bailleur'
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ Profile update error:', profileError);
        const errorMsg = `Erreur mise à jour profil: ${profileError.message}`;
        alert(errorMsg);
        addToast(errorMsg, 'error');
        throw profileError;
      }

      console.log('✅ Profile updated with agency_id');

      console.log('📝 Step 3: Creating agency settings...');
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
        console.error('❌ Settings creation error:', settingsError);
        const errorMsg = `Erreur création settings: ${settingsError.message}`;
        alert(errorMsg);
        addToast(errorMsg, 'error');
        throw settingsError;
      }

      console.log('✅ Agency settings created');

      console.log('📝 Step 4: Creating subscription...');
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          agency_id: agency.id,
          plan_id: 'pro',
          status: 'active',
          current_period_end: trialEndsAt,
        });

      if (subscriptionError) {
        console.error('❌ Subscription creation error:', subscriptionError);
        const errorMsg = `Erreur création subscription: ${subscriptionError.message}`;
        alert(errorMsg);
        addToast(errorMsg, 'error');
        throw subscriptionError;
      }

      console.log('✅ Subscription created');
      console.log('🎉 All setup complete!');

      addToast('Compte créé avec succès ! Bienvenue ! 🎉', 'success');

      console.log('📝 Step 5: Reloading profile to get updated agency_id...');
      const updatedProfile = await reloadUserProfile();

      if (updatedProfile && updatedProfile.agency_id) {
        console.log('✅ Profile reloaded with agency_id, redirecting to dashboard...');
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = '/';
      } else {
        console.warn('⚠️ Profile reload incomplete, forcing refresh...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = '/';
      }
    } catch (error: any) {
      console.error('❌ CRITICAL ERROR in handleSubmit:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full: error
      });

      const userMessage = error.message || 'Une erreur est survenue lors de la création de votre compte';
      alert(`ERREUR: ${userMessage}`);
      addToast(userMessage, 'error');
    } finally {
      console.log('🔄 Setting loading to false');
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 0 && !accountType) return;
    if (step === 1 && !formData.name.trim()) return;
    if (step === 2 && !formData.phone.trim()) return;
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
                <span className="text-sm text-gray-500">Étape 1 sur 6</span>
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
                <span className="text-sm text-gray-500">Étape 2 sur 6</span>
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
                <span className="text-sm text-gray-500">Étape 3 sur 6</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Votre adresse
              </h2>
              <p className="text-gray-600">
                Adresse de votre {accountType === 'agency' ? 'agence' : 'domicile'} (optionnel)
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="text"
                autoFocus
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder="Ex: Mermoz, Dakar, Sénégal"
                onKeyPress={(e) => e.key === 'Enter' && nextStep()}
              />

              <button
                onClick={nextStep}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold flex items-center justify-center"
              >
                Continuer
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 4:
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
                <span className="text-sm text-gray-500">Étape 4 sur 6</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Numéro NINEA
              </h2>
              <p className="text-gray-600">
                Numéro d'identification fiscale (optionnel, vous pourrez l'ajouter plus tard)
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="text"
                autoFocus
                value={formData.ninea}
                onChange={(e) => setFormData({ ...formData, ninea: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder="Ex: 0123456789"
                onKeyPress={(e) => e.key === 'Enter' && nextStep()}
              />

              <button
                onClick={nextStep}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold flex items-center justify-center"
              >
                Continuer
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 5:
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
                <span className="text-sm text-gray-500">Étape 5 sur 6</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Combien d'immeubles gérez-vous ?
              </h2>
              <p className="text-gray-600">
                Cela nous aide à personnaliser votre expérience
              </p>
            </div>

            <div className="space-y-3">
              {['1-5', '6-20', '21-50', '50+'].map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setFormData({ ...formData, nbImmeubles: range });
                    nextStep();
                  }}
                  className={`w-full px-6 py-4 border-2 rounded-lg transition-all text-left font-medium ${
                    formData.nbImmeubles === range
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-orange-300 text-gray-700'
                  }`}
                >
                  {range} immeubles
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
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
                <span className="text-sm text-gray-500">Étape 6 sur 6</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Devise préférée
              </h2>
              <p className="text-gray-600">
                Choisissez la devise pour vos loyers et rapports
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                {[
                  { code: 'XOF', name: 'Franc CFA (XOF)', flag: '🇸🇳' },
                  { code: 'EUR', name: 'Euro (EUR)', flag: '🇪🇺' },
                  { code: 'USD', name: 'Dollar US (USD)', flag: '🇺🇸' },
                ].map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => setFormData({ ...formData, devise: currency.code })}
                    className={`w-full px-6 py-4 border-2 rounded-lg transition-all text-left font-medium flex items-center ${
                      formData.devise === currency.code
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-300 text-gray-700'
                    }`}
                  >
                    <span className="text-2xl mr-3">{currency.flag}</span>
                    {currency.name}
                  </button>
                ))}
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-6 border-2 border-orange-200">
                <h3 className="font-bold text-orange-900 mb-3 text-lg">🎉 Plan Essai Pro Gratuit</h3>
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 flex items-center justify-center p-4">
      {renderStepContent()}
    </div>
  );
}
