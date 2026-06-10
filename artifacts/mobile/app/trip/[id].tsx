import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateBooking, useCancelBooking, useGetBooking, useGetTrip } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { LiveDriverMap } from "@/components/LiveDriverMap";

const LIVE_STATUSES = ["accepted", "in_progress"];

const CANCEL_REASONS = [
  "Plans changed",
  "Found another ride",
  "Booked by mistake",
  "Emergency",
  "Other",
];

export default function TripDetailScreen() {
  const { id, bookingId } = useLocalSearchParams<{ id: string; bookingId?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [newBooking, setNewBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const tripId = parseInt(id ?? "0", 10);
  const parsedBookingId = bookingId ? parseInt(bookingId, 10) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trip, isLoading: tripLoading } = useGetTrip(tripId, { query: { enabled: !!tripId } as any });

  // Fetch the existing booking if bookingId was passed via query param
  const { data: existingBooking, isLoading: bookingLoading } = useGetBooking(
    parsedBookingId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!parsedBookingId } as any },
  );

  const createBookingMutation = useCreateBooking();
  const cancelBookingMutation = useCancelBooking();

  // Determine the active booking (either just-created or fetched existing)
  const activeBooking = newBooking ?? existingBooking ?? null;
  const showLiveMap = !!activeBooking && LIVE_STATUSES.includes(activeBooking.status);

  // Driver's userId for WebSocket subscription
  const driverUserId = trip?.driverProfile?.userId ?? null;

  const { location: driverLocation, isConnected } = useDriverLocation({
    driverUserId,
    accessToken,
    enabled: showLiveMap,
  });

  const isLoading = tripLoading || (!!parsedBookingId && bookingLoading);

  function handleCancelBooking() {
    if (!activeBooking) return;
    if (activeBooking.status === "accepted") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCancelReason("");
      setShowCancelModal(true);
    } else {
      Alert.alert(
        "Cancel Ride",
        "Are you sure you want to cancel this booking?",
        [
          { text: "Keep Ride", style: "cancel" },
          {
            text: "Cancel Ride",
            style: "destructive",
            onPress: async () => {
              try {
                await cancelBookingMutation.mutateAsync({ id: activeBooking.id, data: {} });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                router.replace("/(tabs)/bookings");
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not cancel booking";
                Alert.alert("Cancellation failed", msg);
              }
            },
          },
        ],
      );
    }
  }

  async function confirmCancelModal() {
    if (!activeBooking) return;
    try {
      await cancelBookingMutation.mutateAsync({
        id: activeBooking.id,
        data: cancelReason ? { reason: cancelReason } : {},
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowCancelModal(false);
      router.replace("/(tabs)/bookings");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not cancel booking";
      Alert.alert("Cancellation failed", msg);
    }
  }

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
      setNewBooking(result);
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

  // --- Booking success view (just booked, status = pending) ---
  if (newBooking && !showLiveMap) {
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

          {newBooking.boardingCode && (
            <View style={[styles.boardingBox, { backgroundColor: colors.card, borderColor: `${colors.primary}40` }]}>
              <Text style={[styles.boardingLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Boarding Code
              </Text>
              <Text style={[styles.boardingCode, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {newBooking.boardingCode}
              </Text>
            </View>
          )}

          <View style={[styles.bookingInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Fare: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>₹{newBooking.fare.toFixed(0)}</Text>
            </Text>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              From: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{newBooking.pickupAddress}</Text>
            </Text>
            <Text style={[styles.bookingInfoRow, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              To: <Text style={[styles.bookingInfoVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{newBooking.dropoffAddress}</Text>
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

  // --- Live tracking view (booking accepted or in_progress) ---
  if (showLiveMap) {
    const liveDriverLat = driverLocation?.lat ?? (trip.driverProfile?.currentLat ?? trip.originLat);
    const liveDriverLng = driverLocation?.lng ?? (trip.driverProfile?.currentLng ?? trip.originLng);
    const pickupLat = activeBooking.pickupLat;
    const pickupLng = activeBooking.pickupLng;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Track Your Ride
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
          {/* Status banner */}
          <View style={[styles.statusBanner, {
            backgroundColor: activeBooking.status === "in_progress" ? `${colors.success}15` : `${colors.primary}15`,
            borderColor: activeBooking.status === "in_progress" ? `${colors.success}40` : `${colors.primary}40`,
          }]}>
            <View style={[styles.statusDot, {
              backgroundColor: activeBooking.status === "in_progress" ? colors.success : colors.primary,
            }]} />
            <Text style={[styles.statusText, {
              color: activeBooking.status === "in_progress" ? colors.success : colors.primary,
              fontFamily: "Inter_600SemiBold",
            }]}>
              {activeBooking.status === "in_progress" ? "Ride in progress" : "Driver confirmed — on the way"}
            </Text>
          </View>

          {/* Live map */}
          <LiveDriverMap
            driverLat={liveDriverLat}
            driverLng={liveDriverLng}
            pickupLat={pickupLat}
            pickupLng={pickupLng}
            isConnected={isConnected}
            updatedAt={driverLocation?.updatedAt}
          />

          {/* Driver info */}
          <View style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.driverAvatar, { backgroundColor: `${colors.primary}33` }]}>
              <Text style={[styles.driverAvatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
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
            {activeBooking.boardingCode && (
              <View style={[styles.miniCodeBadge, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
                <Text style={[styles.miniCodeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Code</Text>
                <Text style={[styles.miniCodeValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {activeBooking.boardingCode}
                </Text>
              </View>
            )}
          </View>

          {/* Route summary */}
          <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { borderColor: colors.success }]} />
              <View style={styles.routeInfo}>
                <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Pickup</Text>
                <Text style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {activeBooking.pickupAddress}
                </Text>
              </View>
            </View>
            <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDotFilled, { backgroundColor: colors.destructive }]} />
              <View style={styles.routeInfo}>
                <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Drop-off</Text>
                <Text style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {activeBooking.dropoffAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Cancel ride button — only for accepted (not in-progress) */}
          {activeBooking.status === "accepted" && (
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.destructive, opacity: pressed || cancelBookingMutation.isPending ? 0.7 : 1 },
              ]}
              onPress={handleCancelBooking}
              disabled={cancelBookingMutation.isPending}
            >
              <Feather name="x-circle" size={16} color={colors.destructive} />
              <Text style={[styles.cancelBtnText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
                Cancel Ride
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Cancel modal — shown for accepted bookings only */}
        <Modal
          visible={showCancelModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCancelModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCancelModal(false)}>
            <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={[styles.cancelWarningBanner, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}40` }]}>
                <Feather name="alert-triangle" size={18} color={colors.destructive} />
                <Text style={[styles.cancelWarningText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
                  Driver already confirmed
                </Text>
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Cancel Ride?
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Your driver has accepted this ride and is on the way to pick you up. Cancelling now may affect your passenger reputation.
              </Text>

              <Text style={[styles.reasonLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Reason for cancelling
              </Text>
              <View style={styles.reasonsList}>
                {CANCEL_REASONS.map((reason) => (
                  <Pressable
                    key={reason}
                    style={[
                      styles.reasonOption,
                      {
                        borderColor: cancelReason === reason ? colors.destructive : colors.border,
                        backgroundColor: cancelReason === reason ? `${colors.destructive}10` : colors.background,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCancelReason(reason);
                    }}
                  >
                    <View style={[
                      styles.reasonRadio,
                      {
                        borderColor: cancelReason === reason ? colors.destructive : colors.border,
                        backgroundColor: cancelReason === reason ? colors.destructive : "transparent",
                      },
                    ]} />
                    <Text style={[styles.reasonText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                      {reason}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmCancelBtn,
                  { backgroundColor: colors.destructive, opacity: pressed || cancelBookingMutation.isPending || !cancelReason ? 0.6 : 1 },
                ]}
                onPress={confirmCancelModal}
                disabled={cancelBookingMutation.isPending || !cancelReason}
              >
                <Text style={[styles.confirmCancelBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                  {cancelBookingMutation.isPending ? "Cancelling…" : "Confirm Cancellation"}
                </Text>
              </Pressable>

              <Pressable onPress={() => setShowCancelModal(false)} style={styles.keepRideBtn}>
                <Text style={[styles.keepRideBtnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Keep my ride
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // --- Default: trip detail view (before booking) ---
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { fontSize: 14 },
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
  miniCodeBadge: {
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  miniCodeLabel: { fontSize: 10 },
  miniCodeValue: { fontSize: 18, letterSpacing: 2 },
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
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelBtnText: { fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    gap: 16,
    alignItems: "center",
  },
  cancelWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "stretch",
  },
  cancelWarningText: { fontSize: 14 },
  modalTitle: { fontSize: 20 },
  modalSubtitle: { fontSize: 14, textAlign: "center", marginTop: -6 },
  reasonLabel: { fontSize: 14, alignSelf: "flex-start" },
  reasonsList: { width: "100%", gap: 8 },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  reasonRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  reasonText: { fontSize: 14 },
  confirmCancelBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmCancelBtnText: { color: "#fff", fontSize: 15 },
  keepRideBtn: { paddingVertical: 4 },
  keepRideBtnText: { fontSize: 14 },
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
