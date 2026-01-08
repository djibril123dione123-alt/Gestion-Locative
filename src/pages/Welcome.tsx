import React, { useState } from 'react';
import { Building2, User, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Welcome() {
  const { user, profile } = useAuth();
  const [accountType, setAccountType] = useState<'agency' | 'bailleur' | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: user?.email || '',
    address: '',
    ninea: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType || !user || !profile) return;

    setLoading(true);
    try {
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          ninea: formData.ninea,
          plan: 'basic',
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_bailleur_account: accountType === 'bailleur',
        })
        .select()
        .single();

      if (agencyError) throw agencyError;

      await supabase
        .from('user_profiles')
        .update({ agency_id: agency.id })
        .eq('id', user.id);

      await supabase
        .from('agency_settings')
        .update({
          agency_id: agency.id,
          nom_agence: formData.name,
          telephone: formData.phone,
          email: formData.email,
          adresse: formData.address,
          ninea: formData.ninea,
        })
        .eq('id', 'default');

      await supabase
        .from('subscriptions')
        .insert({
          agency_id: agency.id,
          plan_id: 'basic',
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      window.location.href = '/';
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!accountType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 flex items-center justify-center p-4 animate-fadeIn">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12 animate-slideInUp">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-4">
              Bienvenue sur Confort Immo Archi
            </h1>
            <p className="text-xl text-gray-700">
              Choisissez le type de compte qui vous correspond
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setAccountType('agency')}
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow text-left group"
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
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span>
                  Gestion multi-bailleurs
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span>
                  Équipe collaborative
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span>
                  Rapports personnalisés
                </li>
              </ul>
              <div className="flex items-center text-orange-600 font-semibold">
                Choisir ce type
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => setAccountType('bailleur')}
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow text-left group"
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
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                  Gestion de vos biens
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                  Suivi des loyers
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
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
              Essai gratuit de 30 jours - Sans carte bancaire requise
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 ${accountType === 'agency' ? 'bg-orange-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center mx-auto mb-4`}>
            {accountType === 'agency' ? (
              <Building2 className={`w-8 h-8 ${accountType === 'agency' ? 'text-orange-600' : 'text-blue-600'}`} />
            ) : (
              <User className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {accountType === 'agency' ? 'Configuration de votre agence' : 'Configuration de votre compte'}
          </h2>
          <p className="text-gray-600">
            Renseignez les informations de {accountType === 'agency' ? 'votre agence' : 'votre compte'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {accountType === 'agency' ? 'Nom de l\'agence' : 'Votre nom complet'} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={accountType === 'agency' ? 'Ex: Immobilier Premium' : 'Ex: Jean Dupont'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="+221 77 123 45 67"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Adresse complète"
            />
          </div>

          {accountType === 'agency' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NINEA
              </label>
              <input
                type="text"
                value={formData.ninea}
                onChange={(e) => setFormData({ ...formData, ninea: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Numéro d'identification"
              />
            </div>
          )}

          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Plan Essai Gratuit</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>30 jours d'essai gratuit</li>
              <li>Jusqu'à 3 immeubles et 10 unités</li>
              <li>Toutes les fonctionnalités incluses</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setAccountType(null)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Configuration...' : 'Commencer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
