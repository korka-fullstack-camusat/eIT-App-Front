import { useEffect, useState, useRef } from "react";
import { Plus, Search, Pencil, Trash2, X, Download, Upload, ChevronLeft, ChevronRight, History } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { materielService, attributionService, employeeService } from "@/services/api";
import type { Materiel } from "@/types";

const STATUT_COLORS: Record<string, string> = {
  DISPONIBLE:  "bg-emerald-100 text-emerald-700",
  ATTRIBUE:    "bg-blue-100 text-blue-700",
  MAINTENANCE: "bg-amber-100 text-amber-700",
  REFORME:     "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  ORDINATEUR_PORTABLE: "PC Portable", ORDINATEUR_FIXE: "PC Fixe",
  ECRAN: "Écran", SOURIS: "Souris", CLAVIER: "Clavier",
  TELEPHONE: "Téléphone", IMPRIMANTE: "Imprimante",
  SWITCH: "Switch", ROUTEUR: "Routeur", ONDULEUR: "Onduleur", AUTRE: "Autre",
};

const TYPES_WITH_IP = ["ORDINATEUR_PORTABLE", "ORDINATEUR_FIXE", "SWITCH", "ROUTEUR"];

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  type_materiel:    "ORDINATEUR_PORTABLE",
  marque:           "",
  numero_serie:     "",
  adresse_ip:       "",
  numero_bon_cmd:   "",
  etat:             "BON",
  date_acquisition: "",
};

export default function MaterielsPage() {
  const [items,    setItems]    = useState<Materiel[]>([]);
  const [search,   setSearch]   = useState("");
  const [statut,   setStatut]   = useState("");
  const [loading,  setLoading]  = useState(true);

  // modal formulaire (ajout / modification)
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<number | null>(null);
  const [form,     setForm]     = useState<any>(EMPTY_FORM);

  // modal Gérer
  const [gererItem,   setGererItem]   = useState<Materiel | null>(null);
  const [gererMode,   setGererMode]   = useState<"menu" | "recuperer">("menu");
  // modal Détails
  const [detailItem,  setDetailItem]  = useState<Materiel | null>(null);
  // modal Parcours
  const [parcoursItem,    setParcoursItem]    = useState<Materiel | null>(null);
  const [parcoursHistory, setParcoursHistory] = useState<any[]>([]);
  const [parcoursLoading, setParcoursLoading] = useState(false);
  // formulaire récupération dans le parcours
  const [recupererAttr,   setRecupererAttr]   = useState<any | null>(null);
  const [recupForm,       setRecupForm]       = useState<any>({
    date_restitution:  new Date().toISOString().split("T")[0],
    motif_restitution: "CHANGEMENT",
    notes_restitution: "",
    employee_id: "", employee_nom: "", employee_prenom: "",
    employee_matricule: "", employee_service: "", employee_poste: "",
    date_attribution: new Date().toISOString().split("T")[0],
    etat_remise: "BON", notes: "",
  });
  const [recupEmpQuery,   setRecupEmpQuery]   = useState("");
  const [recupEmpResults, setRecupEmpResults] = useState<any[]>([]);
  const [recupEmpOpen,    setRecupEmpOpen]    = useState(false);
  const [recupEmpLoading, setRecupEmpLoading] = useState(false);
  const [recupLoading,    setRecupLoading]    = useState(false);
  const recupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // modal Import
  const [importOpen,    setImportOpen]    = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult,  setImportResult]  = useState<{ created: number; errors: { ligne: number; message: string }[] } | null>(null);
  // pagination
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    materielService.getAll({ search, statut: statut || undefined })
      .then(setItems).catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); setPage(1); }, [search, statut]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (m: Materiel) => {
    setGererItem(null);
    setForm({
      type_materiel:    m.type_materiel,
      marque:           m.marque,
      numero_serie:     m.numero_serie     ?? "",
      adresse_ip:       m.adresse_ip       ?? "",
      numero_bon_cmd:   m.numero_bon_cmd   ?? "",
      etat:             m.etat,
      date_acquisition: m.date_acquisition ?? "",
    });
    setEditing(m.id);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.marque.trim()) { toast.error("La marque est obligatoire"); return; }
    const showIp = TYPES_WITH_IP.includes(form.type_materiel);
    const payload = {
      type_materiel:    form.type_materiel,
      marque:           form.marque.trim(),
      modele:           "",
      numero_serie:     !showIp ? (form.numero_serie || null) : null,
      adresse_ip:       showIp  ? (form.adresse_ip   || null) : null,
      numero_bon_cmd:   form.numero_bon_cmd || null,
      etat:             form.etat,
      date_acquisition: form.date_acquisition || null,
    };
    try {
      if (editing) await materielService.update(editing, payload);
      else         await materielService.create(payload);
      toast.success(editing ? "Matériel mis à jour" : "Matériel créé");
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de la sauvegarde");
    }
  };

  const handleDelete = async (m: Materiel) => {
    if (!confirm(`Supprimer ${m.marque} ?`)) return;
    try {
      await materielService.delete(m.id);
      toast.success("Matériel supprimé");
      setGererItem(null);
      load();
    } catch {
      toast.error("Impossible de supprimer");
    }
  };

  const searchRecupEmp = (q: string) => {
    if (recupTimer.current) clearTimeout(recupTimer.current);
    if (!q.trim()) { setRecupEmpResults([]); setRecupEmpOpen(false); return; }
    recupTimer.current = setTimeout(async () => {
      setRecupEmpLoading(true);
      try {
        const res = await employeeService.search(q);
        setRecupEmpResults(res.slice(0, 8));
        setRecupEmpOpen(true);
      } catch { toast.error("Impossible de joindre l'API eRh"); }
      finally { setRecupEmpLoading(false); }
    }, 350);
  };

  const selectRecupEmp = (emp: any) => {
    setRecupForm((p: any) => ({
      ...p,
      employee_id:        emp.id,
      employee_nom:       emp.nom,
      employee_prenom:    emp.prenom,
      employee_matricule: emp.matricule,
      employee_service:   emp.service ?? "",
      employee_poste:     emp.fonction ?? "",
    }));
    setRecupEmpQuery(`${emp.prenom} ${emp.nom}`);
    setRecupEmpOpen(false);
    setRecupEmpResults([]);
  };

  const handleRecuperer = async () => {
    if (!recupererAttr) return;
    setRecupLoading(true);
    try {
      await attributionService.restituer(recupererAttr.id, {
        date_restitution:  recupForm.date_restitution,
        motif_restitution: recupForm.motif_restitution,
        notes_restitution: null,
      });
      toast.success("Matériel récupéré — statut repassé à Disponible");
      setRecupererAttr(null);
      setGererItem(null);
      setGererMode("menu");
      if (parcoursItem) {
        const hist = await attributionService.getByMateriel(parcoursItem.id);
        setParcoursHistory(hist);
      }
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de la récupération");
    } finally {
      setRecupLoading(false);
    }
  };

  const openRecuperer = async (m: Materiel) => {
    try {
      const hist = await attributionService.getByMateriel(m.id);
      const active = hist.find((a: any) => a.statut === "ACTIVE");
      if (!active) { toast.error("Aucune attribution active trouvée"); return; }
      setRecupererAttr(active);
      setRecupForm({
        date_restitution:  new Date().toISOString().split("T")[0],
        motif_restitution: "CHANGEMENT", notes_restitution: "",
        employee_id: "", employee_nom: "", employee_prenom: "",
        employee_matricule: "", employee_service: "", employee_poste: "",
        date_attribution: new Date().toISOString().split("T")[0],
        etat_remise: "BON", notes: "",
      });
      setRecupEmpQuery("");
      setGererMode("recuperer");
    } catch {
      toast.error("Impossible de charger l'attribution active");
    }
  };

  const openParcours = async (m: Materiel) => {
    setGererItem(null);
    setParcoursItem(m);
    setParcoursLoading(true);
    try {
      const hist = await attributionService.getByMateriel(m.id);
      setParcoursHistory(hist);
    } catch {
      toast.error("Impossible de charger l'historique");
    } finally {
      setParcoursLoading(false);
    }
  };

  const showIpField = TYPES_WITH_IP.includes(form.type_materiel);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginated   = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ["ID","Type","Marque","Modèle","N° Série","Adresse IP","N° PO","État","Statut","Acquisition","Assigné à"];
    const rows = items.map(m => [
      m.id,
      TYPE_LABELS[m.type_materiel] ?? m.type_materiel,
      m.marque,
      m.modele ?? "",
      m.numero_serie ?? "",
      m.adresse_ip ?? "",
      m.numero_bon_cmd ?? "",
      m.etat,
      m.statut,
      m.date_acquisition ?? "",
      m.attribution_active ? `${m.attribution_active.employee_prenom} ${m.attribution_active.employee_nom}` : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `materiels_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} matériel(s) exporté(s)`);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Gestion des matériels</h1>
          <p className="text-gray-500 text-sm mt-0.5">{items.length} équipement(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition">
            <Download size={15} /> Exporter
          </button>
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition">
            <Upload size={15} /> Importer
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Ajouter Matériel
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="input-base pl-9" />
        </div>
        <select value={statut} onChange={e => setStatut(e.target.value)}
          className="input-base w-auto px-3 py-2.5">
          <option value="">Tous les statuts</option>
          <option value="DISPONIBLE">Disponible</option>
          <option value="ATTRIBUE">Attribué</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="REFORME">Réformé</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Type","Marque","N° Série / IP","État","Statut","Assigné à","Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Aucun matériel</td></tr>
            ) : paginated.map(m => (
              <tr key={m.id} onClick={() => setDetailItem(m)}
                className="hover:bg-gray-50/50 transition cursor-pointer">
                <td className="px-4 py-3 font-medium text-gray-700">{TYPE_LABELS[m.type_materiel] ?? m.type_materiel}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{m.marque}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {m.adresse_ip
                    ? <span className="text-blue-600">{m.adresse_ip}</span>
                    : m.numero_serie
                    ? <span className="text-gray-500">{m.numero_serie}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{m.etat}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[m.statut]}`}>
                    {m.statut}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.attribution_active ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {m.attribution_active.employee_prenom} {m.attribution_active.employee_nom}
                      </p>
                      {m.attribution_active.employee_service && (
                        <p className="text-xs text-gray-400">{m.attribution_active.employee_service}</p>
                      )}
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setGererItem(m)}
                    className="px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white text-xs font-semibold rounded-lg transition">
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} sur {items.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                  n === page ? "bg-camublue-900 text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Détails ─────────────────────────────────────────────────── */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-black text-camublue-900">
                    {detailItem.marque.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-camublue-900">{detailItem.marque}</p>
                  <p className="text-xs text-gray-400">{TYPE_LABELS[detailItem.type_materiel]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUT_COLORS[detailItem.statut]}`}>
                  {detailItem.statut}
                </span>
                <button onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Infos */}
            <div className="px-6 py-5 space-y-0 divide-y divide-gray-50">

              {/* Identification */}
              <div className="pb-4 space-y-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Identification</p>
                {[
                  { label: "Type",        value: TYPE_LABELS[detailItem.type_materiel] },
                  { label: "Marque",      value: detailItem.marque },
                  { label: "Modèle",      value: detailItem.modele },
                  { label: "N° Série",    value: detailItem.numero_serie },
                  { label: "Adresse IP",  value: detailItem.adresse_ip },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-700 font-mono">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Acquisition */}
              <div className="py-4 space-y-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Acquisition</p>
                {[
                  { label: "N° PO",       value: detailItem.numero_bon_cmd },
                  { label: "Date",        value: detailItem.date_acquisition
                      ? new Date(detailItem.date_acquisition).toLocaleDateString("fr-FR")
                      : null },
                  { label: "État",        value: detailItem.etat },
                  { label: "Enregistré",  value: new Date(detailItem.created_at).toLocaleDateString("fr-FR") },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-700">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              {detailItem.description && (
                <div className="py-4 space-y-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Description</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{detailItem.description}</p>
                </div>
              )}

              {/* Attribution */}
              {detailItem.attribution_active ? (
                <div className="pt-4 space-y-2.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Assigné à</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-camublue-900">
                        {detailItem.attribution_active.employee_nom.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {detailItem.attribution_active.employee_prenom} {detailItem.attribution_active.employee_nom}
                      </p>
                      <p className="text-xs text-gray-400">
                        {detailItem.attribution_active.employee_matricule}
                        {detailItem.attribution_active.employee_service ? ` · ${detailItem.attribution_active.employee_service}` : ""}
                        {detailItem.attribution_active.employee_poste ? ` · ${detailItem.attribution_active.employee_poste}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <span className="text-xs text-gray-300">Non assigné</span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Modal Parcours ────────────────────────────────────────────────── */}
      {parcoursItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Parcours matériel</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {parcoursItem.marque} {parcoursItem.modele || ""} — {TYPE_LABELS[parcoursItem.type_materiel]}
                </p>
              </div>
              <button onClick={() => { setParcoursItem(null); setParcoursHistory([]); setRecupererAttr(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Timeline ou Formulaire récupération */}
            <div className="overflow-y-auto px-6 py-5 flex-1">
              {parcoursLoading ? (
                <p className="text-center text-gray-400 py-10">Chargement…</p>

              ) : recupererAttr ? (
                /* ── Formulaire Récupérer ── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => { setRecupererAttr(null); setRecupEmpQuery(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition">← Retour</button>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    Récupéré de <strong>{recupererAttr.employee_prenom} {recupererAttr.employee_nom}</strong> — saisir la date de récupération puis désigner le prochain utilisateur.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de récupération</label>
                      <input type="date" value={recupForm.date_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, date_restitution: e.target.value }))}
                        className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif</label>
                      <select value={recupForm.motif_restitution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, motif_restitution: e.target.value }))}
                        className="input-base">
                        {[["CHANGEMENT","Changement"],["DEPART","Départ"],["PANNE","Panne"],["FIN_CONTRAT","Fin contrat"],["AUTRE","Autre"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note de récupération</label>
                    <input type="text" value={recupForm.notes_restitution}
                      onChange={e => setRecupForm((p: any) => ({ ...p, notes_restitution: e.target.value }))}
                      placeholder="Optionnel…" className="input-base" />
                  </div>

                  <hr className="border-gray-100" />
                  <p className="text-xs font-bold text-camublue-900 uppercase tracking-wide">Nouvel utilisateur</p>

                  {/* Recherche employé */}
                  <div className="relative">
                    {recupForm.employee_id ? (
                      <div className="flex items-center gap-3 p-3 bg-camublue-900/5 border border-camublue-900/20 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-camublue-900">
                            {(recupForm.employee_prenom || recupForm.employee_nom || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{recupForm.employee_prenom} {recupForm.employee_nom}</p>
                          <p className="text-xs text-gray-400">{recupForm.employee_matricule}{recupForm.employee_service ? ` · ${recupForm.employee_service}` : ""}</p>
                        </div>
                        <button onClick={() => { setRecupForm((p: any) => ({ ...p, employee_id: "" })); setRecupEmpQuery(""); }}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={recupEmpQuery}
                          onChange={e => { setRecupEmpQuery(e.target.value); searchRecupEmp(e.target.value); }}
                          onFocus={() => recupEmpResults.length > 0 && setRecupEmpOpen(true)}
                          placeholder="Rechercher le nouvel employé…"
                          className="input-base pl-8 pr-7" autoFocus />
                        {recupEmpLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-camublue-900/30 border-t-camublue-900 rounded-full animate-spin" />
                        )}
                      </div>
                    )}
                    {recupEmpOpen && recupEmpResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {recupEmpResults.map(emp => (
                          <button key={emp.id} type="button" onClick={() => selectRecupEmp(emp)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-camublue-900/5 transition text-left border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-camublue-900">{(emp.prenom || emp.nom).charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{emp.prenom} {emp.nom}</p>
                              <p className="text-xs text-gray-400">{emp.matricule}{emp.service ? ` · ${emp.service}` : ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date d'attribution</label>
                      <input type="date" value={recupForm.date_attribution}
                        onChange={e => setRecupForm((p: any) => ({ ...p, date_attribution: e.target.value }))}
                        className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">État à la remise</label>
                      <select value={recupForm.etat_remise}
                        onChange={e => setRecupForm((p: any) => ({ ...p, etat_remise: e.target.value }))}
                        className="input-base">
                        {["NEUF","BON","USAGE"].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setRecupererAttr(null); setRecupEmpQuery(""); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleRecuperer} disabled={recupLoading}
                      className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {recupLoading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours…</>
                        : "Confirmer la récupération"}
                    </button>
                  </div>
                </div>

              ) : parcoursHistory.length === 0 ? (
                <div className="text-center py-10">
                  <History size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune attribution enregistrée pour ce matériel.</p>
                </div>

              ) : (
                /* ── Timeline ── */
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
                  <div className="space-y-3">
                    {parcoursHistory.map((a, idx) => {
                      const isActive  = a.statut === "ACTIVE";
                      const dateDebut = new Date(a.date_attribution).toLocaleDateString("fr-FR");
                      const dateFin   = a.date_restitution
                        ? new Date(a.date_restitution).toLocaleDateString("fr-FR") : null;
                      const duree = (() => {
                        const start = new Date(a.date_attribution);
                        const end   = a.date_restitution ? new Date(a.date_restitution) : new Date();
                        const j = Math.round((end.getTime() - start.getTime()) / 86400000);
                        if (j < 30)  return `${j}j`;
                        if (j < 365) return `${Math.round(j / 30)} mois`;
                        return `${(j / 365).toFixed(1)} an(s)`;
                      })();
                      const MOTIF: Record<string, string> = {
                        DEPART: "Départ", CHANGEMENT: "Changement", PANNE: "Panne",
                        FIN_CONTRAT: "Fin contrat", AUTRE: "Autre",
                      };
                      // Transition entre cette entrée et la suivante
                      const next = parcoursHistory[idx + 1];
                      const gapJours = (!isActive && next)
                        ? Math.round((new Date(next.date_attribution).getTime() - new Date(a.date_restitution).getTime()) / 86400000)
                        : null;

                      return (
                        <div key={a.id}>
                          <div className="relative pl-10">
                            {/* Pastille */}
                            <div className={`absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10
                              ${isActive ? "bg-emerald-400" : "bg-gray-300"}`}>
                              <span className="text-xs font-black text-white">
                                {(a.employee_prenom || a.employee_nom || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>

                            {/* Carte */}
                            <div className={`rounded-xl border p-3.5 ${isActive
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-gray-100 bg-white"}`}>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div>
                                  <p className="font-semibold text-gray-800 text-sm">
                                    {a.employee_prenom} {a.employee_nom}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {a.employee_matricule}
                                    {a.employee_service ? ` · ${a.employee_service}` : ""}
                                    {a.employee_poste   ? ` · ${a.employee_poste}`   : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                                    ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {isActive ? "En cours" : "Clôturé"}
                                  </span>
                                  {isActive && (
                                    <button onClick={() => {
                                      setRecupererAttr(a);
                                      setRecupForm({
                                        date_restitution: new Date().toISOString().split("T")[0],
                                        motif_restitution: "CHANGEMENT", notes_restitution: "",
                                        employee_id: "", employee_nom: "", employee_prenom: "",
                                        employee_matricule: "", employee_service: "", employee_poste: "",
                                        date_attribution: new Date().toISOString().split("T")[0],
                                        etat_remise: "BON", notes: "",
                                      });
                                      setRecupEmpQuery("");
                                    }}
                                      className="text-xs px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold rounded-full transition">
                                      Récupérer
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                                <span>Du <strong className="text-gray-700">{dateDebut}</strong>
                                  {dateFin
                                    ? <> → Récupéré le <strong className="text-amber-700">{dateFin}</strong></>
                                    : <> → <strong className="text-emerald-600">aujourd'hui</strong></>}
                                </span>
                                <span className="text-gray-400">({duree})</span>
                                {a.motif_restitution && <span>· Motif : <strong>{MOTIF[a.motif_restitution]}</strong></span>}
                              </div>
                              {(a.notes || a.notes_restitution) && (
                                <p className="mt-1.5 text-xs text-gray-400 italic">
                                  {a.notes_restitution || a.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Connecteur entre deux attributions */}
                          {gapJours !== null && (
                            <div className="pl-10 py-1.5 flex items-center gap-2">
                              <div className="flex-1 h-px bg-dashed border-t border-dashed border-gray-200" />
                              <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-50 rounded-full shrink-0">
                                {gapJours <= 0 ? "Réattribué le même jour" : `${gapJours}j en stock`}
                              </span>
                              <div className="flex-1 h-px border-t border-dashed border-gray-200" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer stats */}
            {!parcoursLoading && !recupererAttr && parcoursHistory.length > 0 && (
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0 flex gap-6 text-xs text-gray-500">
                <span><strong className="text-gray-700">{parcoursHistory.length}</strong> utilisateur(s)</span>
                <span><strong className="text-gray-700">{parcoursHistory.filter(a => a.statut === "CLOTUREE").length}</strong> récupération(s)</span>
                {parcoursHistory.some(a => a.statut === "ACTIVE") && (
                  <span className="text-emerald-600 font-semibold">Attribution active</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Gérer ───────────────────────────────────────────────────── */}
      {gererItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {gererMode === "recuperer" && (
                  <button onClick={() => { setGererMode("menu"); setRecupererAttr(null); setRecupEmpQuery(""); }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div>
                  <p className="font-bold text-camublue-900">
                    {gererMode === "recuperer" ? "Récupérer le matériel" : gererItem.marque}
                  </p>
                  <p className="text-xs text-gray-400">
                    {gererMode === "recuperer"
                      ? `${gererItem.marque} — ${TYPE_LABELS[gererItem.type_materiel]}`
                      : TYPE_LABELS[gererItem.type_materiel]}
                  </p>
                </div>
              </div>
              <button onClick={() => { setGererItem(null); setGererMode("menu"); setRecupererAttr(null); setRecupEmpQuery(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={16} />
              </button>
            </div>

            {/* ── Menu principal ── */}
            {gererMode === "menu" && (
              <div className="p-3 space-y-1.5">
                <button onClick={() => openEdit(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-camublue-900/10 flex items-center justify-center shrink-0">
                    <Pencil size={14} className="text-camublue-900" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Modifier</p>
                    <p className="text-xs text-gray-400">Éditer les informations</p>
                  </div>
                </button>

                {gererItem.statut === "ATTRIBUE" && (
                  <button onClick={() => openRecuperer(gererItem)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-amber-50 transition text-left">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <History size={14} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Récupérer</p>
                      <p className="text-xs text-gray-400">Reprendre & réattribuer à un autre</p>
                    </div>
                  </button>
                )}

                <button onClick={() => openParcours(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <History size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Parcours matériel</p>
                    <p className="text-xs text-gray-400">Historique des utilisateurs</p>
                  </div>
                </button>

                <button onClick={() => handleDelete(gererItem)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition text-left">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-600">Supprimer</p>
                    <p className="text-xs text-gray-400">Retirer définitivement</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── Formulaire récupération ── */}
            {gererMode === "recuperer" && recupererAttr && (
              <div className="px-5 py-4 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Actuellement attribué à <strong>{recupererAttr.employee_prenom} {recupererAttr.employee_nom}</strong>
                  {recupererAttr.employee_service ? ` · ${recupererAttr.employee_service}` : ""}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de récupération</label>
                  <input type="date" value={recupForm.date_restitution}
                    onChange={e => setRecupForm((p: any) => ({ ...p, date_restitution: e.target.value }))}
                    className="input-base" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motif</label>
                  <select value={recupForm.motif_restitution}
                    onChange={e => setRecupForm((p: any) => ({ ...p, motif_restitution: e.target.value }))}
                    className="input-base">
                    {[["CHANGEMENT","Changement"],["DEPART","Départ"],["PANNE","Panne"],["FIN_CONTRAT","Fin contrat"],["AUTRE","Autre"]].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setGererMode("menu"); setRecupererAttr(null); }}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleRecuperer} disabled={recupLoading}
                    className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                    {recupLoading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> En cours…</>
                      : "Récupérer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Formulaire (ajout / modification) ───────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-camublue-900">
                {editing ? "Modifier le matériel" : "Nouveau matériel"}
              </h2>
              <button onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
                  <select value={form.type_materiel}
                    onChange={e => setForm((p: any) => ({ ...p, type_materiel: e.target.value }))}
                    className="input-base">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Marque <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.marque}
                    onChange={e => setForm((p: any) => ({ ...p, marque: e.target.value }))}
                    placeholder="Dell, HP…" className="input-base" autoFocus />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {showIpField ? "Adresse IP" : "N° Série"}
                </label>
                {showIpField ? (
                  <input type="text" value={form.adresse_ip}
                    onChange={e => setForm((p: any) => ({ ...p, adresse_ip: e.target.value }))}
                    placeholder="192.168.1.10" className="input-base" />
                ) : (
                  <input type="text" value={form.numero_serie}
                    onChange={e => setForm((p: any) => ({ ...p, numero_serie: e.target.value }))}
                    placeholder="SN-XXXXXXXX" className="input-base" />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">N° PO</label>
                <input type="text" value={form.numero_bon_cmd}
                  onChange={e => setForm((p: any) => ({ ...p, numero_bon_cmd: e.target.value }))}
                  placeholder="PO-2025-XXXX" className="input-base" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">État</label>
                  <select value={form.etat}
                    onChange={e => setForm((p: any) => ({ ...p, etat: e.target.value }))}
                    className="input-base">
                    <option value="NEUF">Neuf</option>
                    <option value="BON">Bon</option>
                    <option value="USAGE">Usagé</option>
                    <option value="DEFECTUEUX">Défectueux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Acquisition</label>
                  <input type="date" value={form.date_acquisition}
                    onChange={e => setForm((p: any) => ({ ...p, date_acquisition: e.target.value }))}
                    className="input-base" />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setFormOpen(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import ──────────────────────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-camublue-900">Importer des matériels</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fichier CSV avec séparateur point-virgule</p>
              </div>
              <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Résultat après import */}
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">{importResult.created} matériel(s) importé(s)</p>
                      {importResult.errors.length > 0 && (
                        <p className="text-xs text-emerald-600">{importResult.errors.length} ligne(s) ignorée(s)</p>
                      )}
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1 max-h-36 overflow-y-auto">
                      <p className="text-xs font-semibold text-amber-700 mb-1.5">Lignes ignorées :</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-amber-600">Ligne {e.ligne} — {e.message}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                    className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <label className={`flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition
                    ${importFile ? "border-camublue-900/40 bg-camublue-900/5" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"}`}>
                    <Upload size={22} className={importFile ? "text-camublue-900" : "text-gray-300"} />
                    {importFile
                      ? <span className="text-sm font-semibold text-camublue-900">{importFile.name}</span>
                      : <span className="text-sm text-gray-400">Cliquer pour choisir un fichier .csv</span>
                    }
                    <input type="file" accept=".csv" className="hidden"
                      onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
                  </label>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                    <p className="font-semibold text-gray-600">Colonnes attendues :</p>
                    <p className="font-mono">Type ; Marque ; N° Série ; Adresse IP ; N° PO ; État ; Acquisition</p>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button
                      disabled={!importFile || importLoading}
                      onClick={async () => {
                        if (!importFile) return;
                        setImportLoading(true);
                        try {
                          const res = await materielService.import(importFile);
                          setImportResult(res);
                          load();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.detail ?? "Erreur lors de l'import");
                        } finally {
                          setImportLoading(false);
                        }
                      }}
                      className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {importLoading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Import…</>
                        : "Importer"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
