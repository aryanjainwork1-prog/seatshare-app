import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

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

// Native map component — only rendered when Platform.OS !== "web"
let MapView: React.ComponentType<{
  style?: object;
  region?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  children?: React.ReactNode;
}> | null = null;
let Marker: React.ComponentType<{
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  children?: React.ReactNode;
}> | null = null;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch {
    // react-native-maps not available
  }
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

  if (Platform.OS !== "web" && MapView && Marker) {
    const midLat = (driverLat + pickupLat) / 2;
    const midLng = (driverLng + pickupLng) / 2;
    const latDelta = Math.abs(driverLat - pickupLat) * 2.5 + 0.01;
    const lngDelta = Math.abs(driverLng - pickupLng) * 2.5 + 0.01;

    return (
      <View style={[styles.container, { borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isConnected ? colors.success : colors.mutedForeground }]} />
          <Text style={[styles.statusText, { color: isConnected ? colors.success : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {isConnected ? "Live tracking" : "Connecting…"}
          </Text>
          {secondsAgo !== null && (
            <Text style={[styles.updatedText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · {secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
            </Text>
          )}
        </View>

        <MapView
          style={styles.map}
          region={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          }}
        >
          <Marker
            coordinate={{ latitude: driverLat, longitude: driverLng }}
            title="Driver"
            pinColor="#0080ff"
          />
          <Marker
            coordinate={{ latitude: pickupLat, longitude: pickupLng }}
            title="Your pickup"
            pinColor="#16a34a"
          />
        </MapView>

        <ETABanner eta={eta} distKm={distKm} colors={colors} />
      </View>
    );
  }

  // Web fallback: coordinate card
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

      <ETABanner eta={eta} distKm={distKm} colors={colors} />
    </View>
  );
}

function ETABanner({
  eta,
  distKm,
  colors,
}: {
  eta: number;
  distKm: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.etaBanner, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
      <Feather name="clock" size={15} color={colors.primary} />
      <Text style={[styles.etaText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
        ~{eta} min away
      </Text>
      <Text style={[styles.etaDist, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        ({distKm.toFixed(1)} km)
      </Text>
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
  map: {
    width: "100%",
    height: 220,
  },
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
