import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Search, Key, Users,
  UserPlus, AlertTriangle,
  Upload, Download, Check, Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { licenceService, ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

const today = () => new Date().toISOString().slice(0, 10);

function fmt(d?: string) {
  if (!d) return "—";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
}
function isExpired(d?: string)  { if (!d) return false; return new Date(d) < new Date(); }
function expireSoon(d?: string) { if (!d) return false; const diff = (new Date(d).getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= 30; }

const EMPTY_LIC = { logiciel: "", cle_licence: "", date_achat: "", date_expiration: "" };

export default function LicencesPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";

  const [licences,    setLicences]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  // Modal création / édition
  const [licModal,    setLicModal]    = useState(false);
  const [editingLic,  setEditingLic]  = useState<any | null>(null);
  const [licForm,     setLicForm]     = useState({ ...EMPTY_LIC });
  const [savingLic,   setSavingLic]   = useState(false);

  // Modal attribution
  const [attModal,    setAttModal]    = useState<number | null>(null);
  const [empSearch,   setEmpSearch]   = useState("");
  const [empResults,  setEmpResults]  = useState<any[]>([]);
  const [empLoading,  setEmpLoading]  = useState(false);
  const [selected,    setSelected]    = useState<any[]>([]);
  const [savingAtt,   setSavingAtt]   = useState(false);
  const empDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suppression
  const [deleteLicId, setDeleteLicId] = useState<number | null>(null);

  // Modal détail
  const [detailLic, setDetailLic] = useState<any | null>(null);

  // Import
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setLicences(await licenceService.list(search || undefined)); }
    catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  // Recherche employés avec debounce
  useEffect(() => {
    if (!attModal) return;
    if (empDebounce.current) clearTimeout(empDebounce.current);
    empDebounce.current = setTimeout(async () => {
      setEmpLoading(true);
      try {
        const res = await ax.get("/licences/employes-search", { params: { q: empSearch } });
        setEmpResults(res.data);
      } catch { setEmpResults([]); }
      finally { setEmpLoading(false); }
    }, 300);
  }, [empSearch, attModal]);

  const openCreate = () => { setEditingLic(null); setLicForm({ ...EMPTY_LIC }); setLicModal(true); };
  const openEdit   = (l: any) => {
    setEditingLic(l);
    setLicForm({ logiciel: l.logiciel, cle_licence: l.cle_licence || "", date_achat: l.date_achat || "", date_expiration: l.date_expiration || "" });
    setLicModal(true);
  };

  const saveLicence = async () => {
    if (!licForm.logiciel.trim()) { toast.error("Le nom du logiciel est requis"); return; }
    setSavingLic(true);
    try {
      const payload = {
        logiciel:        licForm.logiciel,
        cle_licence:     licForm.cle_licence || null,
        date_achat:      licForm.date_achat || null,
        date_expiration: licForm.date_expiration || null,
      };
      if (editingLic) { await licenceService.update(editingLic.id, payload); toast.success("Licence mise à jour"); }
      else            { await licenceService.create(payload);                 toast.success("Licence créée"); }
      setLicModal(false); load();
    } catch { toast.error("Erreur enregistrement"); }
    finally { setSavingLic(false); }
  };

  const confirmDeleteLic = async () => {
    if (!deleteLicId) return;
    try { await licenceService.delete(deleteLicId); toast.success("Licence supprimée"); setDeleteLicId(null); load(); }
    catch { toast.error("Erreur suppression"); }
  };

  const openAttModal = (licId: number) => {
    setAttModal(licId);
    setEmpSearch("");
    setEmpResults([]);
    setSelected([]);
  };

  const toggleEmp = (emp: any) => {
    const key = `${emp.nom}|${emp.prenom}`;
    setSelected(prev =>
      prev.some(e => `${e.nom}|${e.prenom}` === key)
        ? prev.filter(e => `${e.nom}|${e.prenom}` !== key)
        : [...prev, emp]
    );
  };

  const saveAtt = async () => {
    if (!attModal || selected.length === 0) { toast.error("Sélectionnez au moins un employé"); return; }
    setSavingAtt(true);
    try {
      await Promise.all(selected.map(emp =>
        licenceService.addAttribution(attModal, {
          employee_nom:       emp.nom,
          employee_prenom:    emp.prenom,
          employee_matricule: emp.matricule,
          employee_service:   "",
          date_attribution:   today(),
        })
      ));
      toast.success(`${selected.length} attribution(s) ajoutée(s)`);
      setAttModal(null);
      load();
    } catch { toast.error("Erreur"); }
    finally { setSavingAtt(false); }
  };

  const removeAtt = async (licId: number, attId: number) => {
    try { await licenceService.removeAttribution(licId, attId); toast.success("Attribution retirée"); load(); }
    catch { toast.error("Erreur"); }
  };

  const downloadBlob = async (url: string, filename: string) => {
    try {
      const res = await ax.get(url, { responseType: "blob" });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = href; a.download = filename; a.click();
      URL.revokeObjectURL(href);
    } catch { toast.error("Erreur de téléchargement"); }
  };

  const downloadTemplate = () => downloadBlob("/licences/template", "modele_licences.xlsx");
  const exportData = () => downloadBlob(`/licences/export${search ? `?search=${encodeURIComponent(search)}` : ""}`, "licences.xlsx");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await ax.post("/licences/import", fd);
      const { created, errors } = res.data;
      toast.success(`${created} licence(s) importée(s)`);
      if (errors?.length) toast.error(`${errors.length} erreur(s) : ${errors[0]}`);
      load();
    } catch { toast.error("Erreur lors de l'import"); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  };

  const nbExpires  = licences.filter(l => isExpired(l.date_expiration)).length;
  const nbSoon     = licences.filter(l => expireSoon(l.date_expiration)).length;
  const nbAttribs  = licences.reduce((s, l) => s + (l.attributions?.length ?? 0), 0);

  return (
    <AppLayout>
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Suivis Licences</h1>
            <p className="text-gray-500 text-sm mt-0.5">{loading ? "Chargement…" : `${licences.length} licence(s) · ${nbAttribs} attribution(s)`}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Recherche */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 bg-white shadow-sm w-48" />
            </div>
            {canEdit && (
              <>
                {/* Télécharger modèle */}
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white shadow-sm hover:bg-gray-50 transition">
                  <Download size={14} /> Modèle
                </button>
                {/* Exporter données */}
                <button onClick={exportData}
                  className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 shadow-sm transition">
                  <Download size={14} /> Exporter
                </button>
                {/* Importer */}
                <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
                <button onClick={() => importRef.current?.click()} disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-sm transition disabled:opacity-50">
                  <Upload size={14} /> {importing ? "Import…" : "Importer"}
                </button>
                {/* Créer */}
                <button onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm font-semibold shadow hover:bg-camublue-900/90 transition">
                  <Plus size={15} /> Ajouter
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Total",           val: licences.length, color: "text-gray-800" },
            { label: "Utilisateurs",    val: nbAttribs,       color: "text-camublue-900" },
            { label: "Expirées",        val: nbExpires,       color: "text-red-600" },
            { label: "Expirent < 30 j", val: nbSoon,          color: "text-orange-500" },
          ].map(s => (
            <div key={s.label} className="flex-1 min-w-[100px] bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center shadow-sm">
              <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tableau ── */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : licences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Key size={48} className="mb-3 opacity-20" />
          <p className="font-medium">Aucune licence enregistrée</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#1F3864]">
                  {["Logiciel", "Clé de licence", "Date d'achat", "Date d'expiration", "Utilisateurs", "Actions"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide whitespace-nowrap ${i < 5 ? "border-r border-[#2e4d8a]" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {licences.map((l, idx) => {
                  const exp  = isExpired(l.date_expiration);
                  const soon = expireSoon(l.date_expiration);
                  return (
                    <React.Fragment key={l.id}>
                      <tr className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30`}>
                        {/* Logiciel */}
                        <td className="px-4 py-3 border-r border-gray-100 font-semibold text-gray-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            {l.logiciel}
                            {exp  && <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold"><AlertTriangle size={9} />Expirée</span>}
                            {soon && !exp && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">Bientôt</span>}
                          </div>
                        </td>
                        {/* Clé */}
                        <td className="px-4 py-3 border-r border-gray-100">
                          {l.cle_licence
                            ? <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{l.cle_licence}</code>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Date achat */}
                        <td className="px-4 py-3 border-r border-gray-100 text-gray-600 whitespace-nowrap">{fmt(l.date_achat)}</td>
                        {/* Date expiration */}
                        <td className={`px-4 py-3 border-r border-gray-100 whitespace-nowrap font-medium ${exp ? "text-red-600" : soon ? "text-orange-500" : "text-gray-600"}`}>
                          {fmt(l.date_expiration)}
                        </td>
                        {/* Utilisateurs */}
                        <td className="px-4 py-3 border-r border-gray-100">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                            <Users size={12} />{l.attributions?.length ?? 0}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setDetailLic(l)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition whitespace-nowrap">
                              <Eye size={12} /> Afficher
                            </button>
                            {canEdit && (
                              <>
                                <button onClick={() => openAttModal(l.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition whitespace-nowrap">
                                  <UserPlus size={12} /> Attribuer
                                </button>
                                <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Pencil size={13} /></button>
                                <button onClick={() => setDeleteLicId(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal création / édition licence ── */}
      {licModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-camublue-900">{editingLic ? "Modifier la licence" : "Nouvelle licence"}</h2>
              <button onClick={() => setLicModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Logiciel *</label>
                <input value={licForm.logiciel} onChange={e => setLicForm(f => ({ ...f, logiciel: e.target.value }))}
                  placeholder="Ex: Microsoft Office 365"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Clé de licence</label>
                <input value={licForm.cle_licence} onChange={e => setLicForm(f => ({ ...f, cle_licence: e.target.value }))}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date d'achat</label>
                  <input type="date" value={licForm.date_achat} onChange={e => setLicForm(f => ({ ...f, date_achat: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date d'expiration</label>
                  <input type="date" value={licForm.date_expiration} onChange={e => setLicForm(f => ({ ...f, date_expiration: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setLicModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveLicence} disabled={savingLic}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-900/90 disabled:opacity-50 transition">
                {savingLic ? "Enregistrement…" : editingLic ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal attribution employé ── */}
      {attModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="text-lg font-bold text-camublue-900">Attribuer la licence</h2>
              <button onClick={() => setAttModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {/* Barre de recherche */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Rechercher un employé…"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-camublue-900/20"
                />
              </div>
              {selected.length > 0 && (
                <p className="text-xs text-camublue-900 font-semibold mt-2">{selected.length} sélectionné(s)</p>
              )}
            </div>

            {/* Résultats */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {empLoading ? (
                <p className="text-center text-gray-400 text-sm py-6">Recherche…</p>
              ) : empResults.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6 italic">
                  {empSearch ? "Aucun résultat" : "Tapez un nom pour rechercher"}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {empResults.map((emp, i) => {
                    const key = `${emp.nom}|${emp.prenom}`;
                    const isSel = selected.some(e => `${e.nom}|${e.prenom}` === key);
                    return (
                      <button key={i} onClick={() => toggleEmp(emp)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition border ${
                          isSel
                            ? "border-camublue-900 bg-camublue-900/5 text-camublue-900"
                            : "border-gray-100 hover:bg-gray-50 text-gray-800"
                        }`}>
                        <div>
                          <span className="font-semibold">{emp.prenom} {emp.nom}</span>
                          {emp.matricule && <span className="ml-2 text-xs text-gray-400">{emp.matricule}</span>}
                        </div>
                        {isSel && <Check size={15} className="text-camublue-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
              <button onClick={() => setAttModal(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={saveAtt} disabled={savingAtt || selected.length === 0}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-900/90 disabled:opacity-50 transition">
                {savingAtt ? "Enregistrement…" : `Valider${selected.length ? ` (${selected.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal détail licence ── */}
      {detailLic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* En-tête bleu */}
            <div className="bg-[#1F3864] rounded-t-2xl px-6 py-5 flex items-start justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">{detailLic.logiciel}</h2>
                <p className="text-blue-200 text-sm mt-0.5">
                  {isExpired(detailLic.date_expiration)
                    ? "⚠ Licence expirée"
                    : expireSoon(detailLic.date_expiration)
                    ? "⏳ Expire bientôt"
                    : "Licence active"}
                </p>
              </div>
              <button onClick={() => setDetailLic(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white mt-0.5"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Date d'achat",      val: fmt(detailLic.date_achat) },
                  { label: "Date d'expiration",  val: fmt(detailLic.date_expiration) },
                  { label: "Utilisateurs",       val: `${detailLic.attributions?.length ?? 0}` },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{val}</p>
                  </div>
                ))}
              </div>

              {/* Clé de licence */}
              {detailLic.cle_licence && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Clé de licence</p>
                  <code className="block text-sm font-mono bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 break-all text-gray-700">
                    {detailLic.cle_licence}
                  </code>
                </div>
              )}

              {/* Utilisateurs assignés */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Utilisateurs assignés ({detailLic.attributions?.length ?? 0})
                </p>
                {detailLic.attributions?.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune attribution</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1F3864]">
                          {["Nom", "Matricule", "Service", "Depuis le"].map((h, i) => (
                            <th key={h} className={`px-3 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wide ${i < 3 ? "border-r border-[#2e4d8a]" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailLic.attributions.map((a: any, i: number) => (
                          <tr key={a.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                            <td className="px-3 py-2.5 border-r border-gray-100 font-semibold text-gray-800">{a.employee_prenom} {a.employee_nom}</td>
                            <td className="px-3 py-2.5 border-r border-gray-100 text-gray-500 text-xs">{a.employee_matricule || "—"}</td>
                            <td className="px-3 py-2.5 border-r border-gray-100 text-gray-500 text-xs">{a.employee_service || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmt(a.date_attribution)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
              {canEdit && (
                <>
                  <button onClick={() => { setDetailLic(null); openAttModal(detailLic.id); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition">
                    <UserPlus size={14} /> Attribuer
                  </button>
                  <button onClick={() => { setDetailLic(null); openEdit(detailLic); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition">
                    <Pencil size={14} /> Modifier
                  </button>
                </>
              )}
              <button onClick={() => setDetailLic(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium hover:bg-gray-200 transition">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression licence ── */}
      {deleteLicId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-camublue-900 mb-2">Supprimer la licence ?</h3>
            <p className="text-sm text-gray-500 mb-5">Toutes les attributions liées seront aussi supprimées.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteLicId(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={confirmDeleteLic} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
