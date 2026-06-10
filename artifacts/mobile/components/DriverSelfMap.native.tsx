import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { useColors } from "@/hooks/useColors";

const AnimatedMarker = Animated.createAnimatedComponent(Marker);

const ANIM_DURATION = 900;

interface DriverSelfMapProps {
  lat: number;
  lng: number;
  isOnline: boolean;
}

export function DriverSelfMap({ lat, lng, isOnline }: DriverSelfMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);

  const animCoord = useRef(new Animated.ValueXY({ x: lat, y: lng }));

  const markerCoord = useRef({
    latitude: animCoord.current.x as unknown as number,
    longitude: animCoord.current.y as unknown as number,
  });

  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    Animated.timing(animCoord.current, {
      toValue: { x: lat, y: lng },
      duration: ANIM_DURATION,
      useNativeDriver: false,
    }).start();

    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      ANIM_DURATION,
    );
  }, [lat, lng]);

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.mutedForeground }]} />
        <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {isOnline ? "Broadcasting location" : "Location paused"}
        </Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <AnimatedMarker
          coordinate={markerCoord.current}
          title="You"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.markerOuter, { borderColor: colors.primary }]}>
            <View style={[styles.markerInner, { backgroundColor: colors.primary }]} />
          </View>
        </AnimatedMarker>
      </MapView>

      <View style={[styles.coordBar, { borderTopColor: colors.border }]}>
        <Feather name="navigation" size={13} color={colors.mutedForeground} />
        <Text style={[styles.coordText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
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
  map: {
    width: "100%",
    height: 200,
  },
  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  markerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  coordBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  coordText: { fontSize: 12 },
});
