import type {
  DocumentTemplateBlock,
  DocumentTemplateContent,
  DocumentTemplateType,
  TemplateTagDefinition,
} from '../../types/documentStudio';

export const DOCUMENT_TEMPLATE_CATALOG_VERSION = '2026.07.1';
export const DOCUMENT_RENDERER_VERSION = 'studio-1.0.0';

const types = (...documentTypes: DocumentTemplateType[]) => documentTypes;

export const TEMPLATE_TAG_CATALOG: TemplateTagDefinition[] = [
  { key: 'agency_name', label: "Nom de l'organisation", category: 'organisation', example: 'Keur Gestion', documentTypes: types('contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur', 'rapport_proprietaire') },
  { key: 'agency_address', label: 'Adresse', category: 'organisation', example: 'Médina, Dakar', documentTypes: types('contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur', 'rapport_proprietaire') },
  { key: 'agency_ninea', label: 'NINEA', category: 'organisation', example: '0012345 2G3', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_rc', label: 'RCCM', category: 'organisation', example: 'SN-DKR-2026-B-12345', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_manager_full_name', label: 'Représentant légal', category: 'organisation', example: 'Aminata Diop', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_manager_title', label: 'Fonction du représentant', category: 'organisation', example: 'Gérante', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_manager_id_type', label: 'Type de pièce', category: 'organisation', example: 'CNI', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_manager_id_number', label: 'Numéro de pièce', category: 'organisation', example: '1 01 19950825 00123 4', documentTypes: types('contrat', 'mandat') },
  { key: 'agency_city', label: 'Ville de signature', category: 'organisation', example: 'Dakar', documentTypes: types('contrat', 'mandat') },
  { key: 'bailleur_prenom', label: 'Prénom du bailleur', category: 'bailleur', example: 'Moussa', documentTypes: types('contrat', 'mandat', 'rapport_bailleur') },
  { key: 'bailleur_nom', label: 'Nom du bailleur', category: 'bailleur', example: 'Ndiaye', documentTypes: types('contrat', 'mandat', 'rapport_bailleur') },
  { key: 'bailleur_cni', label: 'Pièce du bailleur', category: 'bailleur', example: '1 01 19800101 00012 3', documentTypes: types('mandat') },
  { key: 'bailleur_adresse', label: 'Adresse du bailleur', category: 'bailleur', example: 'Almadies, Dakar', documentTypes: types('mandat') },
  { key: 'locataire_prenom', label: 'Prénom du locataire', category: 'locataire', example: 'Fatou', documentTypes: types('contrat', 'quittance', 'facture') },
  { key: 'locataire_nom', label: 'Nom du locataire', category: 'locataire', example: 'Sarr', documentTypes: types('contrat', 'quittance', 'facture') },
  { key: 'locataire_cni', label: 'Pièce du locataire', category: 'locataire', example: '2 01 19940112 00456 7', documentTypes: types('contrat') },
  { key: 'locataire_adresse', label: 'Adresse du locataire', category: 'locataire', example: 'Ouakam, Dakar', documentTypes: types('contrat') },
  { key: 'designation', label: 'Bien et unité', category: 'bien', example: 'Appartement F4, Résidence Alima', documentTypes: types('contrat') },
  { key: 'destination_local', label: 'Destination du local', category: 'bien', example: 'Habitation', documentTypes: types('contrat') },
  { key: 'bien_description', label: 'Description du bien', category: 'bien', example: 'un appartement F4 situé à Dakar', documentTypes: types('mandat') },
  { key: 'loyer_mensuel', label: 'Loyer mensuel', category: 'finance', example: '300 000 F CFA', documentTypes: types('contrat', 'quittance', 'facture') },
  { key: 'depot_garantie', label: 'Dépôt de garantie', category: 'finance', example: '600 000 F CFA', documentTypes: types('contrat') },
  { key: 'penalite_montant', label: 'Pénalité journalière', category: 'finance', example: '1 000 F CFA', documentTypes: types('contrat') },
  { key: 'penalite_delai', label: 'Délai de pénalité', category: 'contrat', example: '3', documentTypes: types('contrat') },
  { key: 'taux_honoraires', label: 'Taux de gestion', category: 'finance', example: '10', documentTypes: types('mandat') },
  { key: 'date_debut', label: 'Date de début', category: 'date', example: '01/07/2026', documentTypes: types('contrat', 'mandat') },
  { key: 'date_fin', label: 'Date de fin', category: 'date', example: '30/06/2027', documentTypes: types('contrat') },
  { key: 'duree_annees', label: 'Durée en années', category: 'contrat', example: '1', documentTypes: types('contrat', 'mandat') },
  { key: 'date_du_jour', label: "Date d'émission", category: 'date', example: '09/07/2026', documentTypes: types('contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur', 'rapport_proprietaire') },
  { key: 'mention_tribunal', label: 'Tribunal compétent', category: 'organisation', example: 'Tribunal de commerce de Dakar', documentTypes: types('contrat', 'mandat') },
  { key: 'mention_penalites', label: 'Mention de pénalités', category: 'finance', example: 'Les pénalités prévues au bail restent applicables.', documentTypes: types('contrat', 'mandat') },
  { key: 'mention_frais_huissier', label: "Mention frais d'huissier", category: 'finance', example: "Les frais justifiés restent à la charge de la partie défaillante.", documentTypes: types('contrat', 'mandat') },
  { key: 'mention_litige', label: 'Mention litige', category: 'organisation', example: 'Les parties privilégient une résolution amiable.', documentTypes: types('contrat') },
  { key: 'frais_huissier', label: "Frais d'huissier", category: 'finance', example: '37 500 F CFA', documentTypes: types('contrat') },
];

function block(
  code: string,
  title: string,
  content: string,
  order: number,
  options: Partial<DocumentTemplateBlock> = {},
): DocumentTemplateBlock {
  return {
    id: `official-${code}`,
    kind: 'article',
    code,
    title,
    content,
    enabled: true,
    order,
    ...options,
  };
}

const contractBlocks: DocumentTemplateBlock[] = [
  block('parties', 'Entre les soussignés', "M. {{bailleur_prenom}} {{bailleur_nom}}, propriétaire du bien donné en location, d'une part ;\nEt M./Mme {{locataire_prenom}} {{locataire_nom}}, pièce n° {{locataire_cni}}, demeurant à {{locataire_adresse}}, d'autre part.\nLe document est établi et suivi par {{agency_name}} selon le mandat ou le profil de gestion applicable.", 0, { kind: 'paragraph', locked: true, required: true }),
  block('designation', 'Désignation et destination', "Le bailleur donne en location {{designation}}, destiné à l'usage suivant : {{destination_local}}. Le locataire reconnaît avoir visité et accepté les lieux.", 1),
  block('duree', 'Durée du contrat', 'Le présent contrat est consenti pour {{duree_annees}} an(s), du {{date_debut}} au {{date_fin}}, sous réserve de reconduction ou renouvellement.', 2),
  block('conge', 'Congé', 'Le congé est signifié par écrit avec preuve de réception. Le locataire respecte un préavis de deux mois à compter de sa réception.', 3),
  block('abandon', 'Abandon du domicile', "Le contrat peut être résilié de plein droit en cas d'abandon caractérisé du domicile par le locataire, sous réserve des règles applicables.", 4),
  block('obligations-bailleur', 'Obligations du bailleur', "Le bailleur délivre le logement et ses équipements en bon état d'usage, assure les réparations qui lui incombent et garantit la jouissance paisible des lieux.", 5),
  block('obligations-locataire', 'Obligations du locataire', "Le locataire paie le loyer et les charges aux termes convenus, entretient les lieux, répond des dégradations, respecte le règlement de l'immeuble et ne sous-loue pas sans autorisation écrite.", 6),
  block('loyer', 'Montant du loyer', "Le loyer mensuel est fixé à {{loyer_mensuel}} et payé d'avance selon les modalités convenues entre les parties.", 7),
  block('garantie', 'Dépôt de garantie', 'Le dépôt de garantie est fixé à {{depot_garantie}}. Il garantit les obligations locatives sans se substituer au paiement du dernier loyer.', 8),
  block('penalites', 'Pénalités et recouvrement', "{{mention_penalites}}\nLa pénalité journalière est fixée à {{penalite_montant}} pendant {{penalite_delai}} jours. {{mention_litige}}\n{{mention_tribunal}}", 9),
  block('etat-lieux', 'État des lieux', "Un état des lieux contradictoire est établi à l'entrée et à la sortie. À défaut, la partie la plus diligente peut le faire dresser conformément aux règles applicables.", 10),
  block('caution-sortie', 'Caution et remise en état', "À la sortie, les sommes justifiées au titre des réparations locatives, consommations ou impayés peuvent être retenues sur la garantie, avec justificatifs.", 11),
  block('domicile', 'Élection de domicile', "Pour l'exécution du contrat, les parties élisent domicile aux adresses déclarées dans le présent document.", 12),
  block('frais', 'Frais et procédure', "{{mention_frais_huissier}} Le montant indicatif configuré est de {{frais_huissier}}.", 13),
  block('signature', 'Signatures', 'Fait à {{agency_city}}, le {{date_du_jour}}, en deux exemplaires originaux.', 14, { kind: 'signature', locked: true, required: true }),
];

const mandateBlocks: DocumentTemplateBlock[] = [
  block('parties', 'Entre les parties', "M. {{bailleur_prenom}} {{bailleur_nom}}, pièce n° {{bailleur_cni}}, domicilié à {{bailleur_adresse}}, ci-après le mandant ;\nEt {{agency_name}}, sise {{agency_address}}, NINEA {{agency_ninea}}, RCCM {{agency_rc}}, représentée par {{agency_manager_full_name}}, {{agency_manager_title}}, ci-après le mandataire.", 0, { kind: 'paragraph', locked: true, required: true }),
  block('objet', 'Objet du mandat', 'Le mandant confie au mandataire {{bien_description}}.', 1),
  block('duree', 'Durée', 'Le mandat prend effet le {{date_debut}} pour {{duree_annees}} an(s), renouvelable selon les conditions prévues entre les parties.', 2),
  block('honoraires', 'Honoraires de gestion', "Les honoraires du mandataire sont fixés à {{taux_honoraires}} % des sommes encaissées au titre de la gestion, selon les conditions convenues.", 3),
  block('missions', 'Missions du mandataire', "Le mandataire assure la mise en location, la perception des loyers, le suivi administratif, documentaire, juridique et technique du bien dans la limite des pouvoirs confiés.", 4),
  block('pouvoirs', 'Pouvoirs confiés', "Le mandataire peut rédiger les actes de location, réaliser les états des lieux, percevoir les loyers, engager les diligences utiles et mandater les prestataires nécessaires à la conservation du bien.", 5),
  block('reversement', 'Reversement au mandant', "Les sommes nettes dues au mandant sont reversées selon la périodicité convenue, accompagnées d'un relevé de gestion.", 6),
  block('mentions', 'Recouvrement et litiges', '{{mention_penalites}}\n{{mention_frais_huissier}}\n{{mention_tribunal}}', 7),
  block('signature', 'Signatures', 'Fait à {{agency_city}}, le {{date_du_jour}}.', 8, { kind: 'signature', locked: true, required: true }),
];

const receiptBlocks: DocumentTemplateBlock[] = [
  block('summary', 'Résumé du règlement', '', 0, { kind: 'system', systemKey: 'payment_summary', locked: true, required: true }),
  block('tenant', 'Locataire', '', 1, { kind: 'system', systemKey: 'tenant_identity' }),
  block('property', 'Bien et unité', '', 2, { kind: 'system', systemKey: 'property_identity' }),
  block('breakdown', 'Détail financier', '', 3, { kind: 'system', systemKey: 'payment_breakdown' }),
  block('qr', 'Vérification QR', '', 4, { kind: 'system', systemKey: 'qr_verification' }),
  block('footer', 'Mention de quittance', "Cette quittance atteste le paiement enregistré pour la période indiquée, sous réserve des obligations prévues au bail.", 5, { kind: 'footer' }),
];

const reportBlocks: DocumentTemplateBlock[] = [
  block('owner', 'Synthèse bailleur', '', 0, { kind: 'system', systemKey: 'owner_summary', locked: true, required: true }),
  block('occupancy', 'Occupation', '', 1, { kind: 'system', systemKey: 'occupancy' }),
  block('collections', 'Encaissements', '', 2, { kind: 'system', systemKey: 'collections' }),
  block('expenses', 'Dépenses', '', 3, { kind: 'system', systemKey: 'expenses' }),
  block('commissions', 'Commissions', '', 4, { kind: 'system', systemKey: 'commissions' }),
  block('arrears', 'Reliquats', '', 5, { kind: 'system', systemKey: 'arrears' }),
  block('qr', 'Vérification QR', '', 6, { kind: 'system', systemKey: 'qr_verification' }),
];

const meta: Record<DocumentTemplateType, { title: string; description: string; blocks: DocumentTemplateBlock[] }> = {
  contrat: { title: 'Contrat de location', description: 'Articles, clauses et signatures du bail.', blocks: contractBlocks },
  mandat: { title: 'Mandat de gérance', description: 'Pouvoirs, honoraires et obligations du mandat.', blocks: mandateBlocks },
  quittance: { title: 'Quittance de loyer', description: 'Preuve de règlement soldé et vérifiable.', blocks: receiptBlocks },
  facture: { title: 'Facture de loyer', description: 'Situation partielle ou somme restant due.', blocks: receiptBlocks },
  rapport_bailleur: { title: 'Rapport bailleur', description: 'Synthèse de gestion destinée au propriétaire.', blocks: reportBlocks },
  rapport_proprietaire: { title: 'Rapport propriétaire', description: 'Synthèse simplifiée du portefeuille individuel.', blocks: reportBlocks },
};

export function getOfficialDocumentTemplate(documentType: DocumentTemplateType): DocumentTemplateContent {
  const definition = meta[documentType];
  return {
    schemaVersion: 1,
    documentType,
    title: definition.title,
    description: definition.description,
    style: {
      density: 'compact',
      header: 'sobriete',
      showLogo: true,
      showQr: true,
      showDocumentNumber: true,
      showSignature: false,
      showStamp: false,
    },
    blocks: definition.blocks.map((item) => ({ ...item })),
  };
}

export function getTemplateTags(documentType: DocumentTemplateType) {
  return TEMPLATE_TAG_CATALOG.filter((tag) => tag.documentTypes.includes(documentType));
}
