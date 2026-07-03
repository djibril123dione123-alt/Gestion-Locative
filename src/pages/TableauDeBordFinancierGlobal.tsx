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
    drawLegalVerificationFooter,
    drawPageBorder,
    drawTotalsBlock,
    getAutoTableTheme,
    saveGeneratedPdf,
} from '../lib/pdf';
import { PageSkeleton } from '../components/ui/Skeleton';
import { FinancePageHeader } from '../components/finance/FinancePrimitives';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { Sparkline } from '../components/ui/Sparkline';
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
    netBailleurs: number;
    revenus_alt: number;
    totalRevenus: number;
    totalDepenses: number;
    soldeNet: number;
}

interface BailleurRow {
    id: string;
    nom: string;
    prenom: string;
    actif?: boolean | null;
}

interface ImmeubleRow {
    id: string;
    nom: string;
    bailleur_id: string;
    actif?: boolean | null;
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
    const { profile, accountProfile } = useAuth();

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
    const [currentPage, setCurrentPage] = useState<'bailleurs' | 'operationnel'>(() =>
        accountProfile.isIndividualOwner ? 'bailleurs' : 'operationnel'
    );

    useEffect(() => {
        if (accountProfile.isIndividualOwner && currentPage === 'operationnel') {
            setCurrentPage('bailleurs');
        }
    }, [accountProfile.isIndividualOwner, currentPage]);

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

                // 2. Données Annuelles (pour Tendance / Comptabilité)
                supabase.from('paiements').select('part_agence, mois_concerne, statut').eq('agency_id', profile.agency_id).gte('mois_concerne', yearStartDate),
                supabase.from('depenses').select('montant, date_depense').eq('agency_id', profile.agency_id).gte('date_depense', yearStartDate),

                // 3. Données Structurelles
                supabase.from('bailleurs').select('id, nom, prenom, actif').eq('agency_id', profile.agency_id),
                supabase.from('immeubles').select('id, nom, bailleur_id, actif, nombre_unites, bailleurs(nom, prenom)').eq('agency_id', profile.agency_id), // [10]
                supabase.from('agency_settings').select('agency_id, nom_agence, adresse, telephone, email, logo_url, couleur_primaire, couleur_secondaire, pied_page_personnalise').eq('agency_id', profile.agency_id).maybeSingle(),
            ]);

            // Extraction des données
            const paiementsMensuels = (paiementsMensuelsRes.data || []) as PaiementMensuelRow[];
            const depensesMensuels = depensesMensuelsRes.data || [];
            // La table historique `revenus` n'est pas encore garantie par agency_id.
            // On evite une lecture globale non tenant-safe et on garde les autres revenus a 0.
            const revenus_autresMensuels: Array<{ montant?: number | string | null }> = [];

            const paiementsAnnuels = paiementsAnnuelsRes.data || [];
            const depensesAnnuelles = depensesAnnuelsRes.data || [];

            const bailleurs = ((bailleursRes.data || []) as BailleurRow[]).filter((bailleur) => bailleur.actif !== false);
            const immeubles = ((immeublesRes.data || []) as ImmeubleRow[]).filter((immeuble) => immeuble.actif !== false);
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
            const netBailleurs = paiementsMensuels
                .filter(p => p.statut === 'paye' || p.statut === 'partiel')
                .reduce((sum, p) => sum + Number(p.part_bailleur ?? (Number(p.montant_total) - Number(p.part_agence || 0))), 0);
            const revenus_alt = revenus_autresMensuels.reduce((sum, r) => sum + Number(r.montant), 0);

            const totalRevenus = commission + revenus_alt;
            const totalDepenses = depensesMensuels.reduce((sum, d) => sum + Number(d.montant), 0);
            const soldeNet = totalRevenus - totalDepenses;

            setBilanEntreprise({ totalLoyers, loyersImpayes, commission, netBailleurs, revenus_alt, totalRevenus, totalDepenses, soldeNet });

            
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
        const reportRef = `RBL-${selectedMonth}-${bilan.bailleur_id.slice(0, 8).toUpperCase()}`;
        const pdfSettings: Partial<AgencySettings> = {
            ...(agencySettings ?? {}),
            agency_id: agencySettings?.agency_id ?? profile?.agency_id ?? undefined,
            is_bailleur_account: accountProfile.isIndividualOwner,
            organization_type: accountProfile.type,
        };
        const reportTitle = accountProfile.isIndividualOwner ? 'Résumé mensuel propriétaire' : 'Rapport mensuel bailleur';
        const netLabel = accountProfile.isIndividualOwner ? 'Revenus nets' : 'Net bailleur estimé';

        drawPageBorder(doc, pdfSettings);
        const headerY = await drawDocumentHeader(
            doc,
            pdfSettings,
            reportTitle,
            `${bilan.bailleur_prenom} ${bilan.bailleur_nom}`,
            {
                reference: reportRef,
                issueDate: new Date().toLocaleDateString('fr-FR'),
                documentType: 'Rapport financier',
            }
        );

        let y = headerY + 8;
        const ensureSpace = (needed: number) => {
            if (y + needed > pageHeight - 26) {
                addFooter(doc, pdfSettings);
                doc.addPage();
                drawPageBorder(doc, pdfSettings);
                y = 24;
            }
        };
        const tableTheme = getAutoTableTheme(pdfSettings);
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
                accountProfile.isIndividualOwner
                    ? ['Revenus encaissés', formatCurrency(bilan.total_loyers_percus), netLabel, formatCurrency(bilan.total_net)]
                    : ['Commissions agence', formatCurrency(bilan.total_frais), netLabel, formatCurrency(bilan.total_net)],
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
            accountProfile.isIndividualOwner
                ? 'Le revenu net estimé du propriétaire ressort à ' + formatCurrency(bilan.total_net) + '.'
                : 'Après ventilation des commissions, le montant net estimé au profit du bailleur ressort à ' + formatCurrency(bilan.total_net) + '.',
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
                'Total encaissé ' + formatCurrency(immeuble.loyers_percus) + ' · Reliquat ' + formatCurrency(immeuble.loyers_impayes) + ' · ' + netLabel + ' ' + formatCurrency(immeuble.resultat_net),
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
                    ['', 'Total immeuble', '', '', formatCurrency(immeuble.loyers_percus), formatCurrency(immeuble.loyers_impayes), '', netLabel + ' ' + formatCurrency(immeuble.resultat_net)],
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

        ensureSpace(48);
        y = drawTotalsBlock(
            doc,
            14,
            y,
            pageWidth - 28,
            [
                { label: 'Loyers encaissés', value: formatCurrency(bilan.total_loyers_percus) },
                { label: 'Reliquats à suivre', value: formatCurrency(bilan.total_impayes) },
                ...(accountProfile.isIndividualOwner ? [] : [{ label: 'Commissions agence', value: formatCurrency(bilan.total_frais) }]),
                { label: netLabel, value: formatCurrency(bilan.total_net), emphasis: true },
            ],
            pdfSettings
        );

        try {
            await drawLegalVerificationFooter(doc, {
                ref: reportRef,
                type: 'rapport_bailleur',
                agency: agencySettings?.nom_agence ?? 'Samay Këur',
                date: new Date().toISOString(),
                settings: pdfSettings,
            });
        } catch {
            // Document verification QR is non-blocking.
        }
        addFooter(doc, pdfSettings);

        const previewRows = bilan.immeubles.flatMap((i) =>
            i.unites.map((u) => ({
                Immeuble: i.immeuble_nom,
                Unite: u.unite_nom,
                Locataire: u.locataire_nom,
                Statut: u.statut_paiement === 'partiel' ? 'Partiel' : 'Soldé',
                Encaisse: formatCurrency(u.montant_encaisse),
                Restant: formatCurrency(u.montant_restant),
            }))
        );

        await saveGeneratedPdf(doc, {
            kind: 'bilan',
            title: accountProfile.isIndividualOwner ? 'Résumé mensuel propriétaire' : 'Rapport bailleur',
            fileName: `${accountProfile.isIndividualOwner ? 'resume-proprietaire' : 'rapport-bailleur'}-${bilan.bailleur_nom}-${selectedMonth}.pdf`,
            source: 'tableau-de-bord-financier',
            documentType: 'rapport_bailleur',
            entityId: bilan.bailleur_id,
            period: selectedMonth,
            reference: reportRef,
            data: {
                document: 'rapport_bailleur',
                selectedMonth,
                bilan,
                agencySettings,
            },
            preview: {
                columns: ['Immeuble', 'Unite', 'Locataire', 'Statut', 'Encaisse', 'Restant'],
                rows: previewRows.slice(0, 6),
                rowCount: previewRows.length,
                period: periodLabel,
                stats: [
                    { label: 'Revenus encaissés', value: formatCurrency(bilan.total_loyers_percus) },
                    { label: 'Impayés', value: formatCurrency(bilan.total_impayes) },
                    { label: accountProfile.isIndividualOwner ? 'Revenus nets' : 'Net bailleur', value: formatCurrency(bilan.total_net) },
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
        <div className="relative min-h-full">
            {/* Animated Mesh Gradient Background */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="absolute -left-[10%] -top-[20%] h-[70vh] w-[50vw] rounded-full bg-emerald-400/10 blur-[120px] mix-blend-multiply" />
                <div className="absolute -right-[10%] top-[10%] h-[60vh] w-[40vw] rounded-full bg-amber-400/10 blur-[100px] mix-blend-multiply" />
            </div>

            <div className="relative z-10 space-y-6 p-4 sm:p-6 lg:space-y-10 lg:p-8">
                <FinancePageHeader
                    eyebrow="ENCAISSEMENT & FINANCE"
                    title="Rapports financiers"
                    description="Suivez les revenus locatifs, impayés et performances de portefeuille."
                    mobileDescription="Performance financière."
                />

            <div className={`grid grid-cols-1 gap-1.5 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/85 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:gap-2 ${accountProfile.isIndividualOwner ? '' : 'sm:grid-cols-2'}`}>
                <button
                    onClick={() => {
                        if (accountProfile.isIndividualOwner) {
                            setCurrentPage('bailleurs');
                        } else {
                            window.location.hash = '#/bailleurs';
                        }
                    }}
                    className={`flex flex-col items-start rounded-lg px-4 py-3 text-left transition ${currentPage === 'bailleurs' ? 'bg-emerald-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-white hover:text-emerald-900 hover:shadow-sm'}`}
                >
                    <span className="text-sm font-bold">{accountProfile.isIndividualOwner ? 'Mes revenus' : 'Fiches bailleurs'}</span>
                    <span className="mt-0.5 block text-[11px] font-medium opacity-80">
                        {accountProfile.isIndividualOwner
                            ? 'Synthèse mensuelle de vos loyers, impayés et revenus nets.'
                            : 'Les rapports par proprietaire se generent depuis la page Bailleurs.'}
                    </span>
                </button>
                {!accountProfile.isIndividualOwner && (
                <button
                    onClick={() => setCurrentPage('operationnel')}
                    className={`flex flex-col items-start rounded-lg px-4 py-3 text-left transition ${currentPage === 'operationnel' ? 'bg-emerald-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-white hover:text-emerald-900 hover:shadow-sm'}`}
                >
                    <span className="text-sm font-bold">Vue financière opérationnelle</span>
                    <span className="mt-0.5 block text-[11px] font-medium opacity-80">Encaissements, dépenses, solde et mouvements du mois.</span>
                </button>
                )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-3 py-2 shadow-sm">
                    <Calendar className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <label htmlFor="month-selector" className="text-xs font-bold uppercase tracking-wider text-slate-500">Période</label>
                    <input
                        id="month-selector"
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="border-0 bg-transparent py-0 pl-2 pr-0 text-sm font-bold text-slate-900 focus:ring-0 w-auto outline-none"
                    />
                </div>
            </div>
            
            {/* VUE 1: BILAN ENTREPRISE (Mensuel) */}
            {currentPage === 'operationnel' && bilanEntreprise && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700">Bilan de l'Entreprise (Mois de {new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })})</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Carte 4: Solde Net (Dynamique) - BENTO MAIN CARD */}
                        <article className={`col-span-2 md:col-span-2 xl:col-span-2 rounded-3xl border p-5 sm:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] ring-1 ring-white/70 ${bilanEntreprise.soldeNet >= 0 ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white' : 'border-red-200 bg-gradient-to-br from-red-50 via-red-50/50 to-white'}`}>
                            <div className="flex h-full flex-col justify-between">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-[0.7rem] font-bold uppercase tracking-[0.15em] ${bilanEntreprise.soldeNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Marge Opérationnelle</p>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${bilanEntreprise.soldeNet >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>Mensuel</span>
                                        </div>
                                        <AnimatedCounter 
                                            value={bilanEntreprise.soldeNet} 
                                            format={formatCurrency} 
                                            className={`mt-2 block text-4xl sm:text-5xl font-black tracking-tighter ${bilanEntreprise.soldeNet >= 0 ? 'text-emerald-900' : 'text-red-900'}`} 
                                        />
                                    </div>
                                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ${bilanEntreprise.soldeNet >= 0 ? 'bg-emerald-600 text-white ring-emerald-600/30 shadow-[0_8px_16px_rgba(5,150,105,0.3)]' : 'bg-red-600 text-white ring-red-600/30 shadow-[0_8px_16px_rgba(220,38,38,0.3)]'}`}>
                                        {bilanEntreprise.soldeNet >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                                    </div>
                                </div>
                                <div className="mt-6 flex h-12 items-end">
                                    <div className="w-full h-full opacity-60">
                                        <Sparkline data={monthlyData.slice(-6).map(d => (d.commission || 0) - (d.depenses || 0))} color={bilanEntreprise.soldeNet >= 0 ? '#10b981' : '#ef4444'} width="100%" height={48} />
                                    </div>
                                </div>
                            </div>
                        </article>

                        {/* Carte 1: Brut encaissé */}
                        <article className="col-span-1 rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70">
                            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Brut encaissé</p>
                            <AnimatedCounter value={bilanEntreprise.totalLoyers} format={formatCurrency} className="mt-1.5 block text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900" />
                            <div className="mt-4 w-full h-8 opacity-40">
                                <Sparkline data={monthlyData.slice(-6).map(d => (d.commission || 0) * 10)} color="#94a3b8" width="100%" height={32} />
                            </div>
                        </article>

                        <div className="col-span-1 grid grid-rows-2 gap-4">
                            {/* Carte 2: Commission agence */}
                            <article className="rounded-3xl border border-sky-950/10 bg-gradient-to-br from-sky-50/80 to-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70 flex flex-col justify-center">
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-sky-600">Commissions agence</p>
                                <AnimatedCounter value={bilanEntreprise.commission} format={formatCurrency} className="mt-1 block text-xl font-extrabold tracking-tight text-sky-900" />
                            </article>

                            {/* Carte 3: Net bailleurs */}
                            <article className="rounded-3xl border border-emerald-950/10 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70 flex flex-col justify-center">
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-emerald-600">Net bailleurs</p>
                                <AnimatedCounter value={bilanEntreprise.netBailleurs} format={formatCurrency} className="mt-1 block text-xl font-extrabold tracking-tight text-emerald-900" />
                            </article>
                        </div>
                    </div>
                    
                    {/* Résumé du mois */}
                    <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80 p-5 sm:p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-4">Résumé du mois</h3>
                        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 text-center">
                            <div className="py-3 sm:py-0 sm:px-4">
                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Dépenses</p>
                                <p className="mt-1.5 text-[1.1rem] font-extrabold text-red-600">{formatCurrency(bilanEntreprise.totalDepenses)}</p>
                            </div>
                            <div className="py-3 sm:py-0 sm:px-4">
                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Impayés</p>
                                <p className="mt-1.5 text-[1.1rem] font-extrabold text-orange-600">{formatCurrency(bilanEntreprise.loyersImpayes)}</p>
                            </div>
                            <div className="py-3 sm:py-0 sm:px-4">
                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Autres revenus</p>
                                <p className="mt-1.5 text-[1.1rem] font-extrabold text-emerald-600">{formatCurrency(bilanEntreprise.revenus_alt)}</p>
                            </div>
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

                     <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                        {/* Total Revenus (Commission annuelle) */}
                        <article className="rounded-2xl border border-blue-950/10 bg-gradient-to-br from-blue-50 to-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70">
                            <p className="truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] text-blue-600">Total Revenus</p>
                            <p className="mt-1.5 truncate text-[1.4rem] font-extrabold tracking-tight text-blue-900">{formatCurrency(statsAnnuel.totalRevenus)}</p>
                        </article>

                        {/* Total Dépenses (Annuel) */}
                         <article className="rounded-2xl border border-red-950/10 bg-gradient-to-br from-red-50 to-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70">
                            <p className="truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] text-red-600">Total Dépenses</p>
                            <p className="mt-1.5 truncate text-[1.4rem] font-extrabold tracking-tight text-red-900">{formatCurrency(statsAnnuel.totalDepenses)}</p>
                        </article>

                        {/* Solde Net (Annuel) */}
                        <article className={`col-span-2 sm:col-span-1 rounded-2xl border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70 ${statsAnnuel.soldeNet >= 0 ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'}`}>
                            <p className={`truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] ${statsAnnuel.soldeNet >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>Solde Net</p>
                             <p className={`mt-1.5 truncate text-[1.4rem] font-extrabold tracking-tight ${statsAnnuel.soldeNet >= 0 ? 'text-emerald-900' : 'text-orange-900'}`}>
                                {formatCurrency(statsAnnuel.soldeNet)}
                            </p>
                        </article>
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
                    <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80 p-5 sm:p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-4">Détails mensuels</h3>
                        <div className="overflow-x-auto scrollbar-none rounded-2xl border border-slate-100 bg-white">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-[#f8f3e8]/70">
                                <tr>
                                    <th className="px-4 py-3.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Mois</th>
                                    <th className="px-4 py-3.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Revenus</th>
                                    <th className="px-4 py-3.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Dépenses</th>
                                    <th className="px-4 py-3.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Solde</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-transparent">
                                {monthlyData.map((item) => (
                                    <tr key={item.month} className="transition-colors hover:bg-slate-50/50">
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900">{item.month}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600">{formatCurrency(item.revenus || 0)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600">{formatCurrency(item.depenses)}</td>
                                        <td className={`px-4 py-3.5 whitespace-nowrap text-sm font-bold ${item.solde >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(item.solde)}</td>
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
                     <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700">
                        {accountProfile.isIndividualOwner ? 'Mes revenus mensuels' : 'Bilans Mensuels Bailleurs'} (Mois de {new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })})
                     </h2>

                    {bilansBailleurs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-[#fffdf7]/50 p-12 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <Calendar className="h-8 w-8" />
                            </div>
                            <h3 className="mt-4 text-sm font-bold text-slate-900">Aucun revenu pour ce mois</h3>
                            <p className="mt-2 max-w-sm text-sm text-slate-500">
                                Il n'y a pas eu de paiements encaissés pour la période de {new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}.
                            </p>
                        </div>
                    ) : (
                        bilansBailleurs.map((bilan: BilanBailleur) => (
                            <div key={bilan.bailleur_id} className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-[#fffdf7] p-5 sm:p-7 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80 space-y-6">

                            {/* Entête Bailleur */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 pb-4 gap-4">
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                                        {bilan.bailleur_prenom} {bilan.bailleur_nom}
                                    </h3>
                                    <p className="mt-1 text-sm font-medium text-slate-500">{bilan.immeubles.length} immeuble(s) rattaché(s)</p>
                                </div>
                                <button
                                    onClick={() => void exportBilanBailleurPDF(bilan)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold tracking-wide text-white transition hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-95"
                                >
                                    <Download className="w-4 h-4" /> 
                                    <span className="hidden sm:inline">Télécharger le bilan</span>
                                    <span className="sm:hidden">PDF</span>
                                </button>
                            </div>

                            {/* Tableau de Ventilation par Immeuble */}
                            <div className="overflow-x-auto scrollbar-none rounded-2xl border border-slate-100 bg-white">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead className="bg-[#f8f3e8]/70">
                                    <tr>
                                        <th className="px-4 py-3.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Immeuble</th>
                                        <th className="px-4 py-3.5 text-right text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Loyers</th>
                                        <th className="px-4 py-3.5 text-right text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Impayés</th>
                                        {!accountProfile.isIndividualOwner && (
                                            <th className="px-4 py-3.5 text-right text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">Frais</th>
                                        )}
                                        <th className="px-4 py-3.5 text-right text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">
                                            {accountProfile.isIndividualOwner ? 'Nets' : 'Net'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 bg-transparent">
                                    {bilan.immeubles.map((immeuble, index) => (
                                        <tr key={index} className="transition-colors hover:bg-slate-50/50">
                                            <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900">{immeuble.immeuble_nom}</td>
                                            <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 text-right">{formatCurrency(immeuble.loyers_percus)}</td>
                                            <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 text-right">{formatCurrency(immeuble.loyers_impayes)}</td>
                                            {!accountProfile.isIndividualOwner && (
                                                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 text-right">{formatCurrency(immeuble.frais_gestion)}</td>
                                            )}
                                            <td className="px-4 py-3.5 whitespace-nowrap text-sm font-bold text-slate-900 text-right">{formatCurrency(immeuble.resultat_net)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                            
                            {/* Totaux du Bilan */}
                            <div className="pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div className="flex justify-between sm:justify-start gap-4">
                                        <span className="text-slate-500 font-medium">Loyers perçus</span>
                                        <span className="font-bold text-emerald-600">{formatCurrency(bilan.total_loyers_percus)}</span>
                                    </div>
                                    <div className="flex justify-between sm:justify-start gap-4">
                                        <span className="text-slate-500 font-medium">Impayés</span>
                                        <span className="font-bold text-orange-600">{formatCurrency(bilan.total_impayes)}</span>
                                    </div>
                                    {!accountProfile.isIndividualOwner && (
                                        <div className="flex justify-between sm:justify-start gap-4">
                                            <span className="text-slate-500 font-medium">Frais gestion</span>
                                            <span className="font-bold text-sky-600">{formatCurrency(bilan.total_frais)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-5 rounded-2xl bg-[#f8f3e8]/50 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border border-emerald-950/5">
                                    <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                                        {accountProfile.isIndividualOwner ? 'Revenus nets générés' : 'Montant à verser au propriétaire'}
                                    </p>
                                    <p className="text-2xl font-black tracking-tight text-emerald-900">{formatCurrency(bilan.total_net)}</p>
                                </div>
                            </div>
                        </div>
                    )))}
                </div>
            )}

        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_70%)]" />
    </div>
    );
}
