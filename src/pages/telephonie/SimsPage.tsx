import { useEffect, useState, useRef } from "react";
import { Plus, Settings2, X, Link, Pencil, Trash2, AlertTriangle, Unlink, Upload, Download, FileText, CheckCircle2, Smartphone, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { simService, siteService, vehiculeService, employeeService } from "@/services/api";
import type { NumeroSIM, CategorieSIM, SiteGSM, Vehicule, Employee } from "@/types";

const CAT_LABELS: Record<CategorieSIM, string> = {
  EMPLOYE: "Employé", M2M_SITE: "M2M Site", M2M_VEHICULE: "M2M Véhicule",
};
const CAT_COLORS: Record<CategorieSIM, string> = {
  EMPLOYE: "bg-blue-100 text-blue-700",
  M2M_SITE: "bg-purple-100 text-purple-700",
  M2M_VEHICULE: "bg-emerald-100 text-emerald-700",
};

export default function SimsPage() {
  const [sims,     setSims]     = useState<NumeroSIM[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [cat,      setCat]      = useState("");
  const [search,   setSearch]   = useState("");

  // Modal SIM (créer / modifier)
  const [simModal,  setSimModal]  = useState(false);
  const [selected,  setSelected]  = useState<NumeroSIM | null>(null);
  const [form,      setForm]      = useState<any>({ numero: "", imsi: "", categorie: "EMPLOYE", operateur: "", description: "" });

  // Modal Import
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<{ created: number; updated: number; errors: { ligne: number; message: string }[]; total_lignes: number } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal Détail
  const [detailSim, setDetailSim] = useState<NumeroSIM | null>(null);

  // Modal Gérer
  const [gererSim,  setGererSim]  = useState<NumeroSIM | null>(null);
  const [gererMode, setGererMode] = useState<"menu" | "affecter" | "desaffecter" | "modifier" | "supprimer">("menu");
  const [desaffMotif, setDesaffMotif] = useState("");

  // Formulaire affectation
  const [sites,     setSites]     = useState<SiteGSM[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [employees, setEmps]      = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [affForm,   setAffForm]   = useState<any>({
    date_debut: new Date().toISOString().split("T")[0],
    employee_id: null, employee_nom: null, employee_matricule: null,
    site_id: null, vehicule_id: null, notes: "",
  });

  const load = () => {
    setLoading(true);
    simService.getAll({ categorie: cat || undefined, search: search || undefined })
      .then(setSims).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  const handleExport = async () => {
    try {
      await simService.exportCsv({ categorie: cat || undefined, search: search || undefined });
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await simService.importSims(importFile);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import");
    } finally {
      setImportLoading(false);
    }
  };

  const closeImport = () => {
    setImportModal(false); setImportFile(null); setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => { load(); }, [cat, search]);

  useEffect(() => {
    if (gererMode === "affecter") {
      siteService.getAll().then(setSites).catch(() => {});
      vehiculeService.getAll().then(setVehicules).catch(() => {});
    }
  }, [gererMode]);

  useEffect(() => {
    if (empSearch.length < 2) { setEmps([]); return; }
    const t = setTimeout(() => employeeService.search(empSearch).then(setEmps).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  const openGerer = (s: NumeroSIM) => {
    setGererSim(s);
    setGererMode("menu");
    setAffForm({
      date_debut: new Date().toISOString().split("T")[0],
      employee_id: null, employee_nom: null, employee_matricule: null,
      site_id: null, vehicule_id: null, notes: "",
    });
    setEmpSearch("");
    setDesaffMotif("");
  };
  const closeGerer = () => { setGererSim(null); setGererMode("menu"); setDesaffMotif(""); };

  const handleSaveSim = async () => {
    try {
      if (selected) await simService.update(selected.id, form);
      else await simService.create(form);
      toast.success(selected ? "Mis à jour" : "SIM créée");
      setSimModal(false); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleAffecter = async () => {
    if (!gererSim) return;
    try {
      await simService.affecter(gererSim.id, affForm);
      toast.success("Affectation enregistrée"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleModifier = async () => {
    if (!gererSim) return;
    try {
      await simService.update(gererSim.id, form);
      toast.success("Mis à jour"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleDesaffecter = async () => {
    if (!gererSim) return;
    try {
      await simService.desaffecter(gererSim.id, desaffMotif || undefined);
      toast.success("Affectation supprimée"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleSupprimer = async () => {
    if (!gererSim) return;
    try {
      await simService.delete(gererSim.id);
      toast.success("SIM supprimée"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Numéros SIM</h1>
          <p className="text-gray-500 text-sm mt-0.5">{sims.length} numéro(s)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exporter */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition"
          >
            <Download size={15} /> Exporter
          </button>
          {/* Importer */}
          <button
            onClick={() => { setImportResult(null); setImportFile(null); setImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition"
          >
            <Upload size={15} /> Importer
          </button>
          {/* Ajouter */}
          <button
            onClick={() => { setSelected(null); setForm({ numero: "", imsi: "", categorie: "EMPLOYE", operateur: "", description: "" }); setSimModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            <Plus size={16} /> Ajouter SIM
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un numéro…" className="input-base flex-1 min-w-48" />
        <select value={cat} onChange={e => setCat(e.target.value)} className="input-base w-auto px-3 py-2.5">
          <option value="">Toutes catégories</option>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* ── Tableau pleine largeur ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[28%]">Numéro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Opérateur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[16%]">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[12%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : sims.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Aucun numéro SIM</td></tr>
            ) : sims.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setDetailSim(s)}>
                <td className="px-4 py-3">
                  <p className="font-mono font-semibold text-gray-800">{s.numero}</p>
                  {s.affectation_active && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {s.affectation_active.employee_nom
                        ? `↳ ${s.affectation_active.employee_nom}`
                        : s.affectation_active.site_id
                          ? `↳ Site #${s.affectation_active.site_id}`
                          : `↳ Véhicule #${s.affectation_active.vehicule_id}`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${CAT_COLORS[s.categorie]}`}>
                    {CAT_LABELS[s.categorie]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.operateur ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${s.statut === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.statut === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={e => { e.stopPropagation(); openGerer(s); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    <Settings2 size={12} /> Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ Modal Détail SIM ═══════════════════════════════════════════════════ */}
      {detailSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailSim(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Smartphone size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold font-mono text-base">{detailSim.numero}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/60 text-xs">{CAT_LABELS[detailSim.categorie]}</span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${detailSim.statut === "ACTIVE" ? "bg-emerald-400/30 text-emerald-200" : "bg-gray-400/30 text-gray-200"}`}>
                      {detailSim.statut === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailSim(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Champs principaux */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Numéro</p>
                  <p className="text-sm font-mono font-semibold text-gray-800 mt-1">{detailSim.numero}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">IMSI</p>
                  <p className="text-sm font-mono text-gray-700 mt-1">{detailSim.imsi || <span className="text-gray-300">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Catégorie</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${CAT_COLORS[detailSim.categorie]}`}>
                    {CAT_LABELS[detailSim.categorie]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Opérateur</p>
                  <p className="text-sm text-gray-700 mt-1">{detailSim.operateur || <span className="text-gray-300">—</span>}</p>
                </div>
                {detailSim.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Description</p>
                    <p className="text-sm text-gray-700 mt-1">{detailSim.description}</p>
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <p className="text-xs">Créé le {new Date(detailSim.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Affectation active */}
              {detailSim.affectation_active ? (() => {
                const aff = detailSim.affectation_active!;
                return (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Affectation active</p>
                    {aff.employee_nom && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Employé</span>
                        <span className="text-xs font-semibold text-gray-800">{aff.employee_nom}</span>
                      </div>
                    )}
                    {aff.employee_matricule && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Matricule</span>
                        <span className="text-xs font-mono text-gray-700">{aff.employee_matricule}</span>
                      </div>
                    )}
                    {aff.site_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Site</span>
                        <span className="text-xs font-semibold text-gray-800">Site #{aff.site_id}</span>
                      </div>
                    )}
                    {aff.vehicule_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Véhicule</span>
                        <span className="text-xs font-semibold text-gray-800">Véhicule #{aff.vehicule_id}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Depuis le</span>
                      <span className="text-xs text-gray-700">{new Date(aff.date_debut).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {aff.notes && (
                      <div className="pt-1 border-t border-emerald-200">
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-xs text-gray-700 mt-0.5">{aff.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Aucune affectation active</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setDetailSim(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                  Fermer
                </button>
                <button onClick={() => { openGerer(detailSim); setDetailSim(null); }}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Settings2 size={14} /> Gérer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ════════════════════════════════════════════════════════ */}
      {gererSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Settings2 size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm font-mono">{gererSim.numero}</p>
                  <p className="text-white/60 text-xs">{CAT_LABELS[gererSim.categorie]} · {gererSim.operateur ?? "—"}</p>
                </div>
              </div>
              <button onClick={closeGerer}
                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ── Menu principal ── */}
              {gererMode === "menu" && (
                <div className="px-6 py-5 space-y-2.5">

                  {/* Affecter — désactivé si déjà assigné */}
                  {gererSim?.affectation_active ? (
                    <div className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <Link size={16} className="text-gray-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-400">Affecter</p>
                        <p className="text-xs text-gray-400">Numéro déjà affecté — désaffectez d'abord</p>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setGererMode("affecter")}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition group">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center shrink-0 transition">
                        <Link size={16} className="text-purple-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800">Affecter</p>
                        <p className="text-xs text-gray-400">Assigner à un employé, site ou véhicule</p>
                      </div>
                    </button>
                  )}

                  {/* Désaffecter — visible seulement si assigné */}
                  {gererSim?.affectation_active && (() => {
                    const aff = gererSim.affectation_active!;
                    const who = aff.employee_nom
                      ? `${aff.employee_nom}${aff.employee_matricule ? ` · ${aff.employee_matricule}` : ""}`
                      : aff.site_id ? `Site #${aff.site_id}` : `Véhicule #${aff.vehicule_id}`;
                    return (
                      <button onClick={() => setGererMode("desaffecter")}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition group">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center shrink-0 transition">
                          <Unlink size={16} className="text-orange-500" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-semibold text-gray-800">Désaffecter</p>
                          <p className="text-xs text-orange-500 truncate">Actuellement : {who}</p>
                        </div>
                      </button>
                    );
                  })()}

                  {/* Modifier */}
                  <button onClick={() => {
                    setForm({ numero: gererSim.numero, imsi: gererSim.imsi ?? "", categorie: gererSim.categorie, operateur: gererSim.operateur ?? "", description: gererSim.description ?? "" });
                    setGererMode("modifier");
                  }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition">
                      <Pencil size={16} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Modifier</p>
                      <p className="text-xs text-gray-400">Changer les informations de la SIM</p>
                    </div>
                  </button>

                  {/* Supprimer */}
                  <button onClick={() => setGererMode("supprimer")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition">
                      <Trash2 size={16} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Supprimer</p>
                      <p className="text-xs text-gray-400">Retirer ce numéro du système</p>
                    </div>
                  </button>

                  <button onClick={closeGerer}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">
                    Fermer
                  </button>
                </div>
              )}

              {/* ── Affecter ── */}
              {gererMode === "affecter" && (
                <div className="px-6 py-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de début</label>
                    <input type="date" value={affForm.date_debut}
                      onChange={e => setAffForm((p: any) => ({ ...p, date_debut: e.target.value }))}
                      className="input-base" />
                  </div>

                  {gererSim.categorie === "EMPLOYE" && (
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employé</label>
                      <input value={empSearch}
                        onChange={e => { setEmpSearch(e.target.value); setAffForm((p: any) => ({ ...p, employee_id: null, employee_nom: null, employee_matricule: null })); }}
                        placeholder="Rechercher par nom ou matricule…" className="input-base" />
                      {employees.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {employees.map(e => (
                            <button key={e.id}
                              onClick={() => {
                                setAffForm((p: any) => ({ ...p, employee_id: e.id, employee_nom: `${e.nom} ${e.prenom}`.trim(), employee_matricule: e.matricule }));
                                setEmpSearch(`${e.nom} ${e.prenom}`);
                                setEmps([]);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                              <p className="font-medium text-gray-800">{e.nom} {e.prenom}</p>
                              <p className="text-xs text-gray-400">{e.matricule}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {gererSim.categorie === "M2M_SITE" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Site GSM</label>
                      <select value={affForm.site_id ?? ""}
                        onChange={e => setAffForm((p: any) => ({ ...p, site_id: Number(e.target.value) || null }))}
                        className="input-base">
                        <option value="">Sélectionner…</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                      </select>
                    </div>
                  )}

                  {gererSim.categorie === "M2M_VEHICULE" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Véhicule</label>
                      <select value={affForm.vehicule_id ?? ""}
                        onChange={e => setAffForm((p: any) => ({ ...p, vehicule_id: Number(e.target.value) || null }))}
                        className="input-base">
                        <option value="">Sélectionner…</option>
                        {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optionnel)</label>
                    <textarea value={affForm.notes}
                      onChange={e => setAffForm((p: any) => ({ ...p, notes: e.target.value }))}
                      rows={2} className="input-base resize-none" placeholder="Informations complémentaires…" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGererMode("menu")}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleAffecter}
                      className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Confirmer l'affectation
                    </button>
                  </div>
                </div>
              )}

              {/* ── Désaffecter ── */}
              {gererMode === "desaffecter" && gererSim?.affectation_active && (() => {
                const aff = gererSim.affectation_active!;
                const who = aff.employee_nom
                  ? `${aff.employee_nom}${aff.employee_matricule ? ` (${aff.employee_matricule})` : ""}`
                  : aff.site_id ? `Site #${aff.site_id}` : `Véhicule #${aff.vehicule_id}`;
                return (
                  <div className="px-6 py-5 space-y-4">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <p className="text-xs font-semibold text-orange-800">Affectation en cours</p>
                      <p className="text-sm font-bold text-orange-900 mt-0.5">{who}</p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        Depuis le {new Date(aff.date_debut).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Motif de désaffectation <span className="font-normal text-gray-400">(optionnel)</span>
                      </label>
                      <textarea
                        value={desaffMotif}
                        onChange={e => setDesaffMotif(e.target.value)}
                        rows={3}
                        className="input-base resize-none"
                        placeholder="Ex : Départ de l'employé, panne, changement de poste…"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setGererMode("menu")}
                        className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                        Retour
                      </button>
                      <button onClick={handleDesaffecter}
                        className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                        Confirmer la désaffectation
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Modifier ── */}
              {gererMode === "modifier" && (
                <div className="px-6 py-5 space-y-3">
                  {[
                    { label: "Numéro",      key: "numero",      type: "text"   },
                    { label: "IMSI",        key: "imsi",        type: "text"   },
                    { label: "Catégorie",   key: "categorie",   type: "select", opts: Object.entries(CAT_LABELS) },
                    { label: "Opérateur",   key: "operateur",   type: "text"   },
                    { label: "Description", key: "description", type: "text"   },
                  ].map(({ label, key, type, opts }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                      {type === "select" ? (
                        <select value={form[key]}
                          onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                          className="input-base">
                          {(opts as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={form[key]}
                          onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                          className="input-base" />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGererMode("menu")}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleModifier}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {/* ── Supprimer ── */}
              {gererMode === "supprimer" && (
                <div className="px-6 py-5 space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800">Confirmer la suppression</p>
                    <p className="text-xs text-red-600 mt-1">
                      Le numéro <span className="font-mono font-bold">{gererSim.numero}</span> sera définitivement supprimé.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setGererMode("menu")}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleSupprimer}
                      className="flex-[2] bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Supprimer définitivement
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Import ══════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Upload size={18} className="text-white" />
                </div>
                <p className="text-white font-bold text-sm">Importer des numéros SIM</p>
              </div>
              <button onClick={closeImport} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">

              {/* Résultat après import */}
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} />
                    <p className="font-semibold text-sm">Import terminé</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-emerald-700">{importResult.created}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Créés</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-blue-700">{importResult.updated}</p>
                      <p className="text-xs text-blue-600 mt-0.5">Mis à jour</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-red-600">{importResult.errors.length}</p>
                      <p className="text-xs text-red-500 mt-0.5">Erreurs</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-700 mb-1.5">Détail des erreurs</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">Ligne {e.ligne} : {e.message}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={closeImport}
                    className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  {/* Template download */}
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-800">Format attendu (CSV séparateur ;)</p>
                      <p className="text-xs text-blue-600 mt-0.5 font-mono">Numéro;Catégorie;Opérateur;Description</p>
                      <p className="text-xs text-blue-500 mt-1">Catégorie : <span className="font-mono">EMPLOYE</span> | <span className="font-mono">M2M_SITE</span> | <span className="font-mono">M2M_VEHICULE</span></p>
                    </div>
                  </div>

                  {/* Zone de dépôt */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                    />
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700">
                        <CheckCircle2 size={18} />
                        <p className="text-sm font-semibold">{importFile.name}</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier CSV</p>
                        <p className="text-xs text-gray-400 mt-1">Format : .csv — encodage UTF-8 ou Latin-1</p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={closeImport}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!importFile || importLoading}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      {importLoading ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importation…</>
                      ) : (
                        <><Upload size={14} /> Lancer l'import</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Nouvelle SIM ══════════════════════════════════════════════════ */}
      {simModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSimModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">Nouveau numéro SIM</h2>
            <div className="space-y-3">
              {[
                { label: "Numéro",      key: "numero",      type: "text"   },
                { label: "IMSI",        key: "imsi",        type: "text"   },
                { label: "Catégorie",   key: "categorie",   type: "select", opts: Object.entries(CAT_LABELS) },
                { label: "Opérateur",   key: "operateur",   type: "text"   },
                { label: "Description", key: "description", type: "text"   },
              ].map(({ label, key, type, opts }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  {type === "select" ? (
                    <select value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base">
                      {(opts as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} className="input-base" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setSimModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSaveSim}
                className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Créer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
