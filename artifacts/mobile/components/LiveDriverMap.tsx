import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { etaMinutes, haversineKm } from "@/hooks/useDriverLocation";

interface LiveDriverMapProps {
  driverLat: number;
  driverLng: number;
  pickupLat: number;
  pickupLng: number;
  isConnected: boolean;
  updatedAt?: string | null;
}

export function LiveDriverMap({
  driverLat,
  driverLng,
  pickupLat,
  pickupLng,
  isConnected,
  updatedAt,
}: LiveDriverMapProps) {
  const colors = useColors();
  const distKm = haversineKm(driverLat, driverLng, pickupLat, pickupLng);
  const eta = etaMinutes(distKm);
  const lastUpdated = updatedAt ? new Date(updatedAt) : null;
  const secondsAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isConnected ? colors.success : colors.mutedForeground }]} />
        <Text style={[styles.statusText, { color: isConnected ? colors.success : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {isConnected ? "Live tracking" : "Connecting…"}
        </Text>
      </View>

      <View style={[styles.coordCard, { backgroundColor: colors.card }]}>
        <View style={styles.coordRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="navigation" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.coordLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Driver location
            </Text>
            <Text style={[styles.coordValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {driverLat.toFixed(4)}°N, {driverLng.toFixed(4)}°E
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.coordRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${colors.success}22` }]}>
            <Feather name="map-pin" size={16} color={colors.success} />
          </View>
          <View>
            <Text style={[styles.coordLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your pickup
            </Text>
            <Text style={[styles.coordValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {pickupLat.toFixed(4)}°N, {pickupLng.toFixed(4)}°E
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.etaBanner, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
        <Feather name="clock" size={15} color={colors.primary} />
        <Text style={[styles.etaText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
          ~{eta} min away
        </Text>
        <Text style={[styles.etaDist, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          ({distKm.toFixed(1)} km)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { fontSize: 13 },
  updatedText: { fontSize: 12 },
  coordCard: {
    margin: 12,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  coordLabel: { fontSize: 11 },
  coordValue: { fontSize: 13 },
  divider: { height: 1 },
  etaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  etaText: { fontSize: 15 },
  etaDist: { fontSize: 13 },
});
