import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface Props {
  drivers: MatchResult[];
  userLat: number;
  userLng: number;
}

export function NearbyDriversMap({ drivers, userLat, userLng }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Feather name="truck" size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
          {drivers.length > 0
            ? `${drivers.length} driver${drivers.length === 1 ? "" : "s"} nearby`
            : "Finding drivers near you…"}
        </Text>
      </View>
      <MapView
        style={styles.map}
        region={{
          latitude: userLat,
          longitude: userLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Marker
          coordinate={{ latitude: userLat, longitude: userLng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.userDot, { backgroundColor: colors.primary, borderColor: "#fff" }]} />
        </Marker>

        {drivers.map((item) => {
          const driverName = item.driverProfile?.user?.name ?? "Driver";
          const vehicle = item.vehicle;
          return (
            <Marker
              key={item.trip.id}
              coordinate={{
                latitude: item.trip.originLat,
                longitude: item.trip.originLng,
              }}
            >
              <View
                style={[
                  styles.driverMarker,
                  { backgroundColor: colors.card, borderColor: colors.primary },
                ]}
              >
                <Feather name="truck" size={12} color={colors.primary} />
              </View>
              <Callout tooltip={false}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{driverName}</Text>
                  {vehicle && (
                    <Text style={styles.calloutSub}>
                      {vehicle.make} {vehicle.model} · {vehicle.capacity} seats
                    </Text>
                  )}
                  {item.etaMinutes !== undefined && (
                    <Text style={styles.calloutEta}>{item.etaMinutes} min ETA</Text>
                  )}
                  <Text style={styles.calloutFare}>₹{item.estimatedFare.toFixed(0)}/seat</Text>
                </View>
              </Callout>
            </Marker>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  map: { width: "100%", height: 200 },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  driverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  callout: { padding: 8, minWidth: 140, maxWidth: 200 },
  calloutName: { fontSize: 13, fontWeight: "600", marginBottom: 2, color: "#111" },
  calloutSub: { fontSize: 12, color: "#555", marginBottom: 2 },
  calloutEta: { fontSize: 12, color: "#16a34a", fontWeight: "600", marginBottom: 1 },
  calloutFare: { fontSize: 12, color: "#555" },
});
