import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { adminLogin, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { setOnUnauthorized } from "@/lib/authUtils";

const TOKEN_KEY = "seatshare_token";
const USER_KEY  = "seatshare_user";

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Only pre-populate user when a token also exists AND the cached role is admin.
  // This prevents stale non-admin users from bypassing the role guard on mount.
  const [user, setUser] = useState<User | null>(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return null;
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as User;
      return parsed.role === "admin" ? parsed : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);

  // Wire token getter into all generated API calls
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  // Register a global "unauthorized" handler so the QueryClient can trigger
  // logout when any query or mutation receives a 401/403 mid-session.
  useEffect(() => {
    setOnUnauthorized(() => {
      clearSession();
      setToken(null);
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  // Validate the stored token on mount; enforce admin role
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      clearSession();
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const u = (await res.json()) as User;
          if (u.role !== "admin") {
            // Valid token but not an admin — clear and redirect
            clearSession();
            setUser(null);
            setToken(null);
          } else {
            setUser(u);
            setToken(storedToken);
            localStorage.setItem(USER_KEY, JSON.stringify(u));
          }
        } else {
          clearSession();
          setUser(null);
          setToken(null);
        }
      })
      .catch(() => {
        clearSession();
        setUser(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminLogin({ email, password });
    if (result.user.role !== "admin") {
      throw new Error("Access denied: admin credentials required.");
    }
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
