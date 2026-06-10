import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

export type AppMode = "passenger" | "driver";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const MODE_KEY = "seatshare_mode";

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<AppMode>("passenger");

  useEffect(() => {
    async function restoreMode() {
      try {
        const stored = await AsyncStorage.getItem(MODE_KEY);
        if (stored === "driver" && user?.role === "driver") {
          setModeState("driver");
        } else if (stored === null && user?.role === "driver") {
          setModeState("driver");
        } else {
          setModeState("passenger");
        }
      } catch {
        // ignore
      }
    }
    if (user) restoreMode();
    else setModeState("passenger");
  }, [user?.role]);

  const setMode = useCallback(
    (newMode: AppMode) => {
      if (newMode === "driver" && user?.role !== "driver") return;
      setModeState(newMode);
      AsyncStorage.setItem(MODE_KEY, newMode).catch(() => {});
    },
    [user?.role],
  );

  const value = useMemo<ModeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
