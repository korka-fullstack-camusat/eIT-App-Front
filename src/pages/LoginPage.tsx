import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, ArrowRight, CheckCircle2, Mail, KeyRound, Lock } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/axios";

// ── Types d'étapes ─────────────────────────────────────────────────────────
type Step = "login" | "forgot-email" | "forgot-otp" | "forgot-newpwd" | "forgot-done";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("login");

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");

  // Forgot password
  const [fpEmail,      setFpEmail]      = useState("");
  const [fpOtp,        setFpOtp]        = useState("");
  const [fpResetToken, setFpResetToken] = useState("");
  const [fpNewPwd,     setFpNewPwd]     = useState("");
  const [fpConfirmPwd, setFpConfirmPwd] = useState("");
  const [fpShowPwd,    setFpShowPwd]    = useState(false);
  const [fpLoading,    setFpLoading]    = useState(false);
  const [fpError,      setFpError]      = useState("");

  const { login, loading } = useAuth();
  const navigate = useNavigate();

  // ── Connexion ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Identifiants incorrects ou erreur réseau.";
      setError(msg);
    }
  };

  // ── Étape 1 : envoi email ──────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    setFpLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email: fpEmail });
      setStep("forgot-otp");
      toast.success("Code envoyé — vérifiez votre boîte mail");
    } catch {
      setFpError("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── Étape 2 : vérification OTP ────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    setFpLoading(true);
    try {
      const res = await api.post("/api/auth/verify-otp", { email: fpEmail, code: fpOtp });
      setFpResetToken(res.data.reset_token);
      setStep("forgot-newpwd");
    } catch (err: any) {
      setFpError(err?.response?.data?.detail ?? "Code incorrect ou expiré.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── Étape 3 : nouveau mot de passe ────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    if (fpNewPwd !== fpConfirmPwd) {
      setFpError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (fpNewPwd.length < 6) {
      setFpError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setFpLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        reset_token: fpResetToken,
        new_password: fpNewPwd,
      });
      setStep("forgot-done");
    } catch (err: any) {
      setFpError(err?.response?.data?.detail ?? "Erreur lors de la réinitialisation.");
    } finally {
      setFpLoading(false);
    }
  };

  const resetForgot = () => {
    setStep("login");
    setFpEmail(""); setFpOtp(""); setFpResetToken("");
    setFpNewPwd(""); setFpConfirmPwd(""); setFpError("");
  };

  // ── Barre de progression (étapes forgot) ──────────────────────────────
  const forgotSteps = [
    { key: "forgot-email",  label: "Email",       icon: <Mail size={14} /> },
    { key: "forgot-otp",    label: "Code OTP",    icon: <KeyRound size={14} /> },
    { key: "forgot-newpwd", label: "Mot de passe", icon: <Lock size={14} /> },
  ];
  const forgotStepIndex = forgotSteps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen flex items-center justify-center bg-camugray-100 px-4 py-12">
      <Toaster position="top-right" />

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 flex flex-col items-center relative">

          {/* Retour landing */}
          <Link
            to="/"
            className="absolute top-5 left-5 p-1.5 rounded-lg text-slate-400 hover:text-camublue-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>

          {/* Logo Camusat */}
          <img
            src="/logo-camusat.png"
            alt="Camusat"
            className="h-12 mb-6 object-contain"
          />

          {/* ── CONNEXION ─────────────────────────────────────────────── */}
          {step === "login" && (
            <>
              <h1 className="text-xl font-bold text-slate-800 mb-1 text-center">Connexion</h1>
              <p className="text-sm text-slate-400 mb-7 text-center">Accédez à la gestion du Parc IT</p>

              <form onSubmit={handleLogin} className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="ex : admin"
                    required autoFocus
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Mot de passe
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
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-60"
                >
                  {loading ? "Connexion en cours…" : "Se connecter"}
                </button>
              </form>

              <button
                onClick={() => setStep("forgot-email")}
                className="mt-5 text-xs text-camublue-900 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </>
          )}

          {/* ── ÉTAPE 1 : EMAIL ───────────────────────────────────────── */}
          {step === "forgot-email" && (
            <>
              <StepBar steps={forgotSteps} current={0} />
              <h1 className="text-lg font-bold text-slate-800 mb-1 text-center">Mot de passe oublié</h1>
              <p className="text-sm text-slate-400 mb-6 text-center">
                Entrez l'adresse email associée à votre compte.
              </p>

              <form onSubmit={handleSendOtp} className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={fpEmail}
                    onChange={e => setFpEmail(e.target.value)}
                    placeholder="exemple@camusat.com"
                    required autoFocus
                    className="input-base"
                  />
                </div>

                <FpError msg={fpError} />

                <button
                  type="submit"
                  disabled={fpLoading}
                  className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-60"
                >
                  {fpLoading ? "Envoi…" : <>Envoyer le code <ArrowRight size={14} /></>}
                </button>
              </form>

              <BackBtn onClick={resetForgot} />
            </>
          )}

          {/* ── ÉTAPE 2 : OTP ─────────────────────────────────────────── */}
          {step === "forgot-otp" && (
            <>
              <StepBar steps={forgotSteps} current={1} />
              <h1 className="text-lg font-bold text-slate-800 mb-1 text-center">Vérification</h1>
              <p className="text-sm text-slate-400 mb-6 text-center">
                Entrez le code à 6 chiffres envoyé à <br />
                <span className="font-medium text-slate-600">{fpEmail}</span>
              </p>

              <form onSubmit={handleVerifyOtp} className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Code OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={fpOtp}
                    onChange={e => setFpOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required autoFocus
                    className="input-base text-center text-xl tracking-[0.4em] font-bold"
                  />
                </div>

                <FpError msg={fpError} />

                <button
                  type="submit"
                  disabled={fpLoading || fpOtp.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-60"
                >
                  {fpLoading ? "Vérification…" : <>Vérifier le code <ArrowRight size={14} /></>}
                </button>
              </form>

              <button
                onClick={() => { setStep("forgot-email"); setFpError(""); }}
                className="mt-4 text-xs text-slate-400 hover:text-camublue-900 hover:underline"
              >
                Renvoyer le code
              </button>
              <BackBtn onClick={resetForgot} />
            </>
          )}

          {/* ── ÉTAPE 3 : NOUVEAU MOT DE PASSE ───────────────────────── */}
          {step === "forgot-newpwd" && (
            <>
              <StepBar steps={forgotSteps} current={2} />
              <h1 className="text-lg font-bold text-slate-800 mb-1 text-center">Nouveau mot de passe</h1>
              <p className="text-sm text-slate-400 mb-6 text-center">
                Choisissez un mot de passe sécurisé (min. 6 caractères).
              </p>

              <form onSubmit={handleResetPassword} className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={fpShowPwd ? "text" : "password"}
                      value={fpNewPwd}
                      onChange={e => setFpNewPwd(e.target.value)}
                      placeholder="••••••••"
                      required autoFocus
                      className="input-base pr-10"
                    />
                    <button type="button" onClick={() => setFpShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {fpShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type={fpShowPwd ? "text" : "password"}
                    value={fpConfirmPwd}
                    onChange={e => setFpConfirmPwd(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-base"
                  />
                </div>

                <FpError msg={fpError} />

                <button
                  type="submit"
                  disabled={fpLoading}
                  className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-60"
                >
                  {fpLoading ? "Enregistrement…" : "Réinitialiser le mot de passe"}
                </button>
              </form>

              <BackBtn onClick={resetForgot} />
            </>
          )}

          {/* ── SUCCÈS ────────────────────────────────────────────────── */}
          {step === "forgot-done" && (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 size={52} className="text-green-500 mb-4" />
              <h1 className="text-lg font-bold text-slate-800 mb-2">Mot de passe réinitialisé !</h1>
              <p className="text-sm text-slate-400 mb-6">
                Votre mot de passe a été mis à jour avec succès.
              </p>
              <button
                onClick={resetForgot}
                className="flex items-center gap-2 px-6 py-2.5 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                Se connecter <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === "login" && (
            <footer className="mt-8 text-slate-300 text-xs text-center">
              © {new Date().getFullYear()} Camusat Sénégal — Direction IT
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composants utilitaires ─────────────────────────────────────────────────

function StepBar({ steps, current }: { steps: { label: string; icon: React.ReactNode }[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6 w-full">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
            i < current  ? "bg-green-500 text-white" :
            i === current ? "bg-camublue-900 text-white" :
            "bg-slate-100 text-slate-400"
          }`}>
            {i < current ? <CheckCircle2 size={14} /> : s.icon}
          </div>
          <span className={`text-xs font-medium hidden sm:block ${
            i === current ? "text-camublue-900" : "text-slate-400"
          }`}>{s.label}</span>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px ${i < current ? "bg-green-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FpError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
      {msg}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-4 text-xs text-slate-400 hover:text-camublue-900 hover:underline flex items-center gap-1">
      <ArrowLeft size={12} /> Retour à la connexion
    </button>
  );
}
