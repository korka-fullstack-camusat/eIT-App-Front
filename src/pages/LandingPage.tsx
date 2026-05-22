import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div
        className={`flex flex-col items-center text-center max-w-xl transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <img
          src="/logo-camusat.png"
          alt="Camusat"
          className={`h-20 mb-10 object-contain transition-all duration-700 delay-100 ease-out ${
            visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        />

        <h1
          className={`text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight transition-all duration-700 delay-200 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Gestion du{" "}
          <span className="text-camublue-900">Parc Informatique</span>
          {" & "}
          <span className="text-camublue-900">Téléphonie</span>
        </h1>

        <p
          className={`text-gray-500 text-base md:text-lg mb-10 leading-relaxed transition-all duration-700 delay-300 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Une solution complète pour inventorier vos équipements, gérer les
          attributions et piloter vos dépenses télécom.
        </p>

        <button
          onClick={() => navigate("/login")}
          className={`group flex items-center gap-2 px-7 py-3 bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl font-semibold text-base shadow-md transition-all duration-700 delay-[400ms] ease-out hover:shadow-lg hover:scale-105 active:scale-95 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Se connecter
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>

      <footer
        className={`absolute bottom-5 text-xs text-gray-400 transition-all duration-700 delay-500 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        © {new Date().getFullYear()} Camusat Sénégal — Direction IT
      </footer>
    </div>
  );
}
