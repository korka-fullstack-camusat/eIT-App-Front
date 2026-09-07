import React, { useEffect, useState } from "react";
import { Plus, X, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Trash2, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ax } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

const STATUTS = {
  EN_ATTENTE: { label: "En attente",  color: "bg-amber-100 text-amber-700",    icon: <Clock size={12} /> },
  VALIDEE:    { label: "Validée",     color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle size={12} /> },
  REJETEE:    { label: "Rejetée",     color: "bg-red-100 text-red-600",         icon: <XCircle size={12} /> },
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DemandesPage() {
  const { user } = useAuth();
  const isDG   = user?.role === "DIRECTEUR" || user?.role === "ADMIN";
  const canDel = (d: any) => isDG || d.demandeur === (user?.full_name || user?.username);

  const [demandes,   setDemandes]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filterSt,   setFilterSt]   = useState("");
  const [expanded,   setExpanded]   = useState<number | null>(null);

  // Modal création
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState({ titre: "", description: "", projet: "" });
  const [saving, setSaving] = useState(false);

  // Modal décision (DG)
  const [decModal,  setDecModal]  = useState<any | null>(null);
  const [decForm,   setDecForm]   = useState({ statut: "VALIDEE", commentaire_dg: "" });
  const [deciding,  setDeciding]  = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDemandes((await ax.get("/demandes/")).data); }
    catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.titre.trim() || !form.description.trim()) { toast.error("Titre et description requis"); return; }
    setSaving(true);
    try {
      await ax.post("/demandes/", form);
      toast.success("Demande soumise");
      setModal(false); setForm({ titre: "", description: "", projet: "" }); load();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };

  const decide = async () => {
    if (!decModal) return;
    setDeciding(true);
    try {
      await ax.patch(`/demandes/${decModal.id}/decision`, decForm);
      toast.success(decForm.statut === "VALIDEE" ? "Demande validée ✓" : "Demande rejetée");
      setDecModal(null); load();
    } catch { toast.error("Erreur"); }
    finally { setDeciding(false); }
  };

  const del = async (id: number) => {
    try { await ax.delete(`/demandes/${id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };

  const counts = {
    EN_ATTENTE: demandes.filter(d => d.statut === "EN_ATTENTE").length,
    VALIDEE:    demandes.filter(d => d.statut === "VALIDEE").length,
    REJETEE:    demandes.filter(d => d.statut === "REJETEE").length,
  };

  const filtered = filterSt ? demandes.filter(d => d.statut === filterSt) : demandes;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-camugray-100 pt-1 pb-4 -mt-1">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Demandes d'amélioration</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isDG ? "Vue directeur — toutes les demandes" : "Vos demandes soumises"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm font-semibold shadow hover:bg-camublue-900/90 transition">
              <Plus size={15} /> Nouvelle demande
            </button>
          </div>
        </div>

        {/* Stats cliquables */}
        <div className="flex gap-3 flex-wrap">
          {[
            { key: "",           label: "Total",       color: "text-camublue-900", border: "border-camublue-900" },
            { key: "EN_ATTENTE", label: "En attente",  color: "text-amber-600",    border: "border-amber-400" },
            { key: "VALIDEE",    label: "Validées",    color: "text-emerald-600",  border: "border-emerald-400" },
            { key: "REJETEE",    label: "Rejetées",    color: "text-red-500",      border: "border-red-400" },
          ].map(s => {
            const n = s.key === "" ? demandes.length : (counts[s.key as keyof typeof counts] ?? 0);
            const active = filterSt === s.key;
            return (
              <button key={s.key} onClick={() => setFilterSt(s.key)}
                className={`flex-1 min-w-[90px] bg-white rounded-xl border-2 px-4 py-3 shadow-sm text-left transition-all hover:shadow-md ${
                  active ? `${s.border} shadow-md` : "border-gray-100"
                }`}>
                <p className={`text-2xl font-black ${active ? s.color : "text-gray-800"}`}>{n}</p>
                <p className={`text-xs font-medium mt-0.5 ${active ? s.color : "text-gray-400"}`}>{s.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <MessageSquare size={48} className="mb-3 opacity-20" />
          <p className="font-medium">Aucune demande{filterSt ? ` avec ce statut` : ""}</p>
          {!filterSt && <p className="text-sm mt-1">Cliquez sur "Nouvelle demande" pour en soumettre une.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(d => {
            const st   = STATUTS[d.statut as keyof typeof STATUTS] ?? STATUTS.EN_ATTENTE;
            const open = expanded === d.id;
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Ligne principale */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                  onClick={() => setExpanded(open ? null : d.id)}>
                  {/* Statut */}
                  <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.color}`}>
                    {st.icon} {st.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{d.titre}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                      <span>{d.demandeur}</span>
                      {d.projet && <span>· Projet : <span className="text-gray-600 font-medium">{d.projet}</span></span>}
                      <span>· {fmt(d.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Bouton décision — DG seulement sur EN_ATTENTE */}
                    {isDG && d.statut === "EN_ATTENTE" && (
                      <button onClick={e => { e.stopPropagation(); setDecModal(d); setDecForm({ statut: "VALIDEE", commentaire_dg: "" }); }}
                        className="px-3 py-1.5 text-xs font-semibold bg-camublue-900 text-white rounded-lg hover:bg-camublue-900/90 transition">
                        Décider
                      </button>
                    )}
                    {canDel(d) && (
                      <button onClick={e => { e.stopPropagation(); del(d.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={13} /></button>
                    )}
                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Détail déplié */}
                {open && (
                  <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.description}</p>
                    </div>
                    {d.commentaire_dg && (
                      <div className={`rounded-xl p-3 border ${d.statut === "VALIDEE" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Commentaire du Directeur</p>
                        <p className="text-sm text-gray-700">{d.commentaire_dg}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal création ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-camublue-900">Nouvelle demande d'amélioration</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Titre *</label>
                <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex: Ajouter un module de reporting…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Projet concerné</label>
                <input value={form.projet} onChange={e => setForm(f => ({ ...f, projet: e.target.value }))}
                  placeholder="Optionnel — nom du projet"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={5} placeholder="Décrivez l'amélioration souhaitée, le problème rencontré, la valeur ajoutée…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={submit} disabled={saving}
                className="px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-camublue-900/90 transition">
                {saving ? "Envoi…" : "Soumettre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal décision DG ── */}
      {decModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-camublue-900">Décision sur la demande</h2>
              <button onClick={() => setDecModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{decModal.titre}</p>
                <p className="text-xs text-gray-400 mt-0.5">par {decModal.demandeur}</p>
              </div>
              <div className="flex gap-3">
                {["VALIDEE", "REJETEE"].map(s => (
                  <button key={s} onClick={() => setDecForm(f => ({ ...f, statut: s }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                      decForm.statut === s
                        ? s === "VALIDEE" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-red-400 bg-red-50 text-red-600"
                        : "border-gray-200 bg-white text-gray-400"
                    }`}>
                    {s === "VALIDEE" ? <CheckCircle size={15} /> : <XCircle size={15} />}
                    {s === "VALIDEE" ? "Valider" : "Rejeter"}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Commentaire (optionnel)</label>
                <textarea value={decForm.commentaire_dg} onChange={e => setDecForm(f => ({ ...f, commentaire_dg: e.target.value }))}
                  rows={3} placeholder="Motif de la décision, prochaines étapes…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-camublue-900/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setDecModal(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium">Annuler</button>
              <button onClick={decide} disabled={deciding}
                className={`px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition ${
                  decForm.statut === "VALIDEE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"
                }`}>
                {deciding ? "…" : decForm.statut === "VALIDEE" ? "Valider la demande" : "Rejeter la demande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
