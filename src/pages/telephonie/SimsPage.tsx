import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Link } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { simService, siteService, vehiculeService, employeeService } from "@/services/api";
import type { NumeroSIM, CategorieSIM, SiteGSM, Vehicule, Employee } from "@/types";

const CAT_LABELS: Record<CategorieSIM, string> = {
  EMPLOYE: "Employé", M2M_SITE: "M2M Site", M2M_VEHICULE: "M2M Véhicule",
};
const CAT_COLORS: Record<CategorieSIM, string> = {
  EMPLOYE: "bg-blue-100 text-blue-700", M2M_SITE: "bg-purple-100 text-purple-700", M2M_VEHICULE: "bg-emerald-100 text-emerald-700",
};

export default function SimsPage() {
  const [sims,     setSims]     = useState<NumeroSIM[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [cat,      setCat]      = useState("");
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState<"sim" | "affecter" | null>(null);
  const [selected, setSelected] = useState<NumeroSIM | null>(null);
  const [form,     setForm]     = useState<any>({ numero: "", categorie: "EMPLOYE", operateur: "", description: "" });

  const [sites,     setSites]     = useState<SiteGSM[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [employees, setEmps]      = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [affForm,   setAffForm]   = useState<any>({
    date_debut: new Date().toISOString().split("T")[0],
    employee_id: null, site_id: null, vehicule_id: null, notes: "",
  });

  const load = () => {
    setLoading(true);
    simService.getAll({ categorie: cat || undefined, search: search || undefined })
      .then(setSims).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [cat, search]);

  useEffect(() => {
    if (modal === "affecter") {
      siteService.getAll().then(setSites).catch(() => {});
      vehiculeService.getAll().then(setVehicules).catch(() => {});
    }
  }, [modal]);

  useEffect(() => {
    if (empSearch.length < 2) { setEmps([]); return; }
    const t = setTimeout(() => employeeService.search(empSearch).then(setEmps).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  const handleSave = async () => {
    try {
      if (selected) await simService.update(selected.id, form);
      else await simService.create(form);
      toast.success(selected ? "Mis à jour" : "SIM créée");
      setModal(null); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleAffecter = async () => {
    if (!selected) return;
    try {
      await simService.affecter(selected.id, affForm);
      toast.success("Affectation enregistrée"); setModal(null); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Numéros SIM</h1>
          <p className="text-gray-500 text-sm mt-0.5">{sims.length} numéro(s)</p>
        </div>
        <button onClick={() => { setSelected(null); setForm({ numero: "", categorie: "EMPLOYE", operateur: "", description: "" }); setModal("sim"); }}
          className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
          <Plus size={16} /> Ajouter SIM
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un numéro…"
          className="input-base flex-1 min-w-48" />
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="input-base w-auto px-3 py-2.5">
          <option value="">Toutes catégories</option>
          {Object.entries(CAT_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{["Numéro","Catégorie","Opérateur","Statut","Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : sims.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{s.numero}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${CAT_COLORS[s.categorie]}`}>{CAT_LABELS[s.categorie]}</span></td>
                <td className="px-4 py-3 text-gray-600">{s.operateur ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${s.statut === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{s.statut}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => { setSelected(s); setAffForm({ date_debut: new Date().toISOString().split("T")[0], employee_id: null, site_id: null, vehicule_id: null, notes: "" }); setEmpSearch(""); setModal("affecter"); }}
                      className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition" title="Affecter"><Link size={14} /></button>
                    <button onClick={() => { setSelected(s); setForm({ numero: s.numero, categorie: s.categorie, operateur: s.operateur ?? "", description: s.description ?? "" }); setModal("sim"); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"><Pencil size={14} /></button>
                    <button onClick={async () => { if (!confirm("Supprimer ?")) return; await simService.delete(s.id); toast.success("Supprimé"); load(); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === "sim" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">{selected ? "Modifier" : "Nouveau"} numéro SIM</h2>
            <div className="space-y-3">
              {[
                { label: "Numéro",     key: "numero",      type: "text" },
                { label: "Catégorie",  key: "categorie",   type: "select", opts: Object.entries(CAT_LABELS) },
                { label: "Opérateur",  key: "operateur",   type: "text" },
                { label: "Description",key: "description", type: "text" },
              ].map(({ label, key, type, opts }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  {type === "select" ? (
                    <select value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                      className="input-base">
                      {(opts as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                      className="input-base" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave}
                className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {modal === "affecter" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-1">Affecter {selected.numero}</h2>
            <p className="text-xs text-gray-400 mb-4">Catégorie : {CAT_LABELS[selected.categorie]}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date de début</label>
                <input type="date" value={affForm.date_debut} onChange={e => setAffForm((p: any) => ({ ...p, date_debut: e.target.value }))}
                  className="input-base" />
              </div>
              {selected.categorie === "EMPLOYE" && (
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Employé</label>
                  <input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setAffForm((p: any) => ({ ...p, employee_id: null })); }}
                    placeholder="Rechercher…" className="input-base" />
                  {employees.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {employees.map(e => (
                        <button key={e.id} onClick={() => { setAffForm((p: any) => ({ ...p, employee_id: e.id })); setEmpSearch(`${e.nom} ${e.prenom}`); setEmps([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{e.nom} {e.prenom} — {e.matricule}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selected.categorie === "M2M_SITE" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Site GSM</label>
                  <select value={affForm.site_id ?? ""} onChange={e => setAffForm((p: any) => ({ ...p, site_id: Number(e.target.value) || null }))}
                    className="input-base">
                    <option value="">Sélectionner…</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
              )}
              {selected.categorie === "M2M_VEHICULE" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Véhicule</label>
                  <select value={affForm.vehicule_id ?? ""} onChange={e => setAffForm((p: any) => ({ ...p, vehicule_id: Number(e.target.value) || null }))}
                    className="input-base">
                    <option value="">Sélectionner…</option>
                    {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleAffecter}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">Affecter</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
