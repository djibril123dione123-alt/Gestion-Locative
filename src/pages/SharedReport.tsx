import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BrandMark, BrandedLoader } from '../components/brand/BrandLogo';
import { AlertCircle, Download, FileText, CheckCircle2 } from 'lucide-react';
import { buildRapportDocument } from '../lib/pdf';
import type { OwnerReportSnapshotPayload } from '../services/api/documentSnapshotApi';
import type { AgencySettings } from '../types/agency';

export function SharedReport() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [documentData, setDocumentData] = useState<any | null>(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!token) {
            setError('Lien invalide ou expiré.');
            setLoading(false);
            return;
        }

        async function fetchDocument() {
            try {
                // Call the SECURITY DEFINER RPC to get the document safely
                const { data, error: rpcError } = await supabase.rpc('get_document_by_secure_token', {
                    p_token: token
                });

                if (rpcError) throw rpcError;
                
                if (!data || data.length === 0) {
                    setError('Ce document est introuvable ou son lien sécurisé a expiré.');
                    setLoading(false);
                    return;
                }

                const doc = data[0];
                setDocumentData(doc);
            } catch (err: any) {
                console.error('Erreur chargement rapport:', err);
                setError('Impossible de charger le rapport sécurisé.');
            } finally {
                setLoading(false);
            }
        }

        fetchDocument();
    }, [token]);

    useEffect(() => {
        if (!documentData || !iframeRef.current) return;
        
        async function generatePreview() {
            try {
                const metadata = documentData.metadata;
                const payload = metadata.report_payload as OwnerReportSnapshotPayload;
                
                if (!payload) {
                    console.error("Payload manquant dans les métadonnées", metadata);
                    return;
                }
                
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('name, address, city, country, phone, email, rccm, ninea, bank_info, mobile_money, custom_brand_color, custom_brand_logo_url')
                    .eq('id', documentData.agency_id)
                    .maybeSingle();

                const { data: template } = await supabase
                    .from('document_templates')
                    .select('*')
                    .eq('agency_id', documentData.agency_id)
                    .eq('kind', 'rapport_bailleur')
                    .eq('is_active', true)
                    .maybeSingle();
                
                if (!template) {
                     // Fallback Minimalist template handled inside buildRapportDocument if needed?
                     // buildRapportDocument requires a ResolvedDocumentTemplate. We construct a minimal one.
                }
                
                const resolvedTemplate = template ?? {
                    id: 'default',
                    kind: 'rapport_bailleur',
                    name: 'Défaut',
                    content: { blocks: [
                        { id: 'b1', type: 'system', systemKey: 'hero', enabled: true },
                        { id: 'b2', type: 'system', systemKey: 'totals', enabled: true },
                        { id: 'b3', type: 'system', systemKey: 'collections', enabled: true },
                        { id: 'b4', type: 'system', systemKey: 'expenses', enabled: true },
                    ]}
                };
                
                const settings = (agency || {}) as AgencySettings;
                
                // Get the bailleur name from payload if possible
                const bailleurName = payload.owner?.nom || metadata.bailleur_nom || 'Bailleur';
                const moisConcerne = metadata.mois_concerne || 'Période';
                
                const { doc } = await buildRapportDocument(
                    'rapport_bailleur',
                    payload,
                    bailleurName,
                    moisConcerne,
                    resolvedTemplate as any,
                    documentData.reference,
                    settings,
                    { previewMode: true }
                );

                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);
                
                if (iframeRef.current) {
                    iframeRef.current.src = url;
                }
            } catch (err) {
                console.error("Erreur génération preview", err);
            }
        }
        
        generatePreview();
    }, [documentData]);

    const handleDownload = async () => {
        if (!documentData) return;
        setGeneratingPdf(true);
        try {
            const metadata = documentData.metadata;
            const payload = metadata.report_payload as OwnerReportSnapshotPayload;
            
            const { data: agency } = await supabase.from('agencies').select('*').eq('id', documentData.agency_id).maybeSingle();
            const { data: template } = await supabase.from('document_templates').select('*').eq('agency_id', documentData.agency_id).eq('kind', 'rapport_bailleur').eq('is_active', true).maybeSingle();
            
            const resolvedTemplate = template ?? {
                id: 'default', kind: 'rapport_bailleur', name: 'Défaut',
                content: { blocks: [
                    { id: 'b1', type: 'system', systemKey: 'hero', enabled: true },
                    { id: 'b2', type: 'system', systemKey: 'totals', enabled: true },
                    { id: 'b3', type: 'system', systemKey: 'collections', enabled: true },
                    { id: 'b4', type: 'system', systemKey: 'expenses', enabled: true },
                ]}
            };
            
            const { doc } = await buildRapportDocument(
                'rapport_bailleur',
                payload,
                payload.owner?.nom || metadata.bailleur_nom || 'Bailleur',
                metadata.mois_concerne || 'Période',
                resolvedTemplate as any,
                documentData.reference,
                (agency || {}) as AgencySettings
            );
            
            doc.save(`${documentData.reference}.pdf`);
        } catch (err) {
            console.error("Erreur téléchargement", err);
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <BrandedLoader label="Récupération du document sécurisé" />
            </div>
        );
    }

    if (error || !documentData) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-slate-900">Accès impossible</h1>
                    <p className="mb-8 text-slate-600">{error}</p>
                    <a href="/" className="inline-block rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800">
                        Retour à l'accueil
                    </a>
                </div>
            </div>
        );
    }

    const payload = documentData.metadata?.report_payload;
    const isReady = !!payload;

    return (
        <div className="flex h-screen flex-col bg-slate-100">
            {/* Navbar public */}
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <BrandMark size="sm" tone="light" />
                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                    <span className="text-sm font-semibold text-slate-800 hidden sm:block">Partage de document sécurisé</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 sm:flex">
                        <CheckCircle2 className="h-4 w-4" />
                        Authentique
                    </div>
                    <button
                        onClick={handleDownload}
                        disabled={generatingPdf || !isReady}
                        className="flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:opacity-50"
                    >
                        <Download className="h-4 w-4" />
                        {generatingPdf ? 'Génération...' : 'Télécharger PDF'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
                <div className="mx-auto h-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
                    {!isReady ? (
                        <div className="flex h-full items-center justify-center flex-col text-center p-8">
                            <FileText className="h-12 w-12 text-slate-300 mb-4" />
                            <h2 className="text-lg font-medium text-slate-900 mb-2">Rapport non disponible</h2>
                            <p className="text-slate-500 max-w-sm">Les données de ce rapport n'ont pas pu être chargées correctement lors de sa génération automatique.</p>
                        </div>
                    ) : (
                        <iframe 
                            ref={iframeRef} 
                            className="h-full w-full border-0 bg-slate-100/50" 
                            title="Aperçu du rapport"
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
