import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Settings2, X, Link, Pencil, Trash2, Unlink,
  Upload, Download, FileText, CheckCircle2, Smartphone,
  Calendar, Search, ChevronLeft, ChevronRight, FileSpreadsheet, Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { simService, siteService, vehiculeService, employeeService } from "@/services/api";
import type { NumeroSIM, CategorieSIM, SiteGSM, Vehicule, Employee } from "@/types";

const CAT_LABELS: Record<CategorieSIM, string> = {
  EMPLOYE: "Employé", M2M_SITE: "M2M Site", M2M_VEHICULE: "M2M Véhicule",
};
const CAT_COLORS: Record<CategorieSIM, string> = {
  EMPLOYE: "bg-blue-100 text-blue-700",
  M2M_SITE: "bg-purple-100 text-purple-700",
  M2M_VEHICULE: "bg-emerald-100 text-emerald-700",
};
const STATUT_LABELS: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDUE: "Suspendue",
  RESILIE: "Résilié", CEDE: "Cédé",
};
const STATUT_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  INACTIVE:  "bg-gray-100 text-gray-500",
  SUSPENDUE: "bg-amber-100 text-amber-700",
  RESILIE:   "bg-red-100 text-red-700",
  CEDE:      "bg-purple-100 text-purple-700",
};

const PAGE_SIZE = 10;

// ── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number | string; color: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 min-w-[110px] rounded-2xl border p-4 flex flex-col items-center justify-center gap-0.5 transition select-none
        ${active ? `${color} border-transparent shadow-md scale-[1.03]` : "bg-white border-gray-100 hover:shadow-sm hover:border-gray-200"}
        ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <p className={`text-3xl font-black leading-none ${active ? "text-white" : "text-gray-800"}`}>{value}</p>
      <p className={`text-xs font-semibold mt-1 ${active ? "text-white/80" : "text-gray-400"}`}>{label}</p>
    </button>
  );
}

export default function SimsPage() {
  const { isViewer } = useAuth();
  const [sims,    setSims]    = useState<NumeroSIM[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [cat,         setCat]         = useState("");
  const [statutFil,   setStatutFil]   = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Export ───────────────────────────────────────────────────────────────────
  const SIM_COLS = [
    { key: "numero",    label: "Numéro" },
    { key: "imsi",      label: "IMSI" },
    { key: "categorie", label: "Catégorie" },
    { key: "operateur", label: "Opérateur" },
    { key: "statut",    label: "Statut" },
    { key: "affecte",   label: "Affecté à" },
    { key: "matricule", label: "Matricule" },
    { key: "date_aff",  label: "Date affectation" },
    { key: "desc",      label: "Description" },
  ] as const;
  type SimColKey = (typeof SIM_COLS)[number]["key"];

  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportCols,    setExportCols]    = useState<Set<SimColKey>>(new Set(SIM_COLS.map(c => c.key)));
  const toggleCol = (k: SimColKey) =>
    setExportCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [simModal,  setSimModal]  = useState(false);
  const [selected,  setSelected]  = useState<NumeroSIM | null>(null);
  const [form,      setForm]      = useState<any>({ numero: "", imsi: "", categorie: "EMPLOYE", operateur: "", description: "" });
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [detailSim, setDetailSim] = useState<NumeroSIM | null>(null);
  const [gererSim,  setGererSim]  = useState<NumeroSIM | null>(null);
  const [gererMode, setGererMode] = useState<"menu" | "affecter" | "desaffecter" | "modifier" | "supprimer">("menu");
  const [desaffMotif, setDesaffMotif] = useState("");
  const [sites,     setSites]     = useState<SiteGSM[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [employees, setEmps]      = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [affForm,   setAffForm]   = useState<any>({
    date_debut: new Date().toISOString().split("T")[0],
    employee_id: null, employee_nom: null, employee_matricule: null,
    site_id: null, vehicule_id: null, notes: "",
  });

  // ── Chargement ───────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    simService.getAll({
      categorie: cat    || undefined,
      statut:    statutFil || undefined,
      search:    search || undefined,
    }).then(setSims).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  }, [cat, statutFil, search]);

  useEffect(() => { load(); setPage(1); }, [cat, statutFil, search]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (gererMode === "affecter") {
      siteService.getAll().then(setSites).catch(() => {});
      vehiculeService.getAll().then(setVehicules).catch(() => {});
    }
  }, [gererMode]);

  useEffect(() => {
    if (empSearch.length < 2) { setEmps([]); return; }
    const t = setTimeout(() => employeeService.search(empSearch).then(setEmps).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  // ── Debounce search ──────────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearch(""); setSuggestions([]); setShowSuggest(false); return; }
    const lower = val.toLowerCase();
    const sugg = Array.from(new Set(
      sims.flatMap(s => [s.numero, s.operateur, s.description].filter(Boolean) as string[])
        .filter(s => s.toLowerCase().includes(lower))
    )).slice(0, 6);
    setSuggestions(sugg); setShowSuggest(sugg.length > 0);
    searchTimer.current = setTimeout(() => { setSearch(val); setShowSuggest(false); }, 300);
  };

  // ── Dérivations ──────────────────────────────────────────────────────────────
  const statsMap: Record<string, number> = {};
  sims.forEach(s => { statsMap[s.statut] = (statsMap[s.statut] || 0) + 1; });

  const totalPages = Math.max(1, Math.ceil(sims.length / PAGE_SIZE));
  const paginated  = sims.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openGerer = (s: NumeroSIM) => {
    setGererSim(s); setGererMode("menu");
    setAffForm({ date_debut: new Date().toISOString().split("T")[0],
      employee_id: null, employee_nom: null, employee_matricule: null,
      site_id: null, vehicule_id: null, notes: "" });
    setEmpSearch(""); setDesaffMotif("");
  };
  const closeGerer = () => { setGererSim(null); setGererMode("menu"); setDesaffMotif(""); };

  const handleSaveSim   = async () => {
    try {
      if (selected) await simService.update(selected.id, form);
      else await simService.create(form);
      toast.success(selected ? "Mis à jour" : "SIM créée");
      setSimModal(false); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleAffecter  = async () => {
    if (!gererSim) return;
    try { await simService.affecter(gererSim.id, affForm); toast.success("Affectation enregistrée"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleModifier  = async () => {
    if (!gererSim) return;
    try { await simService.update(gererSim.id, form); toast.success("Mis à jour"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleDesaffecter = async () => {
    if (!gererSim) return;
    try { await simService.desaffecter(gererSim.id, desaffMotif || undefined); toast.success("Désaffecté"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleSupprimer = async () => {
    if (!gererSim) return;
    try { await simService.delete(gererSim.id); toast.success("SIM supprimée"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await simService.importSims(importFile);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import"); }
    finally { setImportLoading(false); }
  };
  const closeImport = () => {
    setImportModal(false); setImportFile(null); setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Numéros SIM</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : `${sims.length} numéro(s)`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} /><span>Exporter</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
          </button>
          {!isViewer && (
          <button onClick={() => { setImportResult(null); setImportFile(null); setImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} /><span>Importer</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.csv</span>
          </button>
          )}
          {!isViewer && (
          <button onClick={() => { setSelected(null); setForm({ numero: "", imsi: "", categorie: "EMPLOYE", operateur: "", description: "" }); setSimModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Ajouter SIM
          </button>
          )}
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Total" value={sims.length} color="bg-camublue-900"
          onClick={() => { setStatutFil(""); setCat(""); setSearchInput(""); setSearch(""); }}
          active={!statutFil && !cat && !search} />
        <StatCard label="Actives" value={statsMap["ACTIVE"] ?? 0} color="bg-emerald-500"
          onClick={() => setStatutFil(statutFil === "ACTIVE" ? "" : "ACTIVE")}
          active={statutFil === "ACTIVE"} />
        <StatCard label="Inactives" value={statsMap["INACTIVE"] ?? 0} color="bg-gray-500"
          onClick={() => setStatutFil(statutFil === "INACTIVE" ? "" : "INACTIVE")}
          active={statutFil === "INACTIVE"} />
      </div>

      {/* ── Filtres ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <div className="flex gap-3 flex-wrap items-center">

          {/* Barre de recherche avec suggestions */}
          <div ref={searchRef} className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {loading && searchInput ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
            ) : searchInput ? (
              <button onClick={() => { setSearchInput(""); setSearch(""); setSuggestions([]); setShowSuggest(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={14} />
              </button>
            ) : null}
            <input
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder="Rechercher un numéro, opérateur…"
              className="input-base pl-9 pr-8"
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} type="button"
                    onMouseDown={() => { setSearchInput(s); setSearch(s); setShowSuggest(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-camublue-900/5 text-left text-sm text-gray-700 border-b border-gray-50 last:border-0 transition">
                    <Search size={12} className="text-gray-300 shrink-0" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Séparateur */}
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Filtre Catégorie */}
          <div className="flex items-center gap-1.5 min-w-[160px]">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <select value={cat} onChange={e => { setCat(e.target.value); setPage(1); }}
              className="input-base py-2 flex-1 text-sm">
              <option value="">Toutes catégories</option>
              {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {/* Filtre Statut */}
          <select value={statutFil} onChange={e => { setStatutFil(e.target.value); setPage(1); }}
            className="input-base py-2 w-auto text-sm">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Numéro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Opérateur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : sims.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Aucun numéro SIM</td></tr>
            ) : paginated.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setDetailSim(s)}>
                <td className="px-4 py-3">
                  <p className="font-mono font-semibold text-gray-800">{s.numero}</p>
                  {s.affectation_active && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {s.affectation_active.employee_nom
                        ? `↳ ${s.affectation_active.employee_nom}`
                        : s.affectation_active.site_id ? `↳ Site #${s.affectation_active.site_id}`
                        : `↳ Véhicule #${s.affectation_active.vehicule_id}`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${CAT_COLORS[s.categorie]}`}>
                    {CAT_LABELS[s.categorie]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.operateur ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[s.statut] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUT_LABELS[s.statut] ?? s.statut}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!isViewer && (
                  <button onClick={e => { e.stopPropagation(); openGerer(s); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-xs font-semibold transition shadow-sm">
                    <Settings2 size={12} /> Gérer
                  </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            {sims.length === 0 ? "Aucun résultat"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sims.length)} sur ${sims.length} SIM(s)`}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={14} />
            </button>
            {(() => {
              const w = 2, start = Math.max(1, page - w), end = Math.min(totalPages, page + w);
              return (
                <>
                  {start > 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
                  {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                        n === page ? "bg-camublue-900 text-white shadow-sm" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}>{n}</button>
                  ))}
                  {end < totalPages && <span className="px-1 text-gray-300 text-xs">…</span>}
                </>
              );
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">»</button>
          </div>
          <p className="text-xs text-gray-400">Page <strong className="text-gray-700">{totalPages > 0 ? page : 0}</strong> / {totalPages}</p>
        </div>
      )}

      {/* ══ Modal Export Excel ════════════════════════════════════════════════ */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Exporter les SIM</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fichier Excel (.xlsx) · {sims.length} SIM(s) chargées</p>
              </div>
              <button onClick={() => setExportOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Colonnes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(new Set(SIM_COLS.map(c => c.key)))}
                      className="text-xs text-camublue-900 font-semibold hover:underline">Tout</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setExportCols(new Set())}
                      className="text-xs text-gray-400 hover:underline">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SIM_COLS.map(({ key, label }) => (
                    <label key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition text-sm
                        ${exportCols.has(key) ? "bg-camublue-900/5 border-camublue-900/20 text-camublue-900 font-semibold" : "border-gray-100 text-gray-400 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={exportCols.has(key)} onChange={() => toggleCol(key)}
                        className="accent-camublue-900 w-3.5 h-3.5 shrink-0" />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{exportCols.size} colonne(s) sélectionnée(s)</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setExportOpen(false)} disabled={exportLoading}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">Annuler</button>
                <button disabled={exportCols.size === 0 || exportLoading}
                  onClick={async () => {
                    setExportLoading(true);
                    try {
                      await simService.exportExcel({
                        categorie: cat || undefined,
                        statut: statutFil || undefined,
                        search: search || undefined,
                        cols: exportCols.size > 0 ? Array.from(exportCols).join(",") : undefined,
                      });
                      toast.success("Fichier Excel généré"); setExportOpen(false);
                    } catch { toast.error("Erreur lors de la génération"); }
                    finally { setExportLoading(false); }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                  {exportLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération…</>
                    : <><Download size={14} /> Télécharger .xlsx</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Détail SIM ═══════════════════════════════════════════════════ */}
      {detailSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailSim(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Smartphone size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold font-mono text-base">{detailSim.numero}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/60 text-xs">{CAT_LABELS[detailSim.categorie]}</span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${STATUT_COLORS[detailSim.statut] ?? ""}`}>
                      {STATUT_LABELS[detailSim.statut] ?? detailSim.statut}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailSim(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Numéro</p><p className="text-sm font-mono font-semibold text-gray-800 mt-1">{detailSim.numero}</p></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">IMSI</p><p className="text-sm font-mono text-gray-700 mt-1">{detailSim.imsi || <span className="text-gray-300">—</span>}</p></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Catégorie</p><span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${CAT_COLORS[detailSim.categorie]}`}>{CAT_LABELS[detailSim.categorie]}</span></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Opérateur</p><p className="text-sm text-gray-700 mt-1">{detailSim.operateur || <span className="text-gray-300">—</span>}</p></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Statut</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[detailSim.statut] ?? ""}`}>{STATUT_LABELS[detailSim.statut] ?? detailSim.statut}</span>
                </div>
                {detailSim.description && (<div className="col-span-2"><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Description</p><p className="text-sm text-gray-700 mt-1">{detailSim.description}</p></div>)}
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <p className="text-xs">Créé le {new Date(detailSim.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="border-t border-gray-100" />
              {detailSim.affectation_active ? (() => {
                const aff = detailSim.affectation_active!;
                return (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Affectation active</p>
                    {aff.employee_nom && <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Employé</span><span className="text-xs font-semibold text-gray-800">{aff.employee_nom}</span></div>}
                    {aff.employee_matricule && <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Matricule</span><span className="text-xs font-mono text-gray-700">{aff.employee_matricule}</span></div>}
                    {aff.site_id && <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Site</span><span className="text-xs font-semibold text-gray-800">Site #{aff.site_id}</span></div>}
                    {aff.vehicule_id && <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Véhicule</span><span className="text-xs font-semibold text-gray-800">Véhicule #{aff.vehicule_id}</span></div>}
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Depuis le</span><span className="text-xs text-gray-700">{new Date(aff.date_debut).toLocaleDateString("fr-FR")}</span></div>
                  </div>
                );
              })() : <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center"><p className="text-xs text-gray-400">Aucune affectation active</p></div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setDetailSim(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Fermer</button>
                {!isViewer && (
                <button onClick={() => { openGerer(detailSim); setDetailSim(null); }}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Settings2 size={14} /> Gérer
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ════════════════════════════════════════════════════════ */}
      {gererSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Settings2 size={18} className="text-white" /></div>
                <div>
                  <p className="text-white font-bold text-sm font-mono">{gererSim.numero}</p>
                  <p className="text-white/60 text-xs">{CAT_LABELS[gererSim.categorie]} · {gererSim.operateur ?? "—"}</p>
                </div>
              </div>
              <button onClick={closeGerer} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="overflow-y-auto flex-1">

              {gererMode === "menu" && (
                <div className="px-6 py-5 space-y-2.5">
                  {gererSim?.affectation_active ? (
                    <div className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><Link size={16} className="text-gray-400" /></div>
                      <div className="text-left"><p className="text-sm font-semibold text-gray-400">Affecter</p><p className="text-xs text-gray-400">Numéro déjà affecté</p></div>
                    </div>
                  ) : (
                    <button onClick={() => setGererMode("affecter")}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition group">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center shrink-0 transition"><Link size={16} className="text-purple-600" /></div>
                      <div className="text-left"><p className="text-sm font-semibold text-gray-800">Affecter</p><p className="text-xs text-gray-400">Assigner à un employé, site ou véhicule</p></div>
                    </button>
                  )}
                  {gererSim?.affectation_active && (() => {
                    const aff = gererSim.affectation_active!;
                    const who = aff.employee_nom ? `${aff.employee_nom}` : aff.site_id ? `Site #${aff.site_id}` : `Véhicule #${aff.vehicule_id}`;
                    return (
                      <button onClick={() => setGererMode("desaffecter")}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition group">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center shrink-0 transition"><Unlink size={16} className="text-orange-500" /></div>
                        <div className="text-left min-w-0"><p className="text-sm font-semibold text-gray-800">Désaffecter</p><p className="text-xs text-orange-500 truncate">Actuellement : {who}</p></div>
                      </button>
                    );
                  })()}
                  <button onClick={() => {
                    setForm({ numero: gererSim.numero, imsi: gererSim.imsi ?? "", categorie: gererSim.categorie, operateur: gererSim.operateur ?? "", description: gererSim.description ?? "", statut: gererSim.statut });
                    setGererMode("modifier");
                  }} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition"><Pencil size={16} className="text-blue-600" /></div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Modifier</p><p className="text-xs text-gray-400">Changer les informations de la SIM</p></div>
                  </button>
                  <button onClick={() => setGererMode("supprimer")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition"><Trash2 size={16} className="text-red-500" /></div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Supprimer</p><p className="text-xs text-gray-400">Retirer ce numéro du système</p></div>
                  </button>
                  <button onClick={closeGerer} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">Fermer</button>
                </div>
              )}

              {gererMode === "affecter" && (
                <div className="px-6 py-5 space-y-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de début</label>
                    <input type="date" value={affForm.date_debut} onChange={e => setAffForm((p: any) => ({ ...p, date_debut: e.target.value }))} className="input-base" /></div>
                  {gererSim.categorie === "EMPLOYE" && (
                    <div className="relative"><label className="block text-xs font-semibold text-gray-600 mb-1.5">Employé</label>
                      <input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setAffForm((p: any) => ({ ...p, employee_id: null, employee_nom: null, employee_matricule: null })); }} placeholder="Rechercher…" className="input-base" />
                      {employees.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {employees.map(e => (
                            <button key={e.id} onClick={() => { setAffForm((p: any) => ({ ...p, employee_id: e.id, employee_nom: `${e.nom} ${e.prenom}`.trim(), employee_matricule: e.matricule })); setEmpSearch(`${e.nom} ${e.prenom}`); setEmps([]); }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                              <p className="font-medium text-gray-800">{e.nom} {e.prenom}</p><p className="text-xs text-gray-400">{e.matricule}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {gererSim.categorie === "M2M_SITE" && (
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Site GSM</label>
                      <select value={affForm.site_id ?? ""} onChange={e => setAffForm((p: any) => ({ ...p, site_id: Number(e.target.value) || null }))} className="input-base">
                        <option value="">Sélectionner…</option>{sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                      </select></div>
                  )}
                  {gererSim.categorie === "M2M_VEHICULE" && (
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Véhicule</label>
                      <select value={affForm.vehicule_id ?? ""} onChange={e => setAffForm((p: any) => ({ ...p, vehicule_id: Number(e.target.value) || null }))} className="input-base">
                        <option value="">Sélectionner…</option>{vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                      </select></div>
                  )}
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optionnel)</label>
                    <textarea value={affForm.notes} onChange={e => setAffForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2} className="input-base resize-none" /></div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGererMode("menu")} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Retour</button>
                    <button onClick={handleAffecter} className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">Confirmer l'affectation</button>
                  </div>
                </div>
              )}

              {gererMode === "desaffecter" && gererSim?.affectation_active && (() => {
                const aff = gererSim.affectation_active!;
                const who = aff.employee_nom ? `${aff.employee_nom}` : aff.site_id ? `Site #${aff.site_id}` : `Véhicule #${aff.vehicule_id}`;
                return (
                  <div className="px-6 py-5 space-y-4">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <p className="text-xs font-semibold text-orange-800">Affectation en cours</p>
                      <p className="text-sm font-bold text-orange-900 mt-0.5">{who}</p>
                      <p className="text-xs text-orange-600 mt-0.5">Depuis le {new Date(aff.date_debut).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif <span className="font-normal text-gray-400">(optionnel)</span></label>
                      <textarea value={desaffMotif} onChange={e => setDesaffMotif(e.target.value)} rows={3} className="input-base resize-none" placeholder="Ex : Départ de l'employé…" /></div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setGererMode("menu")} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Retour</button>
                      <button onClick={handleDesaffecter} className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold transition">Confirmer la désaffectation</button>
                    </div>
                  </div>
                );
              })()}

              {gererMode === "modifier" && (
                <div className="px-6 py-5 space-y-3">
                  {[
                    { label: "Numéro", key: "numero", type: "text" },
                    { label: "IMSI",   key: "imsi",   type: "text" },
                    { label: "Catégorie", key: "categorie", type: "select", opts: Object.entries(CAT_LABELS) },
                    { label: "Opérateur", key: "operateur", type: "text" },
                    { label: "Statut", key: "statut", type: "select",
                      opts: Object.entries(STATUT_LABELS) },
                    { label: "Description", key: "description", type: "text" },
                  ].map(({ label, key, type, opts }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                      {type === "select" ? (
                        <select value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base">
                          {(opts as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base" />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGererMode("menu")} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Retour</button>
                    <button onClick={handleModifier} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">Enregistrer</button>
                  </div>
                </div>
              )}

              {gererMode === "supprimer" && (
                <div className="px-6 py-5 space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800">Confirmer la suppression</p>
                    <p className="text-xs text-red-600 mt-1">Le numéro <span className="font-mono font-bold">{gererSim.numero}</span> sera définitivement supprimé.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setGererMode("menu")} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
                    <button onClick={handleSupprimer} className="flex-[2] bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold transition">Supprimer définitivement</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Import ══════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Upload size={18} className="text-white" /></div>
                <p className="text-white font-bold text-sm">Importer des numéros SIM</p>
              </div>
              <button onClick={closeImport} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="font-semibold text-sm">Import terminé</p></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-emerald-700">{importResult.created}</p><p className="text-xs text-emerald-600 mt-0.5">Créés</p></div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-blue-700">{importResult.updated}</p><p className="text-xs text-blue-600 mt-0.5">Mis à jour</p></div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-red-600">{importResult.errors.length}</p><p className="text-xs text-red-500 mt-0.5">Erreurs</p></div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-700 mb-1.5">Détail des erreurs</p>
                      {importResult.errors.map((e: any, i: number) => <p key={i} className="text-xs text-red-600">Ligne {e.ligne} : {e.message}</p>)}
                    </div>
                  )}
                  <button onClick={closeImport} className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Fermer</button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-800">Format attendu (CSV séparateur ;)</p>
                      <p className="text-xs text-blue-600 mt-0.5 font-mono">Numéro;Catégorie;Opérateur;Description</p>
                    </div>
                  </div>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"}`}
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="text-sm font-semibold">{importFile.name}</p></div>
                    ) : (
                      <><Upload size={24} className="mx-auto mb-2 text-gray-400" /><p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier CSV</p></>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={closeImport} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
                    <button onClick={handleImport} disabled={!importFile || importLoading}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {importLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importation…</> : <><Upload size={14} /> Lancer l'import</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Nouvelle SIM ══════════════════════════════════════════════════ */}
      {simModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSimModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">Nouveau numéro SIM</h2>
            <div className="space-y-3">
              {[
                { label: "Numéro", key: "numero", type: "text" },
                { label: "IMSI",   key: "imsi",   type: "text" },
                { label: "Catégorie", key: "categorie", type: "select", opts: Object.entries(CAT_LABELS) },
                { label: "Opérateur", key: "operateur", type: "text" },
                { label: "Description", key: "description", type: "text" },
              ].map(({ label, key, type, opts }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  {type === "select" ? (
                    <select value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base">
                      {(opts as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setSimModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSaveSim} className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Créer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
