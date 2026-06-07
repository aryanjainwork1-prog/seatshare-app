import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateBooking, useGetTrip } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [booking, setBooking] = useState<Booking | null>(null);

  const tripId = parseInt(id ?? "0", 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trip, isLoading } = useGetTrip(tripId, { query: { enabled: !!tripId } as any });
  const createBookingMutation = useCreateBooking();

  async function handleBook() {
    if (!trip || !user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let pLat = trip.originLat + 0.01;
    let pLng = trip.originLng + 0.01;

    if (Platform.OS !== "web") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          pLat = pos.coords.latitude;
          pLng = pos.coords.longitude;
        } catch {
          // use defaults
        }
      }
    }

    try {
      const result = await createBookingMutation.mutateAsync({
        data: {
          tripId: trip.id,
          passengerId: user.id,
          pickupAddress: `Near ${trip.originAddress}`,
          dropoffAddress: trip.destAddress,
          pickupLat: pLat,
          pickupLng: pLng,
          dropoffLat: trip.destLat,
          dropoffLng: trip.destLng,
        },
      });
      setBooking(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not complete booking";
      Alert.alert("Booking failed", msg);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Trip not found
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const driver = trip.driverProfile?.user;
  const vehicle = trip.driverProfile?.vehicle;
  const driverName = driver?.name ?? "Driver";
  const initials = driverName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.replace("/(tabs)/bookings")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.success}22` }]}>
            <Feather name="check-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Ride Booked!
          </Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Waiting for driver confirmation
          </Text>

          {booking.boardingCode && (
            <View style={[styles.boardingBox, { backgroundColor: colors.card, borderColor: `${colors.primary}40` }]}>
              <Text style={[styles.boardingLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Boarding Code
              </Text>
              <Text style={[styles.boardingCode, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {booking.boardingCode}
              </Text>
            </View>
          )}

          <View style={[styles.bookingInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Fare: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>₹{booking.fare.toFixed(0)}</Text>
            </Text>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              From: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{booking.pickupAddress}</Text>
            </Text>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              To: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{booking.dropoffAddress}</Text>
            </Text>
          </View>

          <Pressable
            style={[styles.viewBookingsBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)/bookings")}
          >
            <Text style={[styles.viewBookingsBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
              View My Bookings
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Trip Details
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
        <View style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.driverAvatar, { backgroundColor: `${colors.primary}33` }]}>
            <Text style={[styles.driverAvatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {initials}
            </Text>
          </View>
          <View>
            <Text style={[styles.driverName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {driverName}
            </Text>
            {vehicle && (
              <Text style={[styles.vehicleText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {vehicle.color} {vehicle.make} {vehicle.model} · {vehicle.licensePlate}
              </Text>
            )}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#facc15" />
              <Text style={[styles.ratingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {trip.driverProfile?.rating?.toFixed(1) ?? "—"} · {trip.driverProfile?.totalTrips} trips
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { borderColor: colors.success }]} />
            <View style={styles.routeInfo}>
              <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>From</Text>
              <Text style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {trip.originAddress}
              </Text>
            </View>
          </View>
          <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDotFilled, { backgroundColor: colors.destructive }]} />
            <View style={styles.routeInfo}>
              <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>To</Text>
              <Text style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {trip.destAddress}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              ₹{trip.farePerSeat}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Per seat
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {trip.availableSeats}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Seats left
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {trip.maxDeviationKm} km
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Max detour
            </Text>
          </View>
        </View>

        <View style={[styles.departureRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={16} color={colors.mutedForeground} />
          <View>
            <Text style={[styles.departureLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Departure
            </Text>
            <Text style={[styles.departureValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {new Date(trip.departureTime).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bookBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        <Pressable
          testID="book-ride-btn"
          style={({ pressed }) => [
            styles.bookBtn,
            { backgroundColor: colors.primary, opacity: pressed || createBookingMutation.isPending ? 0.8 : 1 },
          ]}
          onPress={handleBook}
          disabled={createBookingMutation.isPending || trip.availableSeats === 0}
        >
          {createBookingMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="check-circle" size={18} color={colors.primaryForeground} />
              <Text style={[styles.bookBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                {trip.availableSeats === 0 ? "Fully Booked" : `Book for ₹${trip.farePerSeat}`}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", gap: 16 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  topBarTitle: { fontSize: 17 },
  content: { padding: 16, gap: 12 },
  driverCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: { fontSize: 20 },
  driverName: { fontSize: 16 },
  vehicleText: { fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontSize: 13 },
  routeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 0,
  },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: "transparent",
    marginTop: 14,
  },
  routeDotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
  },
  routeConnector: {
    width: 2,
    height: 12,
    marginLeft: 5,
  },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11 },
  routeAddr: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 11 },
  departureRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  departureLabel: { fontSize: 11 },
  departureValue: { fontSize: 14 },
  bookBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bookBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  bookBtnText: { fontSize: 16 },
  errorText: { fontSize: 15 },
  backLink: { fontSize: 15 },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 28, letterSpacing: -0.5 },
  successSub: { fontSize: 15 },
  boardingBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  boardingLabel: { fontSize: 12 },
  boardingCode: { fontSize: 32, letterSpacing: 6 },
  bookingInfoCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  bookingInfoRow: { fontSize: 14 },
  bookingInfoVal: { fontSize: 14 },
  viewBookingsBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  viewBookingsBtnText: { fontSize: 16 },
});
