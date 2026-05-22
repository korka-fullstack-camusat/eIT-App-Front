import { useEffect, useState, useRef } from "react";
import { Plus, Settings2, X, Pencil, Trash2, Upload, Download, FileText, CheckCircle2, Car, Calendar, Smartphone } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { vehiculeService } from "@/services/api";
import type { Vehicule } from "@/types";

const EMPTY = { immatriculation: "", marque: "", modele: "", affectation: "" };

export default function VehiculesPage() {
  const [vehicules,  setVehicules]  = useState<Vehicule[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterSim,  setFilterSim]  = useState("");

  // Modal Détail
  const [detailVeh, setDetailVeh] = useState<Vehicule | null>(null);

  // Modal Gérer
  const [gererVeh,  setGererVeh]  = useState<Vehicule | null>(null);
  const [gererMode, setGererMode] = useState<"menu" | "modifier" | "supprimer">("menu");
  const [form,      setForm]      = useState<any>(EMPTY);

  // Modal Import
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<{ created: number; updated: number; errors: { ligne: number; message: string }[]; total_lignes: number } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal Nouveau
  const [createModal, setCreateModal] = useState(false);
  const [createForm,  setCreateForm]  = useState<any>(EMPTY);

  const load = () => {
    setLoading(true);
    vehiculeService.getAll()
      .then(setVehicules).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openGerer = (v: Vehicule) => {
    setGererVeh(v);
    setGererMode("menu");
    setForm({ immatriculation: v.immatriculation, marque: v.marque ?? "", modele: v.modele ?? "", affectation: v.affectation ?? "" });
  };
  const closeGerer = () => { setGererVeh(null); setGererMode("menu"); };

  const handleModifier = async () => {
    if (!gererVeh) return;
    try {
      await vehiculeService.update(gererVeh.id, form);
      toast.success("Véhicule mis à jour"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleSupprimer = async () => {
    if (!gererVeh) return;
    try {
      await vehiculeService.delete(gererVeh.id);
      toast.success("Véhicule supprimé"); closeGerer(); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleExport = async () => {
    try { await vehiculeService.exportCsv(); }
    catch { toast.error("Erreur lors de l'export"); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await vehiculeService.importVehicules(importFile);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import");
    } finally { setImportLoading(false); }
  };

  const closeImport = () => {
    setImportModal(false); setImportFile(null); setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!createForm.immatriculation.trim()) { toast.error("L'immatriculation est obligatoire"); return; }
    try {
      await vehiculeService.create(createForm);
      toast.success("Véhicule créé"); setCreateModal(false); setCreateForm(EMPTY); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const filtered = vehicules.filter(v => {
    if (filterSim === "affecte"     && !v.sim_numero) return false;
    if (filterSim === "non_affecte" &&  v.sim_numero) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        v.immatriculation.toLowerCase().includes(q) ||
        (v.marque      ?? "").toLowerCase().includes(q) ||
        (v.modele      ?? "").toLowerCase().includes(q) ||
        (v.affectation ?? "").toLowerCase().includes(q) ||
        (v.sim_numero  ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const FIELDS = [
    { label: "Immatriculation *", key: "immatriculation", placeholder: "Ex : DK 1234 AB" },
    { label: "Marque",            key: "marque",          placeholder: "Ex : Toyota"      },
    { label: "Modèle",            key: "modele",          placeholder: "Ex : Land Cruiser" },
    { label: "Affectation",       key: "affectation",     placeholder: "Ex : Direction"    },
  ];

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Véhicules</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length !== vehicules.length ? `${filtered.length} / ` : ""}{vehicules.length} véhicule(s)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition">
            <Download size={15} /> Exporter
          </button>
          <button onClick={() => { setImportResult(null); setImportFile(null); setImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition">
            <Upload size={15} /> Importer
          </button>
          <button onClick={() => { setCreateForm(EMPTY); setCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Ajouter véhicule
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par immatriculation, marque, modèle…"
          className="input-base flex-1 min-w-48" />
        <select value={filterSim} onChange={e => setFilterSim(e.target.value)}
          className="input-base w-auto px-3 py-2.5">
          <option value="">Tous les véhicules</option>
          <option value="affecte">Avec SIM affecté</option>
          <option value="non_affecte">Sans SIM affecté</option>
        </select>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Immatriculation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Marque / Modèle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Affectation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Numéro SIM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[12%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Aucun véhicule</td></tr>
            ) : filtered.map(v => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setDetailVeh(v)}>
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{v.immatriculation}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-700">{v.marque || "—"}</p>
                  {v.modele && <p className="text-xs text-gray-400">{v.modele}</p>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {v.affectation
                    ? <span className="text-gray-600">{v.affectation}</span>
                    : v.sim_numero
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          SIM affectée
                        </span>
                      : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">
                  {v.sim_numero || <span className="text-gray-300 font-normal text-xs">Non affecté</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); openGerer(v); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-xs font-semibold transition shadow-sm">
                    <Settings2 size={12} /> Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ Modal Détail Véhicule ══════════════════════════════════════════════ */}
      {detailVeh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailVeh(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Car size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold font-mono text-base">{detailVeh.immatriculation}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {[detailVeh.marque, detailVeh.modele].filter(Boolean).join(" ") || "Marque non renseignée"}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailVeh(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Champs */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Immatriculation</p>
                  <p className="text-base font-mono font-bold text-gray-800 mt-1">{detailVeh.immatriculation}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Marque</p>
                  <p className="text-sm text-gray-700 mt-1">{detailVeh.marque || <span className="text-gray-300">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Modèle</p>
                  <p className="text-sm text-gray-700 mt-1">{detailVeh.modele || <span className="text-gray-300">—</span>}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Affectation</p>
                  <p className="text-sm text-gray-700 mt-1">{detailVeh.affectation || <span className="text-gray-300">—</span>}</p>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <p className="text-xs">Créé le {new Date(detailVeh.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* SIM affectée */}
              {detailVeh.sim_numero ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Numéro SIM affecté</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0">
                      <Smartphone size={16} className="text-emerald-700" />
                    </div>
                    <p className="text-base font-mono font-bold text-emerald-800">{detailVeh.sim_numero}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <p className="text-xs text-gray-400">Aucun numéro SIM affecté</p>
                  <p className="text-xs text-gray-400 mt-0.5">Assignez depuis la page <span className="font-semibold">Numéros SIM</span></p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setDetailVeh(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                  Fermer
                </button>
                <button onClick={() => { openGerer(detailVeh); setDetailVeh(null); }}
                  className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Settings2 size={14} /> Gérer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Gérer ══════════════════════════════════════════════════════════ */}
      {gererVeh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeGerer}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Settings2 size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm font-mono">{gererVeh.immatriculation}</p>
                  <p className="text-white/60 text-xs">{gererVeh.marque ?? "—"} {gererVeh.modele ?? ""}</p>
                </div>
              </div>
              <button onClick={closeGerer} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {gererMode === "menu" && (
                <div className="px-6 py-5 space-y-2.5">
                  <button onClick={() => setGererMode("modifier")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition">
                      <Pencil size={16} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Modifier</p>
                      <p className="text-xs text-gray-400">Changer les informations du véhicule</p>
                    </div>
                  </button>

                  <button onClick={() => setGererMode("supprimer")}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 transition group">
                    <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition">
                      <Trash2 size={16} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Supprimer</p>
                      <p className="text-xs text-gray-400">Retirer ce véhicule du système</p>
                    </div>
                  </button>

                  <button onClick={closeGerer}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition mt-1">
                    Fermer
                  </button>
                </div>
              )}

              {gererMode === "modifier" && (
                <div className="px-6 py-5 space-y-3">
                  {FIELDS.map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                      <input type="text" value={form[key]}
                        onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder} className="input-base" />
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

              {gererMode === "supprimer" && (
                <div className="px-6 py-5 space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800">Confirmer la suppression</p>
                    <p className="text-xs text-red-600 mt-1">
                      Le véhicule <span className="font-bold font-mono">{gererVeh.immatriculation}</span> sera définitivement supprimé.
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

      {/* ══ Modal Import ════════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Upload size={18} className="text-white" />
                </div>
                <p className="text-white font-bold text-sm">Importer des véhicules</p>
              </div>
              <button onClick={closeImport} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {importResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} /><p className="font-semibold text-sm">Import terminé</p>
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
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Format attendu (CSV séparateur ;)</p>
                      <p className="text-xs text-blue-600 mt-0.5 font-mono">Immatriculation;Marque;Modèle;Affectation</p>
                      <p className="text-xs text-blue-500 mt-1">Seule l'<span className="font-semibold">Immatriculation</span> est obligatoire.</p>
                    </div>
                  </div>
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                      onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700">
                        <CheckCircle2 size={18} />
                        <p className="text-sm font-semibold">{importFile.name}</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier CSV</p>
                        <p className="text-xs text-gray-400 mt-1">Encodage UTF-8 ou Latin-1</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={closeImport}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleImport} disabled={!importFile || importLoading}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {importLoading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importation…</>
                        : <><Upload size={14} /> Lancer l'import</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Nouveau véhicule ═══════════════════════════════════════════════ */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setCreateModal(false); setCreateForm(EMPTY); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">Nouveau véhicule</h2>
            <div className="space-y-3">
              {FIELDS.map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                  <input type="text" value={createForm[key]}
                    onChange={e => setCreateForm((p: any) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder} className="input-base" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setCreateModal(false); setCreateForm(EMPTY); }}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={handleCreate}
                className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
