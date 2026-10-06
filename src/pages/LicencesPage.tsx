import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Shield, Users, Palette, BarChart2, AlertTriangle, X, Eye, Bell } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

/* ─── helpers ─────────────────────────────────────────────────────────── */

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, j] = String(d).slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

function addDays(d: string, n: number): string {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Expiration = date_expiration si présente, sinon date_debut + 365 j, sinon date_activation + 365 j */
function expiration(item: any): string | null {
  if (item.date_expiration) return item.date_expiration;
  if (item.date_debut)      return addDays(item.date_debut, 365);
  if (item.date_activation) return addDays(item.date_activation, 365);
  return null;
}

function isExpired(d?: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function daysLeft(d?: string | null): number {
  if (!d) return Infinity;
  return (new Date(d).getTime() - Date.now()) / 86400000;
}

function expireSoon(d?: string | null, days = 90) {
  const dl = daysLeft(d);
  return dl >= 0 && dl <= days;
}

function StatusBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-gray-300 text-xs">—</span>;
  if (isExpired(date))     return <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold"><AlertTriangle size={9}/>Expirée</span>;
  if (expireSoon(date, 60)) return <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">Bientôt</span>;
  return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Active</span>;
}

/* ─── types ───────────────────────────────────────────────────────────── */

type Tab = "kaspersky" | "m365" | "adobe" | "powerbi";

const TABS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: "kaspersky", label: "Kaspersky",     icon: Shield,    color: "text-emerald-600" },
  { id: "m365",      label: "Microsoft 365", icon: Users,     color: "text-blue-600"    },
  { id: "adobe",     label: "Adobe",         icon: Palette,   color: "text-red-600"     },
  { id: "powerbi",   label: "Power BI",      icon: BarChart2, color: "text-amber-600"   },
];

/* ─── modal ───────────────────────────────────────────────────────────── */

function LicenceModal({ item, tabId, onClose }: { item: any; tabId: Tab; onClose: () => void }) {
  const exp = expiration(item);

  const Row = ({ label, value }: { label: string; value?: any }) =>
    value ? (
      <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
        <span className="text-xs text-gray-800 font-medium">{value}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {TABS.find(t => t.id === tabId)?.label}
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{item.produit || "Détails"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto px-5 py-3 flex-1">
          {/* common */}
          <Row label="N°"               value={item.numero}/>
          <Row label="Produit"          value={item.produit}/>
          <Row label="Date début"       value={fmt(item.date_debut ?? item.date_activation)}/>
          <Row label="Expiration"       value={fmt(exp)}/>

          {/* status */}
          <div className="flex gap-2 py-1.5 border-b border-gray-50">
            <span className="text-xs text-gray-500 w-36 shrink-0">Statut</span>
            <StatusBadge date={exp}/>
          </div>

          {/* Kaspersky */}
          {tabId === "kaspersky" && <>
            <Row label="Code d'activation" value={item.code_activation}/>
            <Row label="Capacité machines" value={item.nb_machines != null ? `${item.machines?.length ?? 0} / ${item.nb_machines}` : undefined}/>
            {item.machines?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-emerald-700 mb-2">Machines ({item.machines.length})</p>
                <div className="flex flex-col gap-1.5">
                  {item.machines.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-medium text-gray-700">{m.machine}</span>
                      <div className="flex items-center gap-2 text-gray-400">
                        {m.statut && <span>{m.statut}</span>}
                        {m.date_expiration && <span className={isExpired(m.date_expiration) ? "text-red-500 font-semibold" : ""}>{fmt(m.date_expiration)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}

          {/* M365 */}
          {tabId === "m365" && <>
            <Row label="Compte organisateur" value={item.compte_organisateur}/>
            <Row label="Email organisateur"  value={item.email_organisateur}/>
            <Row label="Utilisateurs"        value={item.nb_utilisateurs}/>
            <Row label="Places libres"       value={item.places_libres}/>
            {item.membres?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-blue-700 mb-2">Membres ({item.membres.length})</p>
                <div className="flex flex-col gap-1.5">
                  {item.membres.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-medium text-gray-700">{m.nom}</span>
                      <div className="flex items-center gap-2 text-gray-400">
                        {m.email && <span>{m.email}</span>}
                        {m.role  && <span className="text-blue-600 font-semibold">{m.role}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}

          {/* Adobe */}
          {tabId === "adobe" && <>
            <Row label="Utilisateur"        value={item.utilisateur}/>
            <Row label="Email du compte"    value={item.email_compte}/>
            <Row label="Fournisseur"        value={item.fournisseur}/>
            <Row label="Activation"         value={fmt(item.date_activation)}/>
            <Row label="Dernier renouvellement" value={fmt(item.dernier_renouvellement)}/>
          </>}

          {/* Power BI */}
          {tabId === "powerbi" && <>
            <Row label="Utilisateur"        value={item.utilisateur}/>
            <Row label="Compte Power BI"    value={item.compte_powerbi}/>
            <Row label="Fournisseur"        value={item.fournisseur}/>
            <Row label="Activation"         value={fmt(item.date_activation)}/>
            <Row label="Dernier renouvellement" value={fmt(item.dernier_renouvellement)}/>
          </>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 transition">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────── */

export default function LicencesPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [tab, setTab]             = useState<Tab>("kaspersky");
  const [importing, setImporting] = useState(false);
  const importRef                 = useRef<HTMLInputElement>(null);

  const [kaspersky, setKaspersky] = useState<any[]>([]);
  const [m365,      setM365]      = useState<any[]>([]);
  const [adobe,     setAdobe]     = useState<any[]>([]);
  const [powerbi,   setPowerbi]   = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  const [modal, setModal]         = useState<{ item: any; tabId: Tab } | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(true);

  /* load a single tab */
  const loadTab = useCallback(async (t: Tab) => {
    setLoadingTab(true);
    try {
      if (t === "kaspersky") { const r = await ax.get("/licences/kaspersky"); setKaspersky(r.data); }
      if (t === "m365")      { const r = await ax.get("/licences/m365");      setM365(r.data);      }
      if (t === "adobe")     { const r = await ax.get("/licences/adobe");     setAdobe(r.data);     }
      if (t === "powerbi")   { const r = await ax.get("/licences/powerbi");   setPowerbi(r.data);   }
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoadingTab(false); }
  }, []);

  /* load all tabs at startup to compute alerts */
  const loadAll = useCallback(async () => {
    try {
      const [rk, rm, ra, rp] = await Promise.all([
        ax.get("/licences/kaspersky"),
        ax.get("/licences/m365"),
        ax.get("/licences/adobe"),
        ax.get("/licences/powerbi"),
      ]);
      setKaspersky(rk.data);
      setM365(rm.data);
      setAdobe(ra.data);
      setPowerbi(rp.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* after tab switch, reload only if needed (data already there from loadAll) */
  useEffect(() => {
    const data = { kaspersky, m365, adobe, powerbi };
    if (data[tab].length === 0) loadTab(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── alerts: licences expiring within 90 days ── */
  type AlertItem = { label: string; source: Tab; exp: string; item: any };
  const alerts: AlertItem[] = [];
  const collectAlerts = (list: any[], src: Tab) =>
    list.forEach(item => {
      const exp = expiration(item);
      if (exp && expireSoon(exp, 90)) {
        alerts.push({ label: item.produit || item.compte_organisateur || "—", source: src, exp, item });
      }
    });
  collectAlerts(kaspersky, "kaspersky");
  collectAlerts(m365,      "m365");
  collectAlerts(adobe,     "adobe");
  collectAlerts(powerbi,   "powerbi");
  alerts.sort((a, b) => a.exp.localeCompare(b.exp));

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await ax.post("/licences/import-fichier", fd);
      const { stats, total } = res.data;
      const detail = Object.entries(stats as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
      toast.success(`Import réussi — ${total} entrées${detail ? ` (${detail})` : ""}`);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'import");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  /* ── table helpers ── */
  const TH = ({ children }: { children: any }) => (
    <th className="px-3 py-2.5 text-left text-xs font-bold text-white whitespace-nowrap border-r border-[#2e4d8a] last:border-r-0">{children}</th>
  );
  const TD = ({ children, mono, center }: { children: any; mono?: boolean; center?: boolean }) => (
    <td className={`px-3 py-2.5 text-xs border-b border-gray-100 ${mono ? "font-mono" : ""} ${center ? "text-center" : ""}`}>{children}</td>
  );
  const VoirBtn = ({ item, t }: { item: any; t: Tab }) => (
    <button
      onClick={() => setModal({ item, tabId: t })}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-camublue-900 text-white hover:bg-camublue-800 transition shadow-sm"
    >
      <Eye size={11}/> Voir
    </button>
  );

  const srcLabel: Record<Tab, string> = {
    kaspersky: "Kaspersky", m365: "Microsoft 365", adobe: "Adobe", powerbi: "Power BI"
  };

  return (
    <AppLayout>
      {/* ── header ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Suivis Licences</h1>
            <p className="text-gray-500 text-sm mt-0.5">Kaspersky · Microsoft 365 · Adobe · Power BI</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
              <button
                onClick={() => importRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-sm transition disabled:opacity-50"
              >
                <Upload size={14} /> {importing ? "Import en cours…" : "Importer le fichier"}
              </button>
            </div>
          )}
        </div>

        {/* tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition
                  ${tab === t.id ? "bg-camublue-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── alerts ── */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setAlertsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition text-sm font-semibold"
          >
            <Bell size={15} className="shrink-0"/>
            <span className="flex-1 text-left">
              Alertes — {alerts.length} licence{alerts.length > 1 ? "s" : ""} expirant dans moins de 3 mois
            </span>
            <span className="text-xs font-normal">{alertsOpen ? "Masquer" : "Afficher"}</span>
          </button>
          {alertsOpen && (
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {alerts.map((a, i) => {
                const expired = isExpired(a.exp);
                const dl = Math.ceil(daysLeft(a.exp));
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-xs cursor-pointer hover:shadow-sm transition
                      ${expired ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}
                    onClick={() => setModal({ item: a.item, tabId: a.source })}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{a.label}</p>
                      <p className="text-gray-500 mt-0.5">{srcLabel[a.source]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge date={a.exp}/>
                      <p className={`mt-0.5 font-bold ${expired ? "text-red-600" : "text-orange-600"}`}>
                        {expired ? "Expirée" : `J−${dl}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── tables ── */}
      {loadingTab ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : (
        <>
          {/* Kaspersky */}
          {tab === "kaspersky" && (
            kaspersky.length === 0 ? (
              <Empty icon={Shield} label="Aucune licence Kaspersky" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Code d'activation</TH>
                        <TH>Machines</TH>
                        <TH>Date début</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                        <TH>Actions</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {kaspersky.map((lic: any, i: number) => {
                        const exp = expiration(lic);
                        return (
                          <tr key={lic.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                            <TD>{lic.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{lic.produit}</span></TD>
                            <TD mono>{lic.code_activation}</TD>
                            <TD>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
                                <Shield size={11}/>{lic.machines?.length ?? 0} / {lic.nb_machines ?? "?"}
                              </span>
                            </TD>
                            <TD>{fmt(lic.date_debut)}</TD>
                            <TD>{fmt(exp)}</TD>
                            <TD><StatusBadge date={exp}/></TD>
                            <TD center><VoirBtn item={lic} t="kaspersky"/></TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Microsoft 365 */}
          {tab === "m365" && (
            m365.length === 0 ? (
              <Empty icon={Users} label="Aucun compte Microsoft 365" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Compte organisateur</TH>
                        <TH>Email</TH>
                        <TH>Utilisateurs</TH>
                        <TH>Places libres</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                        <TH>Actions</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {m365.map((c: any, i: number) => {
                        const exp = expiration(c);
                        return (
                          <tr key={c.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                            <TD>{c.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{c.produit}</span></TD>
                            <TD><span className="text-blue-600 font-medium">{c.compte_organisateur}</span></TD>
                            <TD mono>{c.email_organisateur || "—"}</TD>
                            <TD><span className="font-bold text-camublue-900">{c.nb_utilisateurs ?? "—"}</span></TD>
                            <TD><span className={c.places_libres === 0 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"}>{c.places_libres ?? "—"}</span></TD>
                            <TD>{fmt(exp)}</TD>
                            <TD><StatusBadge date={exp}/></TD>
                            <TD center><VoirBtn item={c} t="m365"/></TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Adobe */}
          {tab === "adobe" && (
            adobe.length === 0 ? (
              <Empty icon={Palette} label="Aucune licence Adobe" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Utilisateur</TH>
                        <TH>Email du compte</TH>
                        <TH>Fournisseur</TH>
                        <TH>Activation</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                        <TH>Actions</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {adobe.map((a: any, i: number) => {
                        const exp = expiration(a);
                        return (
                          <tr key={a.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                            <TD>{a.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{a.produit}</span></TD>
                            <TD>{a.utilisateur || "—"}</TD>
                            <TD mono>{a.email_compte || "—"}</TD>
                            <TD>{a.fournisseur || "—"}</TD>
                            <TD>{fmt(a.date_activation)}</TD>
                            <TD>{fmt(exp)}</TD>
                            <TD><StatusBadge date={exp}/></TD>
                            <TD center><VoirBtn item={a} t="adobe"/></TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Power BI */}
          {tab === "powerbi" && (
            powerbi.length === 0 ? (
              <Empty icon={BarChart2} label="Aucune licence Power BI" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Utilisateur</TH>
                        <TH>Compte Power BI</TH>
                        <TH>Fournisseur</TH>
                        <TH>Activation</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                        <TH>Actions</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {powerbi.map((p: any, i: number) => {
                        const exp = expiration(p);
                        return (
                          <tr key={p.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                            <TD>{p.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{p.produit}</span></TD>
                            <TD>{p.utilisateur || "—"}</TD>
                            <TD mono>{p.compte_powerbi || "—"}</TD>
                            <TD>{p.fournisseur || "—"}</TD>
                            <TD>{fmt(p.date_activation)}</TD>
                            <TD>{fmt(exp)}</TD>
                            <TD><StatusBadge date={exp}/></TD>
                            <TD center><VoirBtn item={p} t="powerbi"/></TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* modal */}
      {modal && <LicenceModal item={modal.item} tabId={modal.tabId} onClose={() => setModal(null)} />}
    </AppLayout>
  );
}

function Empty({ icon: Icon, label, sub }: { icon: any; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <Icon size={48} className="mb-3 opacity-20" />
      <p className="font-medium text-gray-600">{label}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}
