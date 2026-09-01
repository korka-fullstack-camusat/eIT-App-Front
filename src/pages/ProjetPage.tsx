import React, { useEffect, useState } from "react";
import {
  Plus, X, Pencil, Trash2, Globe, GitBranch, CheckSquare,
  ChevronRight, Search, FolderKanban, Square,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

const today = () => new Date().toISOString().slice(0, 10);

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}

const STATUTS_PROJET = [
  { value: "EN_ATTENTE", label: "En attente",  color: "bg-gray-100 text-gray-600" },
  { value: "EN_COURS",   label: "En cours",    color: "bg-blue-100 text-blue-700" },
  { value: "TERMINE",    label: "Terminé",     color: "bg-emerald-100 text-emerald-700" },
  { value: "SUSPENDU",   label: "Suspendu",    color: "bg-orange-100 text-orange-600" },
];

const STATUTS_ETAPE = [
  { value: "A_FAIRE",  label: "À faire",  color: "text-gray-400", bg: "bg-gray-100" },
  { value: "EN_COURS", label: "En cours", color: "text-blue-600", bg: "bg-blue-50" },
  { value: "TERMINE",  label: "Terminé",  color: "text-emerald-600", bg: "bg-emerald-50" },
];

const TYPES_CHG = [
  { value: "FEATURE",      label: "Nouvelle fonctionnalité", color: "bg-violet-100 text-violet-700" },
  { value: "AMELIORATION", label: "Amélioration",            color: "bg-blue-100 text-blue-700" },
  { value: "BUGFIX",       label: "Correctif",               color: "bg-red-100 text-red-600" },
  { value: "AUTRE",        label: "Autre",                   color: "bg-gray-100 text-gray-600" },
];

const STATUTS_PAYS = [
  { value: "PREVU",   label: "Prévu",    color: "bg-gray-100 text-gray-600" },
  { value: "EN_TEST", label: "En test",  color: "bg-orange-100 text-orange-600" },
  { value: "DEPLOYE", label: "Déployé",  color: "bg-emerald-100 text-emerald-700" },
];

const stProjet  = (v: string) => STATUTS_PROJET.find(s => s.value === v) ?? STATUTS_PROJET[1];
const stEtape   = (v: string) => STATUTS_ETAPE.find(s => s.value === v)  ?? STATUTS_ETAPE[0];
const typeChg   = (v: string) => TYPES_CHG.find(s => s.value === v)      ?? TYPES_CHG[3];
const stPays    = (v: string) => STATUTS_PAYS.find(s => s.value === v)   ?? STATUTS_PAYS[2];

export default function ProjetPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [projets,   setProjets]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filterSt,  setFilterSt]  = useState("");
  const [selected,  setSelected]  = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<"etapes" | "changements" | "pays">("etapes");

  // Modals
  const [projModal,  setProjModal]  = useState(false);
  const [editProj,   setEditProj]   = useState<any | null>(null);
  const [projForm,   setProjForm]   = useState({ nom: "", description: "", statut: "EN_COURS", responsable: "", date_debut: "", date_fin: "", pourcentage: 0 });
  const [saving,     setSaving]     = useState(false);
  const [deleteProj, setDeleteProj] = useState<number | null>(null);

  // Étapes
  const [etapeModal, setEtapeModal] = useState(false);
  const [etapeForm,  setEtapeForm]  = useState({ titre: "", description: "", statut: "A_FAIRE", ordre: 0 });
  const [editEtape,  setEditEtape]  = useState<any | null>(null);

  // Changements
  const [chgModal,  setChgModal]  = useState(false);
  const [chgForm,   setChgForm]   = useState({ titre: "", description: "", type: "FEATURE", date: today(), auteur: "" });
  const [editChg,   setEditChg]   = useState<any | null>(null);

  // Pays
  const [paysModal, setPaysModal] = useState(false);
  const [paysForm,  setPaysForm]  = useState({ pays: "", date_deploiement: "", statut: "DEPLOYE", notes: "" });
  const [editPays,  setEditPays]  = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterSt) params.statut = filterSt;
      const res = await ax.get("/projets/", { params });
      setProjets(res.data);
      if (selected) setSelected((res.data as any[]).find((p: any) => p.id === selected.id) ?? null);
    } catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterSt]);

  const openCreateProj = () => {
    setEditProj(null);
    setProjForm({ nom: "", description: "", statut: "EN_COURS", responsable: "", date_debut: "", date_fin: "", pourcentage: 0 });
    setProjModal(true);
  };
  const openEditProj = (p: any) => {
    setEditProj(p);
    setProjForm({ nom: p.nom, description: p.description || "", statut: p.statut, responsable: p.responsable || "", date_debut: p.date_debut || "", date_fin: p.date_fin || "", pourcentage: p.pourcentage ?? 0 });
    setProjModal(true);
  };

  const saveProjet = async () => {
    if (!projForm.nom.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const payload = { ...projForm, date_debut: projForm.date_debut || null, date_fin: projForm.date_fin || null };
      if (editProj) await ax.patch(`/projets/${editProj.id}`, payload);
      else          await ax.post("/projets/", payload);
      toast.success(editProj ? "Projet mis à jour" : "Projet créé");
      setProjModal(false); load();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };

  const confirmDeleteProj = async () => {
    if (!deleteProj) return;
    try {
      await ax.delete(`/projets/${deleteProj}`);
      toast.success("Projet supprimé");
      setDeleteProj(null);
      if (selected?.id === deleteProj) setSelected(null);
      load();
    } catch { toast.error("Erreur"); }
  };

  // Étapes
  const saveEtape = async () => {
    if (!selected || !etapeForm.titre.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      if (editEtape) await ax.patch(`/projets/${selected.id}/etapes/${editEtape.id}`, etapeForm);
      else           await ax.post(`/projets/${selected.id}/etapes`, etapeForm);
      toast.success("Étape enregistrée"); setEtapeModal(false); load();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };
  const toggleEtape = async (etape: any) => {
    const next = etape.statut === "TERMINE" ? "A_FAIRE" : "TERMINE";
    try { await ax.patch(`/projets/${selected.id}/etapes/${etape.id}`, { statut: next }); load(); }
    catch { toast.error("Erreur"); }
  };
  const deleteEtape = async (etape: any) => {
    try { await ax.delete(`/projets/${selected.id}/etapes/${etape.id}`); load(); }
    catch { toast.error("Erreur"); }
  };

  // Changements
  const saveChg = async () => {
    if (!selected || !chgForm.titre.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      if (editChg) await ax.patch(`/projets/${selected.id}/changements/${editChg.id}`, chgForm);
      else         await ax.post(`/projets/${selected.id}/changements`, chgForm);
      toast.success("Changement enregistré"); setChgModal(false); load();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };
  const deleteChg = async (c: any) => {
    try { await ax.delete(`/projets/${selected.id}/changements/${c.id}`); load(); }
    catch { toast.error("Erreur"); }
  };

  // Pays
  const savePays = async () => {
    if (!selected || !paysForm.pays.trim()) { toast.error("Le pays est requis"); return; }
    setSaving(true);
    try {
      const payload = { ...paysForm, date_deploiement: paysForm.date_deploiement || null };
      if (editPays) await ax.patch(`/projets/${selected.id}/pays/${editPays.id}`, payload);
      else          await ax.post(`/projets/${selected.id}/pays`, payload);
      toast.success("Pays enregistré"); setPaysModal(false); load();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };
  const deletePays = async (p: any) => {
    try { await ax.delete(`/projets/${selected.id}/pays/${p.id}`); load(); }
    catch { toast.error("Erreur"); }
  };

  const q = search.toLowerCase();
  const filtered = projets.filter(p => !q || p.nom.toLowerCase().includes(q) || (p.responsable || "").toLowerCase().includes(q));

  const pctProjet = (p: any) => Math.min(100, Math.max(0, p.pourcentage ?? 0));

  const cols = canEdit ? 7 : 6;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Suivi des projets</h1>
            <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : `${filtered.length} projet(s)`}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 bg-white shadow-sm w-48" />
            </div>
            <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm bg-white outline-none text-gray-700">
              <option value="">Tous les statuts</option>
              {STATUTS_PROJET.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {canEdit && (
              <button onClick={openCreateProj}
                className="flex items-center gap-2 px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm font-semibold shadow hover:bg-camublue-900/90 transition">
                <Plus size={15} /> Nouveau projet
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 flex-wrap">
          {STATUTS_PROJET.map(s => {
            const n = projets.filter(p => p.statut === s.value || (p.statut && p.statut.endsWith(s.value))).length;
            return (
              <div key={s.value} className="flex-1 min-w-[90px] bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                <p className="text-2xl font-black text-gray-800">{n}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Layout 2 colonnes ── */}
      <div className="flex gap-4 min-h-0">
        {/* ── Liste projets ── */}
        <div className={`flex flex-col gap-3 ${selected ? "w-80 shrink-0" : "w-full"}`}>
          {loading ? (
            <div className="text-center py-20 text-gray-400">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <FolderKanban size={48} className="mb-3 opacity-20" />
              <p className="font-medium">Aucun projet</p>
            </div>
          ) : filtered.map(p => {
            const st  = stProjet(p.statut);
            const pct = pctProjet(p);
            const isSel = selected?.id === p.id;
            return (
              <div key={p.id} onClick={() => { setSelected(isSel ? null : p); setDetailTab("etapes"); }}
                className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${isSel ? "border-camublue-900 ring-1 ring-camublue-900/20" : "border-gray-100"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{p.nom}</p>
                    {p.responsable && <p className="text-xs text-gray-400 mt-0.5">{p.responsable}</p>}
                  </div>
                  <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                </div>
                {p.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>}
                {/* Barre avancement */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-camublue-900 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{pct}%</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><CheckSquare size={10} />{p.etapes?.length ?? 0} étape(s)</span>
                  <span className="flex items-center gap-1"><GitBranch size={10} />{p.changements?.length ?? 0} changement(s)</span>
                  <span className="flex items-center gap-1"><Globe size={10} />{p.pays?.length ?? 0} pays</span>
                  {isSel && <ChevronRight size={12} className="ml-auto text-camublue-900" />}
                </div>
                {canEdit && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditProj(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteProj(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Panneau détail ── */}
        {selected && (
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {/* En-tête bleu */}
            <div className="bg-[#1F3864] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.nom}</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${stProjet(selected.statut).color}`}>{stProjet(selected.statut).label}</span>
                    {selected.responsable && <span className="text-blue-200 text-xs">{selected.responsable}</span>}
                    {selected.date_debut  && <span className="text-blue-300 text-xs">Du {fmt(selected.date_debut)}</span>}
                    {selected.date_fin    && <span className="text-blue-300 text-xs">au {fmt(selected.date_fin)}</span>}
                  </div>
                  {selected.description && <p className="text-blue-200 text-xs mt-2 max-w-lg">{selected.description}</p>}
                  {/* Barre globale */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-48 bg-white/20 rounded-full h-1.5">
                      <div className="bg-white h-1.5 rounded-full transition-all" style={{ width: `${pctProjet(selected)}%` }} />
                    </div>
                    <span className="text-white text-xs font-semibold">{pctProjet(selected)}% terminé</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white shrink-0 mt-0.5"><X size={18} /></button>
              </div>
            </div>

            {/* Onglets */}
            <div className="flex border-b border-gray-100">
              {([
                { key: "etapes",      label: "Avancement",   icon: <CheckSquare size={14} />,  count: selected.etapes?.length },
                { key: "changements", label: "Changements",  icon: <GitBranch size={14} />,    count: selected.changements?.length },
                { key: "pays",        label: "Déploiements", icon: <Globe size={14} />,         count: selected.pays?.length },
              ] as const).map(({ key, label, icon, count }) => (
                <button key={key} onClick={() => setDetailTab(key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
                    detailTab === key ? "border-camublue-900 text-camublue-900" : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}>
                  {icon} {label}
                  <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── Étapes / Avancement ── */}
              {detailTab === "etapes" && (
                <div>
                  {canEdit && (
                    <button onClick={() => { setEditEtape(null); setEtapeForm({ titre: "", description: "", statut: "A_FAIRE", ordre: selected.etapes?.length ?? 0 }); setEtapeModal(true); }}
                      className="flex items-center gap-1.5 text-xs text-camublue-900 font-semibold hover:underline mb-4">
                      <Plus size={13} /> Ajouter une étape
                    </button>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1F3864]">
                          {["Étape", "Statut", ""].map((h, i) => (
                            <th key={i} className={`px-4 py-2.5 text-left text-xs font-bold text-white ${i < 2 ? "border-r border-[#2e4d8a]" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.etapes?.length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-gray-400 italic">Aucune étape définie</td></tr>
                        )}
                        {selected.etapes?.map((e: any, i: number) => {
                          const st = stEtape(e.statut);
                          return (
                            <tr key={e.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/20`}>
                              <td className="px-4 py-3 border-r border-gray-100">
                                <button onClick={() => toggleEtape(e)} className="flex items-center gap-2 text-left group">
                                  {e.statut === "TERMINE"
                                    ? <CheckSquare size={16} className="text-emerald-500 shrink-0" />
                                    : <Square size={16} className="text-gray-300 group-hover:text-gray-500 shrink-0" />}
                                  <span className={`font-medium ${e.statut === "TERMINE" ? "line-through text-gray-400" : "text-gray-800"}`}>{e.titre}</span>
                                </button>
                                {e.description && <p className="text-xs text-gray-400 ml-6 mt-0.5">{e.description}</p>}
                              </td>
                              <td className="px-4 py-3 border-r border-gray-100">
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditEtape(e); setEtapeForm({ titre: e.titre, description: e.description || "", statut: e.statut, ordre: e.ordre }); setEtapeModal(true); }}
                                      className="p-1 rounded hover:bg-blue-50 text-blue-400 transition"><Pencil size={12} /></button>
                                    <button onClick={() => deleteEtape(e)} className="p-1 rounded hover:bg-red-50 text-red-400 transition"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Changements ── */}
              {detailTab === "changements" && (
                <div>
                  {canEdit && (
                    <button onClick={() => { setEditChg(null); setChgForm({ titre: "", description: "", type: "FEATURE", date: today(), auteur: "" }); setChgModal(true); }}
                      className="flex items-center gap-1.5 text-xs text-camublue-900 font-semibold hover:underline mb-4">
                      <Plus size={13} /> Ajouter un changement
                    </button>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1F3864]">
                          {["Date", "Type", "Changement", "Auteur", ""].map((h, i) => (
                            <th key={i} className={`px-4 py-2.5 text-left text-xs font-bold text-white whitespace-nowrap ${i < 4 ? "border-r border-[#2e4d8a]" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.changements?.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400 italic">Aucun changement enregistré</td></tr>
                        )}
                        {selected.changements?.map((c: any, i: number) => {
                          const tc = typeChg(c.type);
                          return (
                            <tr key={c.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/20`}>
                              <td className="px-4 py-3 border-r border-gray-100 text-gray-500 whitespace-nowrap text-xs">{fmt(c.date)}</td>
                              <td className="px-4 py-3 border-r border-gray-100">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tc.color}`}>{tc.label}</span>
                              </td>
                              <td className="px-4 py-3 border-r border-gray-100">
                                <p className="font-medium text-gray-800">{c.titre}</p>
                                {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                              </td>
                              <td className="px-4 py-3 border-r border-gray-100 text-gray-500 text-xs whitespace-nowrap">{c.auteur || "—"}</td>
                              <td className="px-4 py-3">
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditChg(c); setChgForm({ titre: c.titre, description: c.description || "", type: c.type, date: c.date, auteur: c.auteur || "" }); setChgModal(true); }}
                                      className="p-1 rounded hover:bg-blue-50 text-blue-400 transition"><Pencil size={12} /></button>
                                    <button onClick={() => deleteChg(c)} className="p-1 rounded hover:bg-red-50 text-red-400 transition"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Pays déployés ── */}
              {detailTab === "pays" && (
                <div>
                  {canEdit && (
                    <button onClick={() => { setEditPays(null); setPaysForm({ pays: "", date_deploiement: "", statut: "DEPLOYE", notes: "" }); setPaysModal(true); }}
                      className="flex items-center gap-1.5 text-xs text-camublue-900 font-semibold hover:underline mb-4">
                      <Plus size={13} /> Ajouter un pays
                    </button>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1F3864]">
                          {["Pays", "Statut", "Date déploiement", "Notes", ""].map((h, i) => (
                            <th key={i} className={`px-4 py-2.5 text-left text-xs font-bold text-white whitespace-nowrap ${i < 4 ? "border-r border-[#2e4d8a]" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.pays?.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400 italic">Aucun déploiement enregistré</td></tr>
                        )}
                        {selected.pays?.map((p: any, i: number) => {
                          const sp = stPays(p.statut);
                          return (
                            <tr key={p.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/20`}>
                              <td className="px-4 py-3 border-r border-gray-100 font-semibold text-gray-800 flex items-center gap-2">
                                <Globe size={14} className="text-gray-400 shrink-0" />{p.pays}
                              </td>
                              <td className="px-4 py-3 border-r border-gray-100">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sp.color}`}>{sp.label}</span>
                              </td>
                              <td className="px-4 py-3 border-r border-gray-100 text-gray-500 text-xs whitespace-nowrap">{fmt(p.date_deploiement)}</td>
                              <td className="px-4 py-3 border-r border-gray-100 text-gray-500 text-xs">{p.notes || "—"}</td>
                              <td className="px-4 py-3">
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditPays(p); setPaysForm({ pays: p.pays, date_deploiement: p.date_deploiement || "", statut: p.statut, notes: p.notes || "" }); setPaysModal(true); }}
                                      className="p-1 rounded hover:bg-blue-50 text-blue-400 transition"><Pencil size={12} /></button>
                                    <button onClick={() => deletePays(p)} className="p-1 rounded hover:bg-red-50 text-red-400 transition"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal projet ── */}
      {projModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-camublue-900">{editProj ? "Modifier le projet" : "Nouveau projet"}</h2>
              <button onClick={() => setProjModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Nom *</label>
                <input value={projForm.nom} onChange={e => setProjForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Statut</label>
                <select value={projForm.statut} onChange={e => setProjForm(f => ({ ...f, statut: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                  {STATUTS_PROJET.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Responsable</label>
                <input value={projForm.responsable} onChange={e => setProjForm(f => ({ ...f, responsable: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Avancement</label>
                  <span className="text-sm font-bold text-camublue-900">{projForm.pourcentage}%</span>
                </div>
                <input type="range" min={0} max={100} step={5}
                  value={projForm.pourcentage}
                  onChange={e => setProjForm(f => ({ ...f, pourcentage: Number(e.target.value) }))}
                  className="w-full accent-camublue-900 cursor-pointer" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setProjModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveProjet} disabled={saving}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold disabled:opacity-50 transition hover:bg-camublue-900/90">
                {saving ? "Enregistrement…" : editProj ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal étape ── */}
      {etapeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-camublue-900">{editEtape ? "Modifier l'étape" : "Nouvelle étape"}</h2>
              <button onClick={() => setEtapeModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Titre *</label>
                <input value={etapeForm.titre} onChange={e => setEtapeForm(f => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Statut</label>
                <select value={etapeForm.statut} onChange={e => setEtapeForm(f => ({ ...f, statut: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                  {STATUTS_ETAPE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Description</label>
                <input value={etapeForm.description} onChange={e => setEtapeForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setEtapeModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveEtape} disabled={saving}
                className="px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal changement ── */}
      {chgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-camublue-900">{editChg ? "Modifier" : "Nouveau changement"}</h2>
              <button onClick={() => setChgModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Titre *</label>
                <input value={chgForm.titre} onChange={e => setChgForm(f => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Type</label>
                  <select value={chgForm.type} onChange={e => setChgForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                    {TYPES_CHG.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date</label>
                  <input type="date" value={chgForm.date} onChange={e => setChgForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Auteur</label>
                <input value={chgForm.auteur} onChange={e => setChgForm(f => ({ ...f, auteur: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Description</label>
                <textarea value={chgForm.description} onChange={e => setChgForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setChgModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveChg} disabled={saving}
                className="px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pays ── */}
      {paysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-camublue-900">{editPays ? "Modifier" : "Ajouter un pays"}</h2>
              <button onClick={() => setPaysModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Pays *</label>
                <input value={paysForm.pays} onChange={e => setPaysForm(f => ({ ...f, pays: e.target.value }))}
                  placeholder="Ex: Sénégal, Côte d'Ivoire…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Statut</label>
                  <select value={paysForm.statut} onChange={e => setPaysForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                    {STATUTS_PAYS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date déploiement</label>
                  <input type="date" value={paysForm.date_deploiement} onChange={e => setPaysForm(f => ({ ...f, date_deploiement: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Notes</label>
                <input value={paysForm.notes} onChange={e => setPaysForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setPaysModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={savePays} disabled={saving}
                className="px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression projet ── */}
      {deleteProj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-camublue-900 mb-2">Supprimer le projet ?</h3>
            <p className="text-sm text-gray-500 mb-5">Toutes les étapes, changements et pays associés seront supprimés.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteProj(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={confirmDeleteProj} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
