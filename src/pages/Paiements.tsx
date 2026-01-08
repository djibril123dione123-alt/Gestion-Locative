// Imports de base, hooks, utilitaires Supabase, et composants UI
import React, { useEffect, useState } from 'react'; // [3, 4]
import { useAuth } from '../contexts/AuthContext'; // [NEW] Multi-tenant support
import { supabase } from '../lib/supabase'; // [3, 4]
import { Modal } from '../components/ui/Modal'; // [3, 4]
import { Table } from '../components/ui/Table'; // [3, 4]
import { Plus, Search, Download } from 'lucide-react'; // Ajout de Download pour l'export [4]
import jsPDF from 'jspdf'; // [3, 4]
import 'jspdf-autotable'; // [3, 4]
import { generatePaiementFacturePDF } from '../lib/pdf'; // [3, 4]

// Déclaration des modules pour jsPDF (nécessaire pour autoTable) [3, 4]
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export function Paiements() {
    // Multi-tenant context [NEW]
    const { profile } = useAuth();

    // États principaux des données et de l'interface [2-6]
    const [paiements, setPaiements] = useState([]); // [3, 4]
    const [filtered, setFiltered] = useState([]); // [5, 6]
    const [contrats, setContrats] = useState([]); // [5, 6]
    const [loading, setLoading] = useState(true); // [5, 6]
    const [isModalOpen, setIsModalOpen] = useState(false); // [5, 6]
    const [searchTerm, setSearchTerm] = useState(''); // [5, 6]
    const [editingPaiement, setEditingPaiement] = useState(null); // Permet la modification [2, 5]

    // État du formulaire [5-7]
    const initialFormData = {
        contrat_id: '',
        montant_total: '',
        mois_concerne: '',
        mois_display: '',
        date_paiement: new Date().toISOString().split('T'),
        mode_paiement: 'especes' as const,
        statut: 'paye' as const,
        reference: '',
    };
    const [formData, setFormData] = useState(initialFormData);

    // Fonction de formatage des devises (version robuste) [8-10]
    const formatCurrency = (amount: number | string): string => {
        if (!amount) return "0 F CFA";
        const cleaned = String(amount)
            .replace(/\//g, "")
            .replace(/\s/g, "");
        const num = Number(cleaned);
        return (
            new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 })
                .format(num)
                .replace(/\u00A0/g, " ") + " F CFA"
        );
    };

    // Fermeture du modal et réinitialisation des états [11-14]
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPaiement(null); // Important pour passer du mode 'Modifier' au mode 'Créer'
        setFormData(initialFormData);
    };

    // Chargement des données (Paiements et Contrats Actifs) [7, 15-17]
    const loadData = async () => {
        // Multi-tenant guard [NEW]
        if (!profile?.agency_id) return;

        try {
            const [paiementsRes, contratsRes] = await Promise.all([
                supabase
                    .from('paiements')
                    .select(
                        '*, contrats(loyer_mensuel, commission, locataires(nom, prenom), unites(nom,id))' // Ajout de 'id' pour unites [15]
                    )
                    .eq('agency_id', profile.agency_id) // [NEW] Multi-tenant filter
                    .order('created_at', { ascending: false }),
                supabase
                    .from('contrats')
                    .select(
                        'id, loyer_mensuel, commission, locataires(nom, prenom), unites(nom)'
                    )
                    .eq('agency_id', profile.agency_id) // [NEW] Multi-tenant filter
                    .eq('statut', 'actif'),
            ]);

            setPaiements(paiementsRes.data || []);
            setFiltered(paiementsRes.data || []);
            setContrats(contratsRes.data || []);
        } catch (error) {
            console.error('Erreur chargement données :', error);
        } finally {
            setLoading(false);
        }
    };

    // Effets : Chargement initial et Filtrage par recherche [7, 16]
    useEffect(() => {
        if (profile?.agency_id) {
            loadData(); // [7, 16]
        }
    }, [profile?.agency_id]); // [NEW] Multi-tenant dependency

    useEffect(() => {
        setFiltered( // [7, 16]
            paiements.filter((p) =>
                JSON.stringify(p).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [searchTerm, paiements]);

    // Gestion du changement de mois [12, 14]
    const handleMoisChange = (monthValue: string) => {
        setFormData({
            ...formData,
            mois_display: monthValue,
            mois_concerne: monthValue + '-01',
        });
    };

    // Fonction d'édition : pré-remplir le formulaire [18, 19]
    const handleEdit = (paiement: any) => {
        setEditingPaiement(paiement);
        setFormData({
            contrat_id: paiement.contrat_id,
            montant_total: paiement.montant_total.toString(),
            mois_display: paiement.mois_concerne.slice(0, 7),
            mois_concerne: paiement.mois_concerne,
            date_paiement: paiement.date_paiement,
            mode_paiement: paiement.mode_paiement,
            statut: paiement.statut,
            reference: paiement.reference || '',
        });
        setIsModalOpen(true);
    };

    // Soumission du formulaire (Création OU Modification) [15, 20-23]
    const handleSubmit = async (e: React.FormEvent) => {
        // Multi-tenant guard [NEW]
        if (!profile?.agency_id) return;

        e.preventDefault();

        try {
            const contrat = contrats.find((c) => c.id === formData.contrat_id); // [15, 19]
            if (!contrat) throw new Error('Contrat non trouvé'); // [19, 20]

            const montantTotal = parseFloat(formData.montant_total);
            const partAgence = (montantTotal * (contrat.commission || contrat.pourcentage_agence || 10)) / 100;
            const partBailleur = montantTotal - partAgence;

            const moisConcerne = new Date(formData.mois_display + '-01')
                .toISOString()
                .split('T'); // Conversion du mois au format YYYY-MM-DD [20, 22]

            const data = {
                montant_total: montantTotal,
                mois_concerne: moisConcerne,
                date_paiement: formData.date_paiement,
                mode_paiement: formData.mode_paiement,
                statut: formData.statut,
                reference: formData.reference || null,
                part_agence: partAgence, // [21, 22]
                part_bailleur: partBailleur, // [21, 22]
                agency_id: profile?.agency_id, // [NEW] Multi-tenant support
            };

            let error;
            // Logique de modification/création unifiée [21, 23]
            if (editingPaiement) {
                const result = await supabase
                    .from('paiements')
                    .update(data)
                    .eq('id', editingPaiement.id);
                error = result.error;
            } else {
                const result = await supabase
                    .from('paiements')
                    .insert([{ ...data, contrat_id: formData.contrat_id }]);
                error = result.error;
            }

            if (error) throw error;

            const message = editingPaiement
                ? '✅ Paiement modifié avec succès !'
                : '✅ Paiement enregistré avec succès !'; // Messages unifiés [21, 23]
            alert(message);
            setEditingPaiement(null);
            closeModal();
            loadData();
        } catch (error: any) {
            console.error('Erreur :', error.message);
            alert(`Erreur : ${error.message}`); // [18, 24]
        }
    };

    // Suppression d'un paiement (avec synchronisation des revenus) [11, 24, 25]
    const handleDelete = async (paiement: any) => {
        // Multi-tenant guard [NEW]
        if (!profile?.agency_id) return;

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return; // Confirmation robuste [25]

        try {
            const { error } = await supabase.from('paiements').delete().eq('id', paiement.id); // [11, 24]
            if (error) throw error;

            // Supprimer l'entrée correspondante dans 'revenus' si le paiement était 'payé' [11, 24, 25]
            if (paiement.statut === 'paye') {
                await supabase.from('revenus').delete().eq('paiement_id', paiement.id);
            }

            alert('✅ Paiement supprimé avec succès !'); // [25]
            loadData();
        } catch (error: any) {
            console.error('Erreur suppression paiement :', error.message);
            alert(`Erreur : ${error.message}`);
        }
    };

    // Génération de la Facture PDF (version robuste avec chargement de l'adresse séparé) [8, 12, 26-28]
    const exportFacture = async (paiementId: string) => {
        // Multi-tenant guard [NEW]
        if (!profile?.agency_id) return;

        try {
            // 1. Charger le paiement et les relations proches
            const { data: pmt, error: e1 } = await supabase
                .from('paiements')
                .select(`
                    id, created_at, date_paiement, mois_concerne, montant_total, reference,
                    contrats(
                        id, loyer_mensuel, commission,
                        locataires(nom, prenom),
                        unites(id, nom)
                    )
                `)
                .eq('agency_id', profile.agency_id) // [NEW] Multi-tenant filter
                .eq('id', paiementId)
                .single(); // [26, 27]

            if (e1 || !pmt || !pmt.contrats || !pmt.contrats.locataires || !pmt.contrats.unites) {
                throw new Error('Données de facturation incomplètes.');
            }

            // 2. Tenter de récupérer l'adresse de l'immeuble séparément (pour tolérer les RLS) [27, 28]
            let adresse = '—';
            try {
                const uniteId = pmt.contrats.unites.id;
                const { data: u } = await supabase
                    .from('unites')
                    .select('immeubles(adresse)')
                    .eq('agency_id', profile.agency_id) // [NEW] Multi-tenant filter
                    .eq('id', uniteId)
                    .maybeSingle();

                if (u?.immeubles?.adresse) adresse = u.immeubles.adresse;
            } catch (e) {
                console.warn('Adresse non récupérée (fallback "—"):', e); // [28]
            }

            // 3. Préparer le payload et générer le PDF [28]
            const payload = {
                ...pmt,
                contrats: {
                    ...pmt.contrats,
                    unites: {
                        ...pmt.contrats.unites,
                        immeubles: { adresse },
                    },
                },
            };

            await generatePaiementFacturePDF(payload);

        } catch (err: any) {
            console.error('Facture PDF:', err);
            alert(`Erreur lors de la génération de la facture PDF: ${err?.message || err}`); // [9]
        }
    };
    
    // Fonction d'export de la liste des paiements au format PDF [14, 26]
    const exportPDF = () => {
        // Multi-tenant guard [NEW]
        if (!profile?.agency_id) return;

        const doc = new jsPDF();
        doc.text('Liste des Paiements', 14, 15);
        doc.autoTable({
            head: [['Locataire', 'Montant', 'Date', 'Statut']],
            body: filtered.map((p: any) => [
                p.contrats?.locataires
                    ? `${p.contrats.locataires.prenom} ${p.contrats.locataires.nom}`
                    : '-',
                formatCurrency(p.montant_total),
                p.date_paiement,
                p.statut,
            ]),
            startY: 20,
        });
        doc.save('paiements.pdf');
    };


    // Définition des colonnes de la table [8, 10, 29-32]
    const columns = [
        {
            key: 'locataire',
            label: 'Locataire',
            render: (p: any) =>
                p.contrats?.locataires
                    ? `${p.contrats.locataires.prenom} ${p.contrats.locataires.nom}`
                    : '-', // [8, 10]
        },
        { key: 'unite', label: 'Produit', render: (p: any) => p.contrats?.unites?.nom || '-' }, // [10, 29]
        {
            key: 'mois_concerne',
            label: 'Mois',
            render: (p: any) =>
                new Date(p.mois_concerne).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                }), // [10, 29]
        },
        {
            key: 'montant_total',
            label: 'Montant',
            render: (p: any) => formatCurrency(p.montant_total), // [29, 31]
        },
        { key: 'date_paiement', label: 'Date paiement' }, // [29, 31]
        {
            key: 'statut',
            label: 'Statut',
            render: (p: any) => (
                <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.statut === 'paye'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                    }`} // Style Statut [29, 31]
                >
                    {p.statut}
                </span>
            ),
        },
        {
            key: 'facture',
            label: 'Facture',
            render: (p: any) => (
                <button
                    onClick={() => exportFacture(p.id)}
                    className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition" // [30, 33]
                >
                    Facture PDF
                </button>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (p: any) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleEdit(p)}
                        className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition" // Bouton Modifier [30, 32]
                    >
                        Modifier
                    </button>
                    <button
                        onClick={() => handleDelete(p)}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition" // Bouton Supprimer [30, 32]
                    >
                        Supprimer
                    </button>
                </div>
            ),
        },
    ];

    if (loading)
        return (
            <div className="p-8 text-center">
                <p className="text-xl font-semibold">Chargement...</p> {/* [31, 34] */}
            </div>
        );

    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Paiements</h1>
                <div className="flex gap-4">
                    {/* Bouton Export PDF (optionnel / commenté dans les sources, mais inclus si souhaité) [35] */}
                    {/* <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                    >
                        <Download size={18} /> Export PDF Liste
                    </button> */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" // [34, 35]
                    >
                        <Plus size={20} /> Nouveau paiement
                    </button>
                </div>
            </header>

            <p className="text-slate-500 mb-6">Gestion des paiements de loyers</p> {/* [34] */}

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [34, 35]
                />
            </div>

            <Table columns={columns} data={filtered} /> {/* Utilisation des colonnes fusionnées */}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingPaiement ? "Modifier le paiement" : "Nouveau paiement"} // Titre dynamique [24, 36]
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contrat *</label>
                        <select
                            required
                            value={formData.contrat_id}
                            onChange={(e) => setFormData({ ...formData, contrat_id: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [33, 36]
                        >
                            <option value="">Sélectionner</option> {/* [33, 36] */}
                            {contrats.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.locataires?.prenom} {c.locataires?.nom} - {c.unites?.nom}
                                </option> // [33, 36]
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Montant *</label>
                        <input
                            type="number"
                            required
                            value={formData.montant_total}
                            onChange={(e) => setFormData({ ...formData, montant_total: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [36-38]
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mois concerné *</label>
                        <input
                            type="month"
                            required
                            value={formData.mois_display}
                            onChange={(e) => handleMoisChange(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [37, 38]
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date paiement *</label>
                        <input
                            type="date"
                            required
                            value={formData.date_paiement}
                            onChange={(e) => setFormData({ ...formData, date_paiement: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [37-39]
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mode *</label>
                        <select
                            value={formData.mode_paiement}
                            onChange={(e) => setFormData({ ...formData, mode_paiement: e.target.value as any })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" // [39, 40]
                        >
                            <option value="especes">Espèces</option>
                            <option value="cheque">Chèque</option>
                            <option value="virement">Virement</option>
                            <option value="mobile_money">Mobile Money</option>
                        </select>
                    </div>

                    {/* Champ Statut et Référence (non affichés dans les extraits de formulaire, mais inclus dans formData)
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                        <select
                            value={formData.statut}
                            onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        >
                            <option value="paye">Payé</option>
                            <option value="en_attente">En Attente</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Référence</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        />
                    </div>
                    */}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition" // [39, 40]
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" // [40, 41]
                        >
                            {editingPaiement ? "Modifier" : "Créer"} {/* Texte dynamique [40, 41] */}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}