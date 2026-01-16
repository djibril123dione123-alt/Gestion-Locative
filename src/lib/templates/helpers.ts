import { supabase } from '../supabase';

export interface AgencySettings {
  nom_agence: string;
  adresse: string;
  telephone: string;
  email: string;
  site_web?: string;
  ninea?: string;
  rc?: string;
  representant_nom?: string;
  representant_fonction?: string;
  logo_url?: string;
  logo_position?: 'left' | 'center' | 'right';
  couleur_primaire?: string;
  couleur_secondaire?: string;
  mention_tribunal?: string;
  mention_penalites?: string;
  pied_page_personnalise?: string;
  frais_huissier?: number;
  penalite_retard_montant?: number;
  penalite_retard_delai_jours?: number;
  devise?: string;
}

export async function getAgencySettings(agencyId: string): Promise<AgencySettings | null> {
  try {
    const { data, error } = await supabase
      .from('agency_settings')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement paramètres agence:', error);

      const { data: agencyData } = await supabase
        .from('agencies')
        .select('name, phone, email, address, ninea')
        .eq('id', agencyId)
        .single();

      if (agencyData) {
        return {
          nom_agence: agencyData.name,
          adresse: agencyData.address || '',
          telephone: agencyData.phone || '',
          email: agencyData.email || '',
          ninea: agencyData.ninea || '',
          couleur_primaire: '#F58220',
          couleur_secondaire: '#333333',
          mention_tribunal: 'Tribunal de commerce de Dakar',
          devise: 'XOF',
        };
      }

      return null;
    }

    if (!data) {
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('name, phone, email, address, ninea')
        .eq('id', agencyId)
        .single();

      if (agencyData) {
        return {
          nom_agence: agencyData.name,
          adresse: agencyData.address || '',
          telephone: agencyData.phone || '',
          email: agencyData.email || '',
          ninea: agencyData.ninea || '',
          couleur_primaire: '#F58220',
          couleur_secondaire: '#333333',
          mention_tribunal: 'Tribunal de commerce de Dakar',
          devise: 'XOF',
        };
      }

      return null;
    }

    return data as AgencySettings;
  } catch (error) {
    console.error('Erreur getAgencySettings:', error);
    return null;
  }
}

export function numberToFrenchWords(num: number): string {
  if (num === 0) return 'zéro';

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      if (ten === 7 || ten === 9) {
        return tens[ten - 1] + '-' + (ten === 7 ? teens[unit] : teens[unit]);
      }
      if (unit === 0) return tens[ten];
      if (unit === 1 && ten !== 8) return tens[ten] + ' et ' + units[unit];
      return tens[ten] + '-' + units[unit];
    }

    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let result = hundred === 1 ? 'cent' : units[hundred] + ' cent';
    if (hundred > 1 && rest === 0) result += 's';
    if (rest > 0) result += ' ' + convertHundreds(rest);
    return result;
  }

  function convertThousands(n: number): string {
    if (n < 1000) return convertHundreds(n);

    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;

    let result = thousands === 1 ? 'mille' : convertHundreds(thousands) + ' mille';
    if (rest > 0) result += ' ' + convertHundreds(rest);
    return result;
  }

  function convertMillions(n: number): string {
    if (n < 1000000) return convertThousands(n);

    const millions = Math.floor(n / 1000000);
    const rest = n % 1000000;

    let result = millions === 1 ? 'un million' : convertHundreds(millions) + ' millions';
    if (rest > 0) result += ' ' + convertThousands(rest);
    return result;
  }

  return convertMillions(num);
}

export function formatCurrency(amount: number, devise: string = 'FCFA'): string {
  return `${amount.toLocaleString('fr-FR')} ${devise}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
