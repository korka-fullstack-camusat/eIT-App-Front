import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, X, Filter, Clock, User, FileText, ChevronDown, ChevronUp } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { exportGlobalService, type ExportLogEntry } from "@/services/api";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function FilterSelect({
  label, value, onChange,
  options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-900/20"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function ExportModal({ onClose, onExported }: { onClose: () => void; onExported: () => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "", label: "Tous les mois" },
    { value: "1", label: "Janvier" },  { value: "2",  label: "Février" },
    { value: "3", label: "Mars" },     { value: "4",  label: "Avril" },
    { value: "5", label: "Mai" },      { value: "6",  label: "Juin" },
    { value: "7", label: "Juillet" },  { value: "8",  label: "Août" },
    { value: "9", label: "Septembre" },{ value: "10", label: "Octobre" },
    { value: "11", label: "Novembre" },{ value: "12", label: "Décembre" },
  ];

  const [matStatut,    setMatStatut]    = useState("");
  const [matType,      setMatType]      = useState("");
  const [attStatut,    setAttStatut]    = useState("");
  const [simCategorie, setSimCategorie] = useState("");
  const [simStatut,    setSimStatut]    = useState("");
  const [siteFilter,   setSiteFilter]   = useState("");
  const [vehFilter,    setVehFilter]    = useState("");
  const [factAnnee,    setFactAnnee]    = useState("");
  const [factMois,     setFactMois]     = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleExport = async () => {
    setStatus("loading");
    try {
      await exportGlobalService.export({
        ...(matStatut    && { mat_statut:      matStatut }),
        ...(matType      && { mat_type:        matType }),
        ...(attStatut    && { att_statut:      attStatut }),
        ...(simCategorie && { sim_categorie:   simCategorie }),
        ...(simStatut    && { sim_statut:      simStatut }),
        ...(siteFilter   && { site_filter_sim: siteFilter }),
        ...(vehFilter    && { veh_filter_sim:  vehFilter }),
        ...(factAnnee    && { fact_annee:      Number(factAnnee) }),
        ...(factMois     && { fact_mois:       Number(factMois) }),
      });
      setStatus("done");
      setTimeout(() => { onExported(); onClose(); }, 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-camublue-900" />
            <h2 className="font-bold text-camublue-900 text-base">Exporter toutes les données</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Feuilles incluses */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Feuilles générées</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Résumé",        color: "bg-gray-100 text-gray-600 border-gray-200" },
                { label: "Matériels",     color: "bg-blue-50 text-blue-700 border-blue-200" },
                { label: "Attributions",  color: "bg-purple-50 text-purple-700 border-purple-200" },
                { label: "Numéros SIM",   color: "bg-green-50 text-green-700 border-green-200" },
                { label: "Sites RMS",     color: "bg-orange-50 text-orange-700 border-orange-200" },
                { label: "Véhicules GPS", color: "bg-red-50 text-red-700 border-red-200" },
                { label: "Factures",      color: "bg-teal-50 text-teal-700 border-teal-200" },
              ].map(s => (
                <span key={s.label} className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${s.color}`}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Filtres */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-1.5 mb-4">
              <Filter size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filtres optionnels</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
              {/* Colonne 1 : Matériels */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-700">Matériels</p>
                <FilterSelect label="Statut" value={matStatut} onChange={setMatStatut}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "DISPONIBLE",  label: "Disponible" },
                    { value: "ATTRIBUE",    label: "Attribué" },
                    { value: "MAINTENANCE", label: "Maintenance" },
                    { value: "EN_PANNE",    label: "En panne" },
                    { value: "REFORME",     label: "Réformé" },
                  ]}
                />
                <FilterSelect label="Type" value={matType} onChange={setMatType}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "ORDINATEUR_PORTABLE", label: "PC Portable" },
                    { value: "ORDINATEUR_FIXE",     label: "PC Fixe" },
                    { value: "ECRAN",               label: "Écran" },
                    { value: "IMPRIMANTE",          label: "Imprimante" },
                    { value: "TELEPHONE",           label: "Téléphone" },
                    { value: "TABLETTE",            label: "Tablette" },
                    { value: "SWITCH",              label: "Switch" },
                    { value: "ROUTEUR",             label: "Routeur" },
                    { value: "SERVEUR",             label: "Serveur" },
                    { value: "AUTRE",               label: "Autre" },
                  ]}
                />
                <p className="text-xs font-bold text-gray-700 mt-1">Attributions</p>
                <FilterSelect label="Statut" value={attStatut} onChange={setAttStatut}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "ACTIVE",   label: "Active" },
                    { value: "CLOTUREE", label: "Clôturée" },
                  ]}
                />
              </div>

              {/* Colonne 2 : SIM */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-700">Numéros SIM</p>
                <FilterSelect label="Catégorie" value={simCategorie} onChange={setSimCategorie}
                  options={[
                    { value: "", label: "Toutes" },
                    { value: "MOBILE",   label: "Mobile" },
                    { value: "GPS",      label: "GPS" },
                    { value: "SITE_GSM", label: "Site GSM" },
                  ]}
                />
                <FilterSelect label="Statut" value={simStatut} onChange={setSimStatut}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "ACTIVE",    label: "Active" },
                    { value: "INACTIVE",  label: "Inactive" },
                    { value: "SUSPENDUE", label: "Suspendue" },
                    { value: "RESILIEE",  label: "Résiliée" },
                  ]}
                />
                <p className="text-xs font-bold text-gray-700 mt-1">Sites / Véhicules</p>
                <FilterSelect label="Sites — SIM" value={siteFilter} onChange={setSiteFilter}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "with_sim",    label: "Avec SIM" },
                    { value: "without_sim", label: "Sans SIM" },
                  ]}
                />
                <FilterSelect label="Véhicules — SIM" value={vehFilter} onChange={setVehFilter}
                  options={[
                    { value: "", label: "Tous" },
                    { value: "with_sim",    label: "Avec SIM" },
                    { value: "without_sim", label: "Sans SIM" },
                  ]}
                />
              </div>

              {/* Colonne 3 : Factures */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-700">Factures Télécom</p>
                <FilterSelect label="Année" value={factAnnee} onChange={setFactAnnee}
                  options={[{ value: "", label: "Toutes" }, ...years.map(y => ({ value: String(y), label: String(y) }))]}
                />
                <FilterSelect label="Mois" value={factMois} onChange={setFactMois} options={months} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer modal */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={status === "loading"}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              status === "done"
                ? "bg-green-500 text-white"
                : status === "error"
                ? "bg-red-500 text-white"
                : status === "loading"
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-camublue-900 text-white hover:bg-camublue-900/90"
            }`}
          >
            <Download size={15} />
            {status === "loading" ? "Génération…" : status === "done" ? "Téléchargé !" : "Générer le fichier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ligne d'historique ───────────────────────────────────────────────────────
function LogRow({ log }: { log: ExportLogEntry }) {
  const [open, setOpen] = useState(false);
  const total = Object.values(log.nb_rows).reduce((s, n) => s + n, 0);
  const hasFilters = Object.keys(log.filters).length > 0;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-4 py-3 bg-white hover:bg-gray-50 transition text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-camublue-900/10 flex items-center justify-center shrink-0">
          <FileText size={14} className="text-camublue-900" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{log.filename}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} /> {fmt(log.created_at)}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <User size={11} /> {log.user_name}
            </span>
            <span className="text-xs text-camublue-900 font-semibold">{total} lignes</span>
            {hasFilters && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                Filtré
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-gray-300">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-gray-500 mb-1.5">Lignes par feuille</p>
            <div className="flex flex-col gap-1">
              {Object.entries(log.nb_rows).map(([sheet, count]) => (
                <div key={sheet} className="flex justify-between">
                  <span className="text-gray-600">{sheet}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-500 mb-1.5">Filtres appliqués</p>
            {hasFilters ? (
              <div className="flex flex-col gap-1">
                {Object.entries(log.filters).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-semibold text-gray-800 truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">Aucun filtre</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExportGlobalPage() {
  const [showModal, setShowModal] = useState(false);
  const [logs, setLogs]           = useState<ExportLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await exportGlobalService.getLogs();
      setLogs(data);
    } catch {
      // silencieux
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Export global</h1>
            <p className="text-sm text-gray-500 mt-1">
              Génère un fichier Excel unique avec toutes les données réparties en feuilles
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-camublue-900 text-white rounded-xl font-semibold text-sm hover:bg-camublue-900/90 transition shadow-sm"
          >
            <Download size={16} />
            Exporter
          </button>
        </div>

        {/* Info feuilles */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet size={16} className="text-camublue-900" />
            <h2 className="font-semibold text-gray-800 text-sm">Contenu du fichier exporté</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Résumé",        color: "bg-gray-100 text-gray-600 border-gray-200" },
              { label: "Matériels",     color: "bg-blue-50 text-blue-700 border-blue-200" },
              { label: "Attributions",  color: "bg-purple-50 text-purple-700 border-purple-200" },
              { label: "Numéros SIM",   color: "bg-green-50 text-green-700 border-green-200" },
              { label: "Sites RMS",     color: "bg-orange-50 text-orange-700 border-orange-200" },
              { label: "Véhicules GPS", color: "bg-red-50 text-red-700 border-red-200" },
              { label: "Factures",      color: "bg-teal-50 text-teal-700 border-teal-200" },
            ].map(s => (
              <span key={s.label} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${s.color}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Historique */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800 text-sm">Historique des exportations</h2>
            {logs.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-camublue-900/10 text-camublue-900 text-xs font-bold">
                {logs.length}
              </span>
            )}
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-14 text-center">
              <FileSpreadsheet size={36} className="text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm font-medium">Aucune exportation effectuée</p>
              <p className="text-gray-400 text-xs mt-1">Cliquez sur "Exporter" pour générer votre premier fichier</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map(log => <LogRow key={log.id} log={log} />)}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ExportModal
          onClose={() => setShowModal(false)}
          onExported={fetchLogs}
        />
      )}
    </AppLayout>
  );
}
