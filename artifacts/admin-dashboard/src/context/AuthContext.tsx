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

const TOKEN_KEY = "seatshare_token";
const USER_KEY = "seatshare_user";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);

  // Wire the token getter into all generated API calls
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  // Validate the stored token on mount by hitting /api/auth/me
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const u = (await res.json()) as User;
          setUser(u);
          setToken(storedToken);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
          setToken(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminLogin({ email, password });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
