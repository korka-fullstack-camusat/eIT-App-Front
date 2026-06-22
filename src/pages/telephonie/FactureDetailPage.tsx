import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X, Filter, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { factureService } from "@/services/api";
import type { FactureTelecom, LigneFacture } from "@/types";

const MOIS_LABELS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const LIGNE_PAGE_SIZE = 50;

// Correspondance entre les libellés du récapitulatif et les champs numériques par ligne
const RECAP_FIELD_MAP: Record<string, keyof LigneFacture> = {
  "Montant Hors Taxe":   "montant_ht",
  "Rutel (5%)":          "rutel",
  "Hors TVA avec Rutel": "montant_ht_rutel",
  "TVA (18%)":           "tva",
  "Montant TTC":         "montant_ttc",
  "Arrondi Précédent":   "arrondi_precedent",
  "Arrondi En cours":    "arrondi_encours",
  "Solde Facture":       "solde_facture",
};

const NUMERIC_LIGNE_FIELDS: (keyof LigneFacture)[] = [
  "montant_ht", "rutel", "montant_ht_rutel", "tva", "montant_ttc",
  "arrondi_precedent", "arrondi_encours", "solde_facture",
];

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isViewer } = useAuth();

  const [facture, setFacture] = useState<FactureTelecom | null>(null);
  const [loading, setLoading] = useState(true);

  const [ligneSearch, setLigneSearch] = useState("");
  const [lignePage,   setLignePage]   = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [typeFilterModal, setTypeFilterModal] = useState(false);
  const [showAllRecap, setShowAllRecap] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    factureService.get(Number(id))
      .then(setFacture)
      .catch(() => toast.error("Facture introuvable"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!facture) return;
    if (!confirm("Supprimer cette facture et toutes ses lignes ?")) return;
    try {
      await factureService.delete(facture.id);
      toast.success("Supprimée");
      navigate("/factures");
    } catch { toast.error("Impossible de supprimer"); }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="text-center text-gray-400 py-12">Chargement…</p>
      </AppLayout>
    );
  }

  if (!facture) {
    return (
      <AppLayout>
        <button onClick={() => navigate("/factures")}
          className="flex items-center gap-2 text-sm text-camublue-900 font-semibold mb-4 hover:underline">
          <ArrowLeft size={15} /> Retour aux factures
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-16 text-center">
          <p className="text-gray-500 font-medium">Facture introuvable</p>
        </div>
      </AppLayout>
    );
  }

  const f = facture;
  const total = (f.solde_facture != null && f.montant_ht != null) ? parseFloat(f.montant_ht) : 0;
  const ecart    = f.ecart != null ? parseFloat(f.ecart) : null;
  const ecartPct = f.ecart_pct ?? null;

  const recapRows: [string, string | null][] = [
    ["Numéro",              f.numero_compte],
    ["Référence Facture",   f.reference_facture],
    ["Montant Hors Taxe",   f.montant_ht],
    ["Rutel (5%)",          f.rutel],
    ["Hors TVA avec Rutel", f.montant_ht_rutel],
    ["TVA (18%)",           f.tva],
    ["Montant TTC",         f.montant_ttc],
    ["Arrondi Précédent",   f.arrondi_precedent],
    ["Arrondi En cours",    f.arrondi_encours],
    ["Solde Facture",       f.solde_facture],
  ];
  const hasRecap = recapRows.some(([, v]) => v != null);

  const types = Array.from(new Set(
    f.lignes.map(l => l.type_ligne).filter((t): t is string => !!t)
  )).sort();

  const filteredLignes = f.lignes.filter(l =>
    (!ligneSearch || l.numero_raw.includes(ligneSearch.trim()))
    && (!selectedType || l.type_ligne === selectedType)
  );
  const ligneTotalPages = Math.max(1, Math.ceil(filteredLignes.length / LIGNE_PAGE_SIZE));
  const ligneCurPage = Math.min(lignePage, ligneTotalPages);
  const paginatedLignes = filteredLignes.slice(
    (ligneCurPage - 1) * LIGNE_PAGE_SIZE, ligneCurPage * LIGNE_PAGE_SIZE
  );
  const fmtN = (v: string | null) => v != null ? parseFloat(v).toLocaleString("fr-FR") : "—";

  const typeTotals = selectedType
    ? NUMERIC_LIGNE_FIELDS.reduce((acc, field) => {
        acc[field] = filteredLignes.reduce((s, l) => {
          const v = l[field];
          return s + (v != null ? parseFloat(v as string) : 0);
        }, 0);
        return acc;
      }, {} as Record<string, number>)
    : null;

  return (
    <AppLayout>
      {/* ── Header (fixe au scroll) ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-1 -mt-1 flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <button onClick={() => navigate("/factures")}
            className="flex items-center gap-2 text-sm text-camublue-900 font-semibold mb-2 hover:underline">
            <ArrowLeft size={15} /> Retour aux factures
          </button>
          <h1 className="text-2xl font-bold text-camublue-900">{MOIS_LABELS[f.mois]} {f.annee}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {f.operateur ?? "—"} · {f.lignes.length} ligne(s)
            {f.nom_fichier && <> · <span className="italic">{f.nom_fichier}</span></>}
            {f.reference_facture && <> · Réf. <span className="font-mono">{f.reference_facture}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasRecap && (
            <div className="flex items-center gap-2">
              {selectedType && (
                <button
                  onClick={() => { setSelectedType(""); setLignePage(1); }}
                  className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} /> Réinitialiser
                </button>
              )}
              <button
                onClick={() => setTypeFilterModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              >
                <Filter size={15} /> Filtrer
              </button>
            </div>
          )}
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
          <p className="font-bold text-gray-800 text-lg">
            {total.toLocaleString("fr-FR")} <span className="font-bold text-gray-800">FCFA</span>
          </p>
          {!isViewer && (
            <button onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {/* ── Récapitulatif facture ── */}
        {hasRecap && (
          <div className="bg-camublue-900/[0.03] border-b border-camublue-900/10 px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <p className="text-[11px] font-bold text-camublue-900/60 uppercase tracking-wider">
                Récapitulatif facture
                {selectedType && (
                  <span className="ml-2 normal-case font-semibold text-camublue-900">
                    — Filtré par Type = {selectedType} ({filteredLignes.length} ligne(s))
                  </span>
                )}
              </p>
              <button
                onClick={() => setShowAllRecap(p => !p)}
                className="text-[11px] font-semibold text-camublue-900 hover:underline flex items-center gap-1"
              >
                {showAllRecap ? "Moins de détails" : "Plus de détails"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recapRows
                .filter(([, v]) => v != null)
                .filter(([label]) => showAllRecap || ["Numéro", "Montant TTC", "Solde Facture", "Arrondi En cours"].includes(label))
                .map(([label, val]) => {
                const field = RECAP_FIELD_MAP[label];
                const displayVal = (selectedType && typeTotals && field)
                  ? typeTotals[field]
                  : val;
                return (
                  <div key={label} className="bg-white border-2 border-camublue-900/15 rounded-xl px-3 py-3.5 shadow-sm text-center">
                    <p className="text-camublue-900/50 uppercase tracking-wide text-[10px] font-semibold">{label}</p>
                    <p className="font-bold text-camublue-900 mt-1 text-sm">
                      {label.toLowerCase().includes("référence") || label === "Numéro"
                        ? displayVal
                        : `${(typeof displayVal === "number" ? displayVal : parseFloat(displayVal as string)).toLocaleString("fr-FR")} FCFA`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Lignes ── */}
        {f.lignes.length > 0 && (
          <div className="bg-gray-50/60">
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex justify-center">
                <div className="relative w-full sm:w-[28rem]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  {ligneSearch && (
                    <button onClick={() => { setLigneSearch(""); setLignePage(1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                      <X size={14} />
                    </button>
                  )}
                  <input
                    value={ligneSearch}
                    onChange={e => { setLigneSearch(e.target.value); setLignePage(1); }}
                    placeholder="Rechercher un numéro…"
                    className="input-base pl-10 pr-9 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-camublue-900 sticky top-0 z-10">
                  <tr>
                    {["Numéro", "Référence Facture", "Montant HT", "Rutel (5%)", "Hors TVA avec Rutel", "TVA (18%)", "Montant TTC", "Arrondi Précédent", "Arrondi En cours", "Solde Facture"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-center text-[11px] font-semibold text-white uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {paginatedLignes.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-4 py-2 text-center font-mono text-gray-700">{l.numero_raw}</td>
                      <td className="px-4 py-2 text-center font-mono text-gray-500 text-xs">{l.reference_facture ?? "—"}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.montant_ht)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.rutel)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.montant_ht_rutel)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.tva)}</td>
                      <td className="px-4 py-2 text-center font-semibold text-camublue-900">{fmtN(l.montant_ttc)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.arrondi_precedent)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.arrondi_encours)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{fmtN(l.solde_facture)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ligneTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {(ligneCurPage - 1) * LIGNE_PAGE_SIZE + 1}–{Math.min(ligneCurPage * LIGNE_PAGE_SIZE, filteredLignes.length)} sur {filteredLignes.length.toLocaleString("fr-FR")}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setLignePage(p => Math.max(1, p - 1))} disabled={ligneCurPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-gray-500 px-1">Page {ligneCurPage} / {ligneTotalPages}</span>
                  <button onClick={() => setLignePage(p => Math.min(ligneTotalPages, p + 1))} disabled={ligneCurPage === ligneTotalPages}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Filtre par Type ── */}
      {typeFilterModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setTypeFilterModal(false)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-camublue-900">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Filter size={15} /> Filtrer par Type
              </h3>
              <button onClick={() => setTypeFilterModal(false)} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {types.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Aucun type détecté pour cette facture.</p>
              )}
              <button
                onClick={() => { setSelectedType(""); setLignePage(1); setTypeFilterModal(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                  selectedType === "" ? "bg-camublue-900 text-white border-camublue-900" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                Tous types (récapitulatif facture complet)
              </button>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => { setSelectedType(t); setLignePage(1); setTypeFilterModal(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                    selectedType === t ? "bg-camublue-900 text-white border-camublue-900" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Type = {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
