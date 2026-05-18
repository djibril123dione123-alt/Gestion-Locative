import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, Download, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/formatters';
import {
    addFooter,
    drawDocumentHeader,
    drawPageBorder,
    getAutoTableTheme,
    saveGeneratedPdf,
} from '../lib/pdf';
import { PageSkeleton } from '../components/ui/Skeleton';
import type { AgencySettings } from '../types/agency';

// -------------------------------------------------------------------------
// 1. DÉFINITION DES TYPES ET INTERFACES UNIFIÉS
// -------------------------------------------------------------------------

// Interface pour le rapport bailleur [4, 7]
interface BilanBailleur {
    bailleur_id: string;
    bailleur_nom: string;
    bailleur_prenom: string;
    immeubles: {
        immeuble_nom: string;
        loyers_percus: number;
        loyers_impayes: number;
        frais_gestion: number;
        resultat_net: number; // [7]
        unites: BilanBailleurUnite[];
    }[];
    total_loyers_percus: number;
    total_impayes: number;
    total_frais: number;
    total_net: number;
}

interface BilanBailleurUnite {
    unite_nom: string;
    locataire_nom: string;
    loyer: number;
    statut_paiement: string;
    montant_encaisse: number;
    reliquat: number;
    montant_restant: number;
    periode: string;
    observation: string;
}

// Interface pour les données mensuelles (fusion de BilanEntreprise et Comptabilité)
interface MonthlyStat {
    month: string;
    commission?: number; 
    revenus?: number; // Utilisé dans la Comptabilité [16]
    depenses: number;
    solde: number;
}

interface BilanEntreprise {
    totalLoyers: number;
    loyersImpayes: number;
    commission: number;
    revenus_alt: number;
    totalRevenus: number;
    totalDepenses: number;
    soldeNet: number;
}

interface BailleurRow {
    id: string;
    nom: string;
    prenom: string;
}

interface ImmeubleRow {
    id: string;
    nom: string;
    bailleur_id: string;
    bailleurs?: { nom?: string | null; prenom?: string | null } | null;
}

interface PaiementMensuelRow {
    montant_total: number;
    part_agence: number;
    part_bailleur?: number | null;
    reliquat?: number | null;
    statut: string;
    mois_concerne?: string | null;
    contrats?: {
        loyer_mensuel?: number | null;
        locataires?: { nom?: string | null; prenom?: string | null } | null;
        unites?: { id?: string | null; nom?: string | null; immeuble_id?: string | null } | null;
    } | null;
}

type PdfWithAutoTable = jsPDF & {
    lastAutoTable?: { finalY: number };
};

// -------------------------------------------------------------------------
// 2. FONCTIONS UTILITAIRES UNIFIÉES
// -------------------------------------------------------------------------

export function TableauDeBordFinancierGlobal() {
    const { profile } = useAuth();

    // -------------------------------------------------------------------------
    // 3. ÉTATS CENTRALISÉS [7-9, 11]
    // -------------------------------------------------------------------------

    const [loading, setLoading] = useState(true); 
    
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // [7, 9, 10]
    });

    // Données des 4 rapports fusionnés:
    const [bilanEntreprise, setBilanEntreprise] = useState<BilanEntreprise | null>(null); 
    const [statsAnnuel, setStatsAnnuel] = useState({ totalRevenus: 0, totalDepenses: 0, soldeNet: 0 }); // [11]
    const [monthlyData, setMonthlyData] = useState<MonthlyStat[]>([]); // [9, 11]
    const [bilansBailleurs, setBilansBailleurs] = useState<BilanBailleur[]>([]); 
    const [agencySettings, setAgencySettings] = useState<Partial<AgencySettings> | null>(null);
    const [currentPage, setCurrentPage] = useState<'bailleurs' | 'operationnel'>('bailleurs');

    // -------------------------------------------------------------------------
    // 4. LOGIQUE DE CHARGEMENT ET DE CALCUL UNIFIÉE
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (profile?.agency_id) {
            loadAllData();
        }
    // This dashboard loader owns a large coordinated query/calculation workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, profile?.agency_id]); 

    const loadAllData = async () => {
        if (!profile?.agency_id) return;
        setLoading(true);

        try {
            const currentYear = new Date(selectedMonth).getFullYear();
            const yearStartDate = `${currentYear}-01-01`;
            
            // --- Périodes mensuelles [10, 21, 22]
            const monthStart = `${selectedMonth}-01`;
            const monthEnd = new Date(selectedMonth + '-01');
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            const monthEndStr = monthEnd.toISOString().slice(0, 10);
            
            // --- Requêtes Supabase Centrales (Optimisation par Promise.all) ---
            const [
                paiementsMensuelsRes,
                depensesMensuelsRes,
                revenusAutresMensuelsRes,

                // Pour Rapports Annuels et Comptabilité:
                paiementsAnnuelsRes, // Utilisation pour 'part_agence' annuelle [23]
                depensesAnnuelsRes, // [23]

                // Pour les bilans bailleurs:
                bailleursRes, // [22]
                immeublesRes, // [10, 22]
                settingsRes,
            ] = await Promise.all([
                // 1. Données Mensuelles
                supabase.from('paiements').select('*, contrats(loyer_mensuel, locataires(nom, prenom), unites(id, nom, immeuble_id))').eq('agency_id', profile.agency_id).gte('mois_concerne', monthStart).lt('mois_concerne', monthEndStr),
                supabase.from('depenses').select('*').eq('agency_id', profile.agency_id).gte('date_depense', monthStart).lt('date_depense', monthEndStr),
                supabase.from('revenus').select('*').eq('agency_id', profile.agency_id).gte('date_revenu', monthStart).lt('date_revenu', monthEndStr),

                // 2. Données Annuelles (pour Tendance / Comptabilité)
                supabase.from('paiements').select('part_agence, mois_concerne, statut').eq('agency_id', profile.agency_id).gte('mois_concerne', yearStartDate),
                supabase.from('depenses').select('montant, date_depense').eq('agency_id', profile.agency_id).gte('date_depense', yearStartDate),

                // 3. Données Structurelles
                supabase.from('bailleurs').select('id, nom, prenom').eq('agency_id', profile.agency_id).eq('actif', true),
                supabase.from('immeubles').select('id, nom, bailleur_id, nombre_unites, bailleurs(nom, prenom)').eq('agency_id', profile.agency_id).eq('actif', true), // [10]
                supabase.from('agency_settings').select('nom_agence, adresse, telephone, email, logo_url, couleur_primaire, couleur_secondaire, pied_page_personnalise').eq('agency_id', profile.agency_id).maybeSingle(),
            ]);

            // Extraction des données
            const paiementsMensuels = (paiementsMensuelsRes.data || []) as PaiementMensuelRow[];
            const depensesMensuels = depensesMensuelsRes.data || [];
            const revenus_autresMensuels = revenusAutresMensuelsRes.data || [];

            const paiementsAnnuels = paiementsAnnuelsRes.data || [];
            const depensesAnnuelles = depensesAnnuelsRes.data || [];

            const bailleurs = (bailleursRes.data || []) as BailleurRow[];
            const immeubles = (immeublesRes.data || []) as ImmeubleRow[];
            setAgencySettings((settingsRes.data || null) as Partial<AgencySettings> | null);


            // ---------------------------------------------------
            // CALCUL 1: BILAN ENTREPRISE MENSUEL (KPIs) [25, 26]
            // ---------------------------------------------------
            const totalLoyers = paiementsMensuels
                .filter(p => p.statut === 'paye' || p.statut === 'partiel')
                .reduce((sum, p) => sum + Number(p.montant_total), 0);
            const loyersImpayes = paiementsMensuels
                .filter(p => p.statut === 'partiel')
                .reduce((sum, p) => sum + Number(p.reliquat || 0), 0);
            const commission = paiementsMensuels
                .filter(p => p.statut === 'paye' || p.statut === 'partiel')
                .reduce((sum, p) => sum + Number(p.part_agence), 0);
            const revenus_alt = revenus_autresMensuels.reduce((sum, r) => sum + Number(r.montant), 0);

            const totalRevenus = commission + revenus_alt;
            const totalDepenses = depensesMensuels.reduce((sum, d) => sum + Number(d.montant), 0);
            const soldeNet = totalRevenus - totalDepenses;

            setBilanEntreprise({ totalLoyers, loyersImpayes, commission, revenus_alt, totalRevenus, totalDepenses, soldeNet });

            
            // ---------------------------------------------------
            // CALCUL 2: TENDANCE ANNUELLE / COMPTABILITÉ [16, 23, 26]
            // ---------------------------------------------------
            const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
            
            // Totaux Annuels [23]
            const totalRevenusAnnuel = (paiementsAnnuels || [])
                .filter(p => p.statut === 'paye' || p.statut === 'partiel')
                .reduce((sum, p) => sum + Number(p.part_agence), 0);
            const totalDepensesAnnuel = (depensesAnnuelles || []).reduce((sum, d) => sum + Number(d.montant), 0);
            
            setStatsAnnuel({
                totalRevenus: totalRevenusAnnuel,
                totalDepenses: totalDepensesAnnuel,
                soldeNet: totalRevenusAnnuel - totalDepensesAnnuel,
            });

            // Données Mensuelles pour graphique (Bilan Annuel / Comptabilité) [16, 27, 28]
            const yearData: MonthlyStat[] = months.map((monthName, index) => {
                const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
                
                const revenus = (paiementsAnnuels || [])
                    .filter(p => p.mois_concerne.startsWith(monthStr) && (p.statut === 'paye' || p.statut === 'partiel'))
                    .reduce((sum, p) => sum + Number(p.part_agence), 0);
                
                const depenses = (depensesAnnuelles || [])
                    .filter(d => d.date_depense.startsWith(monthStr))
                    .reduce((sum, d) => sum + Number(d.montant), 0);
                
                return { 
                    month: monthName, 
                    revenus: Math.round(revenus), 
                    commission: Math.round(revenus), 
                    depenses: Math.round(depenses), 
                    solde: Math.round(revenus - depenses) 
                };
            });
            setMonthlyData(yearData);


            // ---------------------------------------------------
            // CALCUL 3: BILANS BAILLEURS [29-33]
            // ---------------------------------------------------
            
            const bilansMap = new Map<string, BilanBailleur>();

            immeubles.forEach((immeuble) => { 
                const bailleurId = immeuble.bailleur_id;
                if (bailleurId && !bilansMap.has(bailleurId)) {
                    const bailleur = bailleurs.find((b) => b.id === bailleurId);
                    if (bailleur) {
                         bilansMap.set(bailleurId, {
                            bailleur_id: bailleurId,
                            bailleur_nom: bailleur.nom,
                            bailleur_prenom: bailleur.prenom,
                            immeubles: [],
                            total_loyers_percus: 0,
                            total_impayes: 0,
                            total_frais: 0,
                            total_net: 0,
                        });
                    }
                }
            });

            // Remplissage des rapports à partir des paiements mensuels [31, 33]
            paiementsMensuels.forEach((paiement) => {
                const immeubleId = paiement.contrats?.unites?.immeuble_id;
                if (!immeubleId) return;
                const immeuble = immeubles?.find((i) => i.id === immeubleId);
                
                if (immeuble) {
                    const bailleurId = immeuble.bailleur_id;
                    const bilanBailleur = bilansMap.get(bailleurId);

                    if (paiement.statut === 'paye' || paiement.statut === 'partiel') {
                        if (bilanBailleur) {
                            let immeubleData = bilanBailleur.immeubles.find(i => i.immeuble_nom === immeuble.nom);
                            if (!immeubleData) {
                                immeubleData = { immeuble_nom: immeuble.nom, loyers_percus: 0, loyers_impayes: 0, frais_gestion: 0, resultat_net: 0, unites: [] };
                                bilanBailleur.immeubles.push(immeubleData);
                            }
                            immeubleData.loyers_percus += Number(paiement.montant_total);
                            immeubleData.frais_gestion += Number(paiement.part_agence);
                            immeubleData.resultat_net += Number(paiement.part_bailleur);

                            const uniteNom = paiement.contrats?.unites?.nom || 'Unité non renseignée';
                            const locataireNom = [
                                paiement.contrats?.locataires?.prenom,
                                paiement.contrats?.locataires?.nom,
                            ].filter(Boolean).join(' ') || 'Locataire non renseigné';
                            const periode = paiement.mois_concerne
                                ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                                : selectedMonth;
                            let uniteData = immeubleData.unites.find(
                                (u) => u.unite_nom === uniteNom && u.locataire_nom === locataireNom && u.periode === periode
                            );
                            if (!uniteData) {
                                uniteData = {
                                    unite_nom: uniteNom,
                                    locataire_nom: locataireNom,
                                    loyer: Number(paiement.contrats?.loyer_mensuel || 0),
                                    statut_paiement: paiement.statut,
                                    montant_encaisse: 0,
                                    reliquat: 0,
                                    montant_restant: 0,
                                    periode,
                                    observation: '',
                                };
                                immeubleData.unites.push(uniteData);
                            }
                            uniteData.montant_encaisse += Number(paiement.montant_total);
                            uniteData.reliquat = Math.max(uniteData.reliquat, Number(paiement.reliquat || 0));
                            uniteData.montant_restant = uniteData.reliquat;
                            uniteData.statut_paiement = uniteData.reliquat > 0 ? 'partiel' : paiement.statut;
                            uniteData.observation = uniteData.reliquat > 0 ? 'Reliquat à suivre' : 'Échéance soldée';
                            
                            bilanBailleur.total_loyers_percus += Number(paiement.montant_total);
                            bilanBailleur.total_frais += Number(paiement.part_agence);
                            bilanBailleur.total_net += Number(paiement.part_bailleur);
                        }
                        const reliquat = Number(paiement.reliquat || 0);
                        if (reliquat > 0) {
                            if (bilanBailleur) {
                                let immeubleData = bilanBailleur.immeubles.find(i => i.immeuble_nom === immeuble.nom);
                                if (!immeubleData) {
                                    immeubleData = { immeuble_nom: immeuble.nom, loyers_percus: 0, loyers_impayes: 0, frais_gestion: 0, resultat_net: 0, unites: [] };
                                    bilanBailleur.immeubles.push(immeubleData);
                                }
                                immeubleData.loyers_impayes += reliquat;
                                bilanBailleur.total_impayes += reliquat;
                            }
                        }
                    }
                }
            });
            
            setBilansBailleurs(Array.from(bilansMap.values()));

        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        } finally {
            setLoading(false);
        }
    };
    
    // -------------------------------------------------------------------------
    // 5. FONCTIONS D'EXPORT PDF (Corrigées)
    // -------------------------------------------------------------------------

    // Note : 3 fonctions d'export PDF historiques (bilan entreprise,
    // rapports immeubles, comptabilité) ont été retirées car jamais
    // câblées à un bouton. Voir l'historique git pour les récupérer.

    const exportBilanBailleurPDF = async (bilan: BilanBailleur) => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const periodLabel = new Date(selectedMonth).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
        });
        const occupancyBase = bilan.total_loyers_percus + bilan.total_impayes;
        const recoveryRate = occupancyBase > 0
            ? Math.round((bilan.total_loyers_percus / occupancyBase) * 100)
            : 100;

        drawPageBorder(doc, agencySettings ?? undefined);
        const headerY = await drawDocumentHeader(
            doc,
            agencySettings ?? {},
            'Rapport mensuel bailleur',
            `${bilan.bailleur_prenom} ${bilan.bailleur_nom}`,
            {
                reference: `RPT-${selectedMonth.replace('-', '')}-${bilan.bailleur_id.slice(0, 6).toUpperCase()}`,
                issueDate: new Date().toLocaleDateString('fr-FR'),
            }
        );

        let y = headerY + 8;
        const ensureSpace = (needed: number) => {
            if (y + needed > pageHeight - 26) {
                addFooter(doc, agencySettings ?? undefined);
                doc.addPage();
                drawPageBorder(doc, agencySettings ?? undefined);
                y = 24;
            }
        };
        const tableTheme = getAutoTableTheme(agencySettings ?? undefined);
        const sectionTitle = (title: string, subtitle?: string) => {
            ensureSpace(subtitle ? 18 : 13);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.8);
            doc.setTextColor(15, 23, 42);
            doc.text(title, 14, y);
            if (subtitle) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(100, 116, 139);
                doc.text(subtitle, 14, y + 5.2);
                y += 10.5;
            } else {
                y += 5.8;
            }
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.12);
            doc.line(14, y, pageWidth - 14, y);
            y += 6;
        };

        sectionTitle('Indicateurs du mois', 'Période analysée : ' + periodLabel);
        autoTable(doc, {
            body: [
                ['Loyers encaissés', formatCurrency(bilan.total_loyers_percus), 'Reliquats à suivre', formatCurrency(bilan.total_impayes)],
                ['Commissions agence', formatCurrency(bilan.total_frais), 'Net bailleur estimé', formatCurrency(bilan.total_net)],
                ['Taux de recouvrement', String(recoveryRate) + '%', 'Immeubles suivis', String(bilan.immeubles.length)],
            ],
            startY: y,
            theme: 'grid',
            ...tableTheme,
            styles: {
                ...tableTheme.styles,
                fontSize: 8.8,
                cellPadding: { top: 3.1, right: 3.2, bottom: 3.1, left: 3.2 },
            },
            margin: { left: 14, right: 14 },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 42 },
                1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 40 },
                2: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 44 },
                3: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
            },
        });
        y = ((doc as PdfWithAutoTable).lastAutoTable?.finalY ?? y) + 12;

        sectionTitle('Résumé exécutif');
        const executiveSummary = [
            'Sur la période ' + periodLabel + ', le portefeuille de ' + bilan.bailleur_prenom + ' ' + bilan.bailleur_nom + ' présente un taux de recouvrement estimé à ' + recoveryRate + '%.',
            bilan.total_impayes > 0
                ? 'Les reliquats ouverts représentent ' + formatCurrency(bilan.total_impayes) + ' et doivent rester prioritaires dans le suivi de gestion.'
                : 'Les échéances enregistrées sur la période sont soldées, sans reliquat significatif à reporter.',
            'Après ventilation des commissions, le montant net estimé au profit du bailleur ressort à ' + formatCurrency(bilan.total_net) + '.',
        ];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.3);
        doc.setTextColor(30, 41, 59);
        const summaryLines = doc.splitTextToSize(executiveSummary.join(' '), 178);
        doc.text(summaryLines, 14, y);
        y += summaryLines.length * 4.8 + 10;

        sectionTitle('Détail par immeuble', 'Lecture par immeuble, unité, locataire et situation financière.');
        if (bilan.immeubles.length === 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Aucune ligne de paiement enregistrée pour cette période.', 14, y);
            y += 12;
        }

        bilan.immeubles.forEach((immeuble, index) => {
            ensureSpace(38);
            if (index > 0) y += 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(immeuble.immeuble_nom, 14, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
                'Total encaissé ' + formatCurrency(immeuble.loyers_percus) + ' · Reliquat ' + formatCurrency(immeuble.loyers_impayes) + ' · Net ' + formatCurrency(immeuble.resultat_net),
                pageWidth - 14,
                y,
                { align: 'right' }
            );
            y += 5;

            const bodyRows = immeuble.unites.length
                ? immeuble.unites.map((unit) => [
                    unit.unite_nom,
                    unit.locataire_nom,
                    formatCurrency(unit.loyer),
                    unit.statut_paiement === 'partiel' ? 'Partiel' : 'Soldé',
                    formatCurrency(unit.montant_encaisse),
                    formatCurrency(unit.montant_restant),
                    unit.periode,
                    unit.observation,
                ])
                : [['-', 'Aucune unité payée', '-', '-', '-', '-', periodLabel, '-']];

            autoTable(doc, {
                head: [['Unité', 'Locataire', 'Loyer', 'Statut', 'Encaissé', 'Reliquat', 'Période', 'Observation']],
                body: [
                    ...bodyRows,
                    ['', 'Total immeuble', '', '', formatCurrency(immeuble.loyers_percus), formatCurrency(immeuble.loyers_impayes), '', 'Net ' + formatCurrency(immeuble.resultat_net)],
                ],
                startY: y,
                theme: 'grid',
                ...tableTheme,
                styles: {
                    ...tableTheme.styles,
                    fontSize: 7.6,
                    cellPadding: { top: 2.5, right: 2.2, bottom: 2.5, left: 2.2 },
                    overflow: 'linebreak',
                },
                headStyles: {
                    ...tableTheme.headStyles,
                    fontSize: 7.4,
                },
                margin: { left: 14, right: 14 },
                columnStyles: {
                    2: { halign: 'right', cellWidth: 20 },
                    4: { halign: 'right', cellWidth: 22 },
                    5: { halign: 'right', cellWidth: 22 },
                    6: { cellWidth: 24 },
                    7: { cellWidth: 34 },
                },
                didParseCell: (data) => {
                    const raw = Array.isArray(data.row.raw) ? data.row.raw : [];
                    if (raw[1] === 'Total immeuble') {
                        data.cell.styles.fillColor = [248, 250, 252];
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                },
            });
            y = ((doc as PdfWithAutoTable).lastAutoTable?.finalY ?? y) + 10;
        });

        addFooter(doc, agencySettings ?? undefined);

        const previewRows = bilan.immeubles.flatMap((i) =>
            i.unites.map((u) => ({
                Immeuble: i.immeuble_nom,
                Unité: u.unite_nom,
                Locataire: u.locataire_nom,
                Statut: u.statut_paiement === 'partiel' ? 'Partiel' : 'Payé',
                Encaissé: formatCurrency(u.montant_encaisse),
                Restant: formatCurrency(u.montant_restant),
            }))
        );

        await saveGeneratedPdf(doc, {
            kind: 'bilan',
            title: 'Rapport bailleur',
            fileName: `rapport-bailleur-${bilan.bailleur_nom}-${selectedMonth}.pdf`,
            source: 'tableau-de-bord-financier',
            documentType: 'rapport_bailleur',
            entityId: bilan.bailleur_id,
            period: selectedMonth,
            reference: `RBL-${selectedMonth}-${bilan.bailleur_id.slice(0, 8).toUpperCase()}`,
            data: {
                document: 'rapport_bailleur',
                selectedMonth,
                bilan,
                agencySettings,
            },
            preview: {
                columns: ['Immeuble', 'Unité', 'Locataire', 'Statut', 'Encaissé', 'Restant'],
                rows: previewRows.slice(0, 6),
                rowCount: previewRows.length,
                period: periodLabel,
                stats: [
                    { label: 'Revenus encaissés', value: formatCurrency(bilan.total_loyers_percus) },
                    { label: 'Impayés', value: formatCurrency(bilan.total_impayes) },
                    { label: 'Net bailleur', value: formatCurrency(bilan.total_net) },
                    { label: 'Recouvrement', value: `${recoveryRate}%` },
                ],
            },
        });
    };

    if (loading) {
        return <PageSkeleton title="Tableau financier" variant="analytics" />;
    }
    
    // -------------------------------------------------------------------------
    // 7. RENDU DE L'INTERFACE UTILISATEUR CENTRALISÉE
    // -------------------------------------------------------------------------

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">Rapports financiers</h1>

            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-emerald-950/10 bg-white/80 p-2 shadow-sm sm:grid-cols-2">
                <button
                    onClick={() => setCurrentPage('bailleurs')}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${currentPage === 'bailleurs' ? 'bg-brand-950 text-white shadow-lg shadow-emerald-950/15' : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'}`}
                >
                    Rapport Bailleur
                    <span className="mt-1 block text-xs font-medium opacity-75">Vue principale de reporting propriétaire.</span>
                </button>
                <button
                    onClick={() => setCurrentPage('operationnel')}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${currentPage === 'operationnel' ? 'bg-brand-950 text-white shadow-lg shadow-emerald-950/15' : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'}`}
                >
                    Vue financière opérationnelle
                    <span className="mt-1 block text-xs font-medium opacity-75">Encaissements, dépenses, solde et mouvements du mois.</span>
                </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <label htmlFor="month-selector" className="text-sm sm:text-base text-gray-700 font-medium">Période:</label>
                <input
                    id="month-selector"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 text-sm w-full sm:w-auto"
                />
            </div>
            
            {/* VUE 1: BILAN ENTREPRISE (Mensuel) */}
            {currentPage === 'operationnel' && bilanEntreprise && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700">Bilan de l'Entreprise (Mois de {new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })})</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        {/* Carte 1: Commission agence */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Total Gérance</p>
                            <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1">{formatCurrency(bilanEntreprise.commission)}</p>
                        </div>

                        {/* Carte 3: Total dépenses */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Total dépenses</p>
                            <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{formatCurrency(bilanEntreprise.totalDepenses)}</p>
                        </div>

                        {/* Carte 4: Solde Net (Dynamique) */}
                        <div className={`${bilanEntreprise.soldeNet >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'} p-4 sm:p-6 rounded-2xl border shadow-md`}>
                            <div className={`${bilanEntreprise.soldeNet >= 0 ? 'bg-emerald-600' : 'bg-orange-600'} text-white rounded-lg p-2 flex items-center justify-center w-8 sm:w-10 h-8 sm:h-10`}>
                                {bilanEntreprise.soldeNet >= 0 ? <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6" /> : <TrendingDown className="w-5 sm:w-6 h-5 sm:h-6" />}
                            </div>
                            <p className={`${bilanEntreprise.soldeNet >= 0 ? 'text-emerald-700' : 'text-orange-700'} text-xs sm:text-sm font-medium mt-3`}>Solde net</p>
                            <p className={`${bilanEntreprise.soldeNet >= 0 ? 'text-emerald-900' : 'text-orange-900'} text-2xl sm:text-3xl font-extrabold mt-1`}>{formatCurrency(bilanEntreprise.soldeNet)}</p>
                        </div>
                    </div>
                    
                    {/* Résumé du mois */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 className="text-base lg:text-xl font-semibold mb-4 text-gray-700">Résumé du mois</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <p className="text-xs sm:text-sm text-gray-600">Total loyers <span className="block font-bold text-base sm:text-lg text-blue-500 mt-1">{formatCurrency(bilanEntreprise.totalLoyers)}</span></p>
                            <p className="text-xs sm:text-sm text-gray-600">Impayés <span className="block font-bold text-base sm:text-lg text-red-500 mt-1">{formatCurrency(bilanEntreprise.loyersImpayes)}</span></p>
                            <p className="text-xs sm:text-sm text-gray-600">Autres revenus <span className="block font-bold text-base sm:text-lg text-green-500 mt-1">{formatCurrency(bilanEntreprise.revenus_alt)}</span></p>
                        </div>
                    </div>

                    {/* Tendance annuelle */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 className="text-base lg:text-xl font-semibold mb-4 text-gray-700">Tendance annuelle (Commission vs Dépenses)</h3>
                        <ResponsiveContainer width="100%" height={200} className="sm:h-[300px]">
                            <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis tickFormatter={(v) => formatCurrency(v)} />
                                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Montant']} />
                                <Legend />
                                <Line type="monotone" dataKey="commission" stroke="#8884d8" name="Commission" />
                                <Line type="monotone" dataKey="depenses" stroke="#82ca9d" name="Dépenses" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            
            {/* VUE 2: COMPTABILITÉ (Annuelle) */}
            {currentPage === 'operationnel' && (
                 <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700">Comptabilité (Année {new Date().getFullYear()})</h2>
                    </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                        {/* Total Revenus (Commission annuelle) */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Total Revenus</p>
                            <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1">{formatCurrency(statsAnnuel.totalRevenus)}</p>
                        </div>

                        {/* Total Dépenses (Annuel) */}
                         <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Total Dépenses</p>
                            <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{formatCurrency(statsAnnuel.totalDepenses)}</p>
                        </div>

                        {/* Solde Net (Annuel) */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Solde Net</p>
                             <p className={`text-lg sm:text-2xl font-bold mt-1 ${statsAnnuel.soldeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(statsAnnuel.soldeNet)}
                            </p>
                        </div>
                    </div>

                    {/* Évolution mensuelle (Bar Chart) */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 className="text-base lg:text-xl font-semibold mb-4 text-gray-700">Évolution mensuelle</h3>
                        <ResponsiveContainer width="100%" height={200} className="sm:h-[300px]">
                            <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Montant']} />
                                <Legend />
                                <Bar dataKey="revenus" fill="#8884d8" name="Revenus (Commission)" />
                                <Bar dataKey="depenses" fill="#82ca9d" name="Dépenses" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Détails mensuels (Tableau) */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 className="text-base lg:text-xl font-semibold mb-4 text-gray-700">Détails mensuels</h3>
                        <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mois</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenus</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dépenses</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solde</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {monthlyData.map((item) => (
                                    <tr key={item.month}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.month}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.revenus || 0)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.depenses)}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${item.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.solde)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}


            {/* VUE 3: BILANS MENSUELS BAILLEURS */}
            {currentPage === 'bailleurs' && (
                <div className="space-y-6 lg:space-y-8">
                     <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700">Bilans Mensuels Bailleurs (Mois de {new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })})</h2>

                    {bilansBailleurs.map((bilan: BilanBailleur) => (
                        <div key={bilan.bailleur_id} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 space-y-4">

                            {/* Entête Bailleur */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-3 gap-3">
                                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800">
                                    {bilan.bailleur_prenom} {bilan.bailleur_nom}
                                </h3>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                                    <p className="text-xs sm:text-sm text-gray-600">{bilan.immeubles.length} immeuble(s)</p>
                                    <button
                                        onClick={() => void exportBilanBailleurPDF(bilan)}
                                        className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700 transition whitespace-nowrap"
                                    >
                                        <Download className="w-3 sm:w-4 h-3 sm:h-4" /> Bilan PDF
                                    </button>
                                </div>
                            </div>

                            {/* Tableau de Ventilation par Immeuble */}
                            <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Immeuble</th>
                                        <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Loyers</th>
                                        <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Impayés</th>
                                        <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Frais</th>
                                        <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {bilan.immeubles.map((immeuble, index) => (
                                        <tr key={index}>
                                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{immeuble.immeuble_nom}</td>
                                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 text-right">{formatCurrency(immeuble.loyers_percus)}</td>
                                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 text-right">{formatCurrency(immeuble.loyers_impayes)}</td>
                                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 text-right">{formatCurrency(immeuble.frais_gestion)}</td>
                                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold text-right">{formatCurrency(immeuble.resultat_net)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                            
                            {/* Totaux du Bilan */}
                            <div className="pt-4 border-t border-dashed">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                                    <p className="text-gray-600">Total loyers perçus:</p>
                                    <p className="font-semibold text-right text-green-600">{formatCurrency(bilan.total_loyers_percus)}</p>

                                    <p className="text-gray-600">Total impayés:</p>
                                    <p className="font-semibold text-right text-red-600">{formatCurrency(bilan.total_impayes)}</p>

                                    <p className="text-gray-600">Total frais gestion:</p>
                                    <p className="font-semibold text-right text-blue-600">{formatCurrency(bilan.total_frais)}</p>
                                </div>
                                <div className="mt-4 pt-2 border-t border-gray-300 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <p className="text-base sm:text-lg font-bold text-gray-800">Montant à verser:</p>
                                    <p className="text-xl sm:text-2xl font-extrabold text-blue-800">{formatCurrency(bilan.total_net)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
