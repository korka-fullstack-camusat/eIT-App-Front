import { useEffect, useRef, useState } from "react";
import { Upload, ChevronDown, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { factureService } from "@/services/api";
import type { FactureTelecom, ImportResult } from "@/types";

const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function FacturesPage() {
  const [factures,     setFactures]     = useState<FactureTelecom[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [expanded,     setExpanded]     = useState<number | null>(null);
  const [filterAnnee,  setFilterAnnee]  = useState(new Date().getFullYear());
  const [importForm,   setImportForm]   = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear(),
    operateur: "",
    notes: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    factureService.getAll({ annee: filterAnnee })
      .then(setFactures).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterAnnee]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await factureService.importer(file, importForm);
      setImportResult(result);
      toast.success(`Import terminé — ${result.total_lignes} lignes`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de l'import");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Factures télécom</h1>
          <p className="text-gray-500 text-sm mt-0.5">{factures.length} facture(s) · Total {totalMontant.toLocaleString("fr-FR")} FCFA</p>
        </div>
        <select value={filterAnnee} onChange={e => setFilterAnnee(Number(e.target.value))}
          className="input-base w-auto px-3 py-2">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Carte import */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Importer une facture (Excel / CSV)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mois</label>
            <select value={importForm.mois} onChange={e => setImportForm(p => ({ ...p, mois: Number(e.target.value) }))}
              className="input-base">
              {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Année</label>
            <select value={importForm.annee} onChange={e => setImportForm(p => ({ ...p, annee: Number(e.target.value) }))}
              className="input-base">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Opérateur</label>
            <input value={importForm.operateur} onChange={e => setImportForm(p => ({ ...p, operateur: e.target.value }))}
              placeholder="Orange, Expresso…" className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <input value={importForm.notes} onChange={e => setImportForm(p => ({ ...p, notes: e.target.value }))}
              className="input-base" />
          </div>
        </div>

        <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm
          ${importing ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-900/90 text-white"}`}>
          <Upload size={15} />
          {importing ? "Importation en cours…" : "Choisir un fichier"}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importing} onChange={handleImport} />
        </label>

        {importResult && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-700 mb-3">Résultat de l'import</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
              {[
                { label: "Total lignes",  val: importResult.total_lignes,  color: "text-gray-800" },
                { label: "Reconnus",      val: importResult.reconnus,       color: "text-emerald-600" },
                { label: "Non reconnus",  val: importResult.non_reconnus,   color: "text-amber-600" },
                { label: "Montant total", val: `${parseFloat(importResult.montant_total).toLocaleString("fr-FR")} FCFA`, color: "text-camublue-900" },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className={`text-lg font-bold ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {importResult.numeros_inconnus.length > 0 ? (
              <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Numéros non reconnus ({importResult.numeros_inconnus.length})</p>
                  <p className="text-xs text-amber-600 font-mono leading-relaxed">{importResult.numeros_inconnus.join(" · ")}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-center bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <p className="text-xs font-semibold text-emerald-700">Tous les numéros ont été reconnus</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liste factures */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">Chargement…</p>
      ) : factures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-12 text-center text-gray-400">
          Aucune facture pour {filterAnnee}
        </div>
      ) : (
        <div className="space-y-3">
          {factures.map(f => {
            const total = f.lignes.reduce((s, l) => s + parseFloat(l.montant || "0"), 0);
            const isOpen = expanded === f.id;
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-camublue-900/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-camublue-900">{String(f.mois).padStart(2,"0")}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{MOIS_LABELS[f.mois]} {f.annee}</p>
                      <p className="text-xs text-gray-400">{f.operateur ?? "—"} · {f.lignes.length} ligne(s) · {f.nom_fichier ?? ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-gray-800">
                      {total.toLocaleString("fr-FR")} <span className="text-xs font-normal text-gray-400">FCFA</span>
                    </p>
                    <button onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={13} /></button>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>{["Numéro brut","Montant (FCFA)","Reconnu"].map(h => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}</tr>
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
    </AppLayout>
  );
}
