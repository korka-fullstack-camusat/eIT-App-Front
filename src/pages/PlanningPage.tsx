import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Calendar, Search, CheckSquare, Square, ListChecks, ChevronDown, ChevronUp, Download } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { planningService, ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

const STATUTS = [
  { value: "A_FAIRE",  label: "À faire",  color: "bg-gray-100 text-gray-600",       ring: "ring-gray-300" },
  { value: "EN_COURS", label: "En cours", color: "bg-blue-100 text-blue-700",       ring: "ring-blue-300" },
  { value: "TERMINE",  label: "Terminé",  color: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-300" },
  { value: "ANNULE",   label: "Annulé",   color: "bg-red-100 text-red-600",         ring: "ring-red-300" },
];

const PRIORITES = [
  { value: "BASSE",   label: "Basse",   color: "text-gray-400" },
  { value: "NORMALE", label: "Normale", color: "text-blue-500" },
  { value: "HAUTE",   label: "Haute",   color: "text-orange-500" },
  { value: "URGENTE", label: "Urgente", color: "text-red-600 font-bold" },
];

const RESPONSABLE_COLORS: Record<string, string> = {
  Libasse: "bg-violet-100 text-violet-700",
  Korka:   "bg-teal-100 text-teal-700",
};

const today = () => new Date().toISOString().slice(0, 10);
const RESPONSABLES = ["Libasse", "Korka"];
const EMPTY = { titre: "", date_planifiee: today(), date_fin: "", statut: "A_FAIRE", priorite: "NORMALE", responsable: "" };

function fmt(d?: string | null) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}
function stInfo(v: string) { return STATUTS.find(s => s.value === v) ?? STATUTS[0]; }
function prInfo(v: string) { return PRIORITES.find(p => p.value === v) ?? PRIORITES[1]; }

function StatutBadge({ statut, canEdit, onClick }: { statut: string; canEdit: boolean; onClick: () => void }) {
  const st = stInfo(statut);
  if (!canEdit) return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>;
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:ring-2 transition ${st.color} ${st.ring}`}>
      {st.label}
    </button>
  );
}

export default function PlanningPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [tab, setTab] = useState<"taches" | "checklists">("taches");

  // ── Tâches ──
  const [taches,            setTaches]            = useState<any[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [filterDate,        setFilterDate]        = useState(today());
  const [filterStatut,      setFilterStatut]      = useState("");
  const [filterResponsable, setFilterResponsable] = useState("");
  const [modalOpen,         setModalOpen]         = useState(false);
  const [editing,           setEditing]           = useState<any | null>(null);
  const [form,              setForm]              = useState({ ...EMPTY });
  const [saving,            setSaving]            = useState(false);
  const [deleteId,          setDeleteId]          = useState<number | null>(null);
  const [statutTarget,      setStatutTarget]      = useState<any | null>(null);
  const [search,            setSearch]            = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterDate)        { params.date_debut = filterDate; params.date_fin = filterDate; }
      if (filterStatut)        params.statut = filterStatut;
      if (filterResponsable)   params.responsable = filterResponsable;
      setTaches(await planningService.list(params));
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterDate, filterStatut, filterResponsable]);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, date_planifiee: filterDate || today() }); setModalOpen(true); };
  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ titre: t.titre, date_planifiee: t.date_planifiee, date_fin: t.date_fin || "", statut: t.statut, priorite: t.priorite, responsable: t.responsable || "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.titre.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      const payload = { ...form, date_fin: form.date_fin || null };
      if (editing) { await planningService.update(editing.id, payload); toast.success("Tâche mise à jour"); }
      else         { await planningService.create(payload);              toast.success("Tâche créée"); }
      setModalOpen(false); load();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await planningService.delete(deleteId); toast.success("Tâche supprimée"); setDeleteId(null); load(); }
    catch { toast.error("Erreur suppression"); }
  };

  const changeStatut = async (id: number, statut: string) => {
    try { await planningService.update(id, { statut }); setStatutTarget(null); load(); }
    catch { toast.error("Erreur"); }
  };

  // ── Checklists ──
  const [checklists,      setChecklists]      = useState<any[]>([]);
  const [clLoading,       setClLoading]       = useState(false);
  const [expandedCl,      setExpandedCl]      = useState<number | null>(null);
  const [clModal,         setClModal]         = useState(false);
  const [clForm,          setClForm]          = useState({ nom: "", description: "", responsable: "" });
  const [clItems,         setClItems]         = useState<string[]>([""]);
  const [savingCl,        setSavingCl]        = useState(false);
  const [deleteCl,        setDeleteCl]        = useState<number | null>(null);
  const [newItemText,     setNewItemText]     = useState<Record<number, string>>({});

  const loadChecklists = async () => {
    setClLoading(true);
    try { setChecklists((await ax.get("/planning/checklists")).data); }
    catch { toast.error("Erreur checklists"); }
    finally { setClLoading(false); }
  };

  useEffect(() => { loadChecklists(); }, []);
  useEffect(() => { if (tab === "checklists") loadChecklists(); }, [tab]);

  const saveChecklist = async () => {
    if (!clItems.some(t => t.trim())) { toast.error("Ajoutez au moins une tâche"); return; }
    setSavingCl(true);
    try {
      const items = clItems.filter(t => t.trim()).map((titre, ordre) => ({ titre, ordre }));
      await ax.post("/planning/checklists", { ...clForm, items });
      toast.success("Checklist créée");
      setClModal(false); setClForm({ nom: "", description: "", responsable: "" }); setClItems([""]);
      loadChecklists();
    } catch { toast.error("Erreur création"); }
    finally { setSavingCl(false); }
  };

  const toggleItem = async (cl: any, item: any) => {
    try {
      await ax.patch(`/planning/checklists/${cl.id}/items/${item.id}`, { cochee: !item.cochee });
      setChecklists(prev => prev.map(c => c.id !== cl.id ? c : {
        ...c, items: c.items.map((it: any) => it.id === item.id ? { ...it, cochee: !it.cochee } : it)
      }));
    } catch { toast.error("Erreur"); }
  };

  const addItem = async (cl: any) => {
    const titre = (newItemText[cl.id] || "").trim();
    if (!titre) return;
    try {
      const res = await ax.post(`/planning/checklists/${cl.id}/items`, { titre, ordre: cl.items.length });
      setChecklists(prev => prev.map(c => c.id !== cl.id ? c : { ...c, items: [...c.items, res.data] }));
      setNewItemText(prev => ({ ...prev, [cl.id]: "" }));
    } catch { toast.error("Erreur"); }
  };

  const deleteItem = async (cl: any, item: any) => {
    try {
      await ax.delete(`/planning/checklists/${cl.id}/items/${item.id}`);
      setChecklists(prev => prev.map(c => c.id !== cl.id ? c : { ...c, items: c.items.filter((it: any) => it.id !== item.id) }));
    } catch { toast.error("Erreur"); }
  };

  const confirmDeleteCl = async () => {
    if (!deleteCl) return;
    try {
      await ax.delete(`/planning/checklists/${deleteCl}`);
      toast.success("Checklist supprimée"); setDeleteCl(null); loadChecklists();
    } catch { toast.error("Erreur"); }
  };

  const byPrio = ["URGENTE", "HAUTE", "NORMALE", "BASSE"];
  const q = search.toLowerCase().trim();
  const filtered = q ? taches.filter(t => t.titre.toLowerCase().includes(q)) : taches;
  const sorted = [...filtered].sort((a, b) => {
    // groupe par responsable d'abord, puis par priorité
    if (a.responsable !== b.responsable) return (a.responsable || "").localeCompare(b.responsable || "");
    return byPrio.indexOf(a.priorite) - byPrio.indexOf(b.priorite);
  });
  const counts = {
    total:   taches.length,
    afaire:  taches.filter(t => t.statut === "A_FAIRE").length,
    encours: taches.filter(t => t.statut === "EN_COURS").length,
    termine: taches.filter(t => t.statut === "TERMINE").length,
  };

  return (
    <AppLayout>
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Gestion planning</h1>
            <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : q ? `${sorted.length} / ${taches.length} tâche(s)` : `${taches.length} tâche(s)`}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm min-w-[200px]">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une tâche…"
                className="text-sm text-gray-700 outline-none bg-transparent w-full" />
              {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={14} className="text-gray-400" />
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent" />
              {filterDate && <button onClick={() => setFilterDate("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
            </div>
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm bg-white outline-none text-gray-700">
              <option value="">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filterResponsable} onChange={e => setFilterResponsable(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm bg-white outline-none text-gray-700">
              <option value="">Tous</option>
              {RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {/* Exporter */}
            <button onClick={async () => {
              try {
                const params: any = {};
                if (filterDate)        { params.date_debut = filterDate; params.date_fin = filterDate; }
                if (filterStatut)        params.statut = filterStatut;
                if (filterResponsable)   params.responsable = filterResponsable;
                const res = await ax.get("/planning/export", { params, responseType: "blob" });
                const href = URL.createObjectURL(res.data);
                const a = document.createElement("a"); a.href = href; a.download = "planning.xlsx"; a.click();
                URL.revokeObjectURL(href);
              } catch { toast.error("Erreur export"); }
            }}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 shadow-sm transition">
              <Download size={14} /> Exporter
            </button>

            {canEdit && tab === "taches" && (
              <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm font-semibold shadow hover:bg-camublue-900/90 transition">
                <Plus size={15} /> Nouvelle tâche
              </button>
            )}
            {canEdit && tab === "checklists" && (
              <button onClick={() => { setClForm({ nom: "", description: "", responsable: "" }); setClItems([""]); setClModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm font-semibold shadow hover:bg-camublue-900/90 transition">
                <Plus size={15} /> Nouvelle checklist
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {([
            { key: "taches",      label: "Tâches",      icon: <Calendar size={15} /> },
            { key: "checklists",  label: "Checklists",  icon: <ListChecks size={15} /> },
          ] as const).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
                tab === key
                  ? "border-camublue-900 text-camublue-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === "taches" && (
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Total",    val: counts.total,   border: "border-l-camublue-900" },
              { label: "À faire",  val: counts.afaire,  border: "border-l-gray-400" },
              { label: "En cours", val: counts.encours, border: "border-l-blue-500" },
              { label: "Terminé",  val: counts.termine, border: "border-l-emerald-500" },
            ].map(s => (
              <div key={s.label} className={`flex-1 min-w-[90px] bg-white rounded-xl border border-gray-100 border-l-4 ${s.border} px-4 py-3 shadow-sm`}>
                <p className="text-2xl font-black text-gray-800">{s.val}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Onglet Tâches ── */}
      {tab === "taches" && (loading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : sorted.length === 0 && checklists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Calendar size={48} className="mb-3 opacity-20" />
          <p className="font-medium">Aucune tâche{filterDate ? ` pour le ${fmt(filterDate)}` : ""}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1F3864] select-none">
                  {["Responsable", "Tâche", "Planifiée", "Date fin", "Priorité", "Statut"].map((h, idx) => (
                    <th key={h}
                      className={`px-4 py-2.5 text-xs font-bold text-white border-r border-[#2e4d8a] whitespace-nowrap
                        ${idx === 1 ? "text-left" : "text-center"}
                        ${idx === 0 ? "w-28" : ""}
                        ${idx === 2 || idx === 3 || idx === 4 ? "w-28" : ""}
                        ${idx === 5 ? "w-36" : ""}`}>
                      {h}
                    </th>
                  ))}
                  {canEdit && <th className="px-4 py-2.5 w-20 border-r border-[#2e4d8a]" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const pr = prInfo(t.priorite);
                  const isTermine = t.statut === "TERMINE";
                  const respColor = RESPONSABLE_COLORS[t.responsable] ?? "bg-gray-100 text-gray-500";
                  return (
                    <tr key={t.id}
                      className={`transition-colors ${isTermine ? "bg-[#f5f5f5]" : i % 2 === 0 ? "bg-white" : "bg-[#EEF2FF]/40"} hover:bg-[#dbeafe]/40`}>
                      <td className="px-4 py-2.5 text-center border border-gray-200">
                        {t.responsable
                          ? <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${respColor}`}>{t.responsable}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 border border-gray-200">
                        <span className={`font-medium text-gray-900 break-words ${isTermine ? "line-through text-gray-400" : ""}`}>{t.titre}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums whitespace-nowrap border border-gray-200">{fmt(t.date_planifiee)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums whitespace-nowrap border border-gray-200">{fmt(t.date_fin)}</td>
                      <td className={`px-4 py-2.5 text-center text-xs font-semibold border border-gray-200 ${pr.color}`}>{pr.label}</td>
                      <td className="px-4 py-2.5 text-center border border-gray-200">
                        <StatutBadge statut={t.statut} canEdit={canEdit} onClick={() => setStatutTarget(t)} />
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 border border-gray-200">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* ── Checklists dans le tableau ── */}
                {checklists.map(cl => {
                  const total  = cl.items.length;
                  const coches = cl.items.filter((it: any) => it.cochee).length;
                  const pct    = total ? Math.round((coches / total) * 100) : 0;
                  const done   = total > 0 && coches === total;
                  const isOpen = expandedCl === cl.id;
                  const respColor = RESPONSABLE_COLORS[cl.responsable] ?? "bg-gray-100 text-gray-500";
                  const cols = canEdit ? 7 : 6;
                  return (
                    <React.Fragment key={`cl-${cl.id}`}>
                      {/* En-tête groupe checklist */}
                      <tr className={`cursor-pointer transition-colors ${done ? "bg-emerald-50" : "bg-[#EEF2FF]"} hover:bg-[#dbeafe]/60`}
                        onClick={() => setExpandedCl(isOpen ? null : cl.id)}>
                        <td className="px-4 py-2.5 text-center border border-gray-200">
                          {cl.responsable
                            ? <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${respColor}`}>{cl.responsable}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <ListChecks size={14} className={done ? "text-emerald-500" : "text-camublue-900"} />
                            <span className="font-semibold text-gray-900">{cl.nom}</span>
                            <span className="text-xs text-gray-400">{coches}/{total}</span>
                            <div className="flex-1 max-w-[100px] bg-gray-200 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full transition-all ${done ? "bg-emerald-500" : "bg-camublue-900"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="border border-gray-200" />
                        <td className="border border-gray-200" />
                        <td className="border border-gray-200" />
                        <td className="px-4 py-2.5 text-center border border-gray-200">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                            {done ? "Terminée" : "En cours"}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2.5 border border-gray-200">
                            <div className="flex items-center gap-1 justify-end">
                              {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                              <button onClick={e => { e.stopPropagation(); setDeleteCl(cl.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Items de la checklist */}
                      {isOpen && cl.items.map((item: any) => (
                        <tr key={`cl-item-${item.id}`} className={`transition-colors ${item.cochee ? "bg-emerald-50/40" : "bg-white"}`}>
                          <td className="border border-gray-100" />
                          <td className="px-4 py-2 border border-gray-100 pl-10">
                            <div className="flex items-center gap-2 group">
                              <button onClick={() => toggleItem(cl, item)}
                                className={`shrink-0 transition ${item.cochee ? "text-emerald-500" : "text-gray-300 hover:text-gray-500"}`}>
                                {item.cochee ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <span className={`text-sm ${item.cochee ? "line-through text-gray-400" : "text-gray-700"}`}>{item.titre}</span>
                              {canEdit && (
                                <button onClick={() => deleteItem(cl, item)}
                                  className="opacity-0 group-hover:opacity-100 ml-auto p-1 rounded hover:bg-red-50 text-red-400 transition">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-100" />
                          <td className="border border-gray-100" />
                          <td className="border border-gray-100" />
                          <td className="border border-gray-100" />
                          {canEdit && <td className="border border-gray-100" />}
                        </tr>
                      ))}

                      {/* Ajouter item inline */}
                      {isOpen && canEdit && (
                        <tr>
                          <td className="border border-gray-100" />
                          <td className="px-4 py-2 border border-gray-100 pl-10" colSpan={cols - 1}>
                            <div className="flex gap-2">
                              <input
                                value={newItemText[cl.id] || ""}
                                onChange={e => setNewItemText(prev => ({ ...prev, [cl.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") addItem(cl); }}
                                placeholder="Ajouter un item…"
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-camublue-900/20"
                              />
                              <button onClick={() => addItem(cl)}
                                className="px-3 py-1.5 rounded-lg bg-camublue-900 text-white text-xs font-semibold hover:bg-camublue-900/90 transition">
                                <Plus size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Onglet Checklists ── */}
      {tab === "checklists" && (
        <div className="flex flex-col gap-3">
          {clLoading ? (
            <div className="text-center py-20 text-gray-400">Chargement…</div>
          ) : checklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <ListChecks size={48} className="mb-3 opacity-20" />
              <p className="font-medium">Aucune checklist créée</p>
            </div>
          ) : checklists.map(cl => {
            const total   = cl.items.length;
            const coches  = cl.items.filter((it: any) => it.cochee).length;
            const pct     = total ? Math.round((coches / total) * 100) : 0;
            const isOpen  = expandedCl === cl.id;
            const respColor = RESPONSABLE_COLORS[cl.responsable] ?? "bg-gray-100 text-gray-500";
            return (
              <div key={cl.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* En-tête checklist */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => setExpandedCl(isOpen ? null : cl.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900">{cl.nom}</span>
                      {cl.responsable && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${respColor}`}>{cl.responsable}</span>
                      )}
                    </div>
                    {/* Barre de progression */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[200px]">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">{coches}/{total} · {pct}%</span>
                    </div>
                    {cl.description && <p className="text-xs text-gray-400 mt-1 truncate">{cl.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <button onClick={e => { e.stopPropagation(); setDeleteCl(cl.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Items */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="flex flex-col gap-1.5 mb-3">
                      {cl.items.map((item: any) => (
                        <div key={item.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition group ${item.cochee ? "bg-emerald-50/60" : "bg-white border border-gray-100"}`}>
                          <button onClick={() => toggleItem(cl, item)}
                            className={`shrink-0 transition ${item.cochee ? "text-emerald-500" : "text-gray-300 hover:text-gray-500"}`}>
                            {item.cochee ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                          <span className={`flex-1 text-sm ${item.cochee ? "line-through text-gray-400" : "text-gray-800 font-medium"}`}>
                            {item.titre}
                          </span>
                          {canEdit && (
                            <button onClick={() => deleteItem(cl, item)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition shrink-0">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      {cl.items.length === 0 && <p className="text-xs text-gray-400 italic px-1">Aucun item</p>}
                    </div>

                    {/* Ajouter un item inline */}
                    {canEdit && (
                      <div className="flex gap-2">
                        <input
                          value={newItemText[cl.id] || ""}
                          onChange={e => setNewItemText(prev => ({ ...prev, [cl.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") addItem(cl); }}
                          placeholder="Ajouter un item…"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 bg-white"
                        />
                        <button onClick={() => addItem(cl)}
                          className="px-3 py-2 rounded-xl bg-camublue-900 text-white text-xs font-semibold hover:bg-camublue-900/90 transition">
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal création checklist ── */}
      {clModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-camublue-900">Nouvelle checklist</h2>
              <button onClick={() => setClModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Responsable</label>
                <select value={clForm.responsable} onChange={e => setClForm(f => ({ ...f, responsable: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                  <option value="">— Non assigné —</option>
                  {RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {/* Items initiaux */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Tâches de la liste</label>
                <div className="flex flex-col gap-2">
                  {clItems.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={item} onChange={e => setClItems(arr => arr.map((v, idx) => idx === i ? e.target.value : v))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); setClItems(arr => [...arr, ""]); } }}
                        placeholder={`Tâche ${i + 1}`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                      {clItems.length > 1 && (
                        <button onClick={() => setClItems(arr => arr.filter((_, idx) => idx !== i))}
                          className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setClItems(arr => [...arr, ""])}
                    className="flex items-center gap-1.5 text-xs text-camublue-900 font-semibold hover:underline w-fit">
                    <Plus size={13} /> Ajouter une tâche
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setClModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveChecklist} disabled={savingCl}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-900/90 disabled:opacity-50 transition">
                {savingCl ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression checklist ── */}
      {deleteCl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-camublue-900 mb-2">Supprimer la checklist ?</h3>
            <p className="text-sm text-gray-500 mb-5">Tous les items seront supprimés.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteCl(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={confirmDeleteCl} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal création/édition ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-camublue-900">{editing ? "Modifier la tâche" : "Nouvelle tâche"}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Tâche *</label>
                <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Intitulé de la tâche"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date planifiée *</label>
                  <input type="date" value={form.date_planifiee} onChange={e => setForm(f => ({ ...f, date_planifiee: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date de fin</label>
                  <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Statut</label>
                  <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Priorité</label>
                  <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                    {PRIORITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Responsable</label>
                <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20">
                  <option value="">— Non assigné —</option>
                  {RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium">Annuler</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-900/90 disabled:opacity-50 transition">
                {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal changement de statut ── */}
      {statutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-80">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold text-camublue-900">Changer le statut</h2>
              <button onClick={() => setStatutTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-3 truncate">« {statutTarget.titre} »</p>
              <div className="flex flex-col gap-2">
                {STATUTS.map(s => (
                  <button key={s.value}
                    onClick={() => changeStatut(statutTarget.id, s.value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition
                      ${statutTarget.statut === s.value
                        ? `${s.color} border-current`
                        : "bg-gray-50 text-gray-600 border-transparent hover:border-gray-200"}`}>
                    {statutTarget.statut === s.value && <span className="text-base leading-none">✓</span>}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-camublue-900 mb-2">Supprimer la tâche ?</h3>
            <p className="text-sm text-gray-500 mb-5">Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
