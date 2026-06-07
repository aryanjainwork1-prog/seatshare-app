import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useListBookings } from "@workspace/api-client-react";
import type { Booking } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STATUS_COLORS: Record<string, string> = {
  pending: "#d97706",
  accepted: "#0080ff",
  completed: "#16a34a",
  rejected: "#dc2626",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Confirmed",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ACTIVE_STATUSES = new Set(["pending", "accepted"]);

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, refetch, isRefetching } = useListBookings(
    { passengerId: user?.id, limit: 50 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!user?.id } as any },
  );

  const bookings = data?.data ?? [];
  const active = bookings.filter((b) => ACTIVE_STATUSES.has(b.status));
  const past = bookings.filter((b) => !ACTIVE_STATUSES.has(b.status));

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
    const isAccepted = booking.status === "accepted";

    const driverProfile = (trip as { driverProfile?: { user?: { name?: string }; vehicle?: { make?: string; model?: string; color?: string; licensePlate?: string }; rating?: number } } | undefined)?.driverProfile;
    const driverName = driverProfile?.user?.name;
    const vehicle = driverProfile?.vehicle;
    const rating = driverProfile?.rating;

    return (
      <View
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

        {isAccepted && (
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

        <Text style={[styles.dateText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Booked{" "}
          {new Date(booking.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
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
  dateText: { fontSize: 12 },
  emptyState: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
