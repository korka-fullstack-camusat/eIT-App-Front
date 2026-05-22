import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/api/axios";
import { UserPlus, X, Eye, EyeOff, Search, CheckCircle2, XCircle, User } from "lucide-react";
import toast from "react-hot-toast";

interface UserAccount {
  id:        number;
  username:  string;
  full_name: string | null;
  email:     string | null;
  is_active: boolean;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [showModal, setShowModal] = useState(false);

  // Formulaire
  const [username,  setUsername]  = useState("");
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get<UserAccount[]>("/api/auth/users");
      setUsers(res.data);
    } catch {
      toast.error("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setUsername(""); setFullName(""); setEmail("");
    setPassword(""); setFormError(""); setShowPwd(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (password.length < 6) {
      setFormError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/auth/users", {
        username,
        full_name: fullName || null,
        email:     email    || null,
        password,
      });
      toast.success(`Compte "${username}" créé avec succès`);
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Comptes utilisateurs</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {users.length} compte{users.length !== 1 ? "s" : ""} enregistré{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            <UserPlus size={16} /> Ajouter
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="input-base pl-9"
          />
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <User size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom complet</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-camublue-900">
                            {(u.full_name ?? u.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{u.full_name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-4 text-gray-600">{u.email ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-4 text-center">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          <CheckCircle2 size={12} /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                          <XCircle size={12} /> Inactif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal création ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-camublue-900">Nouveau compte</h3>
                <p className="text-xs text-gray-400 mt-0.5">Remplissez les informations de l'utilisateur</p>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Nom d'utilisateur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="ex : jdupont"
                    required autoFocus
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom complet</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jean.dupont@camusat.com"
                  className="input-base"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-base pr-10"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum 6 caractères</p>
              </div>

              {formError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-camublue-900 hover:bg-camublue-900/90 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60"
                >
                  <UserPlus size={15} />
                  {saving ? "Création…" : "Créer le compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
