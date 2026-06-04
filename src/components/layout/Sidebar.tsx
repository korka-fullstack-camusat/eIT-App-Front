import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  Users,
  LogOut,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

type SubItem = { label: string; path: string };
type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  { label: "Tableau de bord", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  {
    label: "Parc Informatique",
    path: "/parc",
    icon: <Monitor size={20} />,
    subItems: [
      { label: "Matériels",    path: "/materiels"    },
      { label: "Attributions", path: "/attributions" },
    ],
  },
  {
    label: "Téléphonie",
    path: "/telephonie",
    icon: <Smartphone size={20} />,
    subItems: [
      { label: "Numéros SIM", path: "/sims"      },
      { label: "Sites RMS",   path: "/sites"     },
      { label: "Véhicules",   path: "/vehicules" },
      { label: "Factures",    path: "/factures"  },
    ],
  },
  { label: "Comptes utilisateurs", path: "/users", icon: <Users size={20} /> },
];

export default function Sidebar() {
  const location  = useLocation();
  const { user, logout } = useAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach(item => {
      if (item.subItems?.some(s => location.pathname.startsWith(s.path)))
        initial[item.path] = true;
    });
    return initial;
  });

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleMenu = (path: string) =>
    setOpenMenus(prev => ({ ...prev, [path]: !prev[path] }));

  const isParentActive = (item: NavItem) =>
    item.subItems
      ? item.subItems.some(s => location.pathname.startsWith(s.path))
      : location.pathname === item.path;

  // ── Nav item ──────────────────────────────────────────────────────────
  const NavItemComp = ({ item, onClose }: { item: NavItem; onClose?: () => void }) => {
    const hasChildren = !!item.subItems?.length;
    const isOpen      = openMenus[item.path] ?? false;
    const parentActive = isParentActive(item);

    if (hasChildren) {
      return (
        <div>
          <button
            onClick={() => toggleMenu(item.path)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
              parentActive
                ? "bg-camublue-900/10 text-camublue-900"
                : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </div>
            {isOpen
              ? <ChevronDown  size={15} className="text-gray-400 shrink-0" />
              : <ChevronRight size={15} className="text-gray-400 shrink-0" />
            }
          </button>
          {isOpen && (
            <div className="mt-1 ml-9 flex flex-col gap-0.5 border-l-2 border-camublue-900/20 pl-3">
              {item.subItems!.map(sub => {
                const isActive = location.pathname.startsWith(sub.path);
                return (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    onClick={onClose}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-camublue-900 text-white shadow-sm"
                        : "text-gray-600 hover:bg-camublue-900/10 hover:text-camublue-900"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-white" : "bg-gray-400"}`} />
                    <span className="flex-1 truncate">{sub.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
          isActive
            ? "bg-camublue-900 text-white shadow-sm"
            : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  // ── Bas du sidebar ────────────────────────────────────────────────────
  const SidebarFooter = () => (
    <div className="px-4 py-4 border-t border-gray-100">
      <button
        onClick={() => setShowLogoutModal(true)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium"
      >
        <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
          <User size={14} className="text-camublue-900" />
        </div>
        <span className="flex-1 truncate">{user?.full_name || user?.username}</span>
        <LogOut size={15} className="shrink-0 text-gray-400" />
      </button>
    </div>
  );

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map(item => (
          <NavItemComp key={item.path} item={item} onClose={onClose} />
        ))}
      </nav>
      <SidebarFooter />
    </>
  );

  return (
    <>
      {/* Burger mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white shadow-md border"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-camublue-900" />
      </button>

      {/* Overlay mobile */}
      <div
        className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${mobileOpen ? "block md:hidden" : "hidden"}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar Desktop */}
      <aside className="bg-white shadow-md w-72 min-h-screen hidden md:flex md:flex-col border-r">
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-center">
          <img src="/logo-camusat.png" alt="Camusat" className="w-full max-w-[180px] object-contain" />
        </div>
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-72 bg-white shadow-md border-r transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <img src="/logo-camusat.png" alt="Camusat" className="h-9 object-contain" />
          <button onClick={() => setMobileOpen(false)}>
            <X size={24} className="text-camublue-900" />
          </button>
        </div>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* ── Modal déconnexion ─────────────────────────────────────────── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="text-lg font-bold text-camublue-900 mb-2">Déconnexion</h3>
            <p className="mb-6 text-sm text-gray-600">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-sm font-medium"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-camublue-900 text-white hover:bg-camublue-900/90 transition text-sm font-semibold"
                onClick={logout}
              >
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
