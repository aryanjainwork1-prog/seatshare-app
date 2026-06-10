import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMatchDrivers } from "@workspace/api-client-react";
import type { MatchResult } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useMode } from "@/context/ModeContext";
import { useColors } from "@/hooks/useColors";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import type { RecentSearch } from "@/hooks/useRecentSearches";
import { MapPickerModal } from "@/components/MapPickerModal";
import type { PickedLocation } from "@/components/MapPickerModal";
import { RoutePreviewMap } from "@/components/RoutePreviewMap";

type GeoSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

const DEFAULT_ORIGIN_LAT = 12.9716;
const DEFAULT_ORIGIN_LNG = 77.5946;
const DEFAULT_DEST_LAT = 13.0827;
const DEFAULT_DEST_LNG = 80.2707;

function LocationInput({
  value,
  onChangeText,
  onSelectLocation,
  placeholder,
  icon,
  iconColor,
  colors,
  onMapPress,
  hasPinnedCoords,
  recents,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSelectLocation?: (text: string, lat: number, lng: number) => void;
  placeholder: string;
  icon: "circle" | "map-pin";
  iconColor: string;
  colors: ReturnType<typeof useColors>;
  onMapPress?: () => void;
  hasPinnedCoords?: boolean;
  recents?: RecentSearch[];
}) {
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
    setTimeout(() => {
      setFocused(false);
    }, 200);
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

  const showRecents =
    focused && value.trim().length < 3 && recents && recents.length > 0;
  const showSuggestions = focused && suggestions.length > 0 && !showRecents;

  return (
    <View>
      <View
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.card,
            borderColor: focused ? colors.primary : colors.border,
          },
        ]}
      >
        <Feather name={icon} size={14} color={iconColor} />
        <TextInput
          style={[
            styles.searchText,
            { color: colors.foreground, fontFamily: "Inter_400Regular" },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
        {fetchingGeo && (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        )}
        {hasPinnedCoords && !fetchingGeo && (
          <View
            style={[
              styles.pinnedBadge,
              { backgroundColor: `${iconColor}22` },
            ]}
          >
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
              {
                backgroundColor: hasPinnedCoords
                  ? `${iconColor}22`
                  : `${colors.mutedForeground}18`,
              },
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
        <View
          style={[
            styles.suggestions,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.recentsHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text
              style={[
                styles.recentsHeaderText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Recent
            </Text>
          </View>
          {recents!.map((r) => (
            <Pressable
              key={r.displayName}
              style={[
                styles.suggestionItem,
                { borderBottomColor: colors.border },
              ]}
              onPress={() => handlePickRecent(r)}
            >
              <Feather name="rotate-ccw" size={12} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.suggestionText,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
                numberOfLines={2}
              >
                {r.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {showSuggestions && (
        <View
          style={[
            styles.suggestions,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {suggestions.map((s) => (
            <Pressable
              key={`${s.lat},${s.lon}`}
              style={[
                styles.suggestionItem,
                { borderBottomColor: colors.border },
              ]}
              onPress={() => handlePickSuggestion(s)}
            >
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.suggestionText,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
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

export default function FindRidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { mode, setMode } = useMode();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromCoords, setFromCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [mapPicker, setMapPicker] = useState<null | "from" | "to">(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [emailBanner, setEmailBanner] = useState<"pending" | "dev_skip" | null>(null);

  const matchMutation = useMatchDrivers();
  const { recents, saveRecent } = useRecentSearches();

  useEffect(() => {
    AsyncStorage.getItem("seatshare_email_verified").then((v) => {
      if (v === "pending" || v === "dev_skip") setEmailBanner(v);
    });
    AsyncStorage.getItem("seatshare_onboarding_prefs").then((raw) => {
      if (!raw) return;
      try {
        const prefs = JSON.parse(raw) as {
          homeArea?: string;
          destination?: string;
        };
        if (prefs.homeArea) setFromText(prefs.homeArea);
        if (prefs.destination) setToText(prefs.destination);
      } catch {
        // ignore
      }
    });
    AsyncStorage.getItem("seatshare_last_from_coords").then((raw) => {
      if (!raw) return;
      try {
        const coords = JSON.parse(raw) as { lat: number; lng: number };
        setFromCoords(coords);
      } catch {
        // ignore
      }
    });
    AsyncStorage.getItem("seatshare_last_to_coords").then((raw) => {
      if (!raw) return;
      try {
        const coords = JSON.parse(raw) as { lat: number; lng: number };
        setToCoords(coords);
      } catch {
        // ignore
      }
    });
  }, []);

  async function dismissEmailBanner() {
    await AsyncStorage.setItem("seatshare_email_verified", "dismissed");
    setEmailBanner(null);
  }

  function handleFromTextChange(t: string) {
    setFromText(t);
    setFromCoords(null);
  }

  function handleToTextChange(t: string) {
    setToText(t);
    setToCoords(null);
  }

  function handleFromSelect(text: string, lat: number, lng: number) {
    setFromText(text);
    setFromCoords({ lat, lng });
    saveRecent({ displayName: text, lat, lng });
    Haptics.selectionAsync();
  }

  function handleToSelect(text: string, lat: number, lng: number) {
    setToText(text);
    setToCoords({ lat, lng });
    saveRecent({ displayName: text, lat, lng });
    Haptics.selectionAsync();
  }

  function handleMapConfirm(picked: PickedLocation) {
    if (mapPicker === "from") {
      setFromText(picked.address);
      const coords = { lat: picked.lat, lng: picked.lng };
      setFromCoords(coords);
      AsyncStorage.setItem("seatshare_last_from_coords", JSON.stringify(coords)).catch(() => {});
      saveRecent({ displayName: picked.address, lat: picked.lat, lng: picked.lng });
    } else if (mapPicker === "to") {
      setToText(picked.address);
      const coords = { lat: picked.lat, lng: picked.lng };
      setToCoords(coords);
      AsyncStorage.setItem("seatshare_last_to_coords", JSON.stringify(coords)).catch(() => {});
      saveRecent({ displayName: picked.address, lat: picked.lat, lng: picked.lng });
    }
    setMapPicker(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function resolveCoords(
    text: string,
    fallbackLat: number,
    fallbackLng: number,
  ): Promise<{ lat: number; lng: number }> {
    if (!text.trim() || Platform.OS === "web")
      return { lat: fallbackLat, lng: fallbackLng };
    try {
      const results = await Location.geocodeAsync(text.trim());
      if (results.length > 0) {
        return { lat: results[0].latitude, lng: results[0].longitude };
      }
    } catch {
      // fall through to default
    }
    return { lat: fallbackLat, lng: fallbackLng };
  }

  async function handleSearch() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let pLat = DEFAULT_ORIGIN_LAT;
    let pLng = DEFAULT_ORIGIN_LNG;

    if (fromCoords) {
      pLat = fromCoords.lat;
      pLng = fromCoords.lng;
    } else if (Platform.OS !== "web") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        if (fromText.trim()) {
          const resolved = await resolveCoords(
            fromText,
            DEFAULT_ORIGIN_LAT,
            DEFAULT_ORIGIN_LNG,
          );
          pLat = resolved.lat;
          pLng = resolved.lng;
        } else {
          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            pLat = pos.coords.latitude;
            pLng = pos.coords.longitude;
          } catch {
            // use defaults
          }
        }
      }
    } else {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            pLat = pos.coords.latitude;
            pLng = pos.coords.longitude;
            resolve();
          },
          () => resolve(),
          { timeout: 5000 },
        );
      });
    }

    let dLat = DEFAULT_DEST_LAT;
    let dLng = DEFAULT_DEST_LNG;

    if (toCoords) {
      dLat = toCoords.lat;
      dLng = toCoords.lng;
    } else {
      const destResolved = await resolveCoords(
        toText,
        DEFAULT_DEST_LAT,
        DEFAULT_DEST_LNG,
      );
      dLat = destResolved.lat;
      dLng = destResolved.lng;
    }

    try {
      const result = await matchMutation.mutateAsync({
        data: {
          passengerLat: pLat,
          passengerLng: pLng,
          destLat: dLat,
          destLng: dLng,
          maxResults: 40,
        },
      });
      setMatches(result.matches ?? []);
      setHasSearched(true);
    } catch {
      setMatches([]);
      setHasSearched(true);
    }
  }

  function renderMatch({ item }: { item: MatchResult }) {
    const driver = item.driverProfile?.user;
    const vehicle = item.vehicle;
    const driverName = driver?.name ?? "Driver";
    const initials = driverName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          router.push({
            pathname: "/trip/[id]",
            params: { id: String(item.trip.id) },
          });
        }}
      >
        <View style={styles.cardTop}>
          <View
            style={[styles.avatar, { backgroundColor: `${colors.primary}33` }]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {initials}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text
              style={[
                styles.driverName,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {driverName}
            </Text>
            {vehicle && (
              <Text
                style={[
                  styles.vehicleText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {vehicle.color} {vehicle.make} {vehicle.model}
              </Text>
            )}
          </View>
          <View style={styles.fareBox}>
            <Text
              style={[
                styles.fareAmount,
                { color: colors.primary, fontFamily: "Inter_700Bold" },
              ]}
            >
              ₹{item.estimatedFare.toFixed(0)}
            </Text>
            <Text
              style={[
                styles.fareLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              /seat
            </Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {item.deviationKm.toFixed(1)} km detour
            </Text>
          </View>
          {item.etaMinutes !== undefined && (
            <View style={styles.metaItem}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.metaText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {item.etaMinutes} min
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="people" size={13} color={colors.mutedForeground} />
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {item.trip.availableSeats} seats
            </Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <View
              style={[
                styles.routeDot,
                styles.routeDotFrom,
                { borderColor: colors.success },
              ]}
            />
            <Text
              style={[
                styles.routeText,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={1}
            >
              {item.trip.originAddress}
            </Text>
          </View>
          <View
            style={[styles.routeLine, { backgroundColor: colors.border }]}
          />
          <View style={styles.routePoint}>
            <View
              style={[
                styles.routeDot,
                { backgroundColor: colors.destructive },
              ]}
            />
            <Text
              style={[
                styles.routeText,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={1}
            >
              {item.trip.destAddress}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const isDriver = user?.role === "driver";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {emailBanner === "pending" && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: `${colors.primary}18`,
              borderBottomColor: `${colors.primary}33`,
            },
          ]}
        >
          <Feather name="mail" size={14} color={colors.primary} />
          <Text
            style={[
              styles.bannerText,
              { color: colors.primary, fontFamily: "Inter_400Regular" },
            ]}
          >
            Verify your email to unlock all features
          </Text>
          <Pressable onPress={dismissEmailBanner}>
            <Feather name="x" size={14} color={colors.primary} />
          </Pressable>
        </View>
      )}

      {emailBanner === "dev_skip" && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: `${colors.destructive}18`,
              borderBottomColor: `${colors.destructive}33`,
            },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={colors.destructive} />
          <Text
            style={[
              styles.bannerText,
              { color: colors.destructive, fontFamily: "Inter_400Regular" },
            ]}
          >
            Email verification disabled in development mode
          </Text>
          <Pressable onPress={dismissEmailBanner}>
            <Feather name="x" size={14} color={colors.destructive} />
          </Pressable>
        </View>
      )}

      {isDriver && (
        <View
          style={[
            styles.modeSwitcher,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable
            style={[
              styles.modeBtn,
              mode === "passenger" && {
                backgroundColor: colors.primary,
                borderRadius: 8,
              },
            ]}
            onPress={() => {
              setMode("passenger");
              Haptics.selectionAsync();
            }}
          >
            <Feather
              name="users"
              size={14}
              color={
                mode === "passenger"
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
            <Text
              style={[
                styles.modeBtnText,
                {
                  color:
                    mode === "passenger"
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  fontFamily:
                    mode === "passenger"
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                },
              ]}
            >
              Passenger
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeBtn,
              mode === "driver" && {
                backgroundColor: colors.primary,
                borderRadius: 8,
              },
            ]}
            onPress={() => {
              setMode("driver");
              Haptics.selectionAsync();
            }}
          >
            <Feather
              name="truck"
              size={14}
              color={
                mode === "driver"
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
            <Text
              style={[
                styles.modeBtnText,
                {
                  color:
                    mode === "driver"
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  fontFamily:
                    mode === "driver"
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                },
              ]}
            >
              Driver
            </Text>
          </Pressable>
        </View>
      )}

      {mode === "driver" ? (
        <View
          style={[
            styles.driverModeView,
            { paddingTop: isDriver ? 0 : topPad + 8 },
          ]}
        >
          <View
            style={[
              styles.driverModeCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginTop: 16,
              },
            ]}
          >
            <View
              style={[
                styles.driverModeIcon,
                { backgroundColor: `${colors.primary}22` },
              ]}
            >
              <Feather name="truck" size={28} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.driverModeTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              You're in Driver Mode
            </Text>
            <Text
              style={[
                styles.driverModeSub,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Manage your trips, go online, and accept bookings from the Drive
              tab.
            </Text>
            <Pressable
              style={[styles.driverModeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/driver")}
            >
              <Feather name="zap" size={16} color={colors.primaryForeground} />
              <Text
                style={[
                  styles.driverModeBtnText,
                  {
                    color: colors.primaryForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Open Driver Dashboard
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.switchToPassenger}
            onPress={() => {
              setMode("passenger");
              Haptics.selectionAsync();
            }}
          >
            <Text
              style={[
                styles.switchToPassengerText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Looking for a ride instead?{" "}
              <Text
                style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}
              >
                Switch to Passenger
              </Text>
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.searchHeader,
              {
                paddingTop: isDriver ? 12 : topPad + 8,
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.screenTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Find a Ride
            </Text>

            <LocationInput
              value={fromText}
              onChangeText={handleFromTextChange}
              onSelectLocation={handleFromSelect}
              placeholder="From — your current location"
              icon="circle"
              iconColor={colors.success}
              colors={colors}
              hasPinnedCoords={!!fromCoords}
              onMapPress={() => setMapPicker("from")}
              recents={recents}
            />

            <LocationInput
              value={toText}
              onChangeText={handleToTextChange}
              onSelectLocation={handleToSelect}
              placeholder="To — destination"
              icon="map-pin"
              iconColor={colors.destructive}
              colors={colors}
              hasPinnedCoords={!!toCoords}
              onMapPress={() => setMapPicker("to")}
              recents={recents}
            />

            <Pressable
              testID="find-rides-btn"
              style={({ pressed }) => [
                styles.searchBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || matchMutation.isPending ? 0.8 : 1,
                },
              ]}
              onPress={handleSearch}
              disabled={matchMutation.isPending}
            >
              {matchMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather
                    name="search"
                    size={16}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.searchBtnText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Find Rides
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <FlatList
            data={matches}
            keyExtractor={(item) => String(item.trip.id)}
            renderItem={renderMatch}
            contentContainerStyle={styles.listContent}
            scrollEnabled
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              hasSearched && fromCoords && toCoords ? (
                <RoutePreviewMap
                  fromCoords={fromCoords}
                  toCoords={toCoords}
                  fromLabel={fromText || "Pickup"}
                  toLabel={toText || "Drop-off"}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {hasSearched ? (
                  <>
                    <Feather
                      name="search"
                      size={40}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.emptyTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      No rides found
                    </Text>
                    <Text
                      style={[
                        styles.emptyText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      Try a different time or destination
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name="navigation"
                      size={40}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.emptyTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Where are you headed?
                    </Text>
                    <Text
                      style={[
                        styles.emptyText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      Enter your destination and find shared rides
                    </Text>
                  </>
                )}
              </View>
            }
          />
        </>
      )}

      {mapPicker !== null && (
        <MapPickerModal
          visible
          title={mapPicker === "from" ? "Set Pickup Location" : "Set Drop-off Location"}
          pinColor={mapPicker === "from" ? colors.success : colors.destructive}
          initialLat={
            mapPicker === "from"
              ? (fromCoords?.lat ?? DEFAULT_ORIGIN_LAT)
              : (toCoords?.lat ?? DEFAULT_DEST_LAT)
          }
          initialLng={
            mapPicker === "from"
              ? (fromCoords?.lng ?? DEFAULT_ORIGIN_LNG)
              : (toCoords?.lng ?? DEFAULT_DEST_LNG)
          }
          onClose={() => setMapPicker(null)}
          onConfirm={handleMapConfirm}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13 },
  modeSwitcher: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  modeBtnText: { fontSize: 14 },
  driverModeView: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  driverModeCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  driverModeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  driverModeTitle: { fontSize: 20, textAlign: "center" },
  driverModeSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  driverModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  driverModeBtnText: { fontSize: 15 },
  switchToPassenger: { alignItems: "center", paddingVertical: 8 },
  switchToPassengerText: { fontSize: 14, textAlign: "center" },
  searchHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  screenTitle: {
    fontSize: 22,
    marginBottom: 4,
  },
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
  recentsHeaderText: { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  searchBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  searchBtnText: { fontSize: 15 },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16 },
  cardInfo: { flex: 1 },
  driverName: { fontSize: 15 },
  vehicleText: { fontSize: 13, marginTop: 2 },
  fareBox: { alignItems: "flex-end" },
  fareAmount: { fontSize: 20 },
  fareLabel: { fontSize: 12 },
  cardDivider: { height: 1 },
  cardMeta: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: { fontSize: 12 },
  routeRow: { gap: 4 },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeDotFrom: {
    backgroundColor: "transparent",
    borderWidth: 2,
  },
  routeLine: {
    width: 2,
    height: 8,
    marginLeft: 4,
  },
  routeText: { fontSize: 13, flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
});
