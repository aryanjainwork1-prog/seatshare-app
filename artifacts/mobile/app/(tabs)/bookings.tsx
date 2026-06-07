import { Feather } from "@expo/vector-icons";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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

  function renderBooking(booking: Booking) {
    const statusColor = STATUS_COLORS[booking.status] ?? colors.mutedForeground;
    const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;
    const trip = booking.trip;

    return (
      <View
        key={booking.id}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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

        {trip && (
          <View style={styles.routeSection}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { borderColor: colors.success }]} />
              <Text
                style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {trip.originAddress}
              </Text>
            </View>
            <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: colors.destructive, borderColor: colors.destructive }]} />
              <Text
                style={[styles.routeAddr, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {trip.destAddress}
              </Text>
            </View>
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

        <Text style={[styles.dateText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
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
              Loading...
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
          bookings.map(renderBooking)
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
    gap: 12,
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
  routeSection: { gap: 0 },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  routeConnector: {
    width: 2,
    height: 10,
    marginLeft: 4,
  },
  routeAddr: { flex: 1, fontSize: 13 },
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
  dateText: { fontSize: 12 },
  emptyState: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
