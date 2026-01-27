export interface ContratData {
  agence: {
    nom: string;
    adresse: string;
    telephone: string;
    email: string;
    site_web?: string;
    ninea?: string;
    rc?: string;
    representant_nom?: string;
    representant_fonction?: string;
    manager_id_type?: string;
    manager_id_number?: string;
    city?: string;
    logo_url?: string;
    couleur_primaire?: string;
    couleur_secondaire?: string;
    mention_tribunal?: string;
    mention_penalites?: string;
    pied_page?: string;
    frais_huissier?: number;
  };
  bailleur: {
    prenom: string;
    nom: string;
    cni: string;
    adresse: string;
  };
  locataire: {
    prenom: string;
    nom: string;
    cni: string;
    adresse: string;
  };
  bien: {
    adresse: string;
    designation: string;
    destination: string;
  };
  contrat: {
    duree_annees: number;
    date_debut: string;
    date_fin?: string;
    loyer_mensuel: number;
    loyer_lettres: string;
    depot_garantie: number;
    depot_lettres: string;
    date_du_jour: string;
  };
}

export function generateContratText(data: ContratData): string {
  const representant = data.agence.representant_nom || 'Le Représentant';
  const fonction = data.agence.representant_fonction || 'Gérant';
  const managerIdType = data.agence.manager_id_type || 'CNI';
  const managerIdNumber = data.agence.manager_id_number || '';
  const city = data.agence.city || 'Dakar';
  const tribunal = data.agence.mention_tribunal || 'Tribunal de commerce de Dakar';
  const penalites = data.agence.mention_penalites ||
    "À défaut de paiement d'un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours), des pénalités qui s'élèvent à 1000 FCFA par jour de retard seront appliquées pendant 03 jours. Passé ce délai, la procédure judiciaire sera enclenchée.";
  const fraisHuissier = data.agence.frais_huissier || 37500;

  const managerIdentity = managerIdNumber
    ? `${managerIdType} n° ${managerIdNumber}`
    : managerIdType;

  return `
CONTRAT DE LOCATION

Entre les soussignés :
M. ${data.bailleur.prenom} ${data.bailleur.nom} (Propriétaire), représenté(e) par M. ${representant}, ${fonction} de ${data.agence.nom}, ${managerIdentity}, mandataire, d'une part;
Et M./Mme ${data.locataire.prenom} ${data.locataire.nom} (Locataire), Pièce d'identité (CNI) ou Passeport n° ${data.locataire.cni}, demeurant à ${data.locataire.adresse}, d'autre part.

Il a été arrêté et convenu ce qui suit :
Le bailleur louant le local ci-après désigné au locataire qui les accepte aux conditions suivantes.
Le locataire déclare bien connaître les lieux loués pour les avoir visités.

DÉSIGNATION : ${data.bien.designation}
DESTINATION DU LOCAL : ${data.bien.destination}

DISPOSITIONS GÉNÉRALES

ARTICLE 1 : DURÉE DU CONTRAT
Le présent contrat est consenti pour une durée de ${data.contrat.duree_annees} an(s), commençant à courir le ${data.contrat.date_debut} et se terminant le ${data.contrat.date_fin || 'à déterminer'} sous réserve de reconduction ou de renouvellement.
NB : Un mois entamé est un mois dû.

ARTICLE 2 : CONGÉ
Le congé doit être signifié par lettre recommandée avec accusé de réception. Il peut être délivré à tout moment par le locataire en respectant un préavis de deux mois courant à compter de la réception de la lettre.

ARTICLE 3 : ABANDON DU DOMICILE
Le contrat est résilié de plein droit par l'abandon de domicile du locataire.

ARTICLE 4 : OBLIGATIONS DU BAILLEUR
1) Délivrer le logement en bon état d'usage et de réparation.
2) Délivrer les éléments d'équipement en bon état de fonctionnement.
3) Maintenir les locaux en état de servir à l'usage prévu par le contrat en effectuant les réparations autres que locatives.
4) Ne pas s'opposer aux aménagements réalisés par le locataire dès lors qu'ils n'entraînent pas une transformation du local.

ARTICLE 5 : OBLIGATIONS DU LOCATAIRE
1) Payer le loyer et les charges récupérables aux termes convenus.
2) Payer les frais d'enregistrement du contrat, d'eau et d'électricité ainsi que toutes les charges incombant au locataire.
3) Répondre des dégradations ou des pertes.
4) Prendre à sa charge l'entretien courant du logement et des équipements.
5) Ne faire aucun changement sans accord écrit du mandataire.
6) Interdiction de sous-location ou cession sans autorisation.
7) Informer immédiatement le mandataire des changements et sinistres.
8) Laisser exécuter les travaux nécessaires.
9) Laisser visiter le logement dans les conditions prévues.
10) Respecter le règlement de l'immeuble.
11) Recourir au mandataire en cas d'incident.
12) Satisfaire à toutes les charges de ville ou de police habituelles.

ARTICLE 6 : MONTANT DU LOYER
Le montant du loyer initial est fixé à la somme de ${data.contrat.loyer_mensuel.toLocaleString('fr-FR')} FCFA (${data.contrat.loyer_lettres}).
Le loyer est payé mensuellement d'avance avant le 05 du mois, chez le mandataire.

ARTICLE 7 : DÉPÔT DE GARANTIE
Le dépôt de garantie est fixé à la somme de ${data.contrat.depot_garantie.toLocaleString('fr-FR')} FCFA (${data.contrat.depot_lettres}) correspondant à un mois de loyer payé d'avance et un mois de caution.

ARTICLE 8 : PÉNALITÉS
${penalites}

Il est expressément convenu qu'en cas de litige, les frais d'huissier, d'expertises et d'honoraires d'avocat, qui auraient été engagés par le bailleur et ce sur pièces justificatives, seront remboursés par le locataire.
Avec attribution exclusive de juridiction au ${tribunal}.

ARTICLE 9 : ÉTAT DES LIEUX
À défaut d'état des lieux contradictoire, la partie la plus diligente peut le faire dresser par huissier.

ARTICLE 10 : CAUTION ET REMISE EN ÉTAT
À la sortie du locataire, une partie de la caution servira au rafraîchissement de la peinture. Les autres corps d'état seront vérifiés et remplacés en cas de défaillance; les factures impayées d'eau/électricité seront défalquées de la caution.

ARTICLE 11 : ÉLECTION DE DOMICILE
Pour l'exécution des obligations, le bailleur fait élection de domicile en sa demeure et le locataire dans les lieux loués.

ARTICLE 12 : IMPORTANT
En cas de non-paiement du loyer dans les délais impartis, une somme de ${fraisHuissier.toLocaleString('fr-FR')} FCFA est prélevée sur la caution pour les frais d'huissier afin d'assignation en expulsion, conformément à la loi sénégalaise.

Fait à ${city}, le ${data.contrat.date_du_jour} en deux originaux.

Le Locataire                                                Le Mandataire
(Signature)                                                 (Signature)
                                                            ${data.agence.nom}


${data.agence.pied_page || ''}
`;
}
