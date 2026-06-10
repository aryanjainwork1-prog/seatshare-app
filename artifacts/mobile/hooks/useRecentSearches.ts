import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecentSearch = {
  displayName: string;
  lat: number;
  lng: number;
};

const STORAGE_KEY = "seatshare_recent_searches";
const MAX_RECENTS = 5;

async function loadFromStorage(): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearch[];
  } catch {
    return [];
  }
}

async function saveToStorage(
  current: RecentSearch[],
  entry: RecentSearch,
): Promise<RecentSearch[]> {
  const filtered = current.filter((r) => r.displayName !== entry.displayName);
  const updated = [entry, ...filtered].slice(0, MAX_RECENTS);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore write errors
  }
  return updated;
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  useEffect(() => {
    loadFromStorage().then(setRecents);
  }, []);

  const saveRecent = useCallback(
    async (entry: RecentSearch) => {
      const updated = await saveToStorage(recents, entry);
      setRecents(updated);
    },
    [recents],
  );

  return { recents, saveRecent };
}
