#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Variable VITE_SUPABASE_URL requise');
  process.exit(1);
}

const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseKey) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY requise');
  process.exit(1);
}

console.log(`🔑 Utilisation de: ${supabaseServiceKey ? 'SERVICE_ROLE_KEY (bypass RLS)' : 'ANON_KEY (avec RLS)'}\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

// Données réalistes pour le Sénégal
const NOMS_SENEGALAIS = [
  'Diop', 'Sall', 'Ndiaye', 'Faye', 'Sarr', 'Ba', 'Sy', 'Fall', 'Gueye', 'Diouf',
  'Mbaye', 'Thiam', 'Kane', 'Cisse', 'Seck', 'Diallo', 'Dieng', 'Ndour', 'Wade', 'Toure'
];

const PRENOMS_SENEGALAIS = [
  'Moussa', 'Amadou', 'Fatou', 'Awa', 'Mamadou', 'Aissatou', 'Ibrahima', 'Mariama',
  'Ousmane', 'Khady', 'Abdoulaye', 'Binta', 'Cheikh', 'Aminata', 'Modou', 'Coumba',
  'Seydou', 'Rokhaya', 'Babacar', 'Ndèye'
];

const QUARTIERS_DAKAR = [
  'Plateau', 'Almadies', 'Mermoz', 'Sacré-Cœur', 'Point E', 'Fann', 'Ouakam',
  'Yoff', 'Ngor', 'Pikine', 'Guédiawaye', 'Parcelles Assainies', 'Grand Yoff',
  'Liberté 6', 'HLM', 'Médina', 'Gueule Tapée', 'Dieuppeul', 'Grand Dakar', 'Rufisque'
];

const VILLES = ['Dakar', 'Pikine', 'Rufisque', 'Thiès', 'Saint-Louis'];

const TYPES_UNITE = {
  'studio': { min: 75000, max: 150000 },
  'appartement': { min: 150000, max: 500000 },
  'bureau': { min: 200000, max: 800000 },
  'commerce': { min: 250000, max: 1000000 }
};

const MODES_PAIEMENT = ['especes', 'virement', 'mobile_money', 'cheque'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone() {
  const prefixes = ['77', '78', '76', '70', '75'];
  const prefix = randomChoice(prefixes);
  const number = String(randomInt(1000000, 9999999)).padStart(7, '0');
  return `+221 ${prefix} ${number.slice(0, 3)} ${number.slice(3, 5)} ${number.slice(5)}`;
}

function generateEmail(prenom, nom) {
  const domains = ['gmail.com', 'yahoo.fr', 'hotmail.com', 'orange.sn'];
  return `${prenom.toLowerCase()}.${nom.toLowerCase()}@${randomChoice(domains)}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Génération des agences
function generateAgencies() {
  return [
    {
      name: 'Immobilier Dakar Premium',
      phone: '+221 33 824 15 67',
      email: 'contact@dakar-premium.sn',
      address: 'Avenue Léopold Sédar Senghor, Plateau, Dakar',
      ninea: '0062341589',
      plan: 'basic',
      status: 'active',
      is_bailleur_account: false,
      size: 'small' // Métadonnée pour savoir combien de données générer
    },
    {
      name: 'Sénégal Gestion Locative',
      phone: '+221 33 867 42 88',
      email: 'info@senegal-gestion.sn',
      address: 'Rue 10, Point E, Dakar',
      ninea: '0073452196',
      plan: 'pro',
      status: 'active',
      is_bailleur_account: false,
      size: 'medium'
    },
    {
      name: 'Teranga Immobilier Group',
      phone: '+221 33 889 55 44',
      email: 'contact@teranga-immo.sn',
      address: 'Boulevard du Centenaire de la Commune de Dakar, Almadies, Dakar',
      ninea: '0081234567',
      plan: 'enterprise',
      status: 'active',
      is_bailleur_account: false,
      size: 'large'
    }
  ];
}

// Génération des bailleurs
function generateBailleurs(count, agencyId) {
  const bailleurs = [];
  for (let i = 0; i < count; i++) {
    const prenom = randomChoice(PRENOMS_SENEGALAIS);
    const nom = randomChoice(NOMS_SENEGALAIS);
    bailleurs.push({
      agency_id: agencyId,
      nom,
      prenom,
      telephone: generatePhone(),
      email: generateEmail(prenom, nom),
      adresse: `${randomInt(1, 150)} Rue ${randomInt(1, 50)}, ${randomChoice(QUARTIERS_DAKAR)}, ${randomChoice(VILLES)}`,
      piece_identite: `CNI ${randomInt(1000000000, 9999999999)}`,
      commission: randomChoice([8, 10, 12, 15]),
      debut_contrat: formatDate(new Date(2020 + randomInt(0, 4), randomInt(0, 11), 1)),
      actif: true
    });
  }
  return bailleurs;
}

// Génération des immeubles
function generateImmeubles(count, bailleurs, agencyId) {
  const immeubles = [];
  for (let i = 0; i < count; i++) {
    const bailleur = randomChoice(bailleurs);
    const quartier = randomChoice(QUARTIERS_DAKAR);
    const ville = randomChoice(VILLES);
    immeubles.push({
      agency_id: agencyId,
      bailleur_id: bailleur.id,
      nom: `Immeuble ${quartier} ${String.fromCharCode(65 + randomInt(0, 25))}`,
      adresse: `${randomInt(1, 200)} ${quartier}, ${ville}`,
      quartier,
      ville,
      nombre_unites: randomInt(4, 12),
      description: `Immeuble moderne situé à ${quartier}`,
      actif: true
    });
  }
  return immeubles;
}

// Génération des unités
function generateUnites(immeubles, agencyId) {
  const unites = [];
  const types = Object.keys(TYPES_UNITE);

  for (const immeuble of immeubles) {
    const nbUnites = immeuble.nombre_unites || randomInt(4, 12);
    for (let i = 0; i < nbUnites; i++) {
      const type = randomChoice(types);
      const { min, max } = TYPES_UNITE[type];
      const etage = Math.floor(i / 4);
      const numero = String.fromCharCode(65 + (i % 4));

      unites.push({
        agency_id: agencyId,
        immeuble_id: immeuble.id,
        nom: `${type.charAt(0).toUpperCase() + type.slice(1)} ${numero}`,
        numero: `${etage}${numero}`,
        etage: etage === 0 ? 'RDC' : `${etage}`,
        loyer_base: randomInt(min, max),
        statut: 'libre',
        superficie: type === 'studio' ? randomInt(25, 40) : randomInt(50, 150),
        description: `${type} au ${etage === 0 ? 'rez-de-chaussée' : etage + 'e étage'}`,
        actif: true
      });
    }
  }
  return unites;
}

// Génération des locataires
function generateLocataires(count, agencyId) {
  const locataires = [];
  for (let i = 0; i < count; i++) {
    const prenom = randomChoice(PRENOMS_SENEGALAIS);
    const nom = randomChoice(NOMS_SENEGALAIS);
    locataires.push({
      agency_id: agencyId,
      nom,
      prenom,
      telephone: generatePhone(),
      email: generateEmail(prenom, nom),
      adresse_personnelle: `${randomInt(1, 150)} Rue ${randomInt(1, 50)}, ${randomChoice(QUARTIERS_DAKAR)}, ${randomChoice(VILLES)}`,
      piece_identite: `CNI ${randomInt(1000000000, 9999999999)}`,
      actif: true
    });
  }
  return locataires;
}

// Génération des contrats
function generateContrats(unites, locataires, agencyId, nbContrats) {
  const contrats = [];
  const availableUnites = [...unites];
  const availableLocataires = [...locataires];

  for (let i = 0; i < Math.min(nbContrats, availableUnites.length, availableLocataires.length); i++) {
    const uniteIndex = randomInt(0, availableUnites.length - 1);
    const locataireIndex = randomInt(0, availableLocataires.length - 1);

    const unite = availableUnites[uniteIndex];
    const locataire = availableLocataires[locataireIndex];

    availableUnites.splice(uniteIndex, 1);
    availableLocataires.splice(locataireIndex, 1);

    const dateDebut = new Date(2023, randomInt(0, 11), 1);
    const isActif = Math.random() > 0.1; // 90% actifs

    contrats.push({
      agency_id: agencyId,
      unite_id: unite.id,
      locataire_id: locataire.id,
      date_debut: formatDate(dateDebut),
      date_fin: isActif ? null : formatDate(addMonths(dateDebut, 12)),
      loyer_mensuel: unite.loyer_base,
      caution: unite.loyer_base * 2,
      commission: randomChoice([8, 10, 12, 15]),
      statut: isActif ? 'actif' : 'expire',
      destination: unite.nom.includes('bureau') || unite.nom.includes('Commerce') ? 'Commercial' : 'Habitation'
    });
  }

  return contrats;
}

// Génération des paiements
function generatePaiements(contrats, agencyId, nbMois) {
  const paiements = [];
  const now = new Date();

  for (const contrat of contrats) {
    if (contrat.statut !== 'actif') continue;

    const dateDebut = new Date(contrat.date_debut);
    const commission = contrat.commission || 10;

    for (let mois = 0; mois < nbMois; mois++) {
      const moisConcerne = addMonths(dateDebut, mois);
      if (moisConcerne > now) break;

      const aPaye = Math.random() > 0.15; // 85% de taux de paiement

      if (aPaye) {
        const montantTotal = contrat.loyer_mensuel;
        const partAgence = Math.round(montantTotal * commission / 100);
        const partBailleur = montantTotal - partAgence;

        const datePaiement = new Date(moisConcerne);
        datePaiement.setDate(randomInt(1, 15)); // Payé entre le 1er et le 15

        paiements.push({
          agency_id: agencyId,
          contrat_id: contrat.id,
          montant_total: montantTotal,
          mois_concerne: formatDate(moisConcerne),
          date_paiement: formatDate(datePaiement),
          mode_paiement: randomChoice(MODES_PAIEMENT),
          part_agence: partAgence,
          part_bailleur: partBailleur,
          statut: 'paye',
          reference: `PAY-${Date.now()}-${randomInt(1000, 9999)}`
        });
      } else {
        // Impayé
        paiements.push({
          agency_id: agencyId,
          contrat_id: contrat.id,
          montant_total: contrat.loyer_mensuel,
          mois_concerne: formatDate(moisConcerne),
          date_paiement: formatDate(moisConcerne),
          mode_paiement: 'especes',
          part_agence: Math.round(contrat.loyer_mensuel * commission / 100),
          part_bailleur: contrat.loyer_mensuel - Math.round(contrat.loyer_mensuel * commission / 100),
          statut: 'impaye'
        });
      }
    }
  }

  return paiements;
}

// Génération des dépenses
function generateDepenses(immeubles, agencyId, nbDepenses) {
  const depenses = [];
  const categories = [
    'Entretien', 'Réparation', 'Électricité', 'Eau', 'Gardiennage',
    'Assurance', 'Taxe foncière', 'Peinture', 'Plomberie', 'Nettoyage'
  ];

  for (let i = 0; i < nbDepenses; i++) {
    const immeuble = randomChoice(immeubles);
    const categorie = randomChoice(categories);
    const montant = randomInt(10000, 500000);
    const dateDepense = new Date(2024, randomInt(0, 11), randomInt(1, 28));

    depenses.push({
      agency_id: agencyId,
      immeuble_id: immeuble.id,
      montant,
      date_depense: formatDate(dateDepense),
      categorie,
      description: `${categorie} pour ${immeuble.nom}`,
      beneficiaire: `Entreprise ${randomChoice(NOMS_SENEGALAIS)}`,
      actif: true
    });
  }

  return depenses;
}

// Fonction principale
async function seedData() {
  console.log('🌱 Démarrage du seed des données de test...\n');

  try {
    const agencies = generateAgencies();

    for (const agencyData of agencies) {
      console.log(`\n📦 Création agence: ${agencyData.name} (${agencyData.size})`);

      const { size, ...agencyInsert } = agencyData;
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert(agencyInsert)
        .select()
        .single();

      if (agencyError) throw new Error(`Erreur agence: ${agencyError.message}`);

      console.log(`  ✅ Agence créée: ${agency.id}`);

      // Déterminer la taille des données selon le type d'agence
      const sizes = {
        small: { bailleurs: 2, immeubles: 3, locataires: 6, contrats: 8, mois: 3, depenses: 5 },
        medium: { bailleurs: 5, immeubles: 8, locataires: 20, contrats: 25, mois: 9, depenses: 15 },
        large: { bailleurs: 12, immeubles: 20, locataires: 60, contrats: 70, mois: 12, depenses: 30 }
      };

      const config = sizes[size];

      // Bailleurs
      console.log(`  📝 Création de ${config.bailleurs} bailleurs...`);
      const bailleursData = generateBailleurs(config.bailleurs, agency.id);
      const { data: bailleurs, error: bailleursError } = await supabase
        .from('bailleurs')
        .insert(bailleursData)
        .select();

      if (bailleursError) throw new Error(`Erreur bailleurs: ${bailleursError.message}`);
      console.log(`  ✅ ${bailleurs.length} bailleurs créés`);

      // Immeubles
      console.log(`  🏢 Création de ${config.immeubles} immeubles...`);
      const immeublesData = generateImmeubles(config.immeubles, bailleurs, agency.id);
      const { data: immeubles, error: immeublesError } = await supabase
        .from('immeubles')
        .insert(immeublesData)
        .select();

      if (immeublesError) throw new Error(`Erreur immeubles: ${immeublesError.message}`);
      console.log(`  ✅ ${immeubles.length} immeubles créés`);

      // Unités
      console.log(`  🏠 Création des unités...`);
      const unitesData = generateUnites(immeubles, agency.id);
      const { data: unites, error: unitesError } = await supabase
        .from('unites')
        .insert(unitesData)
        .select();

      if (unitesError) throw new Error(`Erreur unités: ${unitesError.message}`);
      console.log(`  ✅ ${unites.length} unités créées`);

      // Locataires
      console.log(`  👤 Création de ${config.locataires} locataires...`);
      const locatairesData = generateLocataires(config.locataires, agency.id);
      const { data: locataires, error: locatairesError } = await supabase
        .from('locataires')
        .insert(locatairesData)
        .select();

      if (locatairesError) throw new Error(`Erreur locataires: ${locatairesError.message}`);
      console.log(`  ✅ ${locataires.length} locataires créés`);

      // Contrats
      console.log(`  📄 Création de ${config.contrats} contrats...`);
      const contratsData = generateContrats(unites, locataires, agency.id, config.contrats);
      const { data: contrats, error: contratsError } = await supabase
        .from('contrats')
        .insert(contratsData)
        .select();

      if (contratsError) throw new Error(`Erreur contrats: ${contratsError.message}`);
      console.log(`  ✅ ${contrats.length} contrats créés`);

      // Mise à jour du statut des unités
      for (const contrat of contrats) {
        if (contrat.statut === 'actif') {
          await supabase
            .from('unites')
            .update({ statut: 'loue' })
            .eq('id', contrat.unite_id);
        }
      }
      console.log(`  ✅ Statuts des unités mis à jour`);

      // Paiements
      console.log(`  💰 Création des paiements (${config.mois} mois)...`);
      const paiementsData = generatePaiements(contrats, agency.id, config.mois);

      // Insertion par lots de 100
      const batchSize = 100;
      for (let i = 0; i < paiementsData.length; i += batchSize) {
        const batch = paiementsData.slice(i, i + batchSize);
        const { error: paiementsError } = await supabase
          .from('paiements')
          .insert(batch);

        if (paiementsError) throw new Error(`Erreur paiements: ${paiementsError.message}`);
      }
      console.log(`  ✅ ${paiementsData.length} paiements créés`);

      // Dépenses
      console.log(`  💸 Création de ${config.depenses} dépenses...`);
      const depensesData = generateDepenses(immeubles, agency.id, config.depenses);
      const { error: depensesError } = await supabase
        .from('depenses')
        .insert(depensesData);

      if (depensesError) throw new Error(`Erreur dépenses: ${depensesError.message}`);
      console.log(`  ✅ ${config.depenses} dépenses créées`);

      console.log(`\n✅ Agence ${agencyData.name} complétée!`);
      console.log(`   - ${bailleurs.length} bailleurs`);
      console.log(`   - ${immeubles.length} immeubles`);
      console.log(`   - ${unites.length} unités`);
      console.log(`   - ${locataires.length} locataires`);
      console.log(`   - ${contrats.length} contrats`);
      console.log(`   - ${paiementsData.length} paiements`);
      console.log(`   - ${config.depenses} dépenses`);
    }

    console.log('\n\n🎉 SEED TERMINÉ AVEC SUCCÈS!\n');
    console.log('📊 Résumé:');
    console.log(`   - ${agencies.length} agences créées`);
    console.log('   - Petite agence: données de test basiques');
    console.log('   - Agence moyenne: cas d\'usage réalistes');
    console.log('   - Grande agence: test de performance et cas limites\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedData();
