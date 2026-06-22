import { useEffect, useState, useRef, useCallback } from "react";
import {
  Settings2, X, Pencil, Trash2, Upload, Download,
  FileText, CheckCircle2, Radio, Calendar, Smartphone,
  Search, ChevronLeft, ChevronRight, FileSpreadsheet, Filter,
  Wifi, WifiOff, BarChart3, ArrowLeftRight, TrendingUp, TrendingDown,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { siteService } from "@/services/api";
import type { SiteGSM } from "@/types";

const PAGE_SIZE = 10;
const EMPTY = { code_site: "", imsi: "", nom: "", localisation: "" };
const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

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

export default function SitesPage() {
  const { isViewer } = useAuth();
  const [sites,   setSites]   = useState<SiteGSM[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [filterSim,   setFilterSim]   = useState("");
  const [filterRMS,   setFilterRMS]   = useState<"Orange" | "Free">("Orange");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Export ───────────────────────────────────────────────────────────────────
  const SITE_COLS = [
    { key: "code_site",    label: "SiteID" },
    { key: "imsi",         label: "IMSI" },
    { key: "nom",          label: "Nom du site" },
    { key: "localisation", label: "Localisation" },
    { key: "sim_numero",   label: "Numéro SIM" },
    { key: "statut_sim",   label: "Statut SIM" },
    { key: "created_at",   label: "Date création" },
  ] as const;
  type SiteColKey = (typeof SITE_COLS)[number]["key"];

  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportCols,    setExportCols]    = useState<Set<SiteColKey>>(new Set(SITE_COLS.map(c => c.key)));
  const [exportDateDebut, setExportDateDebut] = useState("");
  const [exportDateFin,   setExportDateFin]   = useState("");
  const toggleCol = (k: SiteColKey) =>
    setExportCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  // ── Historique facturation (modal détail) ────────────────────────────────────
  const [facturation,        setFacturation]        = useState<{ sim_numero: string | null; lignes: any[] } | null>(null);
  const [facturationLoading, setFacturationLoading] = useState(false);

  // ── Statistiques mensuelles / Écart ─────────────────────────────────────────
  const [periodes, setPeriodes] = useState<{ mois: number; annee: number }[]>([]);
  const [statsModal,  setStatsModal]  = useState(false);
  const [ecartModal,  setEcartModal]  = useState(false);
  const [statsPeriode, setStatsPeriode] = useState<{ mois: number; annee: number } | null>(null);
  const [statsResult,  setStatsResult]  = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [ecartP1, setEcartP1] = useState<{ mois: number; annee: number } | null>(null);
  const [ecartP2, setEcartP2] = useState<{ mois: number; annee: number } | null>(null);
  const [ecartResult,  setEcartResult]  = useState<any>(null);
  const [ecartLoading, setEcartLoading] = useState(false);
  const [evolution, setEvolution] = useState<{
    mois: number; annee: number; total: number; nombre_numeros: number;
    ecart: number | null; ecart_pct: number | null;
  }[]>([]);
  const [evolutionLoading, setEvolutionLoading] = useState(false);

  useEffect(() => {
    siteService.statsPeriodes().then((p: { mois: number; annee: number }[]) => {
      setPeriodes(p);
      if (p.length > 0) {
        setStatsPeriode(p[0]);
        setEcartP1(p[1] ?? p[0]);
        setEcartP2(p[0]);
      }
    }).catch(() => {});
  }, []);

  const periodeKey = (p: { mois: number; annee: number }) => `${p.annee}-${p.mois}`;
  const findPeriode = (key: string) => periodes.find(p => periodeKey(p) === key) ?? null;

  const handleStats = () => {
    if (!statsPeriode) return;
    setStatsLoading(true);
    siteService.statsMensuel(statsPeriode.mois, statsPeriode.annee)
      .then(setStatsResult)
      .catch(() => toast.error("Erreur lors du calcul"))
      .finally(() => setStatsLoading(false));
  };

  const handleEcart = () => {
    if (!ecartP1 || !ecartP2) return;
    setEcartLoading(true);
    siteService.statsEcart(ecartP1.mois, ecartP1.annee, ecartP2.mois, ecartP2.annee)
      .then(setEcartResult)
      .catch(() => toast.error("Erreur lors du calcul"))
      .finally(() => setEcartLoading(false));
  };

  // Charger l'évolution mois par mois à l'ouverture du modal Écart
  useEffect(() => {
    if (!ecartModal) return;
    setEvolutionLoading(true);
    siteService.statsEvolution()
      .then(setEvolution)
      .catch(() => setEvolution([]))
      .finally(() => setEvolutionLoading(false));
  }, [ecartModal]);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [detailSite,  setDetailSite]  = useState<SiteGSM | null>(null);
  const [gererSite,   setGererSite]   = useState<SiteGSM | null>(null);
  const [gererMode,   setGererMode]   = useState<"menu" | "modifier" | "supprimer">("menu");
  const [form,        setForm]        = useState<any>(EMPTY);
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Chargement ───────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    siteService.getAll()
      .then(setSites).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  // Charger l'historique de facturation à l'ouverture du détail d'un site
  useEffect(() => {
    if (!detailSite) { setFacturation(null); return; }
    setFacturationLoading(true);
    siteService.facturation(detailSite.id)
      .then(setFacturation)
      .catch(() => setFacturation(null))
      .finally(() => setFacturationLoading(false));
  }, [detailSite]);

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
      sites.flatMap(s => [s.nom, s.code_site, s.localisation, s.sim_numero].filter(Boolean) as string[])
        .filter(v => v.toLowerCase().includes(lower))
    )).slice(0, 6);
    setSuggestions(sugg); setShowSuggest(sugg.length > 0);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); setShowSuggest(false); }, 300);
  };

  useEffect(() => { setPage(1); }, [filterSim, filterRMS]);

  // ── Filtrage ─────────────────────────────────────────────────────────────────
  const filtered = sites.filter(s => {
    if ((s.sim_operateur ?? "Orange") !== filterRMS) return false;
    if (filterSim === "affecte"     && !s.sim_numero) return false;
    if (filterSim === "non_affecte" &&  s.sim_numero) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.nom.toLowerCase().includes(q) ||
      (s.code_site    ?? "").toLowerCase().includes(q) ||
      (s.imsi         ?? "").toLowerCase().includes(q) ||
      (s.sim_numero   ?? "").toLowerCase().includes(q) ||
      (s.localisation ?? "").toLowerCase().includes(q)
    );
  });

  const sitesRMS   = sites.filter(s => (s.sim_operateur ?? "Orange") === filterRMS);
  const avecSim    = sitesRMS.filter(s => s.sim_numero).length;
  const sansSim    = sitesRMS.filter(s => !s.sim_numero).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openGerer = (s: SiteGSM) => {
    setGererSite(s); setGererMode("menu");
    setForm({ code_site: s.code_site ?? "", imsi: s.imsi ?? "", nom: s.nom, localisation: s.localisation ?? "" });
  };
  const closeGerer = () => { setGererSite(null); setGererMode("menu"); };

  const handleModifier = async () => {
    if (!gererSite) return;
    try { await siteService.update(gererSite.id, form); toast.success("Site mis à jour"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleSupprimer = async () => {
    if (!gererSite) return;
    try { await siteService.delete(gererSite.id); toast.success("Site supprimé"); closeGerer(); load(); }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };
  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await siteService.importSites(importFile);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import"); }
    finally { setImportLoading(false); }
  };
  const closeImport = () => {
    setImportModal(false); setImportFile(null); setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const FIELDS = [
    { label: "IMSI",          key: "imsi",         placeholder: "Ex : 608030012345678" },
    { label: "SiteID",        key: "code_site",    placeholder: "Ex : SITE-001" },
    { label: "Nom du site *", key: "nom",          placeholder: "Nom du site" },
    { label: "Localisation",  key: "localisation", placeholder: "Ville, région…" },
  ];

  return (
    <AppLayout>
      {/* ── Header + Stats (fixe au scroll) ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Sites RMS</h1>
            <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : `${sites.length} site(s)`}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtre RMS Orange / Free */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
              <button onClick={() => setFilterRMS("Orange")}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                  filterRMS === "Orange" ? "bg-white text-camublue-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                RMS_Orange
              </button>
              <button onClick={() => setFilterRMS("Free")}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                  filterRMS === "Free" ? "bg-white text-camublue-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                RMS_Free
              </button>
            </div>
            <button onClick={() => { setStatsResult(null); setStatsModal(true); }} disabled={periodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900/5 hover:bg-camublue-900/10 disabled:opacity-40 disabled:cursor-not-allowed text-camublue-900 border border-camublue-900/15 rounded-xl text-sm font-semibold transition shadow-sm">
              <BarChart3 size={15} /><span>Statistiques</span>
            </button>
            <button onClick={() => { setEcartResult(null); setEcartModal(true); }} disabled={periodes.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900/5 hover:bg-camublue-900/10 disabled:opacity-40 disabled:cursor-not-allowed text-camublue-900 border border-camublue-900/15 rounded-xl text-sm font-semibold transition shadow-sm">
              <ArrowLeftRight size={15} /><span>Écart</span>
            </button>
            <button onClick={() => setExportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
              <FileSpreadsheet size={15} /><span>Exporter</span>
              <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
            </button>
            {!isViewer && (
            <button onClick={() => { setImportResult(null); setImportFile(null); setImportModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition shadow-sm">
              <FileSpreadsheet size={15} /><span>Importer</span>
              <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.csv / .xlsx</span>
            </button>
            )}
          </div>
        </div>

        {/* ── Statistiques ── */}
        <div className="flex gap-3 flex-wrap">
          <StatCard label="Total" value={sitesRMS.length} color="bg-camublue-900"
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mt-5">
          <div className="flex gap-3 flex-wrap items-center">

            {/* Recherche avec suggestions */}
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
                placeholder="Rechercher par nom, SiteID, IMSI, numéro SIM…"
                className="input-base pl-9 pr-8" />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button"
                      onMouseDown={() => { setSearchInput(s); setSearch(s); setShowSuggest(false); setPage(1); }}
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

            {/* Filtre SIM */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <Filter size={13} className="text-gray-400 shrink-0" />
              <select value={filterSim} onChange={e => setFilterSim(e.target.value)}
                className="input-base py-2 flex-1 text-sm">
                <option value="">Tous les sites</option>
                <option value="affecte">Avec SIM affecté</option>
                <option value="non_affecte">Sans SIM affecté</option>
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">IMSI</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">SiteID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">Nom du site</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">Numéro SIM</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">Dernière facture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24 bg-gray-50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Aucun site</td></tr>
            ) : paginated.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setDetailSite(s)}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.imsi ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  {s.code_site
                    ? <span className="px-2 py-0.5 bg-camublue-900/10 text-camublue-900 rounded-lg text-xs font-semibold">{s.code_site}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800 truncate">{s.nom}</p>
                  {s.localisation && <p className="text-xs text-gray-400 truncate">{s.localisation}</p>}
                </td>
                <td className="px-4 py-3">
                  {s.sim_numero
                    ? <div className="flex items-center gap-1.5"><Wifi size={12} className="text-emerald-500 shrink-0" /><span className="font-mono text-sm font-semibold text-gray-800">{s.sim_numero}</span></div>
                    : <div className="flex items-center gap-1.5"><WifiOff size={12} className="text-gray-300 shrink-0" /><span className="text-gray-300 text-xs">Non affecté</span></div>}
                </td>
                <td className="px-4 py-3 text-center">
                  {s.derniere_facture ? (
                    <p className="text-sm font-semibold text-gray-800">
                      {s.derniere_facture.montant_ttc != null
                        ? Number(s.derniere_facture.montant_ttc).toLocaleString("fr-FR")
                        : "—"}
                    </p>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
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
      </div>

      {/* ── Pagination ── */}
      {!loading && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            {filtered.length === 0 ? "Aucun résultat"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} sur ${filtered.length} site(s)`}
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
                <h2 className="font-bold text-lg text-camublue-900">Exporter les sites RMS</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fichier Excel (.xlsx) · {sites.length} site(s) chargés</p>
              </div>
              <button onClick={() => setExportOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Période (date de création) */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Période (date de création)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Du</label>
                    <input type="date" value={exportDateDebut}
                      onChange={e => setExportDateDebut(e.target.value)}
                      className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Au</label>
                    <input type="date" value={exportDateFin}
                      onChange={e => setExportDateFin(e.target.value)}
                      className="input-base" />
                  </div>
                </div>
                {(exportDateDebut || exportDateFin) && (() => {
                  const n = sites.filter(s => {
                    const d = new Date(s.created_at).toISOString().slice(0, 10);
                    return (!exportDateDebut || d >= exportDateDebut) && (!exportDateFin || d <= exportDateFin);
                  }).length;
                  return (
                    <p className="text-xs text-camublue-900 font-semibold mt-1.5">
                      → {n} site(s) dans cette période
                    </p>
                  );
                })()}
              </div>

              {/* Colonnes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(new Set(SITE_COLS.map(c => c.key)))}
                      className="text-xs text-camublue-900 font-semibold hover:underline">Tout</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setExportCols(new Set())}
                      className="text-xs text-gray-400 hover:underline">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SITE_COLS.map(({ key, label }) => (
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

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setExportOpen(false)} disabled={exportLoading}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">Annuler</button>
                <button disabled={exportCols.size === 0 || exportLoading}
                  onClick={async () => {
                    setExportLoading(true);
                    try {
                      await siteService.exportExcel({
                        filter_sim:  filterSim        || undefined,
                        search:      search           || undefined,
                        cols:        exportCols.size > 0 ? Array.from(exportCols).join(",") : undefined,
                        date_debut:  exportDateDebut  || undefined,
                        date_fin:    exportDateFin    || undefined,
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

      {/* ══ Modal Détail Site ══════════════════════════════════════════════════ */}
      {detailSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailSite(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Radio size={20} className="text-white" /></div>
                <div>
                  <p className="text-white font-bold text-base">{detailSite.nom}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {detailSite.code_site ? `${detailSite.code_site} · ` : ""}{detailSite.localisation || "Localisation non renseignée"}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailSite(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">SiteID</p>
                  {detailSite.code_site
                    ? <span className="inline-block mt-1 px-2 py-0.5 bg-camublue-900/10 text-camublue-900 rounded-lg text-xs font-semibold">{detailSite.code_site}</span>
                    : <p className="text-sm text-gray-300 mt-1">—</p>}
                </div>
                <div><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">IMSI du site</p>
                  <p className="text-sm font-mono text-gray-700 mt-1">{detailSite.imsi || <span className="text-gray-300">—</span>}</p>
                </div>
                <div className="col-span-2"><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Nom du site</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{detailSite.nom}</p>
                </div>
                <div className="col-span-2"><p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Localisation</p>
                  <p className="text-sm text-gray-700 mt-1">{detailSite.localisation || <span className="text-gray-300">—</span>}</p>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <p className="text-xs">Créé le {new Date(detailSite.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="border-t border-gray-100" />
              {detailSite.sim_numero ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Numéro SIM affecté</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0"><Smartphone size={16} className="text-emerald-700" /></div>
                    <p className="text-base font-mono font-bold text-emerald-800">{detailSite.sim_numero}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Aucun numéro SIM affecté</p>
                  <p className="text-xs text-gray-400 mt-0.5">Assignez depuis la page <span className="font-semibold">Numéros SIM</span></p>
                </div>
              )}

              {/* ── Historique de facturation (auto, depuis les factures importées) ── */}
              {detailSite.sim_numero && (
                <>
                  <div className="border-t border-gray-100" />
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      Historique de facturation
                    </p>
                    {facturationLoading ? (
                      <p className="text-xs text-gray-400 text-center py-3">Chargement…</p>
                    ) : !facturation || facturation.lignes.length === 0 ? (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                        <p className="text-xs text-gray-400">Aucune valeur trouvée pour ce numéro</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Les montants sont récupérés automatiquement depuis les <span className="font-semibold">factures télécom</span> importées.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Période</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Opérateur</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Montant TTC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {facturation.lignes.map((l, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-gray-700">{MOIS_LABELS[l.mois - 1] ?? l.mois} {l.annee}</td>
                                <td className="px-3 py-2 text-gray-500">{l.operateur ?? "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                  {l.montant_ttc != null
                                    ? `${Number(l.montant_ttc).toLocaleString("fr-FR")} F`
                                    : l.montant != null
                                      ? `${Number(l.montant).toLocaleString("fr-FR")} F`
                                      : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setDetailSite(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Fermer</button>
                {!isViewer && (
                <button onClick={() => { openGerer(detailSite); setDetailSite(null); }}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Settings2 size={14} /> Gérer
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ══════════════════════════════════════════════════════════ */}
      {gererSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Settings2 size={18} className="text-white" /></div>
                <div>
                  <p className="text-white font-bold text-sm">{gererSite.nom}</p>
                  <p className="text-white/60 text-xs">{gererSite.code_site ? `${gererSite.code_site} · ` : ""}{gererSite.localisation ?? "—"}</p>
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
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Modifier</p><p className="text-xs text-gray-400">Changer les informations du site</p></div>
                  </button>
                  <button onClick={() => setGererMode("supprimer")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition"><Trash2 size={16} className="text-red-500" /></div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-800">Supprimer</p><p className="text-xs text-gray-400">Retirer ce site du système</p></div>
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
                    <p className="text-xs text-red-600 mt-1">Le site <span className="font-bold">{gererSite.nom}</span> sera définitivement supprimé.</p>
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
                <p className="text-white font-bold text-sm">Importer des sites RMS</p>
              </div>
              <button onClick={closeImport} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="font-semibold text-sm">Import terminé</p></div>
                  <div className={`grid gap-2 ${importResult.sims_crees ? "grid-cols-5" : "grid-cols-4"}`}>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-emerald-700">{importResult.created}</p><p className="text-xs text-emerald-600 mt-0.5">Créés</p></div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-blue-700">{importResult.updated}</p><p className="text-xs text-blue-600 mt-0.5">Mis à jour</p></div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-purple-700">{importResult.affecte ?? 0}</p><p className="text-xs text-purple-600 mt-0.5">SIM liés</p></div>
                    {!!importResult.sims_crees && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center"><p className="text-xl font-bold text-indigo-700">{importResult.sims_crees}</p><p className="text-xs text-indigo-600 mt-0.5">SIM créés</p></div>
                    )}
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
                      <p className="text-xs font-semibold text-blue-800">Format CAMUSAT (CSV/TSV ou Excel)</p>
                      <p className="text-xs text-blue-600 mt-1 font-mono font-semibold">Numéro ; IMSI ; SITES ID ; NOMS SITES</p>
                      <p className="text-xs text-blue-500 mt-1.5">
                        ✓ Le numéro SIM est lié automatiquement au site.<br />
                        ✓ Fichier .xlsx accepté : feuilles "RMS_Orange" / "RMS_Free" reconnues automatiquement.<br />
                        ✓ Ancien format CSV accepté : <span className="font-mono">SiteID;Nom;Localisation</span><br />
                        ✓ Les valeurs de facturation mensuelles s'affichent ensuite automatiquement dans le détail de chaque site, alimentées par les factures importées.
                      </p>
                    </div>
                  </div>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"}`}
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                    {importFile
                      ? <div className="flex items-center justify-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><p className="text-sm font-semibold">{importFile.name}</p></div>
                      : <><Upload size={24} className="mx-auto mb-2 text-gray-400" /><p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier CSV ou Excel</p></>}
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

      {/* ══ Modal Statistiques mensuelles ════════════════════════════════════════ */}
      {statsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStatsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><BarChart3 size={18} className="text-white" /></div>
                <p className="text-white font-bold text-sm">Coût total des sites RMS</p>
              </div>
              <button onClick={() => setStatsModal(false)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Période (mois facturé)</label>
                <select value={statsPeriode ? periodeKey(statsPeriode) : ""}
                  onChange={e => setStatsPeriode(findPeriode(e.target.value))}
                  className="input-base">
                  {periodes.map(p => (
                    <option key={periodeKey(p)} value={periodeKey(p)}>{MOIS_LABELS[p.mois - 1]} {p.annee}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleStats} disabled={!statsPeriode || statsLoading}
                className="w-full bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                {statsLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calcul…</> : "Calculer"}
              </button>
              {statsResult && (
                <div className="p-4 bg-camublue-900/5 border border-camublue-900/15 rounded-xl text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                    {MOIS_LABELS[statsResult.mois - 1]} {statsResult.annee}
                  </p>
                  <p className="text-3xl font-black text-camublue-900 mt-1">
                    {Math.round(statsResult.total).toLocaleString("fr-FR")} <span className="text-base font-semibold">FCFA</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {statsResult.nombre_numeros} numéro(s) SIM facturé(s) sur les sites RMS
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Écart entre deux mois ══════════════════════════════════════════ */}
      {ecartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEcartModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><ArrowLeftRight size={18} className="text-white" /></div>
                <p className="text-white font-bold text-sm">Écart entre deux mois</p>
              </div>
              <button onClick={() => setEcartModal(false)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Période 1</label>
                  <select value={ecartP1 ? periodeKey(ecartP1) : ""}
                    onChange={e => setEcartP1(findPeriode(e.target.value))}
                    className="input-base">
                    {periodes.map(p => (
                      <option key={periodeKey(p)} value={periodeKey(p)}>{MOIS_LABELS[p.mois - 1]} {p.annee}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Période 2</label>
                  <select value={ecartP2 ? periodeKey(ecartP2) : ""}
                    onChange={e => setEcartP2(findPeriode(e.target.value))}
                    className="input-base">
                    {periodes.map(p => (
                      <option key={periodeKey(p)} value={periodeKey(p)}>{MOIS_LABELS[p.mois - 1]} {p.annee}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={handleEcart} disabled={!ecartP1 || !ecartP2 || ecartLoading}
                className="w-full bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                {ecartLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calcul…</> : "Comparer"}
              </button>
              {ecartResult && (() => {
                const ecart    = ecartResult.ecart as number;
                const ecartPct = ecartResult.ecart_pct as number | null;
                const hausse   = ecart > 0;
                const baisse   = ecart < 0;
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                          {MOIS_LABELS[ecartResult.periode1.mois - 1]} {ecartResult.periode1.annee}
                        </p>
                        <p className="text-lg font-bold text-gray-800 mt-1">
                          {Math.round(ecartResult.periode1.total).toLocaleString("fr-FR")} F
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                          {MOIS_LABELS[ecartResult.periode2.mois - 1]} {ecartResult.periode2.annee}
                        </p>
                        <p className="text-lg font-bold text-gray-800 mt-1">
                          {Math.round(ecartResult.periode2.total).toLocaleString("fr-FR")} F
                        </p>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl text-center border ${
                      hausse ? "bg-red-50 border-red-200" : baisse ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                    }`}>
                      <div className="flex items-center justify-center gap-2">
                        {hausse && <TrendingUp size={18} className="text-red-600" />}
                        {baisse && <TrendingDown size={18} className="text-emerald-600" />}
                        <p className={`text-2xl font-black ${hausse ? "text-red-600" : baisse ? "text-emerald-600" : "text-gray-600"}`}>
                          {hausse ? "+" : ""}{Math.round(ecart).toLocaleString("fr-FR")} <span className="text-sm font-semibold">FCFA</span>
                        </p>
                      </div>
                      {ecartPct != null && (
                        <p className={`text-xs mt-1 font-semibold ${hausse ? "text-red-500" : baisse ? "text-emerald-500" : "text-gray-400"}`}>
                          {hausse ? "+" : ""}{ecartPct.toFixed(1)} % par rapport à la période 1
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Évolution mois par mois ─ écart par rapport au mois précédent */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Évolution mois par mois</p>
                {evolutionLoading ? (
                  <p className="text-sm text-gray-400 text-center py-3">Chargement…</p>
                ) : evolution.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">Aucune donnée disponible</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Période</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Écart</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Écart %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {evolution.map(p => {
                          const hausse = (p.ecart ?? 0) > 0;
                          const baisse = (p.ecart ?? 0) < 0;
                          return (
                            <tr key={`${p.annee}-${p.mois}`}>
                              <td className="px-3 py-2 text-gray-700">{MOIS_LABELS[p.mois - 1]} {p.annee}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                {Math.round(p.total).toLocaleString("fr-FR")} F
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${
                                hausse ? "text-red-600" : baisse ? "text-emerald-600" : "text-gray-400"
                              }`}>
                                {p.ecart == null ? "—" : `${hausse ? "+" : ""}${Math.round(p.ecart).toLocaleString("fr-FR")} F`}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${
                                hausse ? "text-red-500" : baisse ? "text-emerald-500" : "text-gray-400"
                              }`}>
                                {p.ecart_pct == null ? "—" : `${hausse ? "+" : ""}${p.ecart_pct.toFixed(1)} %`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
