import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clearBgLocationCredentials,
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
  storeBgLocationCredentials,
} from "@/lib/backgroundLocation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useAcceptBooking,
  useCreateDriverProfile,
  useCreateTrip,
  useCreateVehicle,
  useDeleteVehicle,
  useListBookings,
  useListDriverProfiles,
  useListTrips,
  useListVehicles,
  useRejectBooking,
  useUpdateDriverProfile,
  useUpdateVehicle,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { haversineKm } from "@/hooks/useDriverLocation";
import { useAuth } from "@/context/AuthContext";
import { useDemoMode } from "@/context/DemoModeContext";
import { useMode } from "@/context/ModeContext";
import { useColors } from "@/hooks/useColors";
import { MUMBAI_AREAS } from "@/constants/locations";
import { DriverSelfMap } from "@/components/DriverSelfMap";

const DEPARTURE_OPTIONS = [
  { label: "Now", offsetMs: 0 },
  { label: "In 30 min", offsetMs: 30 * 60 * 1000 },
  { label: "In 1 hr", offsetMs: 60 * 60 * 1000 },
  { label: "In 2 hrs", offsetMs: 2 * 60 * 60 * 1000 },
];

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
    ? MUMBAI_AREAS.filter((a) => a.toLowerCase().includes(value.toLowerCase())).slice(0, 4)
    : [];

  return (
    <View>
      <View style={[dStyles.formInput, { backgroundColor: colors.muted, borderColor: focused ? colors.primary : colors.border }]}>
        <Feather name={icon} size={14} color={iconColor} />
        <TextInput
          style={[dStyles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
      </View>
      {focused && suggestions.length > 0 && (
        <View style={[dStyles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              style={[dStyles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => { onChangeText(s); setFocused(false); }}
            >
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[dStyles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function DriverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const { mode, setMode } = useMode();
  const { isDemoMode } = useDemoMode();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [showPublishForm, setShowPublishForm] = useState(false);
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formSeats, setFormSeats] = useState("3");
  const [formFare, setFormFare] = useState("150");
  const [formDepartureOffset, setFormDepartureOffset] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  const [showCarsSection, setShowCarsSection] = useState(false);
  const [showCarForm, setShowCarForm] = useState(false);
  const [editingCarId, setEditingCarId] = useState<number | null>(null);
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [carColor, setCarColor] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carCapacity, setCarCapacity] = useState("4");
  const [carBodyType, setCarBodyType] = useState<"Hatchback" | "Sedan" | "SUV" | "MPV">("Hatchback");
  const [carConditionNote, setCarConditionNote] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { data: profilesData, refetch: refetchProfile } = useListDriverProfiles(
    { userId: user?.id, limit: 1 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!user?.id && user?.role === "driver" } as any },
  );
  const driverProfile = profilesData?.data?.[0];
  const driverProfileId = driverProfile?.id;

  const [localIsOnline, setLocalIsOnline] = useState<boolean | null>(null);
  const displayIsOnline = localIsOnline !== null ? localIsOnline : !!driverProfile?.isOnline;

  useEffect(() => {
    if (driverProfile !== undefined) {
      setLocalIsOnline(driverProfile?.isOnline ?? false);
    }
  }, [driverProfile?.isOnline]);

  const updateProfileMutation = useUpdateDriverProfile();
  const createProfileMutation = useCreateDriverProfile();
  const createTripMutation = useCreateTrip();
  const acceptBookingMutation = useAcceptBooking();
  const rejectBookingMutation = useRejectBooking();

  const { data: tripsData, refetch: refetchTrips } = useListTrips(
    { driverProfileId, limit: 20 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!driverProfileId } as any },
  );
  const myTripIds = (tripsData?.data ?? []).map((t) => t.id);

  const { data: bookingsData, refetch: refetchBookings } = useListBookings(
    { status: "pending", limit: 50 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!driverProfileId } as any },
  );
  const pendingBookings = (bookingsData?.data ?? []).filter((b) =>
    myTripIds.includes(b.tripId),
  );

  const { data: vehiclesData, refetch: refetchVehicles } = useListVehicles(
    { driverProfileId, limit: 10 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!driverProfileId } as any },
  );
  const myVehicles = vehiclesData?.data ?? [];

  const createVehicleMutation = useCreateVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const deleteVehicleMutation = useDeleteVehicle();

  const stopForegroundTracking = useCallback(() => {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const stopAllTracking = useCallback(async () => {
    stopForegroundTracking();
    await stopBackgroundLocationTask();
    await clearBgLocationCredentials();
  }, [stopForegroundTracking]);

  const startForegroundTracking = useCallback(
    async (profileId: number) => {
      if (!accessToken || !process.env.EXPO_PUBLIC_DOMAIN) return;
      if (Platform.OS === "web") return;

      stopForegroundTracking();

      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation({
          lat: initial.coords.latitude,
          lng: initial.coords.longitude,
        });
      } catch {
        // ignore — watcher will set it on first fix
      }

      const wsUrl = `wss://${process.env.EXPO_PUBLIC_DOMAIN}/ws?token=${accessToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
        (loc) => {
          const { latitude: lat, longitude: lng } = loc.coords;
          setCurrentLocation({ lat, lng });
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "location",
                driverId: profileId,
                lat,
                lng,
              }),
            );
          }
        },
      );
    },
    [accessToken, stopForegroundTracking],
  );

  const startLocationTracking = useCallback(
    async (profileId: number) => {
      if (!accessToken || !process.env.EXPO_PUBLIC_DOMAIN) return;
      if (Platform.OS === "web") return;

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") return;

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

      if (bgStatus === "granted") {
        await storeBgLocationCredentials(accessToken, process.env.EXPO_PUBLIC_DOMAIN);
        await startBackgroundLocationTask();
      }

      await startForegroundTracking(profileId);
    },
    [accessToken, startForegroundTracking],
  );

  useEffect(() => {
    return () => {
      stopForegroundTracking();
    };
  }, [stopForegroundTracking]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (nextState === "background" || nextState === "inactive") &&
        prev === "active"
      ) {
        stopForegroundTracking();
      } else if (nextState === "active" && prev !== "active") {
        if (displayIsOnline && driverProfileId) {
          startForegroundTracking(driverProfileId).catch(() => {});
        }
      }
    });
    return () => subscription.remove();
  }, [displayIsOnline, driverProfileId, startForegroundTracking, stopForegroundTracking]);

  async function ensureDriverProfile(): Promise<number | null> {
    if (driverProfileId) return driverProfileId;
    try {
      const profile = await createProfileMutation.mutateAsync();
      await refetchProfile();
      return profile.id;
    } catch {
      Alert.alert("Setup Error", "Could not create your driver profile. Please try again.");
      return null;
    }
  }

  async function toggleOnline() {
    const profileId = await ensureDriverProfile();
    if (!profileId) return;
    const newVal = !displayIsOnline;
    setLocalIsOnline(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updated = await updateProfileMutation.mutateAsync({
        id: profileId,
        data: { isOnline: newVal },
      });
      setLocalIsOnline((updated as { isOnline?: boolean }).isOnline ?? newVal);
      refetchProfile();
      if (newVal) {
        await startLocationTracking(profileId);
      } else {
        await stopAllTracking();
      }
    } catch {
      setLocalIsOnline(!newVal);
      Alert.alert("Error", "Could not update online status");
    }
  }

  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (Platform.OS === "web") return null;
    try {
      const results = await Location.geocodeAsync(address.trim());
      if (results.length > 0) return { lat: results[0].latitude, lng: results[0].longitude };
    } catch {
      // ignore
    }
    return null;
  }

  const BODY_TYPE_FARES: Record<string, number> = { Hatchback: 70, Sedan: 100, SUV: 150, MPV: 130 };
  const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "MPV"] as const;

  function openCarEdit(car: { id: number; make: string; model: string; year: number; color: string; licensePlate: string; capacity: number; bodyType?: string | null; conditionNote?: string | null }) {
    setEditingCarId(car.id);
    setCarMake(car.make);
    setCarModel(car.model);
    setCarYear(String(car.year));
    setCarColor(car.color);
    setCarPlate(car.licensePlate === "—" ? "" : car.licensePlate);
    setCarCapacity(String(car.capacity));
    setCarBodyType((car.bodyType as typeof carBodyType) ?? "Hatchback");
    setCarConditionNote(car.conditionNote ?? "");
    setShowCarForm(true);
    setShowCarsSection(true);
  }

  function openCarAdd() {
    setEditingCarId(null);
    setCarMake(""); setCarModel(""); setCarYear(""); setCarColor(""); setCarPlate(""); setCarCapacity("4");
    setCarBodyType("Hatchback"); setCarConditionNote("");
    setShowCarForm(true);
    setShowCarsSection(true);
  }

  async function handleDeleteCar(carId: number) {
    Alert.alert(
      "Remove this car?",
      "This won't affect past trips.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteVehicleMutation.mutateAsync({ id: carId });
              if (selectedVehicleId === carId) setSelectedVehicleId(null);
              await refetchVehicles();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Could not remove the car. Please try again.");
            }
          },
        },
      ],
    );
  }

  async function handleSaveCar() {
    if (!driverProfileId) return;
    const year = parseInt(carYear.trim(), 10);
    const capacity = parseInt(carCapacity.trim(), 10);
    if (!carMake.trim() || !carModel.trim() || isNaN(year) || !carColor.trim() || isNaN(capacity) || capacity < 1) {
      Alert.alert("Missing fields", "Please fill in make, model, year, color, and seats.");
      return;
    }
    try {
      if (editingCarId) {
        await updateVehicleMutation.mutateAsync({
          id: editingCarId,
          data: { make: carMake.trim(), model: carModel.trim(), year, color: carColor.trim(), licensePlate: carPlate.trim() || "—", capacity, bodyType: carBodyType, conditionNote: carConditionNote.trim() || undefined },
        });
      } else {
        const created = await createVehicleMutation.mutateAsync({
          data: { driverProfileId, make: carMake.trim(), model: carModel.trim(), year, color: carColor.trim(), licensePlate: carPlate.trim() || "—", capacity, bodyType: carBodyType, conditionNote: carConditionNote.trim() || undefined },
        });
        setSelectedVehicleId(created.id);
        setFormSeats(String(capacity));
        setFormFare(String(BODY_TYPE_FARES[carBodyType] ?? 100));
      }
      setShowCarForm(false);
      setEditingCarId(null);
      setCarMake(""); setCarModel(""); setCarYear(""); setCarColor(""); setCarPlate(""); setCarCapacity("4");
      setCarBodyType("Hatchback"); setCarConditionNote("");
      await refetchVehicles();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save vehicle. Please try again.");
    }
  }

  async function handlePublishTrip() {
    if (myVehicles.length === 0) {
      Alert.alert("Add a car first", "You need at least one car before publishing a trip.");
      return;
    }
    if (!selectedVehicleId) {
      Alert.alert("Select a car", "Please select a car for this trip.");
      return;
    }
    if (!formFrom || !formTo) {
      Alert.alert("Required", "Please fill in origin and destination.");
      return;
    }
    const profileId = await ensureDriverProfile();
    if (!profileId) return;
    const seats = parseInt(formSeats, 10) || 1;
    const fare = parseFloat(formFare) || 100;
    const departureOffsetMs = DEPARTURE_OPTIONS[formDepartureOffset]?.offsetMs ?? 3600000;
    const departure = new Date(Date.now() + departureOffsetMs).toISOString();

    const [fromCoords, toCoords] = await Promise.all([
      geocodeAddress(formFrom),
      geocodeAddress(formTo),
    ]);

    const originLat = fromCoords?.lat ?? 19.076;
    const originLng = fromCoords?.lng ?? 72.8777;
    const destLat = toCoords?.lat ?? 19.059;
    const destLng = toCoords?.lng ?? 72.8394;

    try {
      await createTripMutation.mutateAsync({
        data: {
          driverProfileId: profileId,
          vehicleId: selectedVehicleId ?? undefined,
          originAddress: formFrom,
          destAddress: formTo,
          originLat,
          originLng,
          destLat,
          destLng,
          availableSeats: seats,
          maxDeviationKm: 5,
          farePerSeat: fare,
          departureTime: departure,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPublishForm(false);
      setFormFrom("");
      setFormTo("");
      await refetchTrips();
    } catch {
      Alert.alert("Error", "Could not publish trip");
    }
  }

  async function handleAccept(bookingId: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await acceptBookingMutation.mutateAsync({ id: bookingId, data: {} });
      await refetchBookings();
    } catch {
      Alert.alert("Error", "Could not accept booking");
    }
  }

  async function handleReject(bookingId: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await rejectBookingMutation.mutateAsync({ id: bookingId, data: {} });
      await refetchBookings();
    } catch {
      Alert.alert("Error", "Could not reject booking");
    }
  }

  if (mode !== "driver") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }}>
          <Feather name="truck" size={48} color={colors.mutedForeground} />
          <Text style={[styles.promptTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Driver Mode
          </Text>
          <Text style={[styles.promptText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {user?.role === "driver"
              ? "Switch to driver mode to access driver features."
              : "Register as a driver to offer rides and earn."}
          </Text>
          {user?.role === "driver" && (
            <Pressable
              style={[styles.switchBtn, { backgroundColor: colors.primary }]}
              onPress={() => setMode("driver")}
            >
              <Text style={[styles.switchBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Switch to Driver Mode
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Text style={[styles.profileLink, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
              Manage mode in Profile →
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Driver Dashboard
        </Text>
        <Pressable onPress={() => { setMode("passenger"); Haptics.selectionAsync(); }} style={styles.switchModeBtn}>
          <Feather name="users" size={14} color={colors.mutedForeground} />
          <Text style={[styles.switchModeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Passenger
          </Text>
        </Pressable>
      </View>

      <View style={[styles.onlineCard, { backgroundColor: colors.card, borderColor: displayIsOnline ? colors.success : colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.onlineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {displayIsOnline ? "You're Online" : "You're Offline"}
          </Text>
          <Text style={[styles.onlineSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {displayIsOnline
              ? "Passengers can find and book your trips"
              : "Toggle to go online and accept rides"}
          </Text>
        </View>
        <Switch
          value={displayIsOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: colors.border, true: `${colors.success}99` }}
          thumbColor={displayIsOnline ? colors.success : colors.mutedForeground}
          disabled={updateProfileMutation.isPending || createProfileMutation.isPending}
        />
      </View>

      {isDemoMode && (
        <View style={[styles.demoBanner, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}>
          <Feather name="zap" size={13} color={colors.primary} />
          <Text style={[styles.demoBannerText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
            Demo Mode — post a trip below, then log in as the passenger demo account to test the full booking flow.
          </Text>
        </View>
      )}

      {displayIsOnline && currentLocation && (
        <View style={styles.mapSection}>
          <DriverSelfMap
            lat={currentLocation.lat}
            lng={currentLocation.lng}
            isOnline={displayIsOnline}
          />
        </View>
      )}

      {/* My Cars section */}
      <View style={styles.section}>
        <Pressable style={styles.sectionHeader} onPress={() => setShowCarsSection(!showCarsSection)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="truck" size={15} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              My Cars{myVehicles.length > 0 ? ` (${myVehicles.length})` : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {myVehicles.length < 3 && (
              <Pressable
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={(e) => { e.stopPropagation?.(); openCarAdd(); }}
              >
                <Feather name="plus" size={16} color={colors.primaryForeground} />
              </Pressable>
            )}
            <Feather name={showCarsSection ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {showCarsSection && (
          <>
            {myVehicles.length === 0 && !showCarForm && (
              <Pressable
                style={[styles.carEmptyRow, { borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={openCarAdd}
              >
                <Feather name="plus-circle" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_500Medium" }}>
                  Add your first car
                </Text>
              </Pressable>
            )}

            {myVehicles.map((car) => (
              <Pressable
                key={car.id}
                style={[
                  styles.carRow,
                  {
                    backgroundColor: selectedVehicleId === car.id ? `${colors.primary}18` : colors.card,
                    borderColor: selectedVehicleId === car.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  const selecting = selectedVehicleId !== car.id;
                  setSelectedVehicleId(selecting ? car.id : null);
                  if (selecting) {
                    setFormSeats(String(car.capacity));
                    if (car.bodyType) setFormFare(String(BODY_TYPE_FARES[car.bodyType] ?? 100));
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                    {car.make} {car.model}
                    {car.bodyType ? <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground }}> · {car.bodyType}</Text> : null}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                    {car.year} · {car.color} · {car.capacity} seats{car.licensePlate && car.licensePlate !== "—" ? ` · ${car.licensePlate}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => openCarEdit(car)} style={{ padding: 6 }}>
                  <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                </Pressable>
                {myVehicles.length > 1 && (
                  <Pressable onPress={() => handleDeleteCar(car.id)} style={{ padding: 6 }}>
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                )}
              </Pressable>
            ))}

            {showCarForm && (
              <View style={[styles.carFormCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 }}>
                  {editingCarId ? "Edit Car" : "Add Car"}
                </Text>

                <View style={styles.carFormRow}>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Make (e.g. Maruti)"
                      placeholderTextColor={colors.mutedForeground}
                      value={carMake}
                      onChangeText={setCarMake}
                    />
                  </View>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Model (e.g. Swift)"
                      placeholderTextColor={colors.mutedForeground}
                      value={carModel}
                      onChangeText={setCarModel}
                    />
                  </View>
                </View>

                <View style={styles.carFormRow}>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Year"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      value={carYear}
                      onChangeText={setCarYear}
                      maxLength={4}
                    />
                  </View>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Color"
                      placeholderTextColor={colors.mutedForeground}
                      value={carColor}
                      onChangeText={setCarColor}
                    />
                  </View>
                </View>

                <View style={styles.carFormRow}>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Plate (optional)"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters"
                      value={carPlate}
                      onChangeText={setCarPlate}
                    />
                  </View>
                  <View style={[styles.formInput, styles.carFormHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Feather name="users" size={14} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      placeholder="Seats"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      value={carCapacity}
                      onChangeText={setCarCapacity}
                      maxLength={2}
                    />
                  </View>
                </View>

                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Body Type</Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {BODY_TYPES.map((bt) => (
                    <Pressable
                      key={bt}
                      onPress={() => setCarBodyType(bt)}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor: carBodyType === bt ? colors.primary : colors.muted,
                        borderWidth: 1,
                        borderColor: carBodyType === bt ? colors.primary : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: carBodyType === bt ? "Inter_600SemiBold" : "Inter_400Regular", color: carBodyType === bt ? colors.primaryForeground : colors.foreground }}>
                        {bt}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.border, marginBottom: 10 }]}>
                  <TextInput
                    style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                    placeholder="Condition note (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    value={carConditionNote}
                    onChangeText={setCarConditionNote}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={[styles.publishBtn, { flex: 1, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => { setShowCarForm(false); setEditingCarId(null); }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.publishBtn, { flex: 2, backgroundColor: colors.primary, opacity: pressed || createVehicleMutation.isPending || updateVehicleMutation.isPending ? 0.8 : 1 }]}
                    onPress={handleSaveCar}
                    disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                  >
                    {createVehicleMutation.isPending || updateVehicleMutation.isPending ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                        {editingCarId ? "Save Changes" : "Add Car"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            My Trips
          </Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowPublishForm(!showPublishForm)}
          >
            <Feather name={showPublishForm ? "x" : "plus"} size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>

        {showPublishForm && (
          <View style={[styles.publishForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Publish a Trip
            </Text>

            {myVehicles.length > 0 && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="truck" size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                    Vehicle
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {myVehicles.map((car) => (
                    <Pressable
                      key={car.id}
                      onPress={() => {
                        const next = selectedVehicleId === car.id ? null : car.id;
                        setSelectedVehicleId(next);
                        if (next) setFormSeats(String(car.capacity));
                      }}
                      style={[
                        styles.carChip,
                        {
                          backgroundColor: selectedVehicleId === car.id ? colors.primary : colors.muted,
                          borderColor: selectedVehicleId === car.id ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: selectedVehicleId === car.id ? colors.primaryForeground : colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {car.make} {car.model} · {car.capacity}s
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <LocationInput
              value={formFrom}
              onChangeText={setFormFrom}
              placeholder="From (origin)"
              icon="circle"
              iconColor={colors.success}
              colors={colors}
            />

            <LocationInput
              value={formTo}
              onChangeText={setFormTo}
              placeholder="To (destination)"
              icon="map-pin"
              iconColor={colors.destructive}
              colors={colors}
            />

            <View style={styles.formRow}>
              <View style={[styles.formInput, styles.formHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="users" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="Seats"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={formSeats}
                  onChangeText={setFormSeats}
                />
              </View>
              <View style={[styles.formInput, styles.formHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>₹</Text>
                <TextInput
                  style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="Fare/seat"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={formFare}
                  onChangeText={setFormFare}
                />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                  Departure
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {DEPARTURE_OPTIONS.map((opt, i) => (
                  <Pressable
                    key={opt.label}
                    onPress={() => setFormDepartureOffset(i)}
                    style={[
                      styles.depOption,
                      {
                        backgroundColor: formDepartureOffset === i ? colors.primary : colors.muted,
                        borderColor: formDepartureOffset === i ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: formDepartureOffset === i ? colors.primaryForeground : colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {myVehicles.length === 0 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 6 }}>
                Add a car in My Cars before publishing a trip.
              </Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.publishBtn,
                {
                  backgroundColor: myVehicles.length === 0 ? colors.muted : colors.primary,
                  opacity: pressed || createTripMutation.isPending || createProfileMutation.isPending ? 0.8 : 1,
                },
              ]}
              onPress={handlePublishTrip}
              disabled={createTripMutation.isPending || createProfileMutation.isPending || myVehicles.length === 0}
            >
              {createTripMutation.isPending || createProfileMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.publishBtnText, { color: myVehicles.length === 0 ? colors.mutedForeground : colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Publish Trip
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {(tripsData?.data ?? []).length === 0 && !showPublishForm && (
          <View style={styles.emptyState}>
            <Feather name="navigation" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              No trips posted
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Tap the + button to publish your first route and start accepting passengers
            </Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowPublishForm(true)}
            >
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                Post a Trip
              </Text>
            </Pressable>
          </View>
        )}

        {(tripsData?.data ?? []).map((trip) => (
          <View key={trip.id} style={[styles.tripRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tripInfo}>
              <Text style={[styles.tripRoute, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                {trip.originAddress}
              </Text>
              <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
              <Text style={[styles.tripRoute, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                {trip.destAddress}
              </Text>
            </View>
            <Text style={[styles.tripStatus, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {trip.availableSeats} seats · ₹{trip.farePerSeat}
            </Text>
          </View>
        ))}
      </View>

      {(tripsData?.data ?? []).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Booking Requests{pendingBookings.length > 0 ? ` (${pendingBookings.length})` : ""}
          </Text>
          {pendingBookings.length === 0 && (
            <View style={[styles.emptyState, { paddingVertical: 16 }]}>
              <Feather name="check-circle" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
                All clear
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No pending requests — you're up to date
              </Text>
            </View>
          )}
          {pendingBookings.map((booking: Booking) => {
            const trip = booking.trip as { originLat?: number | null; originLng?: number | null; destLat?: number | null; destLng?: number | null } | undefined;
            const pickupLat = booking.pickupLat;
            const pickupLng = booking.pickupLng;
            const oLat = trip?.originLat;
            const oLng = trip?.originLng;
            const dLat = trip?.destLat;
            const dLng = trip?.destLng;

            // Compute perpendicular deviation of pickup from trip route segment
            let deviationKm: number | null = null;
            if (pickupLat != null && pickupLng != null && oLat != null && oLng != null && dLat != null && dLng != null) {
              const cosLat = Math.cos(((oLat + dLat) / 2) * Math.PI / 180);
              const ax = oLng * cosLat * 111, ay = oLat * 111;
              const bx = dLng * cosLat * 111, by = dLat * 111;
              const px = pickupLng * cosLat * 111, py = pickupLat * 111;
              const dx = bx - ax, dy = by - ay;
              const len2 = dx * dx + dy * dy;
              if (len2 > 0.001) {
                let t = ((px - ax) * dx + (py - ay) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const cx = ax + t * dx, cy = ay + t * dy;
                deviationKm = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
              } else {
                deviationKm = haversineKm(pickupLat, pickupLng, oLat, oLng);
              }
            }
            const hasDeviation = deviationKm != null && deviationKm > 1.5;
            const deviationColor = deviationKm != null && deviationKm > 4 ? colors.destructive : "#d97706";

            return (
            <View
              key={booking.id}
              style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.bookingInfo}>
                <Text style={[styles.bookingPassenger, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {booking.passenger?.name ?? booking.passenger?.phone ?? "Passenger"}
                </Text>
                <Text style={[styles.bookingRoute, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                  {booking.pickupAddress} → {booking.dropoffAddress}
                </Text>
                {hasDeviation && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Feather name="alert-triangle" size={11} color={deviationColor} />
                    <Text style={{ color: deviationColor, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                      Pickup {deviationKm!.toFixed(1)} km off your route
                    </Text>
                  </View>
                )}
                <Text style={[styles.bookingFare, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  ₹{booking.fare.toFixed(0)}
                </Text>
              </View>
              <View style={styles.bookingActions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: `${colors.success}22`, borderColor: colors.success }]}
                  onPress={() => handleAccept(booking.id)}
                  disabled={acceptBookingMutation.isPending}
                >
                  <Feather name="check" size={18} color={colors.success} />
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive }]}
                  onPress={() => handleReject(booking.id)}
                  disabled={rejectBookingMutation.isPending}
                >
                  <Feather name="x" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const dStyles = StyleSheet.create({
  formInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  formInputText: { flex: 1, fontSize: 14 },
  suggestions: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 20,
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
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22 },
  switchModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchModeText: { fontSize: 13 },
  onlineCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  onlineLabel: { fontSize: 16, marginBottom: 2 },
  onlineSub: { fontSize: 13 },
  mapSection: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  section: {
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  publishForm: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 15 },
  formInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  formInputText: { flex: 1, fontSize: 14 },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  formHalf: { flex: 1 },
  publishBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtnText: { fontSize: 15 },
  tripRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  tripInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripRoute: { fontSize: 13, flex: 1 },
  tripStatus: { fontSize: 12 },
  bookingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bookingInfo: { flex: 1, gap: 2 },
  bookingPassenger: { fontSize: 14 },
  bookingRoute: { fontSize: 12 },
  bookingFare: { fontSize: 15 },
  bookingActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 18, marginTop: 4 },
  emptySubtext: { fontSize: 13, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14 },
  emptyText: { fontSize: 13, textAlign: "center" },
  promptTitle: { fontSize: 20 },
  promptText: { fontSize: 14 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  demoBannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  profileLink: { fontSize: 14 },
  switchBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  switchBtnText: { fontSize: 15 },
  depOption: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  carEmptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  carFormCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  carFormRow: {
    flexDirection: "row",
    gap: 8,
  },
  carFormHalf: { flex: 1 },
  carChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
