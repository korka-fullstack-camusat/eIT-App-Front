import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";

interface AuthUser {
  username: string;
  full_name: string | null;
  role: string;
}

interface AuthContextType {
  user:     AuthUser | null;
  token:    string | null;
  login:    (username: string, password: string) => Promise<void>;
  logout:   () => void;
  loading:  boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "parc_it_token";
const USER_KEY  = "parc_it_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(false);

  // Injecter le token dans toutes les requêtes axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const { data } = await axios.post("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const authUser: AuthUser = { username: data.username, full_name: data.full_name, role: data.role ?? "EDITOR" };
      setToken(data.access_token);
      setUser(authUser);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete axios.defaults.headers.common["Authorization"];
  };

  const isViewer = user?.role === "VIEWER";

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isViewer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
