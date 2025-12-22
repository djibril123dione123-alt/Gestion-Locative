import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, Search, Download, AlertCircle, TrendingUp } from 'lucide-react';
import { generateContratPDF } from '../lib/pdf';

// =========================
// 🎨 PALETTE CONFORT IMMO ARCHI
// =========================
const BRAND_COLORS = {
  primary: '#F58220',
  primaryLight: '#FFA64D',
  red: '#C0392B',
  gray: '#555555',
} as const;

// =========================
// 🔸 TYPES
// =========================
interface Locataire {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  email?: string;
  adresse_personnelle?: string;
  piece_identite?: string;
}

interface Bailleur {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  adresse?: string;
  commission?: number;
}

interface Immeuble {
  nom: string;
  adresse?: string;
  bailleurs?: Bailleur;
}

interface Unite {
  id: string;
  nom: string;
  loyer_base: number;
  statut: 'libre' | 'loue';
  immeubles?: Immeuble;
}

interface Contrat {
  id: string;
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin?: string;
  loyer_mensuel: number;
  commission?: number;
  caution?: number;
  statut: 'actif' | 'expire' | 'resilie';
  destination?: string;
  created_at?: string;
  locataires?: Locataire;
  unites?: Unite;
}

interface FormData {
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin: string;
  loyer_mensuel: string;
  caution: string;
  commission: string;
  statut: 'actif' | 'expire' | 'resilie';
  destination: 'Habitation' | 'Commercial' | '';
}

// =========================
// 🔸 VALEURS INITIALES
// =========================
const INITIAL_FORM_DATA: FormData = {
  locataire_id: '',
  unite_id: '',
  date_debut: '',
  date_fin: '',
  loyer_mensuel: '',
  caution: '',
  commission: '',
  statut: 'actif',
  destination: '',
};

// =========================
// 🔸 COMPOSANT PRINCIPAL
// =========================
export function Contrats() {
  // États
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contrat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // =========================
  // 💰 FORMATAGE DES MONTANTS
  // =========================
  const formatCurrency = useCallback((amount: number | string): string => {
    if (!amount) return '0 F CFA';
    const cleaned = String(amount).replace(/[/\s]/g, '');
    const num = Number(cleaned);
    if (isNaN(num)) return '0 F CFA';
    return (
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
        .format(num)
        .replace(/\u00A0/g, ' ') + ' F CFA'
    );
  }, []);

  // =========================
  // 🔁 CHARGEMENT DES DONNÉES
  // =========================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [contratsRes, locatairesRes, unitesRes, bailleursRes] = await Promise.all([
        supabase
          .from('contrats')
          .select(`
            *,
            locataires(nom, prenom, telephone, email, adresse_personnelle, piece_identite),
            unites(
              nom,
              loyer_base,
              immeubles(
                nom,
                adresse,
                bailleurs(id, nom, prenom, telephone, adresse, commission)
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('locataires')
          .select('id, nom, prenom')
          .eq('actif', true)
          .order('nom', { ascending: true }),
        supabase
          .from('unites')
          .select('id, nom, loyer_base, statut, immeubles(nom, bailleurs(id, nom, prenom, commission))')
          .eq('actif', true)
          .eq('statut', 'libre')
          .order('nom', { ascending: true }),
        supabase
          .from('bailleurs')
          .select('id, nom, prenom, telephone, adresse, commission')
          .eq('actif', true)
          .order('nom', { ascending: true }),
      ]);

      if (contratsRes.error) throw contratsRes.error;
      if (locatairesRes.error) throw locatairesRes.error;
      if (unitesRes.error) throw unitesRes.error;
      if (bailleursRes.error) throw bailleursRes.error;

      setContrats(contratsRes.data || []);
      setLocataires(locatairesRes.data || []);
      setUnites(unitesRes.data || []);
      setBailleurs(bailleursRes.data || []);
    } catch (err: any) {
      console.error('Erreur chargement:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =========================
  // 🔍 FILTRAGE DES CONTRATS
  // =========================
  const filteredContrats = useMemo(() => {
    if (!searchTerm.trim()) return contrats;

    const term = searchTerm.toLowerCase();
    return contrats.filter((c) => {
      const locataire = c.locataires
        ? `${c.locataires.prenom} ${c.locataires.nom}`.toLowerCase()
        : '';
      const unite = c.unites?.nom?.toLowerCase() || '';
      const immeuble = c.unites?.immeubles?.nom?.toLowerCase() || '';
      const statut = c.statut.toLowerCase();
      const destination = c.destination?.toLowerCase() || '';

      return (
        locataire.includes(term) ||
        unite.includes(term) ||
        immeuble.includes(term) ||
        statut.includes(term) ||
        destination.includes(term)
      );
    });
  }, [searchTerm, contrats]);

  // =========================
  // 📊 STATISTIQUES
  // =========================
  const stats = useMemo(() => {
    const actifs = contrats.filter((c) => c.statut === 'actif');
    const revenuTotal = actifs.reduce((sum, c) => {
      const partAgence = (c.loyer_mensuel * (c.commission || 0)) / 100;
      const caution = c.caution || 0;
      return sum + partAgence + caution;
    }, 0);

    return {
      total: contrats.length,
      actifs: actifs.length,
      expires: contrats.filter((c) => c.statut === 'expire').length,
      resilies: contrats.filter((c) => c.statut === 'resilie').length,
      revenuTotal,
    };
  }, [contrats]);

  // =========================
  // 🏢 GESTION CHANGEMENT D'UNITÉ
  // =========================
  const handleUniteChange = useCallback(
    (uniteId: string) => {
      const unite = unites.find((u) => u.id === uniteId);
      let commissionBailleur = '';

      if (unite && unite.immeubles?.bailleurs) {
        commissionBailleur = (unite.immeubles.bailleurs.commission || 0).toString();
      }

      setFormData((prev) => ({
        ...prev,
        unite_id: uniteId,
        loyer_mensuel: unite ? unite.loyer_base.toString() : '',
        commission: commissionBailleur,
      }));
    },
    [unites]
  );

  // =========================
  // ✅ VALIDATION DU FORMULAIRE
  // =========================
  const validateForm = useCallback((): string | null => {
    if (!formData.locataire_id) return 'Veuillez sélectionner un locataire';
    if (!formData.unite_id) return 'Veuillez sélectionner un produit';
    if (!formData.date_debut) return 'Veuillez saisir la date de début';
    if (!formData.destination) return 'Veuillez sélectionner la destination';
    if (!formData.loyer_mensuel || parseFloat(formData.loyer_mensuel) <= 0) {
      return 'Veuillez saisir un loyer valide';
    }
    return null;
  }, [formData]);

  // =========================
  // 📝 CRÉATION DE CONTRAT
  // =========================
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationError = validateForm();
      if (validationError) {
        alert(validationError);
        return;
      }

      setSubmitting(true);
      try {
        const { data: uniteCheck, error: uniteError } = await supabase
          .from('unites')
          .select('statut')
          .eq('id', formData.unite_id)
          .single();

        if (uniteError) throw uniteError;

        if (uniteCheck && uniteCheck.statut === 'loue') {
          alert('Ce produit est déjà occupé. Veuillez en sélectionner un autre.');
          return;
        }

        const data = {
          locataire_id: formData.locataire_id,
          unite_id: formData.unite_id,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin || null,
          loyer_mensuel: parseFloat(formData.loyer_mensuel),
          commission: formData.commission ? parseFloat(formData.commission) : null,
          caution: formData.caution ? parseFloat(formData.caution) : null,
          statut: formData.statut,
          destination: formData.destination,
        };

        const { error: insertError } = await supabase
          .from('contrats')
          .insert([data]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('unites')
          .update({ statut: 'loue' })
          .eq('id', formData.unite_id);

        if (updateError) throw updateError;

        closeModal();
        await loadData();
        alert('✅ Contrat créé avec succès!');
      } catch (err: any) {
        console.error('Erreur création:', err);
        alert(`❌ Erreur: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    },
    [formData, validateForm, loadData]
  );

  // =========================
  // ✏️ MODIFICATION DE CONTRAT
  // =========================
  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editing) return;

      setSubmitting(true);
      try {
        const data: any = {
          statut: formData.statut,
          date_fin: formData.date_fin || null,
          commission: formData.commission ? parseFloat(formData.commission) : null,
          caution: formData.caution ? parseFloat(formData.caution) : null,
        };

        const { error: updateError } = await supabase
          .from('contrats')
          .update(data)
          .eq('id', editing.id);

        if (updateError) throw updateError;

        if (formData.statut === 'resilie' || formData.statut === 'expire') {
          const { error: uniteError } = await supabase
            .from('unites')
            .update({ statut: 'libre' })
            .eq('id', editing.unite_id);

          if (uniteError) throw uniteError;
        }

        closeEditModal();
        await loadData();
        alert('✅ Contrat modifié avec succès!');
      } catch (err: any) {
        console.error('Erreur modification:', err);
        alert(`❌ Erreur: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    },
    [formData, editing, loadData]
  );

  // =========================
  // 🖊️ OUVERTURE MODAL D'ÉDITION
  // =========================
  const handleEdit = useCallback((contrat: Contrat) => {
    setEditing(contrat);
    setFormData({
      locataire_id: contrat.locataire_id,
      unite_id: contrat.unite_id,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      loyer_mensuel: contrat.loyer_mensuel.toString(),
      caution: contrat.caution?.toString() || '',
      commission: contrat.commission?.toString() || '',
      statut: contrat.statut,
      destination: (contrat.destination as any) || '',
    });
    setIsEditModalOpen(true);
  }, []);

  // =========================
  // 📄 TÉLÉCHARGEMENT PDF
  // =========================
  const handleDownloadPDF = useCallback(async (contratId: string) => {
    setDownloadingId(contratId);
    try {
      const { data: contrat, error } = await supabase
        .from('contrats')
        .select(`
          *,
          locataires(nom, prenom, telephone, email, adresse_personnelle, piece_identite),
          unites(
            nom,
            loyer_base,
            immeubles(
              nom,
              adresse,
              bailleurs(nom, prenom, telephone, adresse)
            )
          )
        `)
        .eq('id', contratId)
        .single();

      if (error) throw error;
      if (contrat) {
        await generateContratPDF(contrat);
      }
    } catch (err: any) {
      console.error('Erreur PDF:', err);
      alert(`❌ Erreur lors de la génération du PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // =========================
  // 🚪 FERMETURE DES MODALS
  // =========================
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditing(null);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  // =========================
  // 📋 COLONNES DU TABLEAU
  // =========================
  const columns = useMemo(
    () => [
      {
        key: 'locataire',
        label: 'Locataire',
        render: (c: Contrat) =>
          c.locataires ? `${c.locataires.prenom} ${c.locataires.nom}` : '-',
      },
      {
        key: 'unite',
        label: 'Produit',
        render: (c: Contrat) => c.unites?.nom || '-',
      },
      {
        key: 'immeuble',
        label: 'Immeuble',
        render: (c: Contrat) => c.unites?.immeubles?.nom || '-',
      },
      {
        key: 'destination',
        label: 'Destination',
        render: (c: Contrat) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              c.destination === 'Commercial'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {c.destination || 'Non spécifié'}
          </span>
        ),
      },
      {
        key: 'date_debut',
        label: 'Début',
        render: (c: Contrat) =>
          new Date(c.date_debut).toLocaleDateString('fr-FR'),
      },
      {
        key: 'loyer_mensuel',
        label: 'Loyer',
        render: (c: Contrat) => formatCurrency(c.loyer_mensuel),
      },
      {
        key: 'revenue_total',
        label: 'Revenue',
        render: (c: Contrat) => {
          const partAgence = (c.loyer_mensuel * (c.commission || 0)) / 100;
          const caution = c.caution || 0;
          return formatCurrency(partAgence + caution);
        },
      },
      {
        key: 'statut',
        label: 'Statut',
        render: (c: Contrat) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              c.statut === 'actif'
                ? 'bg-green-100 text-green-700'
                : c.statut === 'resilie'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {c.statut.charAt(0).toUpperCase() + c.statut.slice(1)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'PDF',
        render: (c: Contrat) => (
          <button
            onClick={() => handleDownloadPDF(c.id)}
            disabled={downloadingId === c.id}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {downloadingId === c.id ? '...' : 'PDF'}
          </button>
        ),
      },
    ],
    [formatCurrency, handleDownloadPDF, downloadingId]
  );

  // =========================
  // 🧩 RENDU
  // =========================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
               style={{ 
                 borderColor: BRAND_COLORS.primary,
                 borderTopColor: 'transparent'
               }} />
          <p className="mt-4 text-lg" style={{ color: BRAND_COLORS.gray }}>
            Chargement des contrats...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="border rounded-lg p-6 flex items-start gap-3"
             style={{ 
               backgroundColor: '#FFF5F5',
               borderColor: BRAND_COLORS.red
             }}>
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" 
                       style={{ color: BRAND_COLORS.red }} />
          <div>
            <h3 className="text-lg font-semibold mb-1" 
                style={{ color: BRAND_COLORS.red }}>
              Erreur de chargement
            </h3>
            <p style={{ color: BRAND_COLORS.red }}>{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 text-white rounded-lg transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.red})` }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 📊 En-tête et statistiques */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: BRAND_COLORS.gray }}>
            Contrats
          </h1>
          <p className="text-slate-600">Gestion des contrats de location</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition shadow-lg hover:shadow-xl transform hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.red})` }}
        >
          <Plus className="w-5 h-5" />
          Nouveau contrat
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Total contrats</p>
          <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Actifs</p>
          <p className="text-2xl font-bold text-green-900">{stats.actifs}</p>
        </div>
        <div className="border rounded-lg p-4"
             style={{ backgroundColor: '#FFF4E6', borderColor: BRAND_COLORS.primary }}>
          <p className="text-sm font-medium" style={{ color: BRAND_COLORS.primary }}>
            Expirés
          </p>
          <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.red }}>
            {stats.expires}
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-600 font-medium">Revenue mensuel</p>
          </div>
          <p className="text-2xl font-bold text-emerald-900">
            {formatCurrency(stats.revenuTotal)}
          </p>
        </div>
      </div>

      {/* Recherche et tableau */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un locataire, produit, immeuble, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-transparent transition-all"
              style={{ 
                boxShadow: searchTerm ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none' 
              }}
            />
          </div>
        </div>

        {filteredContrats.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-600 text-lg">
              {searchTerm
                ? 'Aucun contrat trouvé pour votre recherche'
                : 'Aucun contrat enregistré'}
            </p>
          </div>
        ) : (
          <Table columns={columns} data={filteredContrats} onEdit={handleEdit} />
        )}
      </div>

      {/* Modal création */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Nouveau contrat">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Locataire *
            </label>
            <select
              required
              value={formData.locataire_id}
              onChange={(e) =>
                setFormData({ ...formData, locataire_id: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.locataire_id ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner un locataire</option>
              {locataires.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.prenom} {l.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Produit libre *
            </label>
            <select
              required
              value={formData.unite_id}
              onChange={(e) => handleUniteChange(e.target.value)}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.unite_id ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner un produit</option>
              {unites.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom} - {u.immeubles?.nom} ({formatCurrency(u.loyer_base)})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Seuls les produits libres sont affichés
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Destination *
            </label>
            <select
              required
              value={formData.destination}
              onChange={(e) =>
                setFormData({ ...formData, destination: e.target.value as any })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.destination ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner la destination</option>
              <option value="Habitation">Habitation</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Date début *
              </label>
              <input
                type="date"
                required
                value={formData.date_debut}
                onChange={(e) =>
                  setFormData({ ...formData, date_debut: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Date fin
              </label>
              <input
                type="date"
                value={formData.date_fin}
                onChange={(e) =>
                  setFormData({ ...formData, date_fin: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Loyer mensuel *
              </label>
              <input
                type="number"
                required
                value={formData.loyer_mensuel}
                onChange={(e) =>
                  setFormData({ ...formData, loyer_mensuel: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Commission (%)
              </label>
              <input
                type="number"
                value={formData.commission}
                onChange={(e) =>
                  setFormData({ ...formData, commission: e.target.value })
                }
                placeholder="Auto-rempli"
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none bg-slate-50"
                disabled
              />
              <p className="text-xs text-slate-500 mt-1">
                Taux défini par le bailleur
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Caution (F CFA)
              </label>
              <input
                type="number"
                value={formData.caution}
                onChange={(e) =>
                  setFormData({ ...formData, caution: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.red})` }}
            >
              {submitting ? 'Création...' : 'Créer le contrat'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal édition */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Modifier le contrat"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Statut *
            </label>
            <select
              required
              value={formData.statut}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  statut: e.target.value as any,
                })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            >
              <option value="actif">Actif</option>
              <option value="expire">Expiré</option>
              <option value="resilie">Résilié</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Date de fin
            </label>
            <input
              type="date"
              value={formData.date_fin}
              onChange={(e) =>
                setFormData({ ...formData, date_fin: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Commission (%)
            </label>
            <input
              type="number"
              value={formData.commission}
              onChange={(e) =>
                setFormData({ ...formData, commission: e.target.value })
              }
              placeholder="Optionnel"
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Caution (F CFA)
            </label>
            <input
              type="number"
              value={formData.caution}
              onChange={(e) =>
                setFormData({ ...formData, caution: e.target.value })
              }
              placeholder="Optionnel"
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submitting}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={submitting}
              className="px-6 py-2 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.red})` }}
            >
              {submitting ? 'Modification...' : 'Modifier le contrat'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}