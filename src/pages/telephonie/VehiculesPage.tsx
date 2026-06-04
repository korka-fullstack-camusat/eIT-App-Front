import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Settings2, X, Pencil, Trash2, Upload, Download,
  FileText, CheckCircle2, Car, Calendar, Smartphone,
  Search, ChevronLeft, ChevronRight, FileSpreadsheet, Filter,
  Wifi, WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { vehiculeService } from "@/services/api";
import type { Vehicule } from "@/types";

const PAGE_SIZE = 10;
const EMPTY = { immatriculation: "", marque: "", modele: "", imsi: "", affectation: "" };

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

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [filterSim,   setFilterSim]   = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Export ───────────────────────────────────────────────────────────────────
  const VEH_COLS = [
    { key: "immat",       label: "Immatriculation" },
    { key: "marque",      label: "Marque" },
    { key: "modele",      label: "Modèle" },
    { key: "affectation", label: "Affectation" },
    { key: "sim_numero",  label: "Numéro SIM" },
    { key: "statut_sim",  label: "Statut SIM" },
    { key: "created_at",  label: "Date création" },
  ] as const;
  type VehColKey = (typeof VEH_COLS)[number]["key"];

  const [exportOpen,      setExportOpen]      = useState(false);
  const [exportLoading,   setExportLoading]   = useState(false);
  const [exportCols,      setExportCols]      = useState<Set<VehColKey>>(new Set(VEH_COLS.map(c => c.key)));
  const [exportDateDebut, setExportDateDebut] = useState("");
  const [exportDateFin,   setExportDateFin]   = useState("");
  const toggleCol = (k: VehColKey) =>
    setExportCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [detailVeh,  setDetailVeh]  = useState<Vehicule | null>(null);
  const [gererVeh,   setGererVeh]   = useState<Vehicule | null>(null);
  const [gererMode,  setGererMode]  = useState<"menu" | "modifier" | "supprimer">("menu");
  const [form,       setForm]       = useState<any>(EMPTY);
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm,  setCreateForm]  = useState<any>(EMPTY);

  // ── Chargement ───────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    vehiculeService.getAll()
      .then(setVehicules).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Debounce search ──────────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearch(""); setSuggestions([]); setShowSuggest(false); setPage(1); return; }
    const lower = val.toLowerCase();
    const sugg = Array.from(new Set(
      vehicules.flatMap(v => [v.immatriculation, v.marque, v.modele, v.affectation, v.sim_numero].filter(Boolean) as string[])
        .filter(s => s.toLowerCase().includes(lower))
    )).slice(0, 6);
    setSuggestions(sugg); setShowSuggest(sugg.length > 0);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); setShowSuggest(false); }, 300);
  };

  useEffect(() => { setPage(1); }, [filterSim]);

  // ── Filtrage ─────────────────────────────────────────────────────────────────
  const filtered = vehicules.filter(v => {
    if (filterSim === "affecte"     && !v.sim_numero) return false;
    if (filterSim === "non_affecte" &&  v.sim_numero) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.immatriculation.toLowerCase().includes(q) ||
      (v.marque      ?? "").toLowerCase().includes(q) ||
      (v.modele      ?? "").toLowerCase().includes(q) ||
      (v.affectation ?? "").toLowerCase().includes(q) ||
      (v.sim_numero  ?? "").toLowerCase().includes(q)
    );
  });

  const avecSim    = vehicules.filter(v => v.sim_numero).length;
  const sansSim    = vehicules.filter(v => !v.sim_numero).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openGerer = (v: Vehicule) => {
    setGererVeh(v); setGererMode("menu");
    setForm({ immatriculation: v.immatriculation, marque: v.marque ?? "", modele: v.modele ?? "", imsi: v.imsi ?? "", affectation: v.affectation ?? "" });
  };
  const closeGerer = () => { setGererVeh(null); setGererMode("menu"); };

  const handleModifier = async () => {
    if (!gererVeh) return;
    try { await vehiculeService.update(gererVeh.id, form); toast.success("Véhicule mis à jour"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleSupprimer = async () => {
    if (!gererVeh) return;
    try { await vehiculeService.delete(gererVeh.id); toast.success("Véhicule supprimé"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await vehiculeService.importVehicules(importFile);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import"); }
    finally { setImportLoading(false); }
  };
  const closeImport = () => {
    setImportModal(false); setImportFile(null); setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleCreate = async () => {
    if (!createForm.immatriculation.trim()) { toast.error("L'immatriculation est obligatoire"); return; }
    try {
      await vehiculeService.create(createForm);
      toast.success("Véhicule créé"); setCreateModal(false); setCreateForm(EMPTY); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const FIELDS = [
    { label: "Immatriculation *", key: "immatriculation", placeholder: "Ex : DK 1234 AB"       },
    { label: "IMSI",              key: "imsi",            placeholder: "Ex : 60803001234567"    },
    { label: "Modèle",            key: "modele",          placeholder: "Ex : Land Cruiser"      },
    { label: "Marque",            key: "marque",          placeholder: "Ex : Toyota"            },
    { label: "Affectation",       key: "affectation",     placeholder: "Ex : Direction"         },
  ];

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Véhicules</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : `${vehicules.length} véhicule(s)`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} /><span>Exporter</span>
            <span className="text-[10px] bg-white/20 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
          </button>
          <button onClick={() => { setImportResult(null); setImportFile(null); setImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet size={15} /><span>Importer</span>
            <span className="text-[10px] bg-white/20 rounded px-1 py-0.5 font-bold leading-none">.csv</span>
          </button>
          <button onClick={() => { setCreateForm(EMPTY); setCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Ajouter véhicule
          </button>
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Total" value={vehicules.length} color="bg-camublue-900"
          onClick={() => { setFilterSim(""); setSearchInput(""); setSearch(""); }}
          active={!filterSim && !search} />
        <StatCard label="Avec SIM" value={avecSim} color="bg-emerald-500"
          onClick={() => setFilterSim(filterSim === "affecte" ? "" : "affecte")}
          active={filterSim === "affecte"} />
        <StatCard label="Sans SIM" value={sansSim} color="bg-amber-500"
          onClick={() => setFilterSim(filterSim === "non_affecte" ? "" : "non_affecte")}
          active={filterSim === "non_affecte"} />
      </div>

      {/* ── Filtres ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div ref={searchRef} className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {loading && searchInput ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
            ) : searchInput ? (
              <button onClick={() => { setSearchInput(""); setSearch(""); setSuggestions([]); setShowSuggest(false); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={14} />
              </button>
            ) : null}
            <input value={searchInput} onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder="Rechercher immatriculation, marque, modèle…"
              className="input-base pl-9 pr-8" />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} type="button"
                    onMouseDown={() => { setSearchInput(s); setSearch(s); setShowSuggest(false); setPage(1); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-camublue-900/5 text-left text-sm text-gray-700 border-b border-gray-50 last:border-0 transition">
                    <Search size={12} className="text-gray-300 shrink-0" /><span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-1.5 min-w-[160px]">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <select value={filterSim} onChange={e => setFilterSim(e.target.value)}
              className="input-base py-2 flex-1 text-sm">
              <option value="">Tous les véhicules</option>
              <option value="affecte">Avec SIM affecté</option>
              <option value="non_affecte">Sans SIM affecté</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Numéro SIM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">IMSI</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Immatriculation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Modèle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Aucun véhicule</td></tr>
            ) : paginated.map(v => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setDetailVeh(v)}>
                {/* Numéro SIM */}
                <td className="px-4 py-3">
                  {v.sim_numero
                    ? <div className="flex items-center gap-1.5"><Wifi size={12} className="text-emerald-500 shrink-0" /><span className="font-mono text-sm font-semibold text-gray-800">{v.sim_numero}</span></div>
                    : <div className="flex items-center gap-1.5"><WifiOff size={12} className="text-gray-300 shrink-0" /><span className="text-gray-300 text-xs">—</span></div>}
                </td>
                {/* IMSI — champ à venir via enrichissement */}
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  <span className="text-gray-300">—</span>
                </td>
                {/* Immatriculation */}
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{v.immatriculation}</td>
                {/* Modèle */}
                <td className="px-4 py-3">
                  {v.modele
                    ? <p className="text-sm text-gray-700">{v.modele}</p>
                    : <span className="text-gray-300 text-xs">—</span>}
                  {v.marque && <p className="text-xs text-gray-400">{v.marque}</p>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); openGerer(v); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-xs font-semibold transition shadow-sm">
                    <Settings2 size={12} /> Gérer
                  </button>
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
            {filtered.length === 0 ? "Aucun résultat"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} sur ${filtered.length} véhicule(s)`}
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
                <h2 className="font-bold text-lg text-camublue-900">Exporter les véhicules</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fichier Excel (.xlsx) · {vehicules.length} véhicule(s) chargés</p>
              </div>
              <button onClick={() => setExportOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Période */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Période (date de création)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Du</label>
                    <input type="date" value={exportDateDebut} onChange={e => setExportDateDebut(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Au</label>
                    <input type="date" value={exportDateFin} onChange={e => setExportDateFin(e.target.value)} className="input-base" />
                  </div>
                </div>
                {(exportDateDebut || exportDateFin) && (() => {
                  const n = vehicules.filter(v => {
                    const d = new Date(v.created_at).toISOString().slice(0, 10);
                    return (!exportDateDebut || d >= exportDateDebut) && (!exportDateFin || d <= exportDateFin);
                  }).length;
                  return <p className="text-xs text-camublue-900 font-semibold mt-1.5">→ {n} véhicule(s) dans cette période</p>;
                })()}
              </div>
              {/* Colonnes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(new Set(VEH_COLS.map(c => c.key)))}
                      className="text-xs text-camublue-900 font-semibold hover:underline">Tout</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setExportCols(new Set())}
                      className="text-xs text-gray-400 hover:underline">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {VEH_COLS.map(({ key, label }) => (
                    <label key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition text-sm
                        ${exportCols.has(key) ? "bg-camublue-900/5 border-camublue-900/20 text-camublue-900 font-semibold" : "border-gray-100 text-gray-400 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={exportCols.has(key)} onChange={() => toggleCol(key)}
                        className="accent-camublue-900 w-3.5 h-3.5 shrink-0" />{label}
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
                      await vehiculeService.exportExcel({
                        filter_sim: filterSim        || undefined,
                        search:     search           || undefined,
                        cols:       exportCols.size > 0 ? Array.from(exportCols).join(",") : undefined,
                        date_debut: exportDateDebut  || undefined,
                        date_fin:   exportDateFin    || undefined,
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

      {/* ══ Modal Détail Véhicule ══════════════════════════════════════════════ */}
      {detailVeh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailVeh(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Car size={20} className="text-white" /></div>
                <div>
                  <p className="text-white font-bold font-mono text-base">{detailVeh.immatriculation}</p>
                  <p className="text-white/60 text-xs mt-0.5">{[detailVeh.marque, detailVeh.modele].filter(Boolean).join(" ") || "Marque non renseignée"}</p>
                </div>
              </div>
              <button onClick={() => setDetailVeh(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2"><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Immatriculation</p><p className="text-base font-mono font-bold text-gray-800 mt-1">{detailVeh.immatriculation}</p></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Marque</p><p className="text-sm text-gray-700 mt-1">{detailVeh.marque || <span className="text-gray-300">—</span>}</p></div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Modèle</p><p className="text-sm text-gray-700 mt-1">{detailVeh.modele || <span className="text-gray-300">—</span>}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Affectation</p><p className="text-sm text-gray-700 mt-1">{detailVeh.affectation || <span className="text-gray-300">—</span>}</p></div>
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <p className="text-xs">Créé le {new Date(detailVeh.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="border-t border-gray-100" />
              {detailVeh.sim_numero ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Numéro SIM affecté</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0"><Smartphone size={16} className="text-emerald-700" /></div>
                    <p className="text-base font-mono font-bold text-emerald-800">{detailVeh.sim_numero}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Aucun numéro SIM affecté</p>
                  <p className="text-xs text-gray-400 mt-0.5">Assignez depuis la page <span className="font-semibold">Numéros SIM</span></p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setDetailVeh(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Fermer</button>
                <button onClick={() => { openGerer(detailVeh); setDetailVeh(null); }}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Settings2 size={14} /> Gérer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ══════════════════════════════════════════════════════════ */}
      {gererVeh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Settings2 size={18} className="text-white" /></div>
                <div>
                  <p className="text-white font-bold text-sm font-mono">{gererVeh.immatriculation}</p>
                  <p className="text-white/60 text-xs">{gererVeh.marque ?? "—"} {gererVeh.modele ?? ""}</p>
                </div>
              </div>
              <button onClick={closeGerer} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {gererMode === "menu" && (
                <div className="px-6 py-5 space-y-2.5">
                  <button onClick={() => setGererMode("modifier")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition"><Pencil size={16} className="text-blue-600" /></div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Modifier</p><p className="text-xs text-gray-400">Changer les informations du véhicule</p></div>
                  </button>
                  <button onClick={() => setGererMode("supprimer")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition"><Trash2 size={16} className="text-red-500" /></div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Supprimer</p><p className="text-xs text-gray-400">Retirer ce véhicule du système</p></div>
                  </button>
                  <button onClick={closeGerer} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">Fermer</button>
                </div>
              )}
              {gererMode === "modifier" && (
                <div className="px-6 py-5 space-y-3">
                  {FIELDS.map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                      <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="input-base" />
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
                    <p className="text-xs text-red-600 mt-1">Le véhicule <span className="font-bold font-mono">{gererVeh.immatriculation}</span> sera définitivement supprimé.</p>
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

      {/* ══ Modal Import ════════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Upload size={18} className="text-white" /></div>
                <p className="text-white font-bold text-sm">Importer des véhicules</p>
              </div>
              <button onClick={closeImport} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="font-semibold text-sm">Import terminé</p></div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-emerald-700">{importResult.created}</p><p className="text-xs text-emerald-600 mt-0.5">Créés</p></div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-blue-700">{importResult.updated}</p><p className="text-xs text-blue-600 mt-0.5">Mis à jour</p></div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-purple-700">{importResult.affecte ?? 0}</p><p className="text-xs text-purple-600 mt-0.5">SIM liés</p></div>
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
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Format CAMUSAT (CSV ou TSV)</p>
                      <p className="text-xs text-blue-600 mt-1 font-mono font-semibold">Numéro ; IMSI ; IMMATRICULATION ; MODEL</p>
                      <p className="text-xs text-blue-500 mt-1.5">
                        ✓ Le numéro SIM est lié automatiquement au véhicule.<br />
                        ✓ Ancien format accepté : <span className="font-mono">Immatriculation;Marque;Modèle</span>
                      </p>
                    </div>
                  </div>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"}`}
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                    {importFile
                      ? <div className="flex items-center justify-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="text-sm font-semibold">{importFile.name}</p></div>
                      : <><Upload size={24} className="mx-auto mb-2 text-gray-400" /><p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier CSV</p></>}
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

      {/* ══ Modal Nouveau véhicule ═══════════════════════════════════════════════ */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setCreateModal(false); setCreateForm(EMPTY); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">Nouveau véhicule</h2>
            <div className="space-y-3">
              {FIELDS.map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                  <input type="text" value={createForm[key]} onChange={e => setCreateForm((p: any) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="input-base" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setCreateModal(false); setCreateForm(EMPTY); }} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleCreate} className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Créer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
