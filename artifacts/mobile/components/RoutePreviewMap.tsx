import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface RoutePreviewMapProps {
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  fromLabel?: string;
  toLabel?: string;
  matches?: MatchResult[];
  selectedMatchId?: number | null;
  onDeselect?: () => void;
}

export function RoutePreviewMap({
  fromCoords,
  toCoords,
  fromLabel = "Pickup",
  toLabel = "Drop-off",
  matches,
  selectedMatchId,
}: RoutePreviewMapProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.labelRow}>
        <View style={styles.labelItem}>
          <View style={[styles.dot, styles.dotFrom, { borderColor: colors.success }]} />
          <Text
            style={[styles.labelText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            numberOfLines={1}
          >
            {fromLabel}
          </Text>
        </View>
        <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
        <View style={styles.labelItem}>
          <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
          <Text
            style={[styles.labelText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            numberOfLines={1}
          >
            {toLabel}
          </Text>
        </View>
      </View>

      {matches && matches.length > 0 && (
        <View style={[styles.matchesBanner, { backgroundColor: `${colors.primary}12`, borderBottomColor: colors.border }]}>
          <Feather name="truck" size={12} color={colors.primary} />
          <Text style={[styles.matchesBannerText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            {matches.length} matched driver{matches.length === 1 ? "" : "s"}
          </Text>
        </View>
      )}

      {selectedMatchId != null && (() => {
        const sel = matches?.find((m) => m.trip.id === selectedMatchId);
        if (!sel) return null;
        const driverName = sel.driverProfile?.user?.name ?? "Driver";
        return (
          <View style={[styles.pickupBanner, { backgroundColor: `#f59e0b18`, borderBottomColor: `#f59e0b44` }]}>
            <Feather name="map-pin" size={12} color="#f59e0b" />
            <Text style={[styles.matchesBannerText, { color: "#f59e0b", fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
              {driverName}'s pickup: {sel.trip.originAddress ?? `${sel.trip.originLat.toFixed(4)}°, ${sel.trip.originLng.toFixed(4)}°`}
            </Text>
          </View>
        );
      })()}

      <View style={[styles.mapPlaceholder, { backgroundColor: `${colors.mutedForeground}10` }]}>
        <View style={styles.coordsRow}>
          <View style={styles.coordItem}>
            <View style={[styles.pinBadge, { backgroundColor: `${colors.success}20` }]}>
              <Feather name="circle" size={14} color={colors.success} />
            </View>
            <View>
              <Text style={[styles.coordLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {fromLabel}
              </Text>
              <Text style={[styles.coordValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {fromCoords.lat.toFixed(4)}°, {fromCoords.lng.toFixed(4)}°
              </Text>
            </View>
          </View>

          <View style={[styles.connector, { backgroundColor: colors.border }]} />

          <View style={styles.coordItem}>
            <View style={[styles.pinBadge, { backgroundColor: `${colors.destructive}20` }]}>
              <Feather name="map-pin" size={14} color={colors.destructive} />
            </View>
            <View>
              <Text style={[styles.coordLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {toLabel}
              </Text>
              <Text style={[styles.coordValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {toCoords.lat.toFixed(4)}°, {toCoords.lng.toFixed(4)}°
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  labelItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  dotFrom: {
    backgroundColor: "transparent",
    borderWidth: 2,
  },
  labelText: {
    fontSize: 12,
    flex: 1,
  },
  mapPlaceholder: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coordItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pinBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  coordLabel: { fontSize: 11 },
  coordValue: { fontSize: 12, marginTop: 2 },
  connector: {
    width: 1,
    height: 32,
  },
  matchesBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  matchesBannerText: { fontSize: 12 },
  pickupBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});
