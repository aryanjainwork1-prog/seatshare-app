import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useRouteGeometry } from "@/hooks/useRouteGeometry";

interface RoutePreviewMapProps {
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  fromLabel?: string;
  toLabel?: string;
  matches?: MatchResult[];
  selectedMatchId?: number | null;
  onDeselect?: () => void;
}

function boundingRegion(
  points: { lat: number; lng: number }[],
  paddingFactor = 2.0,
  minDelta = 0.02,
) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latDelta = Math.max((maxLat - minLat) * paddingFactor, minDelta);
  const lngDelta = Math.max((maxLng - minLng) * paddingFactor, minDelta);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export function RoutePreviewMap({
  fromCoords,
  toCoords,
  fromLabel = "Pickup",
  toLabel = "Drop-off",
  matches,
  selectedMatchId,
  onDeselect,
}: RoutePreviewMapProps) {
  const colors = useColors();
  const { coordinates: roadCoords } = useRouteGeometry(fromCoords, toCoords);
  const mapRef = useRef<MapView>(null);

  const defaultRegion = boundingRegion([fromCoords, toCoords], 2.2);

  const routePolylineCoords =
    roadCoords && roadCoords.length >= 2
      ? roadCoords.map((c) => ({ latitude: c.lat, longitude: c.lng }))
      : [
          { latitude: fromCoords.lat, longitude: fromCoords.lng },
          { latitude: toCoords.lat, longitude: toCoords.lng },
        ];

  useEffect(() => {
    if (selectedMatchId == null) {
      mapRef.current?.animateToRegion(defaultRegion, 400);
      return;
    }
    const match = matches?.find((m) => m.trip.id === selectedMatchId);
    if (!match) return;
    const driverPickupLat = match.trip.originLat;
    const driverPickupLng = match.trip.originLng;
    const region = boundingRegion(
      [fromCoords, { lat: driverPickupLat, lng: driverPickupLng }],
      2.4,
    );
    mapRef.current?.animateToRegion(region, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId]);

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
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={() => onDeselect?.()}
      >
        <Polyline
          coordinates={routePolylineCoords}
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
          const isSelected = selectedMatchId === m.trip.id;
          return (
            <React.Fragment key={m.trip.id}>
              <Polyline
                coordinates={[
                  { latitude: driverLat, longitude: driverLng },
                  { latitude: fromCoords.lat, longitude: fromCoords.lng },
                ]}
                strokeColor={isSelected ? "#f59e0b" : "#a78bfa"}
                strokeWidth={2}
                lineDashPattern={[8, 5]}
                zIndex={isSelected ? 2 : 1}
              />
              <Marker
                coordinate={{ latitude: driverLat, longitude: driverLng }}
                title={driverName}
                description={`₹${m.estimatedFare.toFixed(0)}/seat${eta}`}
                pinColor={isSelected ? "#f59e0b" : "#6366f1"}
                zIndex={isSelected ? 2 : 1}
              />
              {isSelected && (
                <Marker
                  coordinate={{ latitude: m.trip.originLat, longitude: m.trip.originLng }}
                  title={`${driverName}'s pickup`}
                  description={m.trip.originAddress ?? undefined}
                  pinColor="#f59e0b"
                  zIndex={3}
                />
              )}
            </React.Fragment>
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
