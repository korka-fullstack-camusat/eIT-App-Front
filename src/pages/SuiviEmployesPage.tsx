import { useEffect, useState } from "react";
import { Search, X, Monitor, Wrench, AlertTriangle, Eye, User } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { ax } from "@/services/api";

const TYPE_LABELS: Record<string, string> = {
  ORDINATEUR_PORTABLE: "PC Portable", ORDINATEUR_FIXE: "PC Fixe",
  ECRAN: "Écran", SOURIS: "Souris", CLAVIER: "Clavier",
  TELEPHONE: "Téléphone", TABLETTE: "Tablette", IMPRIMANTE: "Imprimante",
  SWITCH: "Switch", ROUTEUR: "Routeur", ONDULEUR: "Onduleur",
  AP: "AP", SERVEUR: "Serveur", PARE_FEU: "Pare-feu", AUTRE: "Autre",
};

const TYPE_ICONS: Record<string, string> = {
  ORDINATEUR_PORTABLE: "💻", ORDINATEUR_FIXE: "🖥️", ECRAN: "🖥️",
  SOURIS: "🖱️", CLAVIER: "⌨️", TELEPHONE: "📱", TABLETTE: "📱",
  IMPRIMANTE: "🖨️", SWITCH: "🔀", ROUTEUR: "📡", ONDULEUR: "🔋",
  AP: "📶", SERVEUR: "🗄️", PARE_FEU: "🔒", AUTRE: "📦",
};

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

function StatutBadgeMat({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    ACTIVE:      "bg-emerald-100 text-emerald-700",
    CLOTUREE:    "bg-gray-100 text-gray-500",
    EN_PANNE:    "bg-red-100 text-red-600",
    MAINTENANCE: "bg-orange-100 text-orange-600",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Actif", CLOTUREE: "Restitué", EN_PANNE: "En panne", MAINTENANCE: "Maintenance",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[statut] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[statut] ?? statut}
    </span>
  );
}

/* ── Drawer latéral détail employé ─────────────────────────────────────────── */
function EmployeDrawer({ emp, onClose }: { emp: any; onClose: () => void }) {
  const actifs    = emp.attributions.filter((a: any) => a.statut === "ACTIVE");
  const restitues = emp.attributions.filter((a: any) => a.statut === "CLOTUREE");

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal centré */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#1F3864]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{emp.prenom} {emp.nom}</h2>
              <p className="text-xs text-blue-200">{emp.service || "—"}{emp.matricule ? ` · Matr. ${emp.matricule}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Stats rapides */}
        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-b">
          {[
            { label: "Total",      val: emp.nb_total,     c: "bg-camublue-900 text-white" },
            { label: "Actifs",     val: actifs.length,    c: "bg-emerald-100 text-emerald-700" },
            { label: "Restitués",  val: restitues.length, c: "bg-gray-100 text-gray-600" },
          ].map(s => (
            <div key={s.label} className={`flex-1 rounded-xl px-4 py-3 text-center ${s.c}`}>
              <p className="text-2xl font-black">{s.val}</p>
              <p className="text-xs font-semibold mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tableau des matériels */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {emp.attributions.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Monitor size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Aucun matériel assigné</p>
            </div>
          ) : (
            <>
              {/* Actifs */}
              {actifs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Matériels en cours ({actifs.length})
                  </h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#1F3864]">
                          {["Type", "Matériel", "N° Série / Référence", "Depuis"].map(h => (
                            <th key={h} className="px-3 py-2 text-xs font-bold text-white text-center border-r border-[#2e4d8a] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {actifs.map((a: any, i: number) => (
                          <tr key={a.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}`}>
                            <td className="px-3 py-2.5 text-center border border-gray-100 text-sm">{TYPE_ICONS[a.type] ?? "📦"} {TYPE_LABELS[a.type] ?? a.type}</td>
                            <td className="px-3 py-2.5 border border-gray-100 font-medium text-gray-800">{a.marque} {a.modele}</td>
                            <td className="px-3 py-2.5 text-center border border-gray-100 font-mono text-xs">
                              {a.numero_serie
                                ? <span className="text-gray-700">{a.numero_serie}</span>
                                : a.reference
                                ? <span className="text-blue-600">{a.reference}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center border border-gray-100 text-gray-600">{fmt(a.date_attribution)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Restitués */}
              {restitues.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Matériels restitués ({restitues.length})
                  </h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-500">
                          {["Type", "Matériel", "Attribution", "Restitution"].map(h => (
                            <th key={h} className="px-3 py-2 text-xs font-bold text-white text-center border-r border-gray-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {restitues.map((a: any, i: number) => (
                          <tr key={a.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                            <td className="px-3 py-2.5 text-center border border-gray-100 text-sm">{TYPE_ICONS[a.type] ?? "📦"} {TYPE_LABELS[a.type] ?? a.type}</td>
                            <td className="px-3 py-2.5 border border-gray-100 font-medium text-gray-600 line-through">{a.marque} {a.modele}</td>
                            <td className="px-3 py-2.5 text-center border border-gray-100 text-gray-500">{fmt(a.date_attribution)}</td>
                            <td className="px-3 py-2.5 text-center border border-gray-100 text-gray-500">{fmt(a.date_restitution)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Page principale
══════════════════════════════════════════════════════════════════════════════ */
export default function SuiviEmployesPage() {
  const [tab,        setTab]        = useState<"employes" | "refection">("employes");
  const [employes,   setEmployes]   = useState<any[]>([]);
  const [refection,  setRefection]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [dateDebut,  setDateDebut]  = useState("");
  const [dateFin,    setDateFin]    = useState("");
  const [selected,   setSelected]   = useState<any | null>(null);
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 20;

  const loadEmployes = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin)   params.date_fin   = dateFin;
      const res = await ax.get("/attributions/suivi-employes", { params });
      setEmployes(res.data);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  const loadRefection = async () => {
    try {
      const res = await ax.get("/attributions/materiels-en-refection");
      setRefection(res.data);
    } catch { toast.error("Erreur chargement réfection"); }
  };

  useEffect(() => { loadEmployes(); }, [dateDebut, dateFin]);
  useEffect(() => { loadRefection(); }, []); // chargé au démarrage pour le badge
  useEffect(() => { if (tab === "refection") loadRefection(); }, [tab]);
  useEffect(() => { setPage(1); }, [search, dateDebut, dateFin]);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? employes.filter(e =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
        (e.matricule || "").toLowerCase().includes(q) ||
        (e.service   || "").toLowerCase().includes(q))
    : employes;

  const totalActifs  = employes.reduce((s, e) => s + e.nb_actifs, 0);
  const totalMats    = employes.reduce((s, e) => s + e.nb_total, 0);
  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showPagination = filtered.length > PAGE_SIZE;

  return (
    <AppLayout>
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        {/* Ligne 1 : titre + période + tabs */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Suivi des employés</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {loading ? "Chargement…" : `${filtered.length} employé(s) · ${totalActifs} attributions actives`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtre période — toujours visible */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-gray-400 text-xs font-medium">Du</span>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="outline-none bg-transparent text-sm text-gray-700" />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-gray-400 text-xs font-medium">Au</span>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="outline-none bg-transparent text-sm text-gray-700" />
            </div>
            {(dateDebut || dateFin) && (
              <button onClick={() => { setDateDebut(""); setDateFin(""); }}
                className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1">
                <X size={12} /> Effacer
              </button>
            )}
            {/* Tabs */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm ml-1">
              <button onClick={() => setTab("employes")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${tab === "employes" ? "bg-camublue-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                <Monitor size={15} /> Employés
              </button>
              <button onClick={() => setTab("refection")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition border-l border-gray-200 ${tab === "refection" ? "bg-camublue-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                <Wrench size={15} /> En réfection
                {refection.length > 0 && <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{refection.length}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Ligne 2 : recherche centrée + stats */}
        {tab === "employes" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm w-full max-w-sm">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, matricule, service…"
                  className="text-sm text-gray-700 outline-none bg-transparent w-full" />
                {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
              </div>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Employés", val: employes.length, c: "bg-camublue-900 text-white" },
                { label: "Actifs",   val: totalActifs,     c: "bg-emerald-100 text-emerald-700" },
                { label: "Total",    val: totalMats,       c: "bg-blue-100 text-blue-700" },
              ].map(s => (
                <div key={s.label} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${s.c}`}>
                  <span className="text-base font-black">{s.val}</span> {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ TAB EMPLOYÉS ══ */}
      {tab === "employes" && (
        loading ? (
          <div className="text-center py-20 text-gray-400">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Monitor size={48} className="mb-3 opacity-20" />
            <p className="font-medium">Aucun employé trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1F3864]">
                    {["Nom / Prénom", "Matricule", "Service", "Total", "En cours", "Restitués", "Actions"].map((h, i) => (
                      <th key={h}
                        className={`px-4 py-2.5 text-xs font-bold text-white border-r border-[#2e4d8a] whitespace-nowrap
                          ${i === 0 ? "text-left" : "text-center"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((emp, i) => {
                    const actifs    = emp.attributions.filter((a: any) => a.statut === "ACTIVE");
                    const restitues = emp.attributions.filter((a: any) => a.statut === "CLOTUREE");
                    return (
                      <tr key={`${emp.matricule}_${emp.nom}`}
                        className={`border-b border-gray-200 transition-colors
                          ${i % 2 === 0 ? "bg-white" : "bg-[#EEF2FF]/40"}
                          hover:bg-blue-50/40`}>
                        <td className="px-4 py-2.5 border border-gray-200 font-semibold text-gray-800">
                          {emp.prenom} {emp.nom}
                        </td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center text-gray-600">{emp.matricule || "—"}</td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center text-gray-600">{emp.service || "—"}</td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center font-bold text-camublue-900">{emp.nb_total}</td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${actifs.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                            {actifs.length}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            {restitues.length}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border border-gray-200 text-center">
                          <button onClick={() => setSelected(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-camublue-900 text-white text-xs font-semibold hover:bg-camublue-900/85 transition shadow-sm">
                            <Eye size={12} /> Afficher
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {showPagination && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} employés
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2.5 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "…"
                        ? <span key={`e${idx}`} className="px-1 text-gray-400 text-xs">…</span>
                        : <button key={p} onClick={() => setPage(p as number)}
                            className={`w-7 h-7 rounded text-xs font-semibold transition ${page === p ? "bg-camublue-900 text-white" : "text-gray-600 hover:bg-gray-200"}`}>
                            {p}
                          </button>
                    )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2.5 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ══ TAB RÉFECTION ══ */}
      {tab === "refection" && (
        <div>
          {refection.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Wrench size={48} className="mb-3 opacity-20" />
              <p className="font-medium">Aucun matériel en réfection</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1F3864]">
                      {["Type", "Matériel", "N° Série", "Statut", "État", "Dernier attributaire", "Date attribution"].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-bold text-white border-r border-[#2e4d8a] whitespace-nowrap ${i === 0 || i === 1 ? "text-left" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {refection.map((m, i) => (
                      <tr key={m.id} className={`border-b border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-[#EEF2FF]/40"} hover:bg-orange-50/30`}>
                        <td className="px-4 py-2.5 border border-gray-200">{TYPE_ICONS[m.type] ?? "📦"} {TYPE_LABELS[m.type] ?? m.type}</td>
                        <td className="px-4 py-2.5 border border-gray-200 font-medium text-gray-800">{m.marque} {m.modele}</td>
                        <td className="px-4 py-2.5 text-center border border-gray-200 font-mono text-gray-500 text-xs">{m.numero_serie || "—"}</td>
                        <td className="px-4 py-2.5 text-center border border-gray-200">
                          {m.statut === "EN_PANNE"
                            ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600"><AlertTriangle size={10} /> En panne</span>
                            : <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">Maintenance</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center border border-gray-200 text-gray-600 text-xs">{m.etat || "—"}</td>
                        <td className="px-4 py-2.5 text-center border border-gray-200 text-gray-700">{m.dernier_attributaire || "—"}</td>
                        <td className="px-4 py-2.5 text-center border border-gray-200 text-gray-600">{fmt(m.date_attribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Drawer employé ── */}
      {selected && <EmployeDrawer emp={selected} onClose={() => setSelected(null)} />}
    </AppLayout>
  );
}
