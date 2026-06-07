import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useAcceptBooking,
  useCreateTrip,
  useListBookings,
  useListDriverProfiles,
  useListTrips,
  useRejectBooking,
  useUpdateDriverProfile,
} from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useMode } from "@/context/ModeContext";
import { useColors } from "@/hooks/useColors";

export default function DriverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const { mode, setMode } = useMode();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [showPublishForm, setShowPublishForm] = useState(false);
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formSeats, setFormSeats] = useState("3");
  const [formFare, setFormFare] = useState("150");
  const [formDeparture, setFormDeparture] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const { data: profilesData, refetch: refetchProfile } = useListDriverProfiles(
    { userId: user?.id, limit: 1 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!user?.id && user?.role === "driver" } as any },
  );
  const driverProfile = profilesData?.data?.[0];
  const driverProfileId = driverProfile?.id;

  const updateProfileMutation = useUpdateDriverProfile();
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

  const stopLocationTracking = useCallback(() => {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(
    async (profileId: number) => {
      if (!accessToken || !process.env.EXPO_PUBLIC_DOMAIN) return;

      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const wsUrl = `wss://${process.env.EXPO_PUBLIC_DOMAIN}/ws?token=${accessToken}`;
        wsRef.current = new WebSocket(wsUrl);

        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
          (loc) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "location",
                  driverId: profileId,
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                }),
              );
            }
          },
        );
      }
    },
    [accessToken],
  );

  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (
        (nextState === "background" || nextState === "inactive") &&
        prev === "active"
      ) {
        stopLocationTracking();
      } else if (nextState === "active" && prev !== "active") {
        if (driverProfile?.isOnline && driverProfileId) {
          startLocationTracking(driverProfileId).catch(() => {});
        }
      }
    });
    return () => subscription.remove();
  }, [driverProfile?.isOnline, driverProfileId, startLocationTracking, stopLocationTracking]);

  async function toggleOnline() {
    if (!driverProfileId) return;
    const newVal = !driverProfile?.isOnline;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateProfileMutation.mutateAsync({
        id: driverProfileId,
        data: { isOnline: newVal },
      });
      await refetchProfile();
      if (newVal) {
        await startLocationTracking(driverProfileId);
      } else {
        stopLocationTracking();
      }
    } catch {
      Alert.alert("Error", "Could not update online status");
    }
  }

  async function handlePublishTrip() {
    if (!driverProfileId || !formFrom || !formTo) {
      Alert.alert("Required", "Please fill in origin and destination.");
      return;
    }
    const seats = parseInt(formSeats, 10) || 1;
    const fare = parseFloat(formFare) || 100;
    const departure = formDeparture || new Date(Date.now() + 3600000).toISOString();

    try {
      await createTripMutation.mutateAsync({
        data: {
          driverProfileId,
          originAddress: formFrom,
          destAddress: formTo,
          originLat: 12.9716,
          originLng: 77.5946,
          destLat: 13.0827,
          destLng: 80.2707,
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
        <View style={[styles.promptBox, { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }]}>
          <Feather name="truck" size={48} color={colors.mutedForeground} />
          <Text style={[styles.promptTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Driver Mode
          </Text>
          <Text style={[styles.promptText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {user?.role === "driver"
              ? "Switch to driver mode from your profile to access driver features."
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
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Driver Dashboard
        </Text>
      </View>

      <View style={[styles.onlineCard, { backgroundColor: colors.card, borderColor: driverProfile?.isOnline ? colors.success : colors.border }]}>
        <View>
          <Text style={[styles.onlineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {driverProfile?.isOnline ? "You're Online" : "You're Offline"}
          </Text>
          <Text style={[styles.onlineSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {driverProfile?.isOnline ? "Passengers can find and book your trips" : "Toggle to go online and accept rides"}
          </Text>
        </View>
        <Switch
          value={!!driverProfile?.isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: colors.border, true: `${colors.success}99` }}
          thumbColor={driverProfile?.isOnline ? colors.success : colors.mutedForeground}
          disabled={updateProfileMutation.isPending}
        />
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

            <View style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="circle" size={14} color={colors.success} />
              <TextInput
                style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="From (origin)"
                placeholderTextColor={colors.mutedForeground}
                value={formFrom}
                onChangeText={setFormFrom}
              />
            </View>

            <View style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.destructive} />
              <TextInput
                style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="To (destination)"
                placeholderTextColor={colors.mutedForeground}
                value={formTo}
                onChangeText={setFormTo}
              />
            </View>

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

            <View style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[styles.formInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Departure (ISO date or leave blank)"
                placeholderTextColor={colors.mutedForeground}
                value={formDeparture}
                onChangeText={setFormDeparture}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.publishBtn,
                { backgroundColor: colors.primary, opacity: pressed || createTripMutation.isPending ? 0.8 : 1 },
              ]}
              onPress={handlePublishTrip}
              disabled={createTripMutation.isPending}
            >
              {createTripMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.publishBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Publish Trip
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {(tripsData?.data ?? []).length === 0 && !showPublishForm && (
          <View style={styles.emptyState}>
            <Feather name="map" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No trips yet. Tap + to publish a route.
            </Text>
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

      {pendingBookings.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Booking Requests ({pendingBookings.length})
          </Text>
          {pendingBookings.map((booking: Booking) => (
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
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22 },
  onlineCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  onlineLabel: { fontSize: 16, marginBottom: 2 },
  onlineSub: { fontSize: 13 },
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
    paddingVertical: 20,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  promptBox: {},
  promptTitle: { fontSize: 20 },
  promptText: { fontSize: 14 },
  switchBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  switchBtnText: { fontSize: 15 },
});
