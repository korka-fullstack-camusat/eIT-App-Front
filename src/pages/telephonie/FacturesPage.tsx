import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, ChevronDown, AlertCircle, CheckCircle2, Trash2, X, FileText, Receipt, FileSpreadsheet, ChevronLeft, ChevronRight, Search, TrendingUp, TrendingDown, Wallet, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { factureService } from "@/services/api";
import type { FactureTelecom, ImportResult } from "@/types";

const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const EMPTY_FORM = () => ({
  mois:      new Date().getMonth() + 1,
  annee:     new Date().getFullYear(),
  operateur: "",
  notes:     "",
});

const PAGE_SIZE = 6;

export default function FacturesPage() {
  const { isViewer } = useAuth();
  const navigate = useNavigate();
  const [factures,     setFactures]     = useState<FactureTelecom[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterAnnee,  setFilterAnnee]  = useState(new Date().getFullYear());

  // Pagination
  const [page, setPage] = useState(1);

  // Recherche des factures (mois, opérateur, fichier, référence, n° compte)
  const [factureSearch, setFactureSearch] = useState("");

  // Export
  const [exportLoading, setExportLoading] = useState(false);

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

  useEffect(() => { load(); setPage(1); }, [filterAnnee]);

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

  const factureTotal = (f: FactureTelecom) =>
    f.montant_ttc != null
      ? parseFloat(f.montant_ttc)
      : f.lignes.reduce((ls, l) => ls + parseFloat(l.montant || "0"), 0);

  const totalMontant = factures.reduce((s, f) => s + factureTotal(f), 0);

  // Recherche : mois, opérateur, fichier, référence, n° compte
  const search = factureSearch.trim().toLowerCase();
  const filteredFactures = !search ? factures : factures.filter(f => {
    const haystack = [
      MOIS_LABELS[f.mois], String(f.annee), f.operateur, f.nom_fichier,
      f.reference_facture, f.numero_compte,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search);
  });

  const totalPages  = Math.max(1, Math.ceil(filteredFactures.length / PAGE_SIZE));
  const curPage     = Math.min(page, totalPages);
  const paginated   = filteredFactures.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // ── Statistiques globales (vue d'ensemble sur l'année sélectionnée) ──
  const nbFactures = factures.length;
  const moyenneMontant = nbFactures > 0 ? totalMontant / nbFactures : 0;
  const maxFacture = nbFactures > 0
    ? factures.reduce((best, f) => factureTotal(f) > factureTotal(best) ? f : best, factures[0])
    : null;
  const minFacture = nbFactures > 0
    ? factures.reduce((best, f) => factureTotal(f) < factureTotal(best) ? f : best, factures[0])
    : null;
  const dernierEcart = factures.length > 0 ? factures[0].ecart : null;
  const dernierEcartVal = dernierEcart != null ? parseFloat(dernierEcart) : null;


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
          <button
            disabled={exportLoading || factures.length === 0}
            onClick={async () => {
              setExportLoading(true);
              try {
                await factureService.exportExcel({ annee: filterAnnee });
                toast.success("Fichier Excel généré");
              } catch { toast.error("Erreur lors de l'export"); }
              finally { setExportLoading(false); }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 rounded-xl text-sm font-semibold transition shadow-sm">
            {exportLoading
              ? <span className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
              : <FileSpreadsheet size={15} />}
            <span>Exporter</span>
            <span className="text-[10px] bg-emerald-200 rounded px-1 py-0.5 font-bold leading-none">.xlsx</span>
          </button>
          {!isViewer && (
          <button onClick={openImportModal}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Upload size={15} /> Importer facture
          </button>
          )}
        </div>
      </div>

      {/* ── Statistiques globales ── */}
      {!loading && factures.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
              <Receipt size={18} className="text-camublue-900" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">{nbFactures}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Factures</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-camublue-900" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">{totalMontant.toLocaleString("fr-FR")} <span className="text-lg">FCFA</span></p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Total {filterAnnee}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
              <BarChart3 size={18} className="text-camublue-900" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">{Math.round(moyenneMontant).toLocaleString("fr-FR")} <span className="text-lg">FCFA</span></p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Moyenne / facture</p>
            </div>
          </div>
          {maxFacture && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">{factureTotal(maxFacture).toLocaleString("fr-FR")} <span className="text-lg">FCFA</span></p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Plus élevée — {MOIS_LABELS[maxFacture.mois]}</p>
              </div>
            </div>
          )}
          {minFacture && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <TrendingDown size={18} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">{factureTotal(minFacture).toLocaleString("fr-FR")} <span className="text-lg">FCFA</span></p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Plus basse — {MOIS_LABELS[minFacture.mois]}</p>
              </div>
            </div>
          )}
          {dernierEcartVal != null && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex flex-col items-center text-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                dernierEcartVal > 0 ? "bg-red-50" : dernierEcartVal < 0 ? "bg-emerald-50" : "bg-gray-100"
              }`}>
                {dernierEcartVal > 0
                  ? <TrendingUp size={18} className="text-red-500" />
                  : dernierEcartVal < 0
                    ? <TrendingDown size={18} className="text-emerald-500" />
                    : <BarChart3 size={18} className="text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">
                  {dernierEcartVal > 0 ? "+" : ""}{Math.round(dernierEcartVal).toLocaleString("fr-FR")} <span className="text-lg">FCFA</span>
                </p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">Dernier écart (vs N-1)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recherche ── */}
      {!loading && factures.length > 0 && (
        <div className="flex justify-center mb-4">
          <div className="relative w-full sm:w-[32rem]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {factureSearch && (
              <button onClick={() => { setFactureSearch(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                <X size={14} />
              </button>
            )}
            <input
              value={factureSearch}
              onChange={e => { setFactureSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher une facture (mois, opérateur, fichier, référence…)"
              className="input-base pl-10 pr-9 py-3 text-sm"
            />
          </div>
        </div>
      )}

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
      ) : filteredFactures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Aucun résultat pour « {factureSearch} »</p>
          <p className="text-gray-400 text-sm mt-1">Essayez un autre mois, opérateur ou nom de fichier</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(f => {
            const total  = factureTotal(f);
            const ecart    = f.ecart != null ? parseFloat(f.ecart) : null;
            const ecartPct = f.ecart_pct ?? null;
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => navigate(`/factures/${f.id}`)}
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
                        {f.reference_facture && <> · Réf. <span className="font-mono">{f.reference_facture}</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ecart != null && (
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                        ecart > 0 ? "bg-red-50 text-red-600 border-red-200"
                        : ecart < 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                      }`} title="Écart par rapport au mois précédent">
                        {ecart > 0 ? "▲" : ecart < 0 ? "▼" : "="} {Math.abs(ecart).toLocaleString("fr-FR")} FCFA
                        {ecartPct != null && <> ({ecartPct > 0 ? "+" : ""}{ecartPct.toFixed(1)}%)</>}
                      </span>
                    )}
                    <p className="font-bold text-gray-800">
                      {total.toLocaleString("fr-FR")} <span className="font-bold text-gray-800">FCFA</span>
                    </p>
                    {!isViewer && (
                    <button onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
                      <Trash2 size={13} />
                    </button>
                    )}
                    <ChevronDown size={16} className="text-gray-400 -rotate-90" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && filteredFactures.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filteredFactures.length)} sur {filteredFactures.length} facture(s)
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={curPage === 1}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={14} />
            </button>
            {(() => {
              const w = 2, start = Math.max(1, curPage - w), end = Math.min(totalPages, curPage + w);
              return (
                <>
                  {start > 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
                  {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                        n === curPage ? "bg-camublue-900 text-white shadow-sm" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}>{n}</button>
                  ))}
                  {end < totalPages && <span className="px-1 text-gray-300 text-xs">…</span>}
                </>
              );
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={curPage === totalPages}
              className="px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-gray-500 transition">»</button>
          </div>
          <p className="text-xs text-gray-400">Page <strong className="text-gray-700">{curPage}</strong> / {totalPages}</p>
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
