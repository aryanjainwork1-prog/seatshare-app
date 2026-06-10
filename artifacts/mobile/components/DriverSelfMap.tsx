import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface DriverSelfMapProps {
  lat: number;
  lng: number;
  isOnline: boolean;
}

export function DriverSelfMap({ lat, lng, isOnline }: DriverSelfMapProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.mutedForeground }]} />
        <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {isOnline ? "Broadcasting location" : "Location paused"}
        </Text>
      </View>

      <View style={[styles.coordCard, { backgroundColor: colors.muted }]}>
        <View style={[styles.iconBadge, { backgroundColor: `${colors.primary}22` }]}>
          <Feather name="navigation" size={18} color={colors.primary} />
        </View>
        <View style={styles.coordValues}>
          <Text style={[styles.coordLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Your current position
          </Text>
          <Text style={[styles.coordValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
          </Text>
        </View>
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
  coordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 12,
    borderRadius: 12,
    padding: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  coordValues: { flex: 1 },
  coordLabel: { fontSize: 11, marginBottom: 3 },
  coordValue: { fontSize: 14 },
});
