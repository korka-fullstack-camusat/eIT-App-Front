import axios from "axios";
import type {
  Materiel, Attribution, NumeroSIM, SiteGSM, Vehicule,
  AffectationSIM, FactureTelecom, ImportResult, Employee,
} from "../types";

const BASE = "/api";
const ax = axios.create({ baseURL: BASE });

// Attache automatiquement le token JWT à chaque requête
ax.interceptors.request.use(config => {
  const token = localStorage.getItem("parc_it_token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gestion globale des erreurs 403 (lecture seule)
ax.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 403) {
      const detail = err.response.data?.detail || "Action non autorisée pour votre compte.";
      import("react-hot-toast").then(({ default: toast }) => toast.error(detail));
    }
    return Promise.reject(err);
  }
);

// ── Matériels ─────────────────────────────────────────────────────────────────
export const materielService = {
  getAll:   (params?: { statut?: string; type_materiel?: string; etat?: string; projet?: string; assigne?: string; search?: string }) => ax.get<Materiel[]>("/materiels/", { params }).then(r => r.data),
  get:      (id: number)    => ax.get<Materiel>(`/materiels/${id}`).then(r => r.data),
  create:   (data: any)     => ax.post<Materiel>("/materiels/", data).then(r => r.data),
  update:   (id: number, data: any) => ax.patch<Materiel>(`/materiels/${id}`, data).then(r => r.data),
  delete:   (id: number)    => ax.delete(`/materiels/${id}`),
  stats:       ()           => ax.get("/materiels/stats/summary").then(r => r.data),
  statsByType: ()           => ax.get("/materiels/stats/par-type").then(r => r.data),
  statsByBrand:()           => ax.get("/materiels/stats/par-marque").then(r => r.data),
  statsByProjet:()          => ax.get("/materiels/stats/par-projet").then(r => r.data),
  exportExcel: async (params: {
    statut?: string; type_materiel?: string; etat?: string; search?: string;
    date_debut?: string; date_fin?: string; cols?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.statut)        q.set("statut",        params.statut);
    if (params.type_materiel) q.set("type_materiel", params.type_materiel);
    if (params.etat)          q.set("etat",          params.etat);
    if (params.search)        q.set("search",        params.search);
    if (params.date_debut)    q.set("date_debut",    params.date_debut);
    if (params.date_fin)      q.set("date_fin",      params.date_fin);
    if (params.cols)          q.set("cols",          params.cols);
    const resp = await ax.get(`/materiels/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([resp.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href  = url;
    let fname  = "materiels";
    if (params.date_debut) fname += `_du_${params.date_debut}`;
    if (params.date_fin)   fname += `_au_${params.date_fin}`;
    link.setAttribute("download", `${fname}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
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
    ax.get<Attribution[]>("/attributions/", { params }).then(r => r.data),
  getByEmployee:  (id: number) => ax.get<Attribution[]>(`/attributions/employee/${id}`).then(r => r.data),
  getByMateriel:  (id: number) => ax.get<Attribution[]>(`/attributions/materiel/${id}`).then(r => r.data),
  transferer:     (id: number, data: any) => ax.post(`/attributions/${id}/transferer`, data).then(r => r.data),
  create:         (data: any)  => ax.post<Attribution>("/attributions/", data).then(r => r.data),
  update:         (id: number, data: any) =>
    ax.patch<Attribution>(`/attributions/${id}`, data).then(r => r.data),
  restituer:      (id: number, data: any) =>
    ax.post<Attribution>(`/attributions/${id}/restitution`, data).then(r => r.data),
  stats:           ()           => ax.get("/attributions/stats/summary").then(r => r.data),
  dechargeUrl:     (id: number) => `${BASE}/templates/decharge/${id}`,
  attestationUrl:  (employeeId: number) => `${BASE}/templates/attestation/employee/${employeeId}`,
  exportExcel: async (params?: { date_debut?: string; date_fin?: string; statut?: string; cols?: string }) => {
    const q = new URLSearchParams();
    if (params?.date_debut) q.set("date_debut", params.date_debut);
    if (params?.date_fin)   q.set("date_fin",   params.date_fin);
    if (params?.statut)     q.set("statut",     params.statut);
    if (params?.cols)       q.set("cols",       params.cols);
    const response = await ax.get(`/attributions/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([response.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href  = url;
    let fname  = "attributions";
    if (params?.date_debut) fname += `_du_${params.date_debut}`;
    if (params?.date_fin)   fname += `_au_${params.date_fin}`;
    link.setAttribute("download", `${fname}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  exportCsv: async (params?: { date_debut?: string; date_fin?: string; statut?: string }) => {
    const q = new URLSearchParams();
    if (params?.date_debut) q.set("date_debut", params.date_debut);
    if (params?.date_fin)   q.set("date_fin",   params.date_fin);
    if (params?.statut)     q.set("statut",     params.statut);
    const response = await ax.get(`/attributions/export?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    const suffix = (params?.date_debut ? `_${params.date_debut}` : "") + (params?.date_fin ? `_au_${params.date_fin}` : "");
    link.setAttribute("download", `attributions${suffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  exportWithTemplate: async (
    file: File,
    params?: { date_debut?: string; date_fin?: string; statut?: string },
  ) => {
    const q = new URLSearchParams();
    if (params?.date_debut) q.set("date_debut", params.date_debut);
    if (params?.date_fin)   q.set("date_fin",   params.date_fin);
    if (params?.statut)     q.set("statut",     params.statut);
    const form = new FormData();
    form.append("file", file);
    const response = await ax.post(`/attributions/export-template?${q.toString()}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    });
    const url  = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "attributions_filled.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

// ── Téléphonie ────────────────────────────────────────────────────────────────
export const simService = {
  getAll:    (params?: { categorie?: string; statut?: string; search?: string }) =>
    ax.get<NumeroSIM[]>("/telephonie/sims", { params }).then(r => r.data),
  create:    (data: any)          => ax.post<NumeroSIM>("/telephonie/sims", data).then(r => r.data),
  update:    (id: number, data: any) => ax.patch<NumeroSIM>(`/telephonie/sims/${id}`, data).then(r => r.data),
  delete:    (id: number)         => ax.delete(`/telephonie/sims/${id}`),
  affecter:    (id: number, data: any) =>
    ax.post<AffectationSIM>(`/telephonie/sims/${id}/affecter`, data).then(r => r.data),
  desaffecter: (id: number, motif?: string) =>
    ax.patch<AffectationSIM>(`/telephonie/sims/${id}/desaffecter`, { motif: motif || null }).then(r => r.data),
  historique:  (id: number) => ax.get<AffectationSIM[]>(`/telephonie/sims/${id}/historique`).then(r => r.data),
  exportExcel: async (params?: { categorie?: string; statut?: string; search?: string; cols?: string }) => {
    const q = new URLSearchParams();
    if (params?.categorie) q.set("categorie", params.categorie);
    if (params?.statut)    q.set("statut",    params.statut);
    if (params?.search)    q.set("search",    params.search);
    if (params?.cols)      q.set("cols",      params.cols);
    const resp = await ax.get(`/telephonie/sims/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([resp.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href  = url; link.setAttribute("download", "numeros_sim.xlsx");
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  },
  exportCsv: async (params?: { categorie?: string; statut?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.categorie) q.set("categorie", params.categorie);
    if (params?.statut)    q.set("statut",    params.statut);
    if (params?.search)    q.set("search",    params.search);
    const response = await ax.get(`/telephonie/sims/export?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "numeros_sim.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  importSims: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return ax.post<{ created: number; updated: number; errors: { ligne: number; message: string }[]; total_lignes: number }>(
      "/telephonie/sims/import", form, { headers: { "Content-Type": "multipart/form-data" } }
    ).then(r => r.data);
  },
};

export const siteService = {
  getAll:  (params?: { search?: string }) =>
    ax.get<SiteGSM[]>("/telephonie/sites", { params }).then(r => r.data),
  create:  (data: any) => ax.post<SiteGSM>("/telephonie/sites", data).then(r => r.data),
  update:  (id: number, data: any) => ax.patch<SiteGSM>(`/telephonie/sites/${id}`, data).then(r => r.data),
  delete:  (id: number) => ax.delete(`/telephonie/sites/${id}`),
  exportCsv: async () => {
    const response = await ax.get("/telephonie/sites/export", { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sites_rms.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  exportExcel: async (params?: { filter_sim?: string; search?: string; cols?: string; date_debut?: string; date_fin?: string }) => {
    const q = new URLSearchParams();
    if (params?.filter_sim)  q.set("filter_sim",  params.filter_sim);
    if (params?.search)      q.set("search",      params.search);
    if (params?.cols)        q.set("cols",         params.cols);
    if (params?.date_debut)  q.set("date_debut",  params.date_debut);
    if (params?.date_fin)    q.set("date_fin",    params.date_fin);
    const resp = await ax.get(`/telephonie/sites/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([resp.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    let fname = "sites_rms";
    if (params?.date_debut) fname += `_du_${params.date_debut}`;
    if (params?.date_fin)   fname += `_au_${params.date_fin}`;
    link.href = url; link.setAttribute("download", `${fname}.xlsx`);
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  },
  importSites: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return ax.post<{ created: number; updated: number; affecte?: number; sims_crees?: number; errors: { ligne: number; message: string }[]; total_lignes: number }>(
      "/telephonie/sites/import", form, { headers: { "Content-Type": "multipart/form-data" } }
    ).then(r => r.data);
  },
  facturation: (id: number) =>
    ax.get<{ sim_numero: string | null; lignes: { mois: number; annee: number; operateur: string | null; montant: number | null; montant_ttc: number | null }[] }>(
      `/telephonie/sites/${id}/facturation`
    ).then(r => r.data),
};

export const vehiculeService = {
  getAll:  () => ax.get<Vehicule[]>("/telephonie/vehicules").then(r => r.data),
  create:  (data: any) => ax.post<Vehicule>("/telephonie/vehicules", data).then(r => r.data),
  update:  (id: number, data: any) => ax.patch<Vehicule>(`/telephonie/vehicules/${id}`, data).then(r => r.data),
  delete:  (id: number) => ax.delete(`/telephonie/vehicules/${id}`),
  exportCsv: async () => {
    const response = await ax.get("/telephonie/vehicules/export", { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "vehicules.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  exportExcel: async (params?: { filter_sim?: string; search?: string; cols?: string; date_debut?: string; date_fin?: string }) => {
    const q = new URLSearchParams();
    if (params?.filter_sim)  q.set("filter_sim",  params.filter_sim);
    if (params?.search)      q.set("search",      params.search);
    if (params?.cols)        q.set("cols",         params.cols);
    if (params?.date_debut)  q.set("date_debut",  params.date_debut);
    if (params?.date_fin)    q.set("date_fin",    params.date_fin);
    const resp = await ax.get(`/telephonie/vehicules/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([resp.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    let fname = "vehicules";
    if (params?.date_debut) fname += `_du_${params.date_debut}`;
    if (params?.date_fin)   fname += `_au_${params.date_fin}`;
    link.href = url; link.setAttribute("download", `${fname}.xlsx`);
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  },
  importVehicules: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return ax.post<{ created: number; updated: number; errors: { ligne: number; message: string }[]; total_lignes: number }>(
      "/telephonie/vehicules/import", form, { headers: { "Content-Type": "multipart/form-data" } }
    ).then(r => r.data);
  },
};

// ── Factures ──────────────────────────────────────────────────────────────────
export const factureService = {
  getAll:       (params?: { annee?: number }) =>
    ax.get<FactureTelecom[]>("/factures/", { params }).then(r => r.data),
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
  exportExcel: async (params?: { annee?: number; mois?: number }) => {
    const q = new URLSearchParams();
    if (params?.annee) q.set("annee", String(params.annee));
    if (params?.mois)  q.set("mois",  String(params.mois));
    const resp = await ax.get(`/factures/export-excel?${q.toString()}`, { responseType: "blob" });
    const url  = URL.createObjectURL(new Blob([resp.data],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `factures_${params?.annee ?? "all"}${params?.mois ? `_${String(params.mois).padStart(2,"0")}` : ""}.xlsx`);
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  },
  statsMensuel: (annee: number) => ax.get("/factures/stats/mensuel", { params: { annee } }).then(r => r.data),
};

// ── Templates Word ────────────────────────────────────────────────────────────
export const templateService = {
  getInfo: () => ax.get<Record<string, {
    uploaded: boolean; size_kb?: number; placeholders: string[];
  }>>("/templates/info").then(r => r.data),

  upload: async (docType: "attestation" | "decharge", file: File) => {
    const form = new FormData();
    form.append("file", file);
    return ax.post<{ message: string; filename: string; placeholders: string[] }>(
      `/templates/${docType}/upload`, form,
      { headers: { "Content-Type": "multipart/form-data" } }
    ).then(r => r.data);
  },

  delete: (docType: "attestation" | "decharge") =>
    ax.delete(`/templates/${docType}`).then(r => r.data),

  attestationUrl:  (employeeId: number)   => `${BASE}/templates/attestation/employee/${employeeId}`,
  dechargeUrl:     (attributionId: number) => `${BASE}/templates/decharge/${attributionId}`,
};

// ── Employés (proxy eRh-App) ──────────────────────────────────────────────────
export const employeeService = {
  search: (search: string, status = "ACTIVE") =>
    ax.get<Employee[]>("/employees/", { params: { search, status } }).then(r => r.data),
  get: (matricule: number) =>
    ax.get<Employee>(`/employees/${matricule}`).then(r => r.data),
};
