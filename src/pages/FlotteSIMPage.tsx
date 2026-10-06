import { useEffect, useRef, useState } from "react";
import {
  Upload, Search, Signal, AlertTriangle, Smartphone,
  Car, Radio, Wifi, Bell,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { flotteSimService } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

type Tab = "mobiles" | "gps" | "rms-orange" | "rms-free" | "alertes";

function fmt(d?: string) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "mobiles",    label: "Mobiles",      icon: <Smartphone size={15} /> },
  { id: "gps",        label: "GPS Véhicules", icon: <Car size={15} /> },
  { id: "rms-orange", label: "RMS Orange",   icon: <Radio size={15} /> },
  { id: "rms-free",   label: "RMS Free",     icon: <Wifi size={15} /> },
  { id: "alertes",    label: "Alertes",      icon: <Bell size={15} /> },
];

export default function FlotteSIMPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [activeTab, setActiveTab] = useState<Tab>("mobiles");
  const [search,    setSearch]    = useState("");
  const [data,      setData]      = useState<any[]>([]);
  const [alertes,   setAlertes]   = useState<{ total: number; seuil: string; alertes: any[] } | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const loadTab = async (tab: Tab, q: string) => {
    setLoading(true);
    try {
      if (tab === "alertes") {
        const res = await flotteSimService.alertes();
        setAlertes(res);
        setData([]);
      } else {
        const loaders: Record<Exclude<Tab, "alertes">, (s?: string) => Promise<any[]>> = {
          mobiles:    flotteSimService.mobiles,
          gps:        flotteSimService.gps,
          "rms-orange": flotteSimService.rmsOrange,
          "rms-free":   flotteSimService.rmsFree,
        };
        const res = await loaders[tab](q || undefined);
        setData(res);
      }
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTab(activeTab, search); }, [activeTab, search]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await flotteSimService.importFichier(file);
      toast.success(`Import terminé — ${res.total} lignes`);
      loadTab(activeTab, search);
    } catch { toast.error("Erreur lors de l'import"); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  };

  // ── Colonnes par onglet ──────────────────────────────────────────────────────
  const columns: Record<Exclude<Tab, "alertes">, { key: string; label: string }[]> = {
    mobiles: [
      { key: "matricule",       label: "Matricule" },
      { key: "beneficiaire",    label: "Bénéficiaire" },
      { key: "service",         label: "Service" },
      { key: "business_line",   label: "BL" },
      { key: "fonction",        label: "Fonction" },
      { key: "numero_ligne",    label: "N° Ligne" },
      { key: "formule",         label: "Formule" },
      { key: "engagement",      label: "Engagement (mois)" },
      { key: "date_activation", label: "Date d'activation" },
      { key: "forfait_internet",label: "Forfait internet" },
    ],
    gps: [
      { key: "numero_sim",      label: "N° SIM" },
      { key: "immatriculation", label: "Immatriculation" },
      { key: "modele",          label: "Modèle" },
      { key: "imei",            label: "IMEI" },
      { key: "engagement",      label: "Engagement (mois)" },
      { key: "date_activation", label: "Date d'activation" },
      { key: "facturation",     label: "Facturation" },
    ],
    "rms-orange": [
      { key: "numero",          label: "Numéro" },
      { key: "imsi",            label: "IMSI" },
      { key: "site_id",         label: "ID Site" },
      { key: "nom_site",        label: "Nom Site" },
      { key: "engagement",      label: "Engagement (mois)" },
      { key: "date_activation", label: "Date d'activation" },
    ],
    "rms-free": [
      { key: "numero",  label: "Numéro" },
      { key: "imsi",    label: "IMSI" },
      { key: "site_id", label: "ID Site" },
      { key: "nom_site",label: "Nom Site" },
    ],
  };

  const renderCell = (col: { key: string; label: string }, row: any) => {
    const val = row[col.key];
    if (val === null || val === undefined) return <span className="text-gray-300">—</span>;
    if (col.key === "date_activation") return <span className="whitespace-nowrap">{fmt(val)}</span>;
    if (col.key === "facturation" || col.key === "total_positionne")
      return <span className="whitespace-nowrap">{Number(val).toLocaleString("fr-FR")} FCFA</span>;
    return val;
  };

  const nbAlertes = alertes?.total ?? 0;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900 flex items-center gap-2">
              <Signal size={22} /> Suivi Flotte SIM
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {loading ? "Chargement…" : activeTab === "alertes"
                ? `${nbAlertes} alerte(s) — contrats expirant dans 90 jours`
                : `${data.length} enregistrement(s)`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab !== "alertes" && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 bg-white shadow-sm w-48"
                />
              </div>
            )}
            {canEdit && (
              <>
                <input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
                <button
                  onClick={() => importRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-sm transition disabled:opacity-50"
                >
                  <Upload size={14} /> {importing ? "Import…" : "Importer .xlsx"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(""); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-camublue-900 text-camublue-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "alertes" && nbAlertes > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {nbAlertes}
                </span>
              )}
            </button>
          ))}
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#1F3864]">
                  {columns[activeTab as Exclude<Tab, "alertes">].map((col, i, arr) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide whitespace-nowrap ${i < arr.length - 1 ? "border-r border-[#2e4d8a]" : ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={row.id ?? idx} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    {columns[activeTab as Exclude<Tab, "alertes">].map((col, ci, arr) => (
                      <td key={col.key} className={`px-4 py-3 text-gray-700 ${ci < arr.length - 1 ? "border-r border-gray-100" : ""}`}>
                        {renderCell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
