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
import { BANGALORE_AREAS } from "@/constants/locations";

const DEFAULT_ORIGIN_LAT = 12.9716;
const DEFAULT_ORIGIN_LNG = 77.5946;
const DEFAULT_DEST_LAT = 13.0827;
const DEFAULT_DEST_LNG = 80.2707;

function LocationInput({
  value,
  onChangeText,
  placeholder,
  icon,
  iconColor,
  colors,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: "circle" | "map-pin";
  iconColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = value.trim().length >= 2
    ? BANGALORE_AREAS.filter((a) => a.toLowerCase().includes(value.toLowerCase())).slice(0, 4)
    : [];

  return (
    <View>
      <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: focused ? colors.primary : colors.border }]}>
        <Feather name={icon} size={14} color={iconColor} />
        <TextInput
          style={[styles.searchText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText("")}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
      {focused && suggestions.length > 0 && (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => { onChangeText(s); setFocused(false); }}
            >
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {s}
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
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [emailBanner, setEmailBanner] = useState<"pending" | null>(null);

  const matchMutation = useMatchDrivers();

  useEffect(() => {
    AsyncStorage.getItem("seatshare_email_verified").then((v) => {
      if (v === "pending") setEmailBanner("pending");
    });
    AsyncStorage.getItem("seatshare_onboarding_prefs").then((raw) => {
      if (!raw) return;
      try {
        const prefs = JSON.parse(raw) as { homeArea?: string; destination?: string };
        if (prefs.homeArea) setFromText(prefs.homeArea);
        if (prefs.destination) setToText(prefs.destination);
      } catch {
        // ignore
      }
    });
  }, []);

  async function dismissEmailBanner() {
    await AsyncStorage.setItem("seatshare_email_verified", "dismissed");
    setEmailBanner(null);
  }

  async function resolveCoords(
    text: string,
    fallbackLat: number,
    fallbackLng: number,
  ): Promise<{ lat: number; lng: number }> {
    if (!text.trim() || Platform.OS === "web") return { lat: fallbackLat, lng: fallbackLng };
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

    if (Platform.OS !== "web") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        if (fromText.trim()) {
          const resolved = await resolveCoords(fromText, DEFAULT_ORIGIN_LAT, DEFAULT_ORIGIN_LNG);
          pLat = resolved.lat;
          pLng = resolved.lng;
        } else {
          try {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
          (pos) => { pLat = pos.coords.latitude; pLng = pos.coords.longitude; resolve(); },
          () => resolve(),
          { timeout: 5000 },
        );
      });
    }

    const destResolved = await resolveCoords(toText, DEFAULT_DEST_LAT, DEFAULT_DEST_LNG);

    try {
      const result = await matchMutation.mutateAsync({
        data: {
          passengerLat: pLat,
          passengerLng: pLng,
          destLat: destResolved.lat,
          destLng: destResolved.lng,
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
    const initials = driverName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          router.push({ pathname: "/trip/[id]", params: { id: String(item.trip.id) } });
        }}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}33` }]}>
            <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {initials}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.driverName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {driverName}
            </Text>
            {vehicle && (
              <Text style={[styles.vehicleText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {vehicle.color} {vehicle.make} {vehicle.model}
              </Text>
            )}
          </View>
          <View style={styles.fareBox}>
            <Text style={[styles.fareAmount, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              ₹{item.estimatedFare.toFixed(0)}
            </Text>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              /seat
            </Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {item.deviationKm.toFixed(1)} km detour
            </Text>
          </View>
          {item.etaMinutes !== undefined && (
            <View style={styles.metaItem}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {item.etaMinutes} min
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="people" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {item.trip.availableSeats} seats
            </Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.routeDotFrom, { borderColor: colors.success }]} />
            <Text style={[styles.routeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              {item.trip.originAddress}
            </Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: colors.destructive }]} />
            <Text style={[styles.routeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
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
        <View style={[styles.banner, { backgroundColor: `${colors.primary}18`, borderBottomColor: `${colors.primary}33` }]}>
          <Feather name="mail" size={14} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
            Verify your email to unlock all features
          </Text>
          <Pressable onPress={dismissEmailBanner}>
            <Feather name="x" size={14} color={colors.primary} />
          </Pressable>
        </View>
      )}

      {isDriver && (
        <View style={[styles.modeSwitcher, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable
            style={[
              styles.modeBtn,
              mode === "passenger" && { backgroundColor: colors.primary, borderRadius: 8 },
            ]}
            onPress={() => { setMode("passenger"); Haptics.selectionAsync(); }}
          >
            <Feather name="users" size={14} color={mode === "passenger" ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[
              styles.modeBtnText,
              {
                color: mode === "passenger" ? colors.primaryForeground : colors.mutedForeground,
                fontFamily: mode === "passenger" ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}>
              Passenger
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeBtn,
              mode === "driver" && { backgroundColor: colors.primary, borderRadius: 8 },
            ]}
            onPress={() => { setMode("driver"); Haptics.selectionAsync(); }}
          >
            <Feather name="truck" size={14} color={mode === "driver" ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[
              styles.modeBtnText,
              {
                color: mode === "driver" ? colors.primaryForeground : colors.mutedForeground,
                fontFamily: mode === "driver" ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}>
              Driver
            </Text>
          </Pressable>
        </View>
      )}

      {mode === "driver" ? (
        <View style={[styles.driverModeView, { paddingTop: isDriver ? 0 : topPad + 8 }]}>
          <View style={[styles.driverModeCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <View style={[styles.driverModeIcon, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="truck" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.driverModeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              You're in Driver Mode
            </Text>
            <Text style={[styles.driverModeSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Manage your trips, go online, and accept bookings from the Drive tab.
            </Text>
            <Pressable
              style={[styles.driverModeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/driver")}
            >
              <Feather name="zap" size={16} color={colors.primaryForeground} />
              <Text style={[styles.driverModeBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Open Driver Dashboard
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.switchToPassenger}
            onPress={() => { setMode("passenger"); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.switchToPassengerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Looking for a ride instead?{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Switch to Passenger</Text>
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.searchHeader, { paddingTop: isDriver ? 12 : topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <Text style={[styles.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Find a Ride
            </Text>

            <LocationInput
              value={fromText}
              onChangeText={setFromText}
              placeholder="From — your current location"
              icon="circle"
              iconColor={colors.success}
              colors={colors}
            />

            <LocationInput
              value={toText}
              onChangeText={setToText}
              placeholder="To — destination"
              icon="map-pin"
              iconColor={colors.destructive}
              colors={colors}
            />

            <Pressable
              testID="find-rides-btn"
              style={({ pressed }) => [
                styles.searchBtn,
                { backgroundColor: colors.primary, opacity: pressed || matchMutation.isPending ? 0.8 : 1 },
              ]}
              onPress={handleSearch}
              disabled={matchMutation.isPending}
            >
              {matchMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="search" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.searchBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
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
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {hasSearched ? (
                  <>
                    <Feather name="search" size={40} color={colors.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      No rides found
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Try a different time or destination
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="navigation" size={40} color={colors.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      Where are you headed?
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Enter your destination and find shared rides
                    </Text>
                  </>
                )}
              </View>
            }
          />
        </>
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
