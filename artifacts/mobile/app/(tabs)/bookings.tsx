import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useListBookings, useCancelBooking, useCreateRating, useListRatings } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STATUS_COLORS: Record<string, string> = {
  pending: "#d97706",
  accepted: "#0080ff",
  in_progress: "#7c3aed",
  completed: "#16a34a",
  rejected: "#dc2626",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ACTIVE_STATUSES = new Set(["pending", "accepted", "in_progress"]);
const TRACKABLE_STATUSES = new Set(["accepted", "in_progress"]);
const CANCELLABLE_STATUSES = new Set(["pending", "accepted"]);

interface RatingModalState {
  booking: Booking;
  driverName: string;
  driverUserId: number;
}

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const cancelBookingMutation = useCancelBooking();
  const createRatingMutation = useCreateRating();

  const [localRatedBookingIds, setLocalRatedBookingIds] = useState<Set<number>>(new Set());
  const [ratingModal, setRatingModal] = useState<RatingModalState | null>(null);
  const [starScore, setStarScore] = useState(0);
  const [comment, setComment] = useState("");

  const { data: ratingsData } = useListRatings(
    { ratedId: user?.id, limit: 200 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!user?.id } as any },
  );

  const serverRatedBookingIds = new Set(
    (ratingsData?.data ?? []).map((r) => r.bookingId),
  );

  const ratedBookingIds = new Set([...serverRatedBookingIds, ...localRatedBookingIds]);

  const { data, isLoading, refetch, isRefetching } = useListBookings(
    { passengerId: user?.id, limit: 50 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!user?.id } as any },
  );

  const bookings = data?.data ?? [];
  const active = bookings.filter((b) => ACTIVE_STATUSES.has(b.status));
  const past = bookings.filter((b) => !ACTIVE_STATUSES.has(b.status));

  function openRatingModal(booking: Booking) {
    const trip = booking.trip;
    const driverProfile = (trip as { driverProfile?: { userId?: number; user?: { name?: string } } } | undefined)?.driverProfile;
    const driverUserId = driverProfile?.userId;
    const driverName = driverProfile?.user?.name ?? "Driver";

    if (!driverUserId) {
      Alert.alert("Unable to Rate", "Driver information is not available for this booking.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStarScore(0);
    setComment("");
    setRatingModal({ booking, driverName, driverUserId });
  }

  function closeRatingModal() {
    setRatingModal(null);
  }

  async function submitRating() {
    if (!ratingModal || !user?.id) return;
    if (starScore === 0) {
      Alert.alert("Select a Rating", "Please tap a star to rate your ride.");
      return;
    }

    try {
      await createRatingMutation.mutateAsync({
        data: {
          bookingId: ratingModal.booking.id,
          raterId: user.id,
          ratedId: ratingModal.driverUserId,
          score: starScore,
          comment: comment.trim() || undefined,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocalRatedBookingIds((prev) => new Set([...prev, ratingModal.booking.id]));
      closeRatingModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit rating";
      Alert.alert("Rating Failed", msg);
    }
  }

  function handleCancel(booking: Booking) {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelBookingMutation.mutateAsync({ id: booking.id, data: {} });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              refetch();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Could not cancel booking";
              Alert.alert("Cancellation failed", msg);
            }
          },
        },
      ],
    );
  }

  function handleTrack(booking: Booking) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const trip = booking.trip;
    router.push({
      pathname: "/tracking/[bookingId]",
      params: {
        bookingId: String(booking.id),
        driverProfileId: String(trip?.driverProfileId ?? 0),
        driverName: (trip as { driverProfile?: { user?: { name?: string } } } | undefined)?.driverProfile?.user?.name ?? "Driver",
        pickupLat: String(booking.pickupLat ?? 0),
        pickupLng: String(booking.pickupLng ?? 0),
      },
    });
  }

  function renderBooking(booking: Booking) {
    const statusColor = STATUS_COLORS[booking.status] ?? colors.mutedForeground;
    const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;
    const trip = booking.trip;
    const isActive = ACTIVE_STATUSES.has(booking.status);
    const isTrackable = TRACKABLE_STATUSES.has(booking.status);

    const driverProfile = (trip as { driverProfile?: { userId?: number; user?: { name?: string }; vehicle?: { make?: string; model?: string; color?: string; licensePlate?: string }; rating?: number } } | undefined)?.driverProfile;
    const driverName = driverProfile?.user?.name;
    const vehicle = driverProfile?.vehicle;
    const rating = driverProfile?.rating;

    const isCompleted = booking.status === "completed";
    const hasDriverUserId = !!driverProfile?.userId;
    const showRatePrompt = isCompleted && hasDriverUserId && !ratedBookingIds.has(booking.id);

    return (
      <Pressable
        key={booking.id}
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: isActive ? `${statusColor}55` : colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_500Medium" }]}>
              {statusLabel}
            </Text>
          </View>
          <Text style={[styles.fareText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            ₹{booking.fare.toFixed(0)}
          </Text>
        </View>

        {driverName && (
          <View style={styles.driverRow}>
            <View style={[styles.driverAvatar, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.driverInitials, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {driverName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
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
            </View>
            {rating != null && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#facc15" />
                <Text style={[styles.ratingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { borderColor: colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Pickup</Text>
              <Text
                style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {booking.pickupAddress ?? trip?.originAddress ?? "—"}
              </Text>
            </View>
          </View>
          <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.destructive, borderColor: colors.destructive }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Drop-off</Text>
              <Text
                style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {booking.dropoffAddress ?? trip?.destAddress ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {trip && (
          <View style={styles.tripMeta}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={[styles.tripMetaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {new Date(trip.departureTime).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text style={[styles.tripMetaDot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.tripMetaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              ₹{trip.farePerSeat}/seat
            </Text>
          </View>
        )}

        {booking.boardingCode && (
          <View style={[styles.boardingCodeBox, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.boardingCodeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Boarding code:
            </Text>
            <Text style={[styles.boardingCode, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {booking.boardingCode}
            </Text>
          </View>
        )}

        {isTrackable && (
          <Pressable
            style={({ pressed }) => [
              styles.trackBtn,
              { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44`, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handleTrack(booking)}
          >
            <Feather name="navigation" size={15} color={colors.primary} />
            <Text style={[styles.trackBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              Track Driver
            </Text>
          </Pressable>
        )}

        {CANCELLABLE_STATUSES.has(booking.status) && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { borderColor: colors.destructive, opacity: pressed || cancelBookingMutation.isPending ? 0.7 : 1 },
            ]}
            onPress={() => handleCancel(booking)}
            disabled={cancelBookingMutation.isPending}
          >
            <Feather name="x-circle" size={15} color={colors.destructive} />
            <Text style={[styles.cancelBtnText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
              Cancel Booking
            </Text>
          </Pressable>
        )}

        {showRatePrompt && (
          <Pressable
            style={({ pressed }) => [
              styles.rateBtn,
              { backgroundColor: "#facc1518", borderColor: "#facc1555", opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => openRatingModal(booking)}
          >
            <Ionicons name="star-outline" size={15} color="#facc15" />
            <Text style={[styles.rateBtnText, { color: "#b59000", fontFamily: "Inter_600SemiBold" }]}>
              Rate Your Ride
            </Text>
          </Pressable>
        )}

        <Text style={[styles.dateText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Booked{" "}
          {new Date(booking.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          My Bookings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Loading…
            </Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              No bookings yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Book a ride to get started
            </Text>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Active
                </Text>
                {active.map(renderBooking)}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: active.length > 0 ? 8 : 0 }]}>
                  Past
                </Text>
                {past.map(renderBooking)}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={ratingModal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRatingModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeRatingModal}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Rate Your Ride
            </Text>
            {ratingModal && (
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                How was your trip with {ratingModal.driverName}?
              </Text>
            )}

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStarScore(n);
                  }}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={n <= starScore ? "star" : "star-outline"}
                    size={36}
                    color={n <= starScore ? "#facc15" : colors.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>

            {starScore > 0 && (
              <Text style={[styles.scoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {["", "Poor", "Fair", "Good", "Great", "Excellent"][starScore]}
              </Text>
            )}

            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholder="Add a comment (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={300}
            />

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || createRatingMutation.isPending ? 0.75 : 1 },
              ]}
              onPress={submitRating}
              disabled={createRatingMutation.isPending}
            >
              <Text style={[styles.submitBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                {createRatingMutation.isPending ? "Submitting…" : "Submit Rating"}
              </Text>
            </Pressable>

            <Pressable onPress={closeRatingModal} style={styles.skipBtn}>
              <Text style={[styles.skipBtnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Skip for now
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22 },
  content: {
    padding: 16,
    gap: 0,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: { fontSize: 12 },
  fareText: { fontSize: 20 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitials: { fontSize: 14 },
  driverName: { fontSize: 14 },
  vehicleText: { fontSize: 12, marginTop: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13 },
  divider: { height: 1 },
  routeSection: { gap: 0 },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: "transparent",
    marginTop: 4,
  },
  routeConnector: {
    width: 2,
    height: 10,
    marginLeft: 4,
  },
  routeLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  routeAddr: { flex: 1, fontSize: 13, marginTop: 1 },
  tripMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripMetaText: { fontSize: 12 },
  tripMetaDot: { fontSize: 12 },
  boardingCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  boardingCodeLabel: { fontSize: 12 },
  boardingCode: { fontSize: 16, letterSpacing: 2 },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
  trackBtnText: { fontSize: 14 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
  cancelBtnText: { fontSize: 14 },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
  rateBtnText: { fontSize: 14 },
  dateText: { fontSize: 12 },
  emptyState: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    gap: 16,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: -6,
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  starBtn: {
    padding: 4,
  },
  scoreLabel: {
    fontSize: 14,
    marginTop: -8,
  },
  commentInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: "top",
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
  },
  skipBtn: {
    paddingVertical: 4,
  },
  skipBtnText: {
    fontSize: 13,
  },
});
