import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { RecentSearch } from "@/hooks/useRecentSearches";
import { useColors } from "@/hooks/useColors";

type GeoSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

export interface LocationInputProps {
  value: string;
  onChangeText: (t: string) => void;
  onSelectLocation?: (text: string, lat: number, lng: number) => void;
  placeholder: string;
  icon: "circle" | "map-pin";
  iconColor: string;
  onMapPress?: () => void;
  hasPinnedCoords?: boolean;
  recents?: RecentSearch[];
}

export function LocationInput({
  value,
  onChangeText,
  onSelectLocation,
  placeholder,
  icon,
  iconColor,
  onMapPress,
  hasPinnedCoords,
  recents,
}: LocationInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [fetchingGeo, setFetchingGeo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setFetchingGeo(false);
      return;
    }
    setFetchingGeo(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value.trim())}&format=json&limit=5&addressdetails=0`;
        const resp = await fetch(url, {
          headers: { "Accept-Language": "en", "User-Agent": "SeatShare/1.0" },
        });
        const data = (await resp.json()) as GeoSuggestion[];
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setFetchingGeo(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function handleBlur() {
    setTimeout(() => setFocused(false), 200);
  }

  function handleClear() {
    onChangeText("");
    setSuggestions([]);
  }

  function handlePickSuggestion(s: GeoSuggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    if (onSelectLocation) {
      onSelectLocation(s.display_name, lat, lng);
    } else {
      onChangeText(s.display_name);
    }
    setSuggestions([]);
    setFocused(false);
  }

  function handlePickRecent(r: RecentSearch) {
    if (onSelectLocation) {
      onSelectLocation(r.displayName, r.lat, r.lng);
    } else {
      onChangeText(r.displayName);
    }
    setSuggestions([]);
    setFocused(false);
  }

  const showRecents = focused && value.trim().length < 3 && recents && recents.length > 0;
  const showSuggestions = focused && suggestions.length > 0 && !showRecents;

  return (
    <View>
      <View
        style={[
          styles.searchInput,
          { backgroundColor: colors.card, borderColor: focused ? colors.primary : colors.border },
        ]}
      >
        <Feather name={icon} size={14} color={iconColor} />
        <TextInput
          style={[styles.searchText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
        {fetchingGeo && <ActivityIndicator size="small" color={colors.mutedForeground} />}
        {hasPinnedCoords && !fetchingGeo && (
          <View style={[styles.pinnedBadge, { backgroundColor: `${iconColor}22` }]}>
            <Feather name="check" size={10} color={iconColor} />
          </View>
        )}
        {value.length > 0 && !fetchingGeo && (
          <Pressable onPress={handleClear}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
        {onMapPress && Platform.OS !== "web" && (
          <Pressable
            onPress={onMapPress}
            hitSlop={8}
            style={[
              styles.mapBtn,
              { backgroundColor: hasPinnedCoords ? `${iconColor}22` : `${colors.mutedForeground}18` },
            ]}
          >
            <Feather
              name="map"
              size={14}
              color={hasPinnedCoords ? iconColor : colors.mutedForeground}
            />
          </Pressable>
        )}
      </View>

      {showRecents && (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.recentsHeader, { borderBottomColor: colors.border }]}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={[styles.recentsHeaderText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              Recent
            </Text>
          </View>
          {recents!.map((r) => (
            <Pressable
              key={r.displayName}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => handlePickRecent(r)}
            >
              <Feather name="rotate-ccw" size={12} color={colors.mutedForeground} />
              <Text
                style={[styles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={2}
              >
                {r.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {showSuggestions && (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {suggestions.map((s) => (
            <Pressable
              key={`${s.lat},${s.lon}`}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => handlePickSuggestion(s)}
            >
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text
                style={[styles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={2}
              >
                {s.display_name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
  },
  pinnedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  mapBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestions: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 10,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionText: { fontSize: 13, flex: 1 },
  recentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  recentsHeaderText: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
