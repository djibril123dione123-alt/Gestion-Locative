import React, { useState } from 'react';
import { 
  EDL_Piece, 
  EDL_Element, 
  EtatElement, 
  Inventaire,
  InventaireType,
  EDL_Compteur,
  EDL_Cle
} from '../../types/inventaire';
import { SmartCombobox } from '../ui/SmartCombobox';
import { Camera, Plus, Trash2, AlertTriangle, ShieldCheck, FileCheck2, Info, CheckCircle2, ChevronRight, Check } from 'lucide-react';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { v4 as uuidv4 } from 'uuid';

interface InventaireEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contrats: any[];
  agencyId: string;
}

const ETAT_LABELS: Record<EtatElement, { label: string, color: string }> = {
  bon: { label: 'Bon état', color: 'bg-emerald-100 text-emerald-800' },
  usage_normal: { label: 'Usage normal', color: 'bg-blue-100 text-blue-800' },
  a_surveiller: { label: 'À surveiller', color: 'bg-amber-100 text-amber-800' },
  degrade: { label: 'Dégradé', color: 'bg-orange-100 text-orange-800' },
  a_reparer: { label: 'À réparer', color: 'bg-red-100 text-red-800' },
};

const DEFAULT_ELEMENTS = ['Murs', 'Sol', 'Plafond', 'Porte', 'Fenêtre', 'Électricité', 'Plomberie'];

export function InventaireEditor({ isOpen, onClose, onSuccess, contrats, agencyId }: InventaireEditorProps) {
  const { user } = useAuth();
  const toast = useToast();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [contratId, setContratId] = useState('');
  const [type, setType] = useState<InventaireType>('entree');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [locatairePresent, setLocatairePresent] = useState(true);
  const [proprietairePresent, setProprietairePresent] = useState(false);
  const [agentPresent, setAgentPresent] = useState(true);
  
  const [pieces, setPieces] = useState<EDL_Piece[]>([]);
  const [compteurs, setCompteurs] = useState<EDL_Compteur[]>([]);
  const [cles, setCles] = useState<EDL_Cle[]>([]);
  
  const [observations, setObservations] = useState('');
  const [cautionRetenue, setCautionRetenue] = useState(0);

  // Pour l'UI d'ajout de pièce
  const [newPieceName, setNewPieceName] = useState('');
  const [activePieceId, setActivePieceId] = useState<string | null>(null);

  const addPiece = () => {
    if (!newPieceName.trim()) return;
    const newPiece: EDL_Piece = {
      id: uuidv4(),
      nom: newPieceName.trim(),
      elements: DEFAULT_ELEMENTS.map(nom => ({
        id: uuidv4(),
        nom,
        etat: 'bon',
        observations: '',
        photos: []
      }))
    };
    setPieces([...pieces, newPiece]);
    setNewPieceName('');
    setActivePieceId(newPiece.id);
  };
  
  const updateElement = (pieceId: string, elementId: string, patch: Partial<EDL_Element>) => {
    setPieces(prev => prev.map(p => {
      if (p.id !== pieceId) return p;
      return {
        ...p,
        elements: p.elements.map(e => e.id === elementId ? { ...e, ...patch } : e)
      };
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, pieceId: string, elementId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Simuler un upload/compression
    const tempUrl = URL.createObjectURL(file);
    const newPhoto = { url: tempUrl, date: new Date().toISOString() };
    
    setPieces(prev => prev.map(p => {
      if (p.id !== pieceId) return p;
      return {
        ...p,
        elements: p.elements.map(el => el.id === elementId ? { ...el, photos: [...el.photos, newPhoto] } : el)
      };
    }));
    toast.success('Photo ajoutée');
  };

  const addCompteur = () => {
    setCompteurs([...compteurs, { id: uuidv4(), type: 'Eau', valeur: '' }]);
  };
  
  const addCle = () => {
    setCles([...cles, { id: uuidv4(), type: 'Entrée principale', quantite: 1 }]);
  };

  const submit = async () => {
    if (!contratId) {
      toast.error('Veuillez sélectionner un contrat');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inventaires').insert({
        agency_id: agencyId,
        contrat_id: contratId,
        type,
        date,
        locataire_present: locatairePresent,
        proprietaire_present: proprietairePresent,
        agent_present: agentPresent,
        pieces,
        compteurs,
        cles,
        observations: observations.trim() || null,
        caution_retenue: cautionRetenue || 0,
        statut: 'en_cours',
        created_by: user?.id
      });
      if (error) throw error;
      toast.success('État des lieux enregistré avec succès');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const activePiece = pieces.find(p => p.id === activePieceId);

  return (
    <PremiumDrawerShell
      open={isOpen}
      onClose={onClose}
      size="full"
      title="État des lieux professionnel"
      description="Réalisez une inspection complète et structurée."
      actions={
        step === 4 ? (
          <button 
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex h-8 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white transition hover:bg-emerald-800"
          >
            {submitting ? 'Enregistrement...' : 'Finaliser & Signer'}
          </button>
        ) : (
          <button 
            type="button"
            onClick={() => setStep((s) => Math.min(s + 1, 4) as any)}
            className="flex h-8 items-center gap-2 rounded-xl bg-slate-800 px-4 text-xs font-bold text-white transition hover:bg-slate-900"
          >
            Étape suivante <ChevronRight className="h-4 w-4" />
          </button>
        )
      }
    >
      <div className="max-w-4xl mx-auto py-4">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          {[
            { s: 1, l: 'Informations' },
            { s: 2, l: 'Pièces & Éléments' },
            { s: 3, l: 'Compteurs & Clés' },
            { s: 4, l: 'Bilan' }
          ].map((item) => (
            <div key={item.s} className="flex-1">
              <div className={`h-1.5 rounded-full mb-1.5 transition ${step >= item.s ? 'bg-emerald-600' : 'bg-slate-100'}`} />
              <p className={`text-[10px] font-bold uppercase tracking-wider ${step >= item.s ? 'text-emerald-800' : 'text-slate-400'}`}>
                {step > item.s ? <Check className="w-3 h-3 inline mr-1" /> : null}
                {item.l}
              </p>
            </div>
          ))}
        </div>

        {/* STEP 1: Infos */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Informations générales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Contrat concerné *</label>
                  <SmartCombobox
                    value={contratId}
                    options={contrats.map(c => ({
                      value: c.id,
                      label: `${c.locataires?.prenom} ${c.locataires?.nom} - ${c.unites?.nom}`
                    }))}
                    onChange={(val) => setContratId(val || '')}
                    placeholder="Sélectionner le bail..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Type d'EDL</label>
                  <SmartCombobox
                    value={type}
                    options={[
                      { value: 'entree', label: 'Entrée' },
                      { value: 'intermediaire', label: 'Intermédiaire / Visite' },
                      { value: 'sortie', label: 'Sortie' },
                    ]}
                    onChange={(val) => setType((val || 'entree') as InventaireType)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Date de la visite</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Personnes présentes</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={locatairePresent} onChange={e => setLocatairePresent(e.target.checked)} className="rounded border-slate-300" />
                  Locataire
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={proprietairePresent} onChange={e => setProprietairePresent(e.target.checked)} className="rounded border-slate-300" />
                  Bailleur
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={agentPresent} onChange={e => setAgentPresent(e.target.checked)} className="rounded border-slate-300" />
                  Agent Samay Këur
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Pièces */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-220px)] min-h-[400px]">
            {/* Colonne Liste des Pièces */}
            <div className="md:col-span-1 border-r border-slate-100 pr-4 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-3 text-sm flex justify-between items-center">
                Pièces ({pieces.length})
              </h3>
              
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newPieceName}
                  onChange={e => setNewPieceName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPiece()}
                  placeholder="Ex: Salon..."
                  className="flex-1 h-8 rounded-lg border border-slate-200 px-2 text-xs"
                />
                <button onClick={addPiece} className="h-8 w-8 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {pieces.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Ajoutez votre première pièce</p>
                ) : pieces.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActivePieceId(p.id)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition ${
                      activePieceId === p.id ? 'bg-emerald-600 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p.nom}
                  </button>
                ))}
              </div>
            </div>

            {/* Colonne Édition des Éléments */}
            <div className="md:col-span-3 overflow-y-auto pl-2 pb-8">
              {!activePiece ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                  Sélectionnez ou créez une pièce
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <h2 className="text-lg font-black text-slate-800">{activePiece.nom}</h2>
                    <button 
                      onClick={() => {
                        setPieces(pieces.filter(p => p.id !== activePiece.id));
                        setActivePieceId(null);
                      }}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activePiece.elements.map(el => (
                      <div key={el.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-emerald-200 transition">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm text-slate-800">{el.nom}</h4>
                          <SmartCombobox
                            value={el.etat}
                            options={[
                              { value: 'bon', label: 'Bon état' },
                              { value: 'usage_normal', label: 'Usage normal' },
                              { value: 'a_surveiller', label: 'À surveiller' },
                              { value: 'degrade', label: 'Dégradé' },
                              { value: 'a_reparer', label: 'À réparer' },
                            ]}
                            onChange={(val) => updateElement(activePiece.id, el.id, { etat: (val || 'bon') as EtatElement })}
                            className="w-32"
                            density="compact"
                          />
                        </div>
                        
                        <textarea
                          placeholder="Observations..."
                          value={el.observations}
                          onChange={e => updateElement(activePiece.id, el.id, { observations: e.target.value })}
                          className="w-full h-12 text-xs border border-slate-100 rounded-lg bg-slate-50 p-2 mb-2 resize-none"
                        />
                        
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {el.photos.map((photo, idx) => (
                            <img key={idx} src={photo.url} alt="Preuve" className="h-10 w-10 object-cover rounded border border-slate-200 shrink-0" />
                          ))}
                          <label className="h-10 w-10 shrink-0 border border-dashed border-slate-300 rounded bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100">
                            <Camera className="w-4 h-4 text-slate-400" />
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoUpload(e, activePiece.id, el.id)} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Compteurs & Clés */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Compteurs (Eau, Élec...)</h3>
                <button onClick={addCompteur} className="text-xs bg-slate-100 font-bold px-2 py-1 rounded hover:bg-slate-200">+ Ajouter</button>
              </div>
              <div className="space-y-3">
                {compteurs.map((c, i) => (
                  <div key={c.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <input type="text" value={c.type} onChange={e => setCompteurs(prev => prev.map((item, idx) => idx === i ? {...item, type: e.target.value} : item))} placeholder="Type" className="w-1/3 text-xs p-1.5 border rounded" />
                    <input type="text" value={c.valeur} onChange={e => setCompteurs(prev => prev.map((item, idx) => idx === i ? {...item, valeur: e.target.value} : item))} placeholder="Relevé" className="flex-1 text-xs p-1.5 border rounded" />
                    <button onClick={() => setCompteurs(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {compteurs.length === 0 && <p className="text-xs text-slate-400">Aucun relevé</p>}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Remise des Clés</h3>
                <button onClick={addCle} className="text-xs bg-slate-100 font-bold px-2 py-1 rounded hover:bg-slate-200">+ Ajouter</button>
              </div>
              <div className="space-y-3">
                {cles.map((c, i) => (
                  <div key={c.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <input type="text" value={c.type} onChange={e => setCles(prev => prev.map((item, idx) => idx === i ? {...item, type: e.target.value} : item))} placeholder="Porte..." className="flex-1 text-xs p-1.5 border rounded" />
                    <input type="number" value={c.quantite} onChange={e => setCles(prev => prev.map((item, idx) => idx === i ? {...item, quantite: parseInt(e.target.value)||0} : item))} className="w-16 text-xs p-1.5 border rounded text-center" />
                    <button onClick={() => setCles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {cles.length === 0 && <p className="text-xs text-slate-400">Aucune clé renseignée</p>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Bilan & Signatures */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Bilan et Retenue
              </h3>
              <p className="text-xs text-amber-800 mb-4">Indiquez vos observations finales. Si c'est un EDL de sortie, précisez la retenue sur caution éventuelle.</p>
              
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Observations générales de l'agent..."
                className="w-full h-20 text-xs border border-amber-200 rounded-xl bg-white p-3 mb-3 resize-none"
              />
              
              {type === 'sortie' && (
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">Montant retenu sur caution (FCFA)</label>
                  <input
                    type="number"
                    value={cautionRetenue}
                    onChange={e => setCautionRetenue(parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/3 h-9 rounded-xl border border-amber-200 px-3 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PremiumDrawerShell>
  );
}
