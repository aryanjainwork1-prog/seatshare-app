import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetDriverProfile } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { LiveDriverMap } from "@/components/LiveDriverMap";

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAge(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m ago` : `${minutes}m ${seconds}s ago`;
}

export default function TrackingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const params = useLocalSearchParams<{
    bookingId: string;
    driverProfileId: string;
    driverName: string;
    pickupLat: string;
    pickupLng: string;
  }>();

  const driverProfileId = parseInt(params.driverProfileId ?? "0", 10);
  const driverName = params.driverName ?? "Driver";
  const pickupLat = parseFloat(params.pickupLat ?? "0");
  const pickupLng = parseFloat(params.pickupLng ?? "0");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const { data: profile, refetch: refetchProfile } = useGetDriverProfile(driverProfileId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!driverProfileId, refetchInterval: 10000 } as any,
  });

  // Immediately refetch when the passenger returns from the background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refetchProfile();
      }
    });
    return () => subscription.remove();
  }, [refetchProfile]);

  const isOnline = profile?.isOnline;
  const driverUserId = profile?.userId ?? null;

  // WebSocket real-time location (native only); falls back to REST polling
  const { location: wsLocation, isConnected } = useDriverLocation({
    driverUserId,
    accessToken,
    enabled: !!driverUserId && Platform.OS !== "web",
  });

  // Use WS location if available, otherwise fall back to profile's last known coords
  const driverLat = wsLocation?.lat ?? profile?.currentLat ?? null;
  const driverLng = wsLocation?.lng ?? profile?.currentLng ?? null;
  // locationUpdatedAt comes from the WS message (or falls back to the DB field via profile)
  const locationUpdatedAt =
    wsLocation?.updatedAt != null
      ? new Date(wsLocation.updatedAt).getTime()
      : profile?.locationUpdatedAt != null
        ? new Date(profile.locationUpdatedAt).getTime()
        : null;

  // Tick every second to keep the "Updated X ago" label live
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Staleness is derived from the actual location event timestamp, not poll time.
  // No false stale flash on initial load — stays false until the first location arrives.
  const ageSinceUpdateMs = locationUpdatedAt !== null ? now - locationUpdatedAt : 0;
  const isStale = locationUpdatedAt !== null && ageSinceUpdateMs > STALE_THRESHOLD_MS;

  const distanceKm =
    driverLat != null && driverLng != null && pickupLat && pickupLng
      ? haversineKm(driverLat, driverLng, pickupLat, pickupLng)
      : null;

  const etaMin = distanceKm != null ? Math.round((distanceKm / 30) * 60) : null;

  const initials = driverName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text
          style={[
            styles.topBarTitle,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          Track Ride
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.liveCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.liveHeader}>
            <View style={styles.liveIndicator}>
              <Animated.View
                style={[
                  styles.livePulse,
                  {
                    backgroundColor: isStale
                      ? `${colors.warning}44`
                      : `${colors.success}44`,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: isStale ? colors.warning : colors.success },
                ]}
              />
            </View>
            <Text
              style={[
                styles.liveText,
                {
                  color: isStale ? colors.warning : colors.success,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {isStale ? "WAITING" : "LIVE"}
            </Text>

            {isStale ? (
              <View
                style={[
                  styles.staleBadge,
                  {
                    backgroundColor: `${colors.warning}18`,
                    borderColor: `${colors.warning}40`,
                  },
                ]}
              >
                <Feather name="wifi-off" size={11} color={colors.warning} />
                <Text
                  style={[
                    styles.staleBadgeText,
                    { color: colors.warning, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Waiting for location…
                </Text>
              </View>
            ) : locationUpdatedAt !== null ? (
              <Text
                style={[
                  styles.updatedText,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
              >
                Updated {formatAge(ageSinceUpdateMs)}
              </Text>
            ) : isConnected ? (
              <Text
                style={[
                  styles.updatedText,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
              >
                Real-time
              </Text>
            ) : null}
          </View>

          <View style={[styles.driverRow, { borderTopColor: colors.border }]}>
            <View
              style={[
                styles.driverAvatar,
                { backgroundColor: `${colors.primary}33` },
              ]}
            >
              <Text
                style={[
                  styles.driverInitials,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  styles.driverName,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {driverName}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isOnline
                        ? colors.success
                        : colors.mutedForeground,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {isOnline ? "Online · En route to you" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {driverLat != null && driverLng != null && pickupLat && pickupLng ? (
          <LiveDriverMap
            driverLat={driverLat}
            driverLng={driverLng}
            pickupLat={pickupLat}
            pickupLng={pickupLng}
            isConnected={isConnected}
            updatedAt={wsLocation?.updatedAt ?? null}
          />
        ) : (
          <View
            style={[
              styles.waitCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="radio" size={32} color={colors.mutedForeground} />
            <Text
              style={[
                styles.waitTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Waiting for driver location
            </Text>
            <Text
              style={[
                styles.waitSub,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Location updates every 5 seconds once your driver goes online.
            </Text>
          </View>
        )}

        <View
          style={[
            styles.noteCard,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text
            style={[
              styles.noteText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Location refreshes automatically every 5 seconds. Keep this screen open while
            waiting for your driver.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  topBarTitle: { fontSize: 17 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  liveCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liveIndicator: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulse: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: { fontSize: 13, letterSpacing: 1 },
  updatedText: { fontSize: 12, marginLeft: "auto" },
  staleBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  staleBadgeText: { fontSize: 12 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitials: { fontSize: 18 },
  driverName: { fontSize: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13 },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  locationTitle: { fontSize: 15 },
  coordsRow: { flexDirection: "row", gap: 10 },
  coordBox: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  coordLabel: { fontSize: 11 },
  coordValue: { fontSize: 16 },
  etaRow: { flexDirection: "row", gap: 10 },
  etaBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  etaValue: { fontSize: 18 },
  etaLabel: { fontSize: 12 },
  waitCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  waitTitle: { fontSize: 16 },
  waitSub: { fontSize: 14, textAlign: "center" },
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  noteText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
