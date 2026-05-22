import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { vehiculeService } from "@/services/api";
import type { Vehicule } from "@/types";

const EMPTY = { immatriculation: "", marque: "", modele: "", affectation: "" };

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<number | null>(null);
  const [form,      setForm]      = useState<any>(EMPTY);

  const load = () => {
    setLoading(true);
    vehiculeService.getAll()
      .then(setVehicules).catch(() => toast.error("Erreur")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit   = (v: Vehicule) => {
    setForm({ immatriculation: v.immatriculation, marque: v.marque ?? "", modele: v.modele ?? "", affectation: v.affectation ?? "" });
    setEditing(v.id); setModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) await vehiculeService.update(editing, form);
      else         await vehiculeService.create(form);
      toast.success(editing ? "Véhicule mis à jour" : "Véhicule créé");
      setModal(false); load();
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Erreur"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce véhicule ?")) return;
    try { await vehiculeService.delete(id); toast.success("Supprimé"); load(); }
    catch { toast.error("Impossible de supprimer"); }
  };

  const filtered = vehicules.filter(v =>
    !search ||
    v.immatriculation.toLowerCase().includes(search.toLowerCase()) ||
    (v.marque ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (v.affectation ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-camublue-900">Véhicules</h1>
          <p className="text-gray-500 text-sm mt-0.5">{vehicules.length} véhicule(s)</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm">
          <Plus size={16} /> Ajouter véhicule
        </button>
      </div>

      <div className="mb-4 max-w-sm">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un véhicule…"
          className="input-base" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{["Immatriculation","Marque / Modèle","Affectation","Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="py-12 text-center text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-gray-400">Aucun véhicule</td></tr>
            ) : filtered.map(v => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{v.immatriculation}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-700">{v.marque ?? "—"}</p>
                  <p className="text-xs text-gray-400">{v.modele ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{v.affectation ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(v)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(v.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-camublue-900 mb-4">{editing ? "Modifier" : "Nouveau"} véhicule</h2>
            <div className="space-y-3">
              {[
                { label: "Immatriculation *", key: "immatriculation" },
                { label: "Marque",            key: "marque"          },
                { label: "Modèle",            key: "modele"          },
                { label: "Affectation",       key: "affectation"     },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input type="text" value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                    className="input-base" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSubmit}
                className="flex-1 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
