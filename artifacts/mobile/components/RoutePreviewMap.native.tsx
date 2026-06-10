import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface RoutePreviewMapProps {
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  fromLabel?: string;
  toLabel?: string;
  matches?: MatchResult[];
}

export function RoutePreviewMap({
  fromCoords,
  toCoords,
  fromLabel = "Pickup",
  toLabel = "Drop-off",
  matches,
}: RoutePreviewMapProps) {
  const colors = useColors();

  const midLat = (fromCoords.lat + toCoords.lat) / 2;
  const midLng = (fromCoords.lng + toCoords.lng) / 2;
  const latDelta = Math.abs(fromCoords.lat - toCoords.lat) * 2.2 + 0.02;
  const lngDelta = Math.abs(fromCoords.lng - toCoords.lng) * 2.2 + 0.02;

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

      <MapView
        style={styles.map}
        region={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Polyline
          coordinates={[
            { latitude: fromCoords.lat, longitude: fromCoords.lng },
            { latitude: toCoords.lat, longitude: toCoords.lng },
          ]}
          strokeColor="#6366f1"
          strokeWidth={3}
        />
        <Marker
          coordinate={{ latitude: fromCoords.lat, longitude: fromCoords.lng }}
          title={fromLabel}
          pinColor="#16a34a"
        />
        <Marker
          coordinate={{ latitude: toCoords.lat, longitude: toCoords.lng }}
          title={toLabel}
          pinColor="#dc2626"
        />

        {matches?.map((m) => {
          const driverLat = m.driverProfile?.currentLat ?? m.trip.originLat;
          const driverLng = m.driverProfile?.currentLng ?? m.trip.originLng;
          const driverName = m.driverProfile?.user?.name ?? "Driver";
          const eta = m.etaMinutes !== undefined ? ` · ${m.etaMinutes} min` : "";
          return (
            <Marker
              key={m.trip.id}
              coordinate={{ latitude: driverLat, longitude: driverLng }}
              title={driverName}
              description={`₹${m.estimatedFare.toFixed(0)}/seat${eta}`}
              pinColor="#6366f1"
            />
          );
        })}
      </MapView>
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
  map: {
    width: "100%",
    height: 180,
  },
});
