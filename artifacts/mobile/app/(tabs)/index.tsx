import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateRideRequest } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { MapPickerModal } from "@/components/MapPickerModal";
import type { PickedLocation } from "@/components/MapPickerModal";
import { LocationInput } from "@/components/LocationInput";

const DEFAULT_ORIGIN_LAT = 19.076;
const DEFAULT_ORIGIN_LNG = 72.8777;
const DEFAULT_DEST_LAT = 19.059;
const DEFAULT_DEST_LNG = 72.8394;

const WALKING_OPTIONS = [
  { label: "0.5 km", value: 0.5 },
  { label: "1 km", value: 1 },
  { label: "2 km", value: 2 },
  { label: "3+ km", value: 3 },
];

export default function RequestRideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPicker, setMapPicker] = useState<null | "from" | "to">(null);
  const [emailBanner, setEmailBanner] = useState<"pending" | "dev_skip" | null>(null);

  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [preferences, setPreferences] = useState("");
  const [walkingKm, setWalkingKm] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createRequest = useCreateRideRequest();
  const { recents, saveRecent } = useRecentSearches();

  useEffect(() => {
    AsyncStorage.getItem("seatshare_email_verified").then((v) => {
      if (v === "pending" || v === "dev_skip") setEmailBanner(v);
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
    AsyncStorage.getItem("seatshare_last_from_coords").then((raw) => {
      if (!raw) return;
      try {
        setFromCoords(JSON.parse(raw) as { lat: number; lng: number });
      } catch {
        // ignore
      }
    });
    AsyncStorage.getItem("seatshare_last_to_coords").then((raw) => {
      if (!raw) return;
      try {
        setToCoords(JSON.parse(raw) as { lat: number; lng: number });
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
  ): Promise<{ lat: number; lng: number } | null> {
    if (!text.trim() || Platform.OS === "web") return null;
    try {
      const results = await Location.geocodeAsync(text.trim());
      if (results.length > 0) {
        return { lat: results[0].latitude, lng: results[0].longitude };
      }
    } catch {
      // ignore — coords are optional for concierge requests
    }
    return null;
  }

  async function handleSubmit() {
    setFormError(null);

    if (!fromText.trim() || !toText.trim()) {
      setFormError("Please enter both a pickup and a drop-off location.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const pickup = fromCoords ?? (await resolveCoords(fromText));
    const dropoff = toCoords ?? (await resolveCoords(toText));

    try {
      const created = await createRequest.mutateAsync({
        data: {
          pickupAddress: fromText.trim(),
          dropoffAddress: toText.trim(),
          ...(pickup && { pickupLat: pickup.lat, pickupLng: pickup.lng }),
          ...(dropoff && { dropoffLat: dropoff.lat, dropoffLng: dropoff.lng }),
          ...(departureTime.trim() && { preferredDepartureTime: departureTime.trim() }),
          ...(arrivalTime.trim() && { preferredArrivalTime: arrivalTime.trim() }),
          ...(preferences.trim() && { preferences: preferences.trim() }),
          ...(walkingKm != null && { walkingDistanceKm: walkingKm }),
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: "/request/[id]", params: { id: String(created.id) } });
    } catch {
      setFormError("Could not submit your request. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {emailBanner === "pending" && (
        <View
          style={[
            styles.banner,
            { backgroundColor: `${colors.primary}18`, borderBottomColor: `${colors.primary}33` },
          ]}
        >
          <Feather name="mail" size={14} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
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
            { backgroundColor: `${colors.destructive}18`, borderBottomColor: `${colors.destructive}33` },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={colors.destructive} />
          <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
            Email verification disabled in development mode
          </Text>
          <Pressable onPress={dismissEmailBanner}>
            <Feather name="x" size={14} color={colors.destructive} />
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Request a Ride
        </Text>
        <Text style={[styles.screenSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Tell us where you're going — our dispatch team will arrange the best ride for you.
        </Text>

        <LocationInput
          value={fromText}
          onChangeText={handleFromTextChange}
          onSelectLocation={handleFromSelect}
          placeholder="Pickup location"
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
          placeholder="Drop-off location"
          icon="map-pin"
          iconColor={colors.destructive}
          hasPinnedCoords={!!toCoords}
          onMapPress={() => setMapPicker("to")}
          recents={recents}
        />

        <View style={styles.timeRow}>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              Departure time
            </Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="clock" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                value={departureTime}
                onChangeText={setDepartureTime}
                placeholder="e.g. 8:30 AM"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              Arrive by
            </Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="flag" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                value={arrivalTime}
                onChangeText={setArrivalTime}
                placeholder="e.g. 9:15 AM"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            Ride preferences (optional)
          </Text>
          <View style={[styles.inputBox, styles.multilineBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.inputText, styles.multilineText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              value={preferences}
              onChangeText={setPreferences}
              placeholder="e.g. Front seat, AC, quiet ride, ladies only…"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
          </View>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            How far can you walk to the pickup point?
          </Text>
          <View style={styles.walkRow}>
            {WALKING_OPTIONS.map((opt) => {
              const active = walkingKm === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.walkChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setWalkingKm(active ? null : opt.value);
                  }}
                >
                  <Text
                    style={[
                      styles.walkChipText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {formError && (
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
            {formError}
          </Text>
        )}

        <Pressable
          testID="submit-ride-request-btn"
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || createRequest.isPending ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={createRequest.isPending}
        >
          {createRequest.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="send" size={16} color={colors.primaryForeground} />
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Request Ride
              </Text>
            </>
          )}
        </Pressable>

        <View style={[styles.infoCard, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}>
          <Feather name="headphones" size={16} color={colors.primary} />
          <Text style={[styles.infoCardText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Your request goes straight to our dispatch team, who will personally match you with the best available driver.
          </Text>
        </View>
      </ScrollView>

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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  screenTitle: { fontSize: 22 },
  screenSub: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  timeRow: { flexDirection: "row", gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  multilineBox: {
    height: 80,
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  inputText: { flex: 1, fontSize: 15 },
  multilineText: { height: "100%", textAlignVertical: "top" },
  walkRow: { flexDirection: "row", gap: 8 },
  walkChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  walkChipText: { fontSize: 13 },
  errorText: { fontSize: 13 },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: { fontSize: 15 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  infoCardText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
