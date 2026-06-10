import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useDemoMode } from "@/context/DemoModeContext";
import { useColors } from "@/hooks/useColors";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { MapPickerModal } from "@/components/MapPickerModal";
import type { PickedLocation } from "@/components/MapPickerModal";
import { LocationInput } from "@/components/LocationInput";
import { NearbyDriversMap } from "@/components/NearbyDriversMap";
import { RoutePreviewMap } from "@/components/RoutePreviewMap";

const DEFAULT_ORIGIN_LAT = 19.076;
const DEFAULT_ORIGIN_LNG = 72.8777;
const DEFAULT_DEST_LAT = 19.059;
const DEFAULT_DEST_LNG = 72.8394;

export default function FindRidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isDemoMode } = useDemoMode();
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
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [emailBanner, setEmailBanner] = useState<"pending" | "dev_skip" | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<MatchResult[]>([]);

  const matchMutation = useMatchDrivers();
  const nearbyMutation = useMatchDrivers();
  const { recents, saveRecent } = useRecentSearches();

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("seatshare_prefill_search").then(async (raw) => {
        if (!raw) return;
        try {
          const prefill = JSON.parse(raw) as {
            fromText?: string;
            toText?: string;
            fromLat?: number;
            fromLng?: number;
            toLat?: number;
            toLng?: number;
            autoSearch?: boolean;
          };
          if (prefill.fromText) setFromText(prefill.fromText);
          if (prefill.toText) setToText(prefill.toText);
          if (prefill.fromLat != null && prefill.fromLng != null)
            setFromCoords({ lat: prefill.fromLat, lng: prefill.fromLng });
          if (prefill.toLat != null && prefill.toLng != null)
            setToCoords({ lat: prefill.toLat, lng: prefill.toLng });
          AsyncStorage.removeItem("seatshare_prefill_search").catch(() => {});

          if (
            prefill.autoSearch &&
            prefill.fromLat != null &&
            prefill.fromLng != null &&
            prefill.toLat != null &&
            prefill.toLng != null
          ) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              const result = await matchMutation.mutateAsync({
                data: {
                  passengerLat: prefill.fromLat,
                  passengerLng: prefill.fromLng,
                  destLat: prefill.toLat,
                  destLng: prefill.toLng,
                  maxResults: 40,
                },
              });
              setMatches(result.matches ?? []);
              setHasSearched(true);
              setSelectedMatchId(null);
            } catch {
              setMatches([]);
              setHasSearched(true);
              setSelectedMatchId(null);
            }
          }
        } catch {
          // ignore
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function fetchNearby() {
        let lat: number | null = null;
        let lng: number | null = null;

        if (fromCoords) {
          lat = fromCoords.lat;
          lng = fromCoords.lng;
        } else if (Platform.OS !== "web") {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === "granted") {
              const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
            }
          } catch {
            // ignore
          }
        }
        if (lat === null || lng === null || cancelled) return;
        setUserLocation({ lat, lng });
        try {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          const result = await nearbyMutation.mutateAsync({
            data: { passengerLat: lat, passengerLng: lng, destLat: lat, destLng: lng, maxResults: 10 },
          });
          if (!cancelled) setNearbyDrivers(result.matches ?? []);
        } catch {
          // ignore
        }
      }
      fetchNearby();
      return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromCoords?.lat, fromCoords?.lng]),
  );

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
    AsyncStorage.getItem("seatshare_last_from_address").then((val) => {
      if (val) setFromText(val);
    });
    AsyncStorage.getItem("seatshare_last_to_address").then((val) => {
      if (val) setToText(val);
    });
  }, []);

  async function dismissEmailBanner() {
    await AsyncStorage.setItem("seatshare_email_verified", "dismissed");
    setEmailBanner(null);
  }

  function handleFromTextChange(t: string) {
    setFromText(t);
    setFromCoords(null);
    AsyncStorage.removeItem("seatshare_last_from_coords").catch(() => {});
    AsyncStorage.removeItem("seatshare_last_from_address").catch(() => {});
  }

  function handleToTextChange(t: string) {
    setToText(t);
    setToCoords(null);
    AsyncStorage.removeItem("seatshare_last_to_coords").catch(() => {});
    AsyncStorage.removeItem("seatshare_last_to_address").catch(() => {});
  }

  function handleFromSelect(text: string, lat: number, lng: number) {
    setFromText(text);
    const coords = { lat, lng };
    setFromCoords(coords);
    AsyncStorage.setItem("seatshare_last_from_coords", JSON.stringify(coords)).catch(() => {});
    AsyncStorage.setItem("seatshare_last_from_address", text).catch(() => {});
    saveRecent({ displayName: text, lat, lng });
    Haptics.selectionAsync();
  }

  function handleToSelect(text: string, lat: number, lng: number) {
    setToText(text);
    const coords = { lat, lng };
    setToCoords(coords);
    AsyncStorage.setItem("seatshare_last_to_coords", JSON.stringify(coords)).catch(() => {});
    AsyncStorage.setItem("seatshare_last_to_address", text).catch(() => {});
    saveRecent({ displayName: text, lat, lng });
    Haptics.selectionAsync();
  }

  function handleMapConfirm(picked: PickedLocation) {
    if (mapPicker === "from") {
      setFromText(picked.address);
      const coords = { lat: picked.lat, lng: picked.lng };
      setFromCoords(coords);
      AsyncStorage.setItem("seatshare_last_from_coords", JSON.stringify(coords)).catch(() => {});
      AsyncStorage.setItem("seatshare_last_from_address", picked.address).catch(() => {});
      saveRecent({ displayName: picked.address, lat: picked.lat, lng: picked.lng });
    } else if (mapPicker === "to") {
      setToText(picked.address);
      const coords = { lat: picked.lat, lng: picked.lng };
      setToCoords(coords);
      AsyncStorage.setItem("seatshare_last_to_coords", JSON.stringify(coords)).catch(() => {});
      AsyncStorage.setItem("seatshare_last_to_address", picked.address).catch(() => {});
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
      setSelectedMatchId(null);
    } catch {
      setMatches([]);
      setHasSearched(true);
      setSelectedMatchId(null);
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

    const isSelected = selectedMatchId === item.trip.id;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedMatchId(isSelected ? null : item.trip.id);
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
            {driver?.bio && (
              <Text
                style={[
                  styles.driverBio,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
                numberOfLines={1}
              >
                {driver.bio.split("\n")[0]}
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
            <View
              style={[
                styles.metaItem,
                styles.etaBadge,
                { backgroundColor: `${colors.success}1a` },
              ]}
            >
              <Feather name="clock" size={13} color={colors.success} />
              <Text
                style={[
                  styles.metaText,
                  {
                    color: colors.success,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {item.etaMinutes} min away
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

        {isSelected && (
          <Pressable
            style={[styles.viewDetailsBtn, { borderTopColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({
                pathname: "/trip/[id]",
                params: { id: String(item.trip.id) },
              });
            }}
          >
            <Text style={[styles.viewDetailsBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              View ride details
            </Text>
            <Feather name="arrow-right" size={14} color={colors.primary} />
          </Pressable>
        )}
      </Pressable>
    );
  }

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

      <>
          {!hasSearched && userLocation && (
            <View style={{ paddingTop: topPad + 4 }}>
              <NearbyDriversMap
                drivers={nearbyDrivers}
                userLat={userLocation.lat}
                userLng={userLocation.lng}
              />
            </View>
          )}

          <View
            style={[
              styles.searchHeader,
              {
                paddingTop: !hasSearched && userLocation ? 8 : topPad + 8,
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
                  matches={matches}
                  selectedMatchId={selectedMatchId}
                  onDeselect={() => setSelectedMatchId(null)}
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
                    {isDemoMode && (
                      <View
                        style={[
                          styles.demoBanner,
                          {
                            backgroundColor: `${colors.primary}18`,
                            borderColor: `${colors.primary}44`,
                          },
                        ]}
                      >
                        <Feather name="zap" size={14} color={colors.primary} />
                        <Text
                          style={[
                            styles.demoBannerText,
                            { color: colors.primary, fontFamily: "Inter_400Regular" },
                          ]}
                        >
                          Demo Mode: log in as a driver to post trips, then search as a passenger to test the full booking flow.
                        </Text>
                      </View>
                    )}
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
  driverBio: { fontSize: 12, marginTop: 2 },
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
  etaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
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
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    marginTop: 8,
  },
  viewDetailsBtnText: { fontSize: 13 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginHorizontal: 8,
  },
  demoBannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
