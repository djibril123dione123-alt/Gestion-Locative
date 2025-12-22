import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
import { Search, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface LoyerImpaye {
  id: string;
  locataire_nom: string;
  locataire_prenom: string;
  unite_nom: string;
  immeuble_nom: string;
  bailleur_nom: string;
  bailleur_prenom: string;
  montant_du: number;
  mois_concerne: string;
  telephone_locataire: string;
}

export function LoyersImpayes() {
  const [impayes, setImpayes] = useState<LoyerImpaye[]>([]);
  const [filtered, setFiltered] = useState<LoyerImpaye[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBailleur, setSelectedBailleur] = useState('');
  const [bailleurs, setBailleurs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLoyer, setSelectedLoyer] = useState<LoyerImpaye | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = impayes;

    if (searchTerm) {
      result = result.filter(i =>
        `${i.locataire_nom} ${i.locataire_prenom} ${i.unite_nom} ${i.immeuble_nom}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    if (selectedBailleur) {
      result = result.filter(i =>
        `${i.bailleur_prenom} ${i.bailleur_nom}` === selectedBailleur
      );
    }

    setFiltered(result);
  }, [searchTerm, selectedBailleur, impayes]);

  const loadData = async () => {
    try {
      const { data: contratsActifs } = await supabase
        .from('contrats')
        .select(`
          id,
          loyer_mensuel,
          locataires(nom, prenom, telephone),
          unites(
            nom,
            immeubles(
              nom,
              bailleurs(nom, prenom)
            )
          )
        `)
        .eq('statut', 'actif');

      const currentDate = new Date();
      const lastSixMonths = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        lastSixMonths.push(d.toISOString().slice(0, 7) + '-01');
      }

      const contratIds = contratsActifs?.map(c => c.id) || [];

      const { data: paiementsExistants } = await supabase
        .from('paiements')
        .select('contrat_id, mois_concerne, statut')
        .in('contrat_id', contratIds)
        .in('mois_concerne', lastSixMonths);

      const paiementsMap = new Map();
      paiementsExistants?.forEach(p => {
        const key = `${p.contrat_id}-${p.mois_concerne}`;
        paiementsMap.set(key, p.statut);
      });

      const impayesList: LoyerImpaye[] = [];

      contratsActifs?.forEach(contrat => {
        lastSixMonths.forEach(mois => {
          const key = `${contrat.id}-${mois}`;
          const statut = paiementsMap.get(key);

          if (!statut || statut === 'impaye') {
            impayesList.push({
              id: `${contrat.id}-${mois}`,
              locataire_nom: contrat.locataires?.nom || '',
              locataire_prenom: contrat.locataires?.prenom || '',
              unite_nom: contrat.unites?.nom || '',
              immeuble_nom: contrat.unites?.immeubles?.nom || '',
              bailleur_nom: contrat.unites?.immeubles?.bailleurs?.nom || '',
              bailleur_prenom: contrat.unites?.immeubles?.bailleurs?.prenom || '',
              montant_du: contrat.loyer_mensuel,
              mois_concerne: mois,
              telephone_locataire: contrat.locataires?.telephone || '',
            });
          }
        });
      });

      setImpayes(impayesList);
      setFiltered(impayesList);

      const uniqueBailleurs = Array.from(
        new Set(impayesList.map(i => `${i.bailleur_prenom} ${i.bailleur_nom}`))
      ).filter(b => b.trim());
      setBailleurs(uniqueBailleurs.map(b => ({ label: b })));

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return '0 F CFA';
    return (
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
        .format(amount)
        .replace(/\u00A0/g, ' ') + ' F CFA'
    );
  };

  const handlePayerClick = (loyer: LoyerImpaye) => {
    setSelectedLoyer(loyer);
    setShowModal(true);
  };

  const handleConfirmPaiement = async () => {
    if (!selectedLoyer) return;
    try {
      // 🔸 Ici tu pourras ajouter ta logique Supabase
      console.log('Paiement confirmé pour:', selectedLoyer);
      setShowModal(false);
      setSelectedLoyer(null);
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
    }
  };

  const totalImpaye = filtered.reduce((sum, i) => sum + i.montant_du, 0);

  const columns = [
    {
      key: 'locataire',
      label: 'Locataire',
      render: (i: LoyerImpaye) => `${i.locataire_prenom} ${i.locataire_nom}`,
    },
    { key: 'unite_nom', label: 'Produit' },
    { key: 'immeuble_nom', label: 'Immeuble' },
    {
      key: 'bailleur',
      label: 'Bailleur',
      render: (i: LoyerImpaye) => `${i.bailleur_prenom} ${i.bailleur_nom}`,
    },
    {
      key: 'mois_concerne',
      label: 'Mois',
      render: (i: LoyerImpaye) =>
        new Date(i.mois_concerne).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
        }),
    },
    {
      key: 'montant_du',
      label: 'Montant dû',
      render: (i: LoyerImpaye) => formatCurrency(i.montant_du),
    },
    { key: 'telephone_locataire', label: 'Téléphone' },
    {
      key: 'actions',
      label: 'Action',
      render: (i: LoyerImpaye) => (
        <button
          onClick={() => handlePayerClick(i)}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md 
                     transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #F58220, #C0392B)',
          }}
        >
          Payer ce loyer
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-slate-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Loyers Impayés</h1>
          <p className="text-slate-600">Suivi des loyers en retard</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-lg bg-red-50 text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600">Total impayés</h3>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalImpaye)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Nombre de loyers impayés</h3>
          <p className="text-2xl font-bold text-slate-900">{filtered.length}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Locataires concernés</h3>
          <p className="text-2xl font-bold text-slate-900">
            {new Set(filtered.map(i => `${i.locataire_nom} ${i.locataire_prenom}`)).size}
          </p>
        </div>
      </div>

      {/* Filtres + Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <select
              value={selectedBailleur}
              onChange={(e) => setSelectedBailleur(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Tous les bailleurs</option>
              {bailleurs.map((b, index) => (
                <option key={index} value={b.label}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Table columns={columns} data={filtered} />
      </div>

      {/* MODAL DE CONFIRMATION */}
      {showModal && selectedLoyer && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <img
              src="/templates/Logo confort immo archi neutre.png"
              alt="Logo"
              className="mx-auto mb-4 h-16 w-auto object-contain"
            />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Confirmer le paiement ?
            </h2>
            <p className="text-slate-600 mb-6">
              Voulez-vous confirmer le paiement du loyer de{' '}
              <strong>
                {selectedLoyer.locataire_prenom} {selectedLoyer.locataire_nom}
              </strong>{' '}
              pour le mois de{' '}
              <strong>
                {new Date(selectedLoyer.mois_concerne).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>{' '}
              ?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleConfirmPaiement}
                className="px-6 py-2 rounded-lg text-white font-semibold shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #F58220, #C0392B)',
                }}
              >
                Oui, confirmer
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-800 font-semibold transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
