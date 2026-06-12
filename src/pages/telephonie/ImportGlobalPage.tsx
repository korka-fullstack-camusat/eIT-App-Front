import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Upload, CheckCircle2, XCircle, FileText, Users, Truck, Radio, History, Clock, X,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { importGlobalService, type ImportGlobalResult, type ImportGlobalLog } from "@/services/api";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()} à ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ImportGlobalPage() {
  const { isViewer } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportGlobalResult | null>(null);

  const [importModal, setImportModal] = useState(false);

  const [historique, setHistorique] = useState<ImportGlobalLog[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  const loadHistorique = () => {
    setHistLoading(true);
    importGlobalService.historique()
      .then(setHistorique)
      .catch(() => {})
      .finally(() => setHistLoading(false));
  };

  useEffect(() => { loadHistorique(); }, []);

  const reset = () => {
    setFile(null); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importGlobalService.importer(file);
      setResult(res);
      toast.success("Import global terminé");
      loadHistorique();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors de l'import global");
    } finally {
      setLoading(false);
    }
  };

  const totalErreurs =
    (result?.employes.errors.length ?? 0) +
    (result?.vehicules.errors.length ?? 0) +
    (result?.sites.errors.length ?? 0);

  if (isViewer) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Import global — Suivi flotte</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Mettez à jour automatiquement les numéros SIM employés, les véhicules M2M et les sites RMS
            à partir d'un seul fichier Excel "SUIVI FLOTTE CAMUSAT".
          </p>
        </div>
        {!isViewer && (
          <button onClick={() => { reset(); setImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
            <Upload size={15} /><span>Importer</span>
          </button>
        )}
      </div>

      <div className="w-full">
        {/* ── Historique des imports ── */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><History size={15} className="text-gray-600" /></div>
            <h2 className="font-semibold text-base text-gray-800">Historique des imports</h2>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {histLoading ? (
              <p className="text-sm text-gray-400 p-6 text-center">Chargement…</p>
            ) : historique.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Aucun import effectué pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-camublue-900 text-white text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Fichier</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Utilisateur</th>
                      <th className="text-center px-4 py-2.5 font-semibold">Employés</th>
                      <th className="text-center px-4 py-2.5 font-semibold">Véhicules M2M</th>
                      <th className="text-center px-4 py-2.5 font-semibold">Sites RMS</th>
                      <th className="text-center px-4 py-2.5 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historique.map(h => {
                      let r: ImportGlobalResult | null = null;
                      try { r = h.resultat ? JSON.parse(h.resultat) : null; } catch { r = null; }
                      const totalErr =
                        (r?.employes.errors.length ?? 0) +
                        (r?.vehicules.errors.length ?? 0) +
                        (r?.sites.errors.length ?? 0);
                      return (
                        <tr key={h.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            <div className="flex items-center gap-1.5"><Clock size={13} className="text-gray-400" />{formatDate(h.created_at)}</div>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5"><FileText size={13} className="text-gray-400" />{h.nom_fichier || "—"}</div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{h.utilisateur || "—"}</td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {r ? `${r.employes.created} créés / ${r.employes.updated} maj` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {r ? `${r.vehicules.created_sim + r.vehicules.created_vehicule} créés / ${r.vehicules.updated_sim + r.vehicules.updated_vehicule} maj` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {r ? `${r.sites.created} créés / ${r.sites.updated} maj` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {totalErr > 0
                              ? <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs"><XCircle size={13} />{totalErr} erreur(s)</span>
                              : <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs"><CheckCircle2 size={13} />OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Modal Import ════════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Upload size={18} className="text-white" /></div>
                <p className="text-white font-bold text-sm">Import global — Suivi flotte</p>
              </div>
              <button onClick={() => setImportModal(false)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} className="text-white" /></button>
            </div>

            <div className="p-6">
              {!result ? (
                <>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      file ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-camublue-900/40 hover:bg-gray-50"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden"
                      onChange={e => setFile(e.target.files?.[0] ?? null)} />
                    {file
                      ? <div className="flex items-center justify-center gap-2 text-emerald-700"><CheckCircle2 size={20} /><p className="text-sm font-semibold">{file.name}</p></div>
                      : <><Upload size={28} className="mx-auto mb-2 text-gray-400" /><p className="text-sm text-gray-600 font-medium">Cliquer pour sélectionner le fichier Excel</p></>}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setImportModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={handleImport} disabled={!file || loading}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      {loading
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importation en cours…</>
                        : <><Upload size={14} /> Lancer l'import global</>}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={20} />
                    <p className="font-semibold text-sm">Import terminé{totalErreurs > 0 ? ` (${totalErreurs} erreur(s))` : ""}</p>
                  </div>

                  {/* Employés */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-camublue-900/10 flex items-center justify-center"><Users size={15} className="text-camublue-900" /></div>
                      <p className="font-semibold text-sm text-gray-800">SIM Employés (ORANGE-mobiles)</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Stat label="Créés" value={result.employes.created} color="emerald" />
                      <Stat label="Mis à jour" value={result.employes.updated} color="blue" />
                      <Stat label="Affectations créées" value={result.employes.affecte} color="purple" />
                      <Stat label="Erreurs" value={result.employes.errors.length} color="red" />
                    </div>
                  </div>

                  {/* Véhicules */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center"><Truck size={15} className="text-sky-700" /></div>
                      <p className="font-semibold text-sm text-gray-800">Véhicules M2M (ORANGE-Gps_Vehicules)</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <Stat label="SIM créés" value={result.vehicules.created_sim} color="emerald" />
                      <Stat label="SIM mis à jour" value={result.vehicules.updated_sim} color="blue" />
                      <Stat label="Véhicules créés" value={result.vehicules.created_vehicule} color="emerald" />
                      <Stat label="Véhicules mis à jour" value={result.vehicules.updated_vehicule} color="blue" />
                      <Stat label="Erreurs" value={result.vehicules.errors.length} color="red" />
                    </div>
                  </div>

                  {/* Sites */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><Radio size={15} className="text-indigo-700" /></div>
                      <p className="font-semibold text-sm text-gray-800">Sites RMS (RMS_Orange / RMS_Free)</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <Stat label="Créés" value={result.sites.created} color="emerald" />
                      <Stat label="Mis à jour" value={result.sites.updated} color="blue" />
                      <Stat label="SIM créés" value={result.sites.sims_crees} color="indigo" />
                      <Stat label="Lignes factures reliées" value={result.sites.relinked} color="purple" />
                      <Stat label="Erreurs" value={result.sites.errors.length} color="red" />
                    </div>
                    {result.sites.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3 max-h-36 overflow-y-auto">
                        {result.sites.errors.map((e, i) => <p key={i} className="text-xs text-red-600">Ligne {e.ligne} : {e.message}</p>)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={reset} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Nouvel import
                    </button>
                    <button onClick={() => setImportModal(false)} className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: "emerald" | "blue" | "purple" | "red" | "indigo" }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue:    "bg-blue-50 border-blue-200 text-blue-700",
    purple:  "bg-purple-50 border-purple-200 text-purple-700",
    red:     "bg-red-50 border-red-200 text-red-600",
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`border rounded-xl p-3 text-center ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] mt-0.5 leading-tight opacity-80">{label}</p>
    </div>
  );
}
