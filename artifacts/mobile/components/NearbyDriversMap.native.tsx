import { Feather } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface Props {
  drivers: MatchResult[];
  userLat: number;
  userLng: number;
}

function haversineEtaMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round((distKm / 30) * 60));
}

function getEta(item: MatchResult, userLat: number, userLng: number): number {
  if (item.etaMinutes !== undefined) return item.etaMinutes;
  const dLat = item.driverProfile?.currentLat ?? item.trip.originLat;
  const dLng = item.driverProfile?.currentLng ?? item.trip.originLng;
  return haversineEtaMinutes(dLat, dLng, userLat, userLng);
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < filled ? "star" : "star-outline"}
          size={12}
          color={i < filled ? "#f59e0b" : "#ccc"}
        />
      ))}
      <Text style={styles.ratingNum}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export function NearbyDriversMap({ drivers, userLat, userLng }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedDriver, setSelectedDriver] = useState<MatchResult | null>(null);

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
          const driverLat = item.driverProfile?.currentLat ?? item.trip.originLat;
          const driverLng = item.driverProfile?.currentLng ?? item.trip.originLng;
          return (
            <Marker
              key={item.trip.id}
              coordinate={{ latitude: driverLat, longitude: driverLng }}
              onPress={() => setSelectedDriver(item)}
            >
              <View
                style={[
                  styles.driverMarker,
                  { backgroundColor: colors.card, borderColor: colors.primary },
                ]}
              >
                <Feather name="truck" size={12} color={colors.primary} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <Modal
        visible={!!selectedDriver}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDriver(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedDriver(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 16,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />

            <Pressable style={styles.sheetClose} onPress={() => setSelectedDriver(null)}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>

            {selectedDriver && (() => {
              const d = selectedDriver;
              const driver = d.driverProfile?.user;
              const vehicle = d.vehicle;
              const eta = getEta(d, userLat, userLng);
              const initials = driver?.name
                ? driver.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
                : "?";

              return (
                <>
                  <View style={styles.sheetTop}>
                    <View style={[styles.sheetAvatar, { backgroundColor: `${colors.primary}22` }]}>
                      <Text style={[styles.sheetAvatarText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                        {initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {driver?.name ?? "Driver"}
                      </Text>
                      <RatingStars rating={d.driverProfile.rating} />
                      <Text style={[styles.sheetTrips, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {d.driverProfile.totalTrips} trips completed
                      </Text>
                    </View>
                    <View style={[styles.etaChip, { backgroundColor: `${colors.success}1a` }]}>
                      <Feather name="clock" size={12} color={colors.success} />
                      <Text style={[styles.etaChipText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                        {eta} min
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.sheetDetails}>
                    {vehicle && (
                      <View style={styles.detailRow}>
                        <Feather name="truck" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.detailText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                          {vehicle.color} {vehicle.make} {vehicle.model} · {vehicle.capacity} seats
                        </Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.detailText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                        {d.trip.originAddress} → {d.trip.destAddress}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="tag" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.detailText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                        ₹{d.estimatedFare.toFixed(0)} / seat · {d.trip.availableSeats} seats available
                      </Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
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
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetClose: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  sheetTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  sheetAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatarText: { fontSize: 18 },
  sheetName: { fontSize: 16, marginBottom: 4 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 3 },
  ratingNum: { fontSize: 12, color: "#888", marginLeft: 4, fontFamily: "Inter_400Regular" },
  sheetTrips: { fontSize: 12 },
  etaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  etaChipText: { fontSize: 13 },
  sheetDivider: { height: 1 },
  sheetDetails: { gap: 10, paddingBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailText: { fontSize: 14, flex: 1 },
});
