// ── Matériels ─────────────────────────────────────────────────────────────────

export type TypeMateriel =
  | "ORDINATEUR_PORTABLE" | "ORDINATEUR_FIXE" | "ECRAN" | "SOURIS"
  | "CLAVIER" | "TELEPHONE" | "TABLETTE" | "IMPRIMANTE" | "SWITCH" | "ROUTEUR"
  | "ONDULEUR" | "AUTRE";

export type EtatMateriel  = "NEUF" | "BON" | "USAGE" | "DEFECTUEUX";
export type StatutMateriel = "DISPONIBLE" | "ATTRIBUE" | "MAINTENANCE" | "EN_PANNE" | "REFORME";

export interface AttributionActiveInfo {
  employee_nom:       string;
  employee_prenom:    string | null;
  employee_matricule: string | null;
  employee_service:   string | null;
  employee_poste:     string | null;
}

export interface Materiel {
  id:                 number;
  type_materiel:      TypeMateriel;
  marque:             string;
  modele:             string | null;
  numero_serie:       string | null;
  adresse_mac:        string | null;
  reference:          string | null;
  numero_bon_cmd:     string | null;
  projet:             string | null;
  beneficiaire_matricule: string | null;
  beneficiaire_nom:       string | null;
  beneficiaire_prenom:    string | null;
  etat:               EtatMateriel;
  statut:             StatutMateriel;
  date_acquisition:   string | null;
  description:        string | null;
  created_at:         string;
  attribution_active: AttributionActiveInfo | null;
}

// ── Attributions ──────────────────────────────────────────────────────────────

export type StatutAttribution = "ACTIVE" | "CLOTUREE";
export type MotifRestitution  = "DEPART" | "CHANGEMENT" | "PANNE" | "FIN_CONTRAT" | "AUTRE";

export interface Attribution {
  id:                 number;
  materiel_id:        number;
  materiel:           Materiel | null;
  employee_id:        number;
  employee_nom:       string;
  employee_prenom:    string | null;
  employee_matricule: string | null;
  employee_service:   string | null;
  employee_poste:     string | null;
  date_attribution:   string;
  etat_remise:        string | null;
  statut:             StatutAttribution;
  notes:              string | null;
  date_restitution:   string | null;
  motif_restitution:  MotifRestitution | null;
  notes_restitution:  string | null;
  created_at:         string;
}

// ── Téléphonie ────────────────────────────────────────────────────────────────

export type CategorieSIM = "EMPLOYE" | "M2M_SITE" | "M2M_VEHICULE";
export type StatutSIM    = "ACTIVE" | "INACTIVE" | "SUSPENDUE" | "RESILIE" | "CEDE";

export interface NumeroSIM {
  id:                 number;
  numero:             string;
  imsi:               string | null;
  categorie:          CategorieSIM;
  statut:             StatutSIM;
  operateur:          string | null;
  description:        string | null;
  matricule:          string | null;
  beneficiaire:       string | null;
  service:            string | null;
  business_line:      string | null;
  fonction:           string | null;
  forfait:            number | null;
  created_at:         string;
  affectation_active: AffectationSIM | null;
  derniere_facture:   DerniereFactureInfo | null;
}

export interface DerniereFactureInfo {
  mois:        number;
  annee:       number;
  operateur:   string | null;
  montant_ttc: number | null;
}

export interface SiteGSM {
  id:           number;
  code_site:    string | null;
  imsi:         string | null;
  nom:          string;
  localisation: string | null;
  created_at:   string;
  sim_numero:   string | null;
  sim_operateur: string | null;
  derniere_facture: DerniereFactureInfo | null;
}

export interface Vehicule {
  id:              number;
  immatriculation: string;
  marque:          string | null;
  modele:          string | null;
  imsi:            string | null;
  imei:            string | null;
  affectation:     string | null;
  created_at:      string;
  sim_numero:      string | null;
  sim_operateur:   string | null;
  statut_sim:      string | null;
  forfait:         number | null;
  derniere_facture: DerniereFactureInfo | null;
}

export interface AffectationSIM {
  id:                 number;
  sim_id:             number;
  date_debut:         string;
  date_fin:           string | null;
  is_active:          boolean;
  employee_id:        number | null;
  employee_nom:       string | null;
  employee_matricule: string | null;
  site_id:            number | null;
  vehicule_id:        number | null;
  motif_fin:          string | null;
  notes:              string | null;
  created_at:         string;
}

// ── Factures ──────────────────────────────────────────────────────────────────

export interface LigneFacture {
  id:          number;
  sim_id:      number | null;
  numero_raw:  string;
  montant:     string;
  non_reconnu: string;

  // Détail récapitulatif par numéro (extrait tel quel du fichier)
  reference_facture: string | null;
  montant_ht:        string | null;
  rutel:             string | null;
  montant_ht_rutel:  string | null;
  tva:               string | null;
  montant_ttc:       string | null;
  arrondi_precedent: string | null;
  arrondi_encours:   string | null;
  solde_facture:     string | null;
  type_ligne:        string | null;
}

export interface FactureTelecom {
  id:          number;
  mois:        number;
  annee:       number;
  operateur:   string | null;
  nom_fichier: string | null;
  notes:       string | null;
  created_at:  string;
  lignes:      LigneFacture[];

  // Récapitulatif facture (extrait du fichier importé)
  numero_compte:     string | null;
  reference_facture: string | null;
  montant_ht:        string | null;
  rutel:             string | null;
  montant_ht_rutel:  string | null;
  tva:               string | null;
  montant_ttc:       string | null;
  arrondi_precedent: string | null;
  arrondi_encours:   string | null;
  solde_facture:     string | null;

  // Écart vs mois précédent (calculé côté backend)
  ecart:     string | null;
  ecart_pct: number | null;
}

export interface ImportResult {
  facture_id:       number;
  total_lignes:     number;
  reconnus:         number;
  non_reconnus:     number;
  montant_total:    string;
  numeros_inconnus: string[];
}

// ── Employé (proxy eRh-App) ───────────────────────────────────────────────────

export interface Employee {
  id:            number;
  nom:           string;
  prenom:        string;
  matricule:     string;
  service:       string | null;
  fonction:      string | null;
  email:         string | null;
  status:        string | null;
  type_contrat:  string | null;
  business_line: string | null;
  manager:       string | null;
}
