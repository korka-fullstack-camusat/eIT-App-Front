import { useEffect, useRef, useState } from "react";
import { Upload, ChevronDown, AlertCircle, CheckCircle2, Trash2, X, FileText, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { factureService } from "@/services/api";
import type { FactureTelecom, ImportResult } from "@/types";

const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const EMPTY_FORM = () => ({
  mois:      new Date().getMonth() + 1,
  annee:     new Date().getFullYear(),
  operateur: "",
  notes:     "",
});

export default function FacturesPage() {
  const [factures,     setFactures]     = useState<FactureTelecom[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<number | null>(null);
  const [filterAnnee,  setFilterAnnee]  = useState(new Date().getFullYear());

  // Modal Import
  const [importModal,   setImportModal]   = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importForm,    setImportForm]    = useState(EMPTY_FORM());
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const load = () => {
    setLoading(true);
    factureService.getAll({ annee: filterAnnee })
      .then(setFactures).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterAnnee]);

  const openImportModal = () => {
    setImportForm(EMPTY_FORM());
    setImportFile(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
    setImportModal(true);
  };

  const closeImportModal = () => {
    setImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const result = await factureService.importer(importFile, importForm);
      setImportResult(result);
      toast.success(`Import terminé — ${result.total_lignes} ligne(s)`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette facture et toutes ses lignes ?")) return;
    try { await factureService.delete(id); toast.success("Supprimée"); load(); }
    catch { toast.error("Impossible de supprimer"); }
  };

  const totalMontant = factures.reduce((s, f) =>
    s + f.lignes.reduce((ls, l) => ls + parseFloat(l.montant || "0"), 0), 0
  );

  return (
    <AppLayout>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Factures télécom</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {factures.length} facture(s)
            {factures.length > 0 && <> · Total <span className="font-semibold">{totalMontant.toLocaleString("fr-FR")} FCFA</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterAnnee} onChange={e => setFilterAnnee(Number(e.target.value))}
            className="input-base w-auto px-3 py-2">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={openImportModal}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Upload size={15} /> Importer facture
          </button>
        </div>
      </div>

      {/* ── Liste factures ── */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">Chargement…</p>
      ) : factures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Receipt size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Aucune facture pour {filterAnnee}</p>
          <p className="text-gray-400 text-sm mt-1">Cliquez sur <span className="font-semibold">Importer facture</span> pour en ajouter une</p>
        </div>
      ) : (
        <div className="space-y-3">
          {factures.map(f => {
            const total  = f.lignes.reduce((s, l) => s + parseFloat(l.montant || "0"), 0);
            const isOpen = expanded === f.id;
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-camublue-900">{String(f.mois).padStart(2, "0")}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{MOIS_LABELS[f.mois]} {f.annee}</p>
                      <p className="text-xs text-gray-400">
                        {f.operateur ?? "—"} · {f.lignes.length} ligne(s)
                        {f.nom_fichier && <> · <span className="italic">{f.nom_fichier}</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-gray-800">
                      {total.toLocaleString("fr-FR")} <span className="text-xs font-normal text-gray-400">FCFA</span>
                    </p>
                    <button onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
                      <Trash2 size={13} />
                    </button>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Numéro brut", "Montant (FCFA)", "Reconnu"].map(h => (
                            <th key={h} className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {f.lignes.map(l => (
                          <tr key={l.id} className={l.sim_id ? "" : "bg-amber-50/40"}>
                            <td className="px-4 py-2 font-mono text-gray-700">{l.numero_raw}</td>
                            <td className="px-4 py-2 font-semibold text-gray-800">{parseFloat(l.montant).toLocaleString("fr-FR")}</td>
                            <td className="px-4 py-2">
                              {l.sim_id
                                ? <span className="text-emerald-600 font-semibold">✓</span>
                                : <span className="text-amber-500 font-semibold">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Modal Import Facture ═══════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeImportModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Upload size={18} className="text-white" />
                </div>
                <p className="text-white font-bold text-sm">Importer une facture télécom</p>
              </div>
              <button onClick={closeImportModal} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {importResult ? (
                /* ── Résultat ── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} />
                    <p className="font-semibold text-sm">Import terminé</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total lignes",  val: String(importResult.total_lignes),  cls: "bg-gray-50 border-gray-200 text-gray-800" },
                      { label: "Montant total", val: `${parseFloat(importResult.montant_total).toLocaleString("fr-FR")} FCFA`, cls: "bg-camublue-900/5 border-camublue-900/20 text-camublue-900" },
                      { label: "Reconnus",      val: String(importResult.reconnus),       cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                      { label: "Non reconnus",  val: String(importResult.non_reconnus),   cls: "bg-amber-50 border-amber-200 text-amber-700" },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className={`border rounded-xl p-3 text-center ${cls}`}>
                        <p className="text-xl font-bold">{val}</p>
                        <p className="text-xs mt-0.5 opacity-70">{label}</p>
                      </div>
                    ))}
                  </div>

                  {importResult.numeros_inconnus.length > 0 ? (
                    <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-1">
                          Numéros non reconnus ({importResult.numeros_inconnus.length})
                        </p>
                        <p className="text-xs text-amber-600 font-mono leading-relaxed">
                          {importResult.numeros_inconnus.join(" · ")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700">Tous les numéros ont été reconnus</p>
                    </div>
                  )}

                  <button onClick={closeImportModal}
                    className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                    Fermer
                  </button>
                </div>

              ) : (
                /* ── Formulaire ── */
                <>
                  {/* Mois / Année / Opérateur */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mois *</label>
                      <select value={importForm.mois}
                        onChange={e => setImportForm(p => ({ ...p, mois: Number(e.target.value) }))}
                        className="input-base">
                        {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Année *</label>
                      <select value={importForm.annee}
                        onChange={e => setImportForm(p => ({ ...p, annee: Number(e.target.value) }))}
                        className="input-base">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Opérateur</label>
                      <input value={importForm.operateur}
                        onChange={e => setImportForm(p => ({ ...p, operateur: e.target.value }))}
                        placeholder="Orange, Expresso…" className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                      <input value={importForm.notes}
                        onChange={e => setImportForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optionnel…" className="input-base" />
                    </div>
                  </div>

                  {/* Zone fichier */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      importFile ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"
                    }`}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                      onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700">
                        <CheckCircle2 size={18} />
                        <p className="text-sm font-semibold">{importFile.name}</p>
                      </div>
                    ) : (
                      <>
                        <FileText size={28} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner un fichier</p>
                        <p className="text-xs text-gray-400 mt-1">Formats acceptés : .xlsx, .xls, .csv</p>
                      </>
                    )}
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-2">
                    <button onClick={closeImportModal}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleImport} disabled={!importFile || importing}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {importing
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

    </AppLayout>
  );
}
