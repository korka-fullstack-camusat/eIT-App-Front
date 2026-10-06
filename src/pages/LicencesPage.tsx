import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Shield, Users, Palette, BarChart2, ChevronDown, ChevronRight, AlertTriangle, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, j] = String(d).slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

function isExpired(d?: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function expireSoon(d?: string | null) {
  if (!d) return false;
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 60;
}

function StatusBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-gray-300 text-xs">—</span>;
  if (isExpired(date))  return <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold"><AlertTriangle size={9}/>Expirée</span>;
  if (expireSoon(date)) return <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">Bientôt</span>;
  return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Active</span>;
}

type Tab = "kaspersky" | "m365" | "adobe" | "powerbi";

const TABS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: "kaspersky", label: "Kaspersky",     icon: Shield,    color: "text-emerald-600" },
  { id: "m365",      label: "Microsoft 365", icon: Users,     color: "text-blue-600"    },
  { id: "adobe",     label: "Adobe",         icon: Palette,   color: "text-red-600"     },
  { id: "powerbi",   label: "Power BI",      icon: BarChart2, color: "text-amber-600"   },
];

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

  const [expandedKasp, setExpandedKasp] = useState<Set<number>>(new Set());
  const [expandedM365, setExpandedM365] = useState<Set<number>>(new Set());

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

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

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
      loadTab(tab);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Erreur lors de l'import";
      toast.error(msg);
    }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  };

  const toggleKasp = (id: number) => setExpandedKasp(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleM365 = (id: number) => setExpandedM365(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const TH = ({ children }: { children: any }) => (
    <th className="px-3 py-2.5 text-left text-xs font-bold text-white whitespace-nowrap border-r border-[#2e4d8a] last:border-r-0">{children}</th>
  );
  const TD = ({ children, mono }: { children: any; mono?: boolean }) => (
    <td className={`px-3 py-2.5 text-xs border-b border-gray-100 ${mono ? "font-mono" : ""}`}>{children}</td>
  );

  return (
    <AppLayout>
      {/* Header */}
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

        {/* Tabs */}
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

      {/* Content */}
      {loadingTab ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : (
        <>
          {/* ── Kaspersky ── */}
          {tab === "kaspersky" && (
            kaspersky.length === 0 ? (
              <Empty icon={Shield} label="Aucune licence Kaspersky" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH> </TH>
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Code d'activation</TH>
                        <TH>Machines</TH>
                        <TH>Date début</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {kaspersky.map((lic: any, i: number) => (
                        <>
                          <tr key={lic.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 cursor-pointer`}
                            onClick={() => toggleKasp(lic.id)}>
                            <TD>{expandedKasp.has(lic.id) ? <ChevronDown size={13} className="text-gray-400"/> : <ChevronRight size={13} className="text-gray-400"/>}</TD>
                            <TD>{lic.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{lic.produit}</span></TD>
                            <TD mono>{lic.code_activation}</TD>
                            <TD>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
                                <Shield size={11}/>{lic.machines?.length ?? 0} / {lic.nb_machines ?? "?"}
                              </span>
                            </TD>
                            <TD>{fmt(lic.date_debut)}</TD>
                            <TD>{fmt(lic.date_expiration)}</TD>
                            <TD><StatusBadge date={lic.date_expiration}/></TD>
                          </tr>
                          {expandedKasp.has(lic.id) && lic.machines?.length > 0 && (
                            <tr key={`${lic.id}-machines`}>
                              <td colSpan={8} className="bg-emerald-50/40 px-6 py-2 border-b border-gray-100">
                                <p className="text-xs font-bold text-emerald-700 mb-1.5">Machines ({lic.machines.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {lic.machines.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-1.5 bg-white border border-emerald-100 rounded-lg px-2.5 py-1 text-xs">
                                      <span className="font-medium text-gray-700">{m.machine}</span>
                                      {m.statut && <span className="text-gray-400">· {m.statut}</span>}
                                      {m.date_expiration && <span className={`${isExpired(m.date_expiration) ? "text-red-500" : "text-gray-400"}`}>· {fmt(m.date_expiration)}</span>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── Microsoft 365 ── */}
          {tab === "m365" && (
            m365.length === 0 ? (
              <Empty icon={Users} label="Aucun compte Microsoft 365" sub="Importez le fichier pour voir les données" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1F3864]">
                        <TH> </TH>
                        <TH>N°</TH>
                        <TH>Produit</TH>
                        <TH>Compte organisateur</TH>
                        <TH>Email</TH>
                        <TH>Utilisateurs</TH>
                        <TH>Places libres</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {m365.map((c: any, i: number) => (
                        <>
                          <tr key={c.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 cursor-pointer`}
                            onClick={() => toggleM365(c.id)}>
                            <TD>{expandedM365.has(c.id) ? <ChevronDown size={13} className="text-gray-400"/> : <ChevronRight size={13} className="text-gray-400"/>}</TD>
                            <TD>{c.numero ?? "—"}</TD>
                            <TD><span className="font-medium text-gray-800">{c.produit}</span></TD>
                            <TD><span className="text-blue-600 font-medium">{c.compte_organisateur}</span></TD>
                            <TD mono>{c.email_organisateur || "—"}</TD>
                            <TD><span className="font-bold text-camublue-900">{c.nb_utilisateurs ?? "—"}</span></TD>
                            <TD><span className={c.places_libres === 0 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"}>{c.places_libres ?? "—"}</span></TD>
                            <TD>{fmt(c.date_expiration)}</TD>
                            <TD><StatusBadge date={c.date_expiration}/></TD>
                          </tr>
                          {expandedM365.has(c.id) && c.membres?.length > 0 && (
                            <tr key={`${c.id}-membres`}>
                              <td colSpan={9} className="bg-blue-50/40 px-6 py-2 border-b border-gray-100">
                                <p className="text-xs font-bold text-blue-700 mb-1.5">Membres ({c.membres.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {c.membres.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-1.5 bg-white border border-blue-100 rounded-lg px-2.5 py-1 text-xs">
                                      <span className="font-medium text-gray-700">{m.nom}</span>
                                      {m.email && <span className="text-gray-400">· {m.email}</span>}
                                      {m.role  && <span className="text-blue-500 font-semibold">· {m.role}</span>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── Adobe ── */}
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
                        <TH>Renouvellement</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {adobe.map((a: any, i: number) => (
                        <tr key={a.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                          <TD>{a.numero ?? "—"}</TD>
                          <TD><span className="font-medium text-gray-800">{a.produit}</span></TD>
                          <TD>{a.utilisateur || "—"}</TD>
                          <TD mono>{a.email_compte || "—"}</TD>
                          <TD>{a.fournisseur || "—"}</TD>
                          <TD>{fmt(a.date_activation)}</TD>
                          <TD>{fmt(a.dernier_renouvellement)}</TD>
                          <TD>{fmt(a.date_expiration)}</TD>
                          <TD><StatusBadge date={a.date_expiration}/></TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── Power BI ── */}
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
                        <TH>Renouvellement</TH>
                        <TH>Expiration</TH>
                        <TH>Statut</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {powerbi.map((p: any, i: number) => (
                        <tr key={p.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                          <TD>{p.numero ?? "—"}</TD>
                          <TD><span className="font-medium text-gray-800">{p.produit}</span></TD>
                          <TD>{p.utilisateur || "—"}</TD>
                          <TD mono>{p.compte_powerbi || "—"}</TD>
                          <TD>{p.fournisseur || "—"}</TD>
                          <TD>{fmt(p.date_activation)}</TD>
                          <TD>{fmt(p.dernier_renouvellement)}</TD>
                          <TD>{fmt(p.date_expiration)}</TD>
                          <TD><StatusBadge date={p.date_expiration}/></TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
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
