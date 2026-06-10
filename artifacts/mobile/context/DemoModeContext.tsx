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

interface DemoModeContextValue {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
}

const DEMO_MODE_KEY = "seatshare_demo_mode";

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEMO_MODE_KEY).then((v) => {
      if (v === "1") setIsDemoMode(true);
    }).catch(() => {});
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DEMO_MODE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<DemoModeContextValue>(
    () => ({ isDemoMode, toggleDemoMode }),
    [isDemoMode, toggleDemoMode],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
  return ctx;
}
