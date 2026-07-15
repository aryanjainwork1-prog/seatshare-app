import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetRideRequest, getGetRideRequestQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending — waiting for dispatch",
  approved: "Approved — assigning your ride",
  assigned: "Driver assigned!",
  rejected: "Request declined",
  completed: "Ride completed",
  cancelled: "Request cancelled",
};

export default function RideRequestWaitingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);

  const { data: request, isLoading } = useGetRideRequest(requestId, {
    query: {
      queryKey: getGetRideRequestQueryKey(requestId),
      enabled: Number.isFinite(requestId),
      // Poll for live status updates from the dispatch team
      refetchInterval: 5000,
    },
  });

  const status = request?.status ?? "pending";
  const isTerminal = ["rejected", "completed", "cancelled"].includes(status);
  const steps = [
    { label: "Request Submitted", done: true },
    { label: "Reviewing Available Drivers", done: status !== "pending" },
    { label: "Assigning Your Ride", done: status === "assigned" || status === "completed" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <View style={styles.content}>
        <View style={[styles.spinnerWrap, { backgroundColor: `${colors.primary}18` }]}>
          {isTerminal ? (
            <Feather
              name={status === "completed" || status === "assigned" ? "check-circle" : "x-circle"}
              size={36}
              color={status === "rejected" || status === "cancelled" ? colors.destructive : colors.success}
            />
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>

        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {status === "assigned"
            ? "Your ride is assigned!"
            : isTerminal
              ? STATUS_LABELS[status]
              : "Finding the best ride for you..."}
        </Text>

        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Our dispatch team is reviewing available drivers.
        </Text>

        {!isTerminal && (
          <View style={[styles.waitBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.waitBadgeText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              Approximately 1–2 minutes
            </Text>
          </View>
        )}

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {steps.map((step, i) => (
            <View key={step.label} style={[styles.stepRow, i < steps.length - 1 && styles.stepRowBorder, i < steps.length - 1 && { borderBottomColor: colors.border }]}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: step.done ? `${colors.success}22` : `${colors.mutedForeground}15`,
                  },
                ]}
              >
                {step.done ? (
                  <Feather name="check" size={13} color={colors.success} />
                ) : (
                  <ActivityIndicator size="small" color={colors.mutedForeground} style={{ transform: [{ scale: 0.7 }] }} />
                )}
              </View>
              <Text
                style={[
                  styles.stepText,
                  {
                    color: step.done ? colors.foreground : colors.mutedForeground,
                    fontFamily: step.done ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.statusRow, { borderColor: colors.border }]}>
          <Text style={[styles.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Status
          </Text>
          <Text style={[styles.statusValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {isLoading && !request ? "Loading…" : (STATUS_LABELS[status] ?? status)}
          </Text>
        </View>

        {request && (
          <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { borderColor: colors.success, borderWidth: 2 }]} />
              <Text style={[styles.routeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                {request.pickupAddress}
              </Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.routeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                {request.dropoffAddress}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  content: { flex: 1, alignItems: "center", paddingTop: 24, gap: 14 },
  spinnerWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: 22, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  waitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  waitBadgeText: { fontSize: 13 },
  progressCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepRowBorder: { borderBottomWidth: 1 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 14, flex: 1 },
  statusRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  statusLabel: { fontSize: 13 },
  statusValue: { fontSize: 14 },
  routeCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 10, marginLeft: 4 },
  routeText: { fontSize: 14, flex: 1 },
});
