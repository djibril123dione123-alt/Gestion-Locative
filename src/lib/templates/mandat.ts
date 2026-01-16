export interface MandatData {
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
    logo_url?: string;
    couleur_primaire?: string;
    couleur_secondaire?: string;
    mention_tribunal?: string;
    pied_page?: string;
  };
  bailleur: {
    prenom: string;
    nom: string;
    cni: string;
    adresse: string;
  };
  bien: {
    adresse: string;
    composition: string;
  };
  mandat: {
    date_debut: string;
    taux_honoraires: number;
    date_du_jour: string;
  };
}

export function generateMandatText(data: MandatData): string {
  const representant = data.agence.representant_nom || 'Le Représentant';
  const fonction = data.agence.representant_fonction || 'Gérant';
  const tribunal = data.agence.mention_tribunal || 'Tribunal de commerce de Dakar';
  const ninea = data.agence.ninea ? `NINEA : ${data.agence.ninea}` : '';
  const rc = data.agence.rc ? `RC : ${data.agence.rc}` : '';
  const identification = [ninea, rc].filter(Boolean).join(' / ');

  return `
MANDAT DE GÉRANCE

Entre :
M./Mme ${data.bailleur.prenom} ${data.bailleur.nom}, carte d'identité/passeport n° ${data.bailleur.cni}, (Propriétaire), domicilié(e) à ${data.bailleur.adresse}, d'une part ;

Et la société ${data.agence.nom}, domiciliée à ${data.agence.adresse}${identification ? ', ' + identification : ''}, représentée par M./Mme ${representant}, ${fonction}, d'autre part.

Objet du mandat : Le propriétaire confie à ${data.agence.nom} la gestion complète de son bien immobilier sis à ${data.bien.adresse} composé de ${data.bien.composition} dans son état actuel à la remise des clés.

Durée : Le mandat est conclu à compter du ${data.mandat.date_debut} pour une durée de 3 ans, renouvelable par tacite reconduction. Chaque partie peut y mettre fin par LRAR six (6) mois avant l'échéance.

Conditions principales :
1) L'agence percevra à titre d'honoraires un taux de ${data.mandat.taux_honoraires}% des sommes mensuellement encaissées.
2) Elle assure la perception des loyers, la rédaction des contrats, et le suivi juridique et technique des biens.
3) Elle peut représenter le propriétaire dans toute action judiciaire ou extrajudiciaire liée à la gestion.
4) En cas de litige, le ${tribunal} est seul compétent.

Pouvoirs donnés à l'agence :
- Louer par écrit, renouveler ou résilier les locations, dresser état des lieux, exiger les réparations locatives
- Donner et accepter congés ;
- Percevoir les loyers et les verser au propriétaire le 10 de chaque mois ;
- Exercer toutes actions judiciaires/extra-judiciaires nécessaires ;
- Entretenir l'immeuble/appartement, passer marchés, choisir prestataires en cas d'urgence ;
- Conclure/modifier/résilier les abonnements ;
- TOM et taxes d'ordures à la charge du propriétaire ; autres déclarations fiscales à sa charge.

Mentions supplémentaires : En cas d'assignation en expulsion d'un locataire, les frais d'huissier sont prélevés sur la caution du locataire.

Fait à Dakar, le ${data.mandat.date_du_jour}

Le Propriétaire                                            Le Manager ${data.agence.nom}
(Signature)                                                (Signature et cachet)


${data.agence.pied_page || ''}
`;
}
