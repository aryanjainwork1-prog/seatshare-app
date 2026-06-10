import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

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

const AnimatedMarker = Animated.createAnimatedComponent(Marker);

const ANIM_DURATION_MS = 900;

export function LiveDriverMap({
  driverLat,
  driverLng,
  pickupLat,
  pickupLng,
  isConnected,
  updatedAt,
}: LiveDriverMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);

  const distKm = haversineKm(driverLat, driverLng, pickupLat, pickupLng);
  const eta = etaMinutes(distKm);
  const lastUpdated = updatedAt ? new Date(updatedAt) : null;
  const secondsAgo = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    : null;

  // Animated coordinate for the driver marker — updates smoothly without re-centering the map
  const animCoord = useRef(new Animated.ValueXY({ x: driverLat, y: driverLng }));
  const markerCoord = useRef({
    latitude: animCoord.current.x as unknown as number,
    longitude: animCoord.current.y as unknown as number,
  });

  // Track whether first real location has been received so we can fit the map once
  const hasFit = useRef(false);

  // On first mount, set the initial region to fit both pins
  useEffect(() => {
    const midLat = (driverLat + pickupLat) / 2;
    const midLng = (driverLng + pickupLng) / 2;
    const latDelta = Math.max(Math.abs(driverLat - pickupLat) * 2.5, 0.01);
    const lngDelta = Math.max(Math.abs(driverLng - pickupLng) * 2.5, 0.01);
    mapRef.current?.animateToRegion(
      { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta },
      400,
    );
    hasFit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the driver's position changes, smoothly animate the marker in place.
  // Re-fit the viewport only on the very first real location received after connecting.
  useEffect(() => {
    Animated.timing(animCoord.current, {
      toValue: { x: driverLat, y: driverLng },
      duration: ANIM_DURATION_MS,
      useNativeDriver: false,
    }).start();

    if (!hasFit.current) {
      const midLat = (driverLat + pickupLat) / 2;
      const midLng = (driverLng + pickupLng) / 2;
      const latDelta = Math.max(Math.abs(driverLat - pickupLat) * 2.5, 0.01);
      const lngDelta = Math.max(Math.abs(driverLng - pickupLng) * 2.5, 0.01);
      mapRef.current?.animateToRegion(
        { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta },
        600,
      );
      hasFit.current = true;
    }
  }, [driverLat, driverLng, pickupLat, pickupLng]);

  const midLat = (driverLat + pickupLat) / 2;
  const midLng = (driverLng + pickupLng) / 2;
  const latDelta = Math.max(Math.abs(driverLat - pickupLat) * 2.5, 0.01);
  const lngDelta = Math.max(Math.abs(driverLng - pickupLng) * 2.5, 0.01);

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: isConnected ? colors.success : colors.mutedForeground },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            {
              color: isConnected ? colors.success : colors.mutedForeground,
              fontFamily: "Inter_500Medium",
            },
          ]}
        >
          {isConnected ? "Live tracking" : "Connecting…"}
        </Text>
        {secondsAgo !== null && (
          <Text
            style={[
              styles.updatedText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            ·{" "}
            {secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
          </Text>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
      >
        {/* Driver pin — animates smoothly to new position */}
        <AnimatedMarker
          coordinate={markerCoord.current}
          title="Driver"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={[styles.driverMarker, { backgroundColor: colors.primary, borderColor: "#fff" }]}>
            <Feather name="navigation" size={14} color="#fff" />
          </View>
        </AnimatedMarker>

        {/* Pickup pin — static */}
        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          title="Your pickup"
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <View style={styles.pickupMarkerWrap}>
            <View style={[styles.pickupMarker, { backgroundColor: colors.success, borderColor: "#fff" }]}>
              <Feather name="map-pin" size={14} color="#fff" />
            </View>
            <View style={[styles.pickupStem, { backgroundColor: colors.success }]} />
          </View>
        </Marker>
      </MapView>

      <View
        style={[
          styles.etaBanner,
          {
            backgroundColor: `${colors.primary}15`,
            borderColor: `${colors.primary}30`,
          },
        ]}
      >
        <Feather name="clock" size={15} color={colors.primary} />
        <Text
          style={[styles.etaText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}
        >
          ~{eta} min away
        </Text>
        <Text
          style={[
            styles.etaDist,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
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
    height: 240,
  },
  driverMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  pickupMarkerWrap: {
    alignItems: "center",
  },
  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  pickupStem: {
    width: 3,
    height: 8,
    borderRadius: 2,
  },
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
