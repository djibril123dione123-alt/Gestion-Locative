import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Switch } from '@headlessui/react';
import { Mail, Calendar, RefreshCcw, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function LandlordReportSettingsUI({ bailleurId, defaultEmail }: { bailleurId: string; defaultEmail: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('landlord_report_settings')
          .select('*')
          .eq('bailleur_id', bailleurId)
          .maybeSingle();
        
        if (data) {
          setSettings(data);
        } else {
          setSettings({
            enabled: false,
            recipient_email: defaultEmail,
            frequency: 'monthly',
            send_day: 1,
          });
        }
      } catch (err) {
        console.error('Error loading settings', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [bailleurId, defaultEmail]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: profile } = await supabase.from('user_profiles').select('agency_id').single();
      if (!profile?.agency_id) throw new Error("No agency ID");

      const payload = {
        bailleur_id: bailleurId,
        agency_id: profile.agency_id,
        enabled: settings.enabled,
        recipient_email: settings.recipient_email,
        frequency: settings.frequency,
        send_day: settings.send_day,
      };

      const { error } = await supabase.from('landlord_report_settings').upsert(payload);
      if (error) throw error;
      toast.success('Configuration sauvegardée');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSend = async () => {
    toast.success('Génération du rapport ajoutée à la file d\'attente');
    // Call Edge Function or endpoint if implemented
  };

  if (loading) return <div className="p-2 text-xs text-slate-500">Chargement...</div>;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-sm">
      <div className="bg-slate-50 p-2 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Envoi Automatique</h3>
          <p className="text-[9px] text-slate-500">Configurer l'envoi des rapports bailleur</p>
        </div>
        <Switch
          checked={settings.enabled}
          onChange={(val) => setSettings({ ...settings, enabled: val })}
          className={`${settings.enabled ? 'bg-emerald-600' : 'bg-slate-200'} relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none`}
        >
          <span className={`${settings.enabled ? 'translate-x-3' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
        </Switch>
      </div>

      {settings.enabled && (
        <div className="p-2 space-y-2 text-xs">
          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Email Destinataire</label>
            <div className="relative">
              <Mail className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                value={settings.recipient_email || ''} 
                onChange={e => setSettings({ ...settings, recipient_email: e.target.value })}
                className="w-full h-7 rounded-md border border-slate-200 pl-6 pr-2 text-xs" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Fréquence</label>
              <div className="relative">
                <RefreshCcw className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <select 
                  value={settings.frequency} 
                  onChange={e => setSettings({ ...settings, frequency: e.target.value })}
                  className="w-full h-7 rounded-md border border-slate-200 pl-6 pr-2 text-xs"
                >
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Jour du mois</label>
              <div className="relative">
                <Calendar className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input 
                  type="number" 
                  min="1" max="31"
                  value={settings.send_day} 
                  onChange={e => setSettings({ ...settings, send_day: parseInt(e.target.value) || 1 })}
                  className="w-full h-7 rounded-md border border-slate-200 pl-6 pr-2 text-xs" 
                />
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 pt-1">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save className="h-3 w-3" /> {saving ? '...' : 'Sauvegarder'}
            </button>
            <button 
              onClick={handleManualSend}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
            >
              <Mail className="h-3 w-3" /> Envoyer
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
