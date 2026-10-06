import { useEffect, useRef, useState } from "react";
import {
  Upload, Search, Signal, AlertTriangle, Smartphone,
  Car, Radio, Wifi, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { flotteSimService } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

type Tab = "mobiles" | "gps" | "rms-orange" | "rms-free" | "alertes";
type Stats = { mobiles: number; gps: number; rms_orange: number; rms_free: number; alertes: number };

const PAGE_SIZE = 30;

function fmt(d?: string) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

const KPI_CFG: {
  id: Tab; label: string; icon: React.ReactNode; statKey: keyof Stats;
  activeBg: string; activeBorder: string; activeText: string; activeIcon: string;
}[] = [
  {
    id: "mobiles", label: "Mobiles", icon: <Smartphone size={22} />, statKey: "mobiles",
    activeBg: "bg-blue-50", activeBorder: "border-blue-300", activeText: "text-blue-700", activeIcon: "text-blue-500",
  },
  {
    id: "gps", label: "GPS Véhicules", icon: <Car size={22} />, statKey: "gps",
    activeBg: "bg-purple-50", activeBorder: "border-purple-300", activeText: "text-purple-700", activeIcon: "text-purple-500",
  },
  {
    id: "rms-orange", label: "RMS Orange", icon: <Radio size={22} />, statKey: "rms_orange",
    activeBg: "bg-orange-50", activeBorder: "border-orange-300", activeText: "text-orange-700", activeIcon: "text-orange-500",
  },
  {
    id: "rms-free", label: "RMS Free", icon: <Wifi size={22} />, statKey: "rms_free",
    activeBg: "bg-green-50", activeBorder: "border-green-300", activeText: "text-green-700", activeIcon: "text-green-500",
  },
  {
    id: "alertes", label: "Alertes", icon: <Bell size={22} />, statKey: "alertes",
    activeBg: "bg-red-50", activeBorder: "border-red-300", activeText: "text-red-700", activeIcon: "text-red-500",
  },
];

const COLUMNS: Record<Exclude<Tab, "alertes">, { key: string; label: string }[]> = {
  mobiles: [
    { key: "numero_ligne",    label: "N° Ligne" },
    { key: "engagement",      label: "Engagement (mois)" },
    { key: "date_activation", label: "Date d'activation" },
  ],
  gps: [
    { key: "numero_sim",      label: "N° Ligne" },
    { key: "engagement",      label: "Engagement (mois)" },
    { key: "date_activation", label: "Date d'activation" },
  ],
  "rms-orange": [
    { key: "numero",          label: "N° Ligne" },
    { key: "engagement",      label: "Engagement (mois)" },
    { key: "date_activation", label: "Date d'activation" },
  ],
  "rms-free": [
    { key: "numero",          label: "N° Ligne" },
    { key: "engagement",      label: "Engagement (mois)" },
    { key: "date_activation", label: "Date d'activation" },
  ],
};

function renderCell(col: { key: string }, row: any) {
  const val = row[col.key];
  if (val === null || val === undefined) return <span className="text-gray-300">—</span>;
  if (col.key === "date_activation") return <span className="whitespace-nowrap">{fmt(String(val))}</span>;
  if (col.key === "facturation" || col.key === "total_positionne")
    return <span className="whitespace-nowrap">{Number(val).toLocaleString("fr-FR")} FCFA</span>;
  return String(val);
}

export default function FlotteSIMPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [activeTab, setActiveTab]   = useState<Tab>("mobiles");
  const [search,    setSearch]      = useState("");
  const [data,      setData]        = useState<any[]>([]);
  const [alertes,   setAlertes]     = useState<{ total: number; seuil: string; alertes: any[] } | null>(null);
  const [loading,   setLoading]     = useState(true);
  const [importing, setImporting]   = useState(false);
  const [stats,     setStats]       = useState<Stats | null>(null);
  const [page,      setPage]        = useState(1);
  const importRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    try { setStats(await flotteSimService.stats()); } catch {}
  };

  const loadTab = async (tab: Tab, q: string) => {
    setLoading(true);
    try {
      if (tab === "alertes") {
        const res = await flotteSimService.alertes();
        setAlertes(res);
        setData([]);
      } else {
        const loaders: Record<Exclude<Tab, "alertes">, (s?: string) => Promise<any[]>> = {
          mobiles:      flotteSimService.mobiles,
          gps:          flotteSimService.gps,
          "rms-orange": flotteSimService.rmsOrange,
          "rms-free":   flotteSimService.rmsFree,
        };
        setData(await loaders[tab](q || undefined));
      }
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTab(activeTab, search); setPage(1); }, [activeTab, search]);
  useEffect(() => { loadStats(); }, []);

  const switchTab = (tab: Tab) => { setActiveTab(tab); setSearch(""); setPage(1); };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await flotteSimService.importFichier(file);
      toast.success(`Import terminé — ${res.total} lignes`);
      loadTab(activeTab, search);
      loadStats();
    } catch { toast.error("Erreur lors de l'import"); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  };

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pagedData  = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const nbAlertes  = stats?.alertes ?? alertes?.total ?? 0;

  // Pages à afficher dans la pagination
  const pageNumbers = (() => {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
      const end   = Math.min(totalPages, start + 4);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  })();

  return (
    <AppLayout>
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1 space-y-4">

        {/* Ligne 1 : titre + bouton import */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900 flex items-center gap-2">
              <Signal size={22} /> Suivi Flotte SIM
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {loading ? "Chargement…" : activeTab === "alertes"
                ? `${alertes?.total ?? 0} alerte(s) — contrats expirant dans 90 jours`
                : `${data.length} enregistrement(s)${totalPages > 1 ? ` — page ${page}/${totalPages}` : ""}`}
            </p>
          </div>
          {canEdit && (
            <>
              <input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
              <button
                onClick={() => importRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-sm transition disabled:opacity-50"
              >
                <Upload size={14} /> {importing ? "Import…" : "Importer .xlsx"}
              </button>
            </>
          )}
        </div>

        {/* Ligne 2 : KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {KPI_CFG.map(k => {
            const isActive = activeTab === k.id;
            const count    = stats?.[k.statKey];
            return (
              <button
                key={k.id}
                onClick={() => switchTab(k.id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all shadow-sm text-center ${
                  isActive
                    ? `${k.activeBg} ${k.activeBorder} ring-1 ring-inset ring-current/10`
                    : "bg-white border-gray-200 hover:border-gray-300 hover:shadow"
                }`}
              >
                <span className={isActive ? k.activeIcon : "text-gray-400"}>{k.icon}</span>
                <span className={`text-2xl font-bold leading-none ${isActive ? k.activeText : "text-gray-800"}`}>
                  {count !== undefined ? count : "—"}
                </span>
                <span className={`text-xs font-medium ${isActive ? k.activeText : "text-gray-500"}`}>
                  {k.label}
                  {k.id === "alertes" && nbAlertes > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">!</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ligne 3 : filtres pill + recherche */}
        <div className="flex items-center gap-2 flex-wrap">
          {KPI_CFG.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeTab === tab.id
                  ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "alertes" && nbAlertes > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? "bg-white text-red-600" : "bg-red-500 text-white"
                }`}>
                  {nbAlertes}
                </span>
              )}
            </button>
          ))}

          {activeTab !== "alertes" && (
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher…"
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 bg-white shadow-sm w-48"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : activeTab === "alertes" ? (
        <AlertesPanel alertes={alertes?.alertes ?? []} seuil={alertes?.seuil} />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Signal size={48} className="mb-3 opacity-20" />
          <p className="font-medium">Aucune donnée — importez un fichier .xlsx</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1F3864]">
                    {COLUMNS[activeTab as Exclude<Tab, "alertes">].map((col, i, arr) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide whitespace-nowrap ${
                          i < arr.length - 1 ? "border-r border-[#2e4d8a]" : ""
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, idx) => (
                    <tr
                      key={row.id ?? idx}
                      className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      {COLUMNS[activeTab as Exclude<Tab, "alertes">].map((col, ci, arr) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-gray-700 ${ci < arr.length - 1 ? "border-r border-gray-100" : ""}`}
                        >
                          {renderCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3 text-sm">
              <span className="text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.length)} sur {data.length} enregistrement(s)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} /> Précédent
                </button>
                {pageNumbers.map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                      page === p
                        ? "bg-camublue-900 text-white shadow-sm"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Suivant <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

// ── Panneau Alertes ────────────────────────────────────────────────────────────
function AlertesPanel({ alertes, seuil }: { alertes: any[]; seuil?: string }) {
  if (alertes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Bell size={48} className="mb-3 opacity-20" />
        <p className="font-medium">Aucune alerte — tous les contrats sont à jour</p>
      </div>
    );
  }

  const expired = alertes.filter(a => a.expire);
  const soon    = alertes.filter(a => !a.expire);

  const catLabel: Record<string, string> = {
    MOBILE:     "Mobile employé",
    GPS:        "GPS Véhicule",
    RMS_ORANGE: "RMS Orange",
  };

  const catColor: Record<string, string> = {
    MOBILE:     "bg-blue-100 text-blue-800",
    GPS:        "bg-purple-100 text-purple-800",
    RMS_ORANGE: "bg-orange-100 text-orange-800",
  };

  const Card = ({ a }: { a: any }) => (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-2 ${a.expire ? "border-red-200" : "border-orange-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${catColor[a.categorie] ?? "bg-gray-100 text-gray-700"}`}>
          {catLabel[a.categorie] ?? a.categorie}
        </span>
        <span className={`text-xs font-bold ${a.expire ? "text-red-600" : "text-orange-500"}`}>
          {a.expire ? "⚠ Expiré" : `Expire le ${fmt(a.date_fin)}`}
        </span>
      </div>
      <p className="font-bold text-gray-900 text-sm font-mono">{a.numero}</p>
      {a.beneficiaire && <p className="text-xs text-gray-600">{a.beneficiaire}{a.matricule ? ` — ${a.matricule}` : ""}</p>}
      {a.immatriculation && <p className="text-xs text-gray-600">Véhicule : {a.immatriculation} {a.modele ? `(${a.modele})` : ""}</p>}
      {a.nom_site && <p className="text-xs text-gray-600">Site : {a.site_id} — {a.nom_site}</p>}
      <div className="flex gap-3 text-xs text-gray-500 mt-1">
        <span>Activation : {fmt(a.date_activation)}</span>
        <span>Engagement : {a.engagement ?? "—"} mois</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {seuil && (
        <p className="text-xs text-gray-400 italic">Seuil d'alerte : contrats expirant avant le {fmt(seuil)}</p>
      )}
      {expired.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-red-600 font-bold text-sm mb-3 uppercase tracking-wide">
            <AlertTriangle size={15} /> Contrats expirés ({expired.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expired.map((a, i) => <Card key={i} a={a} />)}
          </div>
        </section>
      )}
      {soon.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-orange-500 font-bold text-sm mb-3 uppercase tracking-wide">
            <Bell size={15} /> Expirent dans 90 jours ({soon.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {soon.map((a, i) => <Card key={i} a={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}
