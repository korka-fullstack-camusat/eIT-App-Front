import axios from "axios";
import type {
  Materiel, Attribution, NumeroSIM, SiteGSM, Vehicule,
  AffectationSIM, FactureTelecom, ImportResult, Employee,
} from "../types";

const BASE = "/api";
const ax = axios.create({ baseURL: BASE });

// ── Matériels ─────────────────────────────────────────────────────────────────
export const materielService = {
  getAll:   (params?: { statut?: string; search?: string }) => ax.get<Materiel[]>("/materiels", { params }).then(r => r.data),
  get:      (id: number)    => ax.get<Materiel>(`/materiels/${id}`).then(r => r.data),
  create:   (data: any)     => ax.post<Materiel>("/materiels", data).then(r => r.data),
  update:   (id: number, data: any) => ax.patch<Materiel>(`/materiels/${id}`, data).then(r => r.data),
  delete:   (id: number)    => ax.delete(`/materiels/${id}`),
  stats:       ()           => ax.get("/materiels/stats/summary").then(r => r.data),
  statsByType: ()           => ax.get("/materiels/stats/par-type").then(r => r.data),
  statsByBrand:()           => ax.get("/materiels/stats/par-marque").then(r => r.data),
  import:   (file: File)   => {
    const form = new FormData();
    form.append("file", file);
    return ax.post<{ created: number; errors: { ligne: number; message: string }[]; total_lignes: number }>(
      "/materiels/import", form, { headers: { "Content-Type": "multipart/form-data" } }
    ).then(r => r.data);
  },
};

// ── Attributions ──────────────────────────────────────────────────────────────
export const attributionService = {
  getAll:         (params?: { employee_id?: number; statut?: string }) =>
    ax.get<Attribution[]>("/attributions", { params }).then(r => r.data),
  getByEmployee:  (id: number) => ax.get<Attribution[]>(`/attributions/employee/${id}`).then(r => r.data),
  getByMateriel:  (id: number) => ax.get<Attribution[]>(`/attributions/materiel/${id}`).then(r => r.data),
  transferer:     (id: number, data: any) => ax.post(`/attributions/${id}/transferer`, data).then(r => r.data),
  create:         (data: any)  => ax.post<Attribution>("/attributions", data).then(r => r.data),
  update:         (id: number, data: any) =>
    ax.patch<Attribution>(`/attributions/${id}`, data).then(r => r.data),
  restituer:      (id: number, data: any) =>
    ax.post<Attribution>(`/attributions/${id}/restitution`, data).then(r => r.data),
  stats:           ()           => ax.get("/attributions/stats/summary").then(r => r.data),
  dechargeUrl:     (id: number) => `${BASE}/attributions/${id}/decharge`,
  attestationUrl:  (employeeId: number) => `${BASE}/attributions/attestation/employee/${employeeId}`,
};

// ── Téléphonie ────────────────────────────────────────────────────────────────
export const simService = {
  getAll:    (params?: { categorie?: string; statut?: string; search?: string }) =>
    ax.get<NumeroSIM[]>("/telephonie/sims", { params }).then(r => r.data),
  create:    (data: any)          => ax.post<NumeroSIM>("/telephonie/sims", data).then(r => r.data),
  update:    (id: number, data: any) => ax.patch<NumeroSIM>(`/telephonie/sims/${id}`, data).then(r => r.data),
  delete:    (id: number)         => ax.delete(`/telephonie/sims/${id}`),
  affecter:  (id: number, data: any) =>
    ax.post<AffectationSIM>(`/telephonie/sims/${id}/affecter`, data).then(r => r.data),
  historique: (id: number)        => ax.get<AffectationSIM[]>(`/telephonie/sims/${id}/historique`).then(r => r.data),
};

export const siteService = {
  getAll:  () => ax.get<SiteGSM[]>("/telephonie/sites").then(r => r.data),
  create:  (data: any) => ax.post<SiteGSM>("/telephonie/sites", data).then(r => r.data),
  update:  (id: number, data: any) => ax.patch<SiteGSM>(`/telephonie/sites/${id}`, data).then(r => r.data),
  delete:  (id: number) => ax.delete(`/telephonie/sites/${id}`),
};

export const vehiculeService = {
  getAll:  () => ax.get<Vehicule[]>("/telephonie/vehicules").then(r => r.data),
  create:  (data: any) => ax.post<Vehicule>("/telephonie/vehicules", data).then(r => r.data),
  update:  (id: number, data: any) => ax.patch<Vehicule>(`/telephonie/vehicules/${id}`, data).then(r => r.data),
  delete:  (id: number) => ax.delete(`/telephonie/vehicules/${id}`),
};

// ── Factures ──────────────────────────────────────────────────────────────────
export const factureService = {
  getAll:       (params?: { annee?: number }) =>
    ax.get<FactureTelecom[]>("/factures", { params }).then(r => r.data),
  get:          (id: number) => ax.get<FactureTelecom>(`/factures/${id}`).then(r => r.data),
  importer:     (file: File, meta: { mois: number; annee: number; operateur?: string; notes?: string }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("mois", String(meta.mois));
    form.append("annee", String(meta.annee));
    if (meta.operateur) form.append("operateur", meta.operateur);
    if (meta.notes)     form.append("notes", meta.notes);
    return ax.post<ImportResult>("/factures/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  delete:       (id: number) => ax.delete(`/factures/${id}`),
  statsMensuel: (annee: number) => ax.get("/factures/stats/mensuel", { params: { annee } }).then(r => r.data),
};

// ── Employés (proxy eRh-App) ──────────────────────────────────────────────────
export const employeeService = {
  search: (search: string, status = "ACTIVE") =>
    ax.get<Employee[]>("/employees", { params: { search, status } }).then(r => r.data),
  get: (matricule: number) =>
    ax.get<Employee>(`/employees/${matricule}`).then(r => r.data),
};
