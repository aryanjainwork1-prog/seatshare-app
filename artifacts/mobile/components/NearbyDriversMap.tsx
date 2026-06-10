import { Feather } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

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

export function NearbyDriversMap({ drivers, userLat, userLng }: Props) {
  const colors = useColors();

  if (drivers.length === 0) {
    return (
      <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Feather name="truck" size={13} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
            Finding drivers near you…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Feather name="truck" size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
          {drivers.length} driver{drivers.length === 1 ? "" : "s"} nearby
        </Text>
      </View>

      {drivers.slice(0, 4).map((item) => {
        const driverName = item.driverProfile?.user?.name ?? "Driver";
        const vehicle = item.vehicle;
        const eta = getEta(item, userLat, userLng);
        const rating = item.driverProfile.rating;
        const filledStars = Math.round(rating);

        return (
          <View key={item.trip.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="truck" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                {driverName}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Ionicons
                    key={i}
                    name={i < filledStars ? "star" : "star-outline"}
                    size={11}
                    color={i < filledStars ? "#f59e0b" : "#ccc"}
                  />
                ))}
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginLeft: 3 }}>
                  {rating.toFixed(1)}
                </Text>
              </View>
              {vehicle && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 }}>
                  {vehicle.make} {vehicle.model} · {vehicle.capacity} seats
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[styles.etaChip, { backgroundColor: `${colors.success}1a` }]}>
                <Feather name="clock" size={11} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                  {eta} min
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                ₹{item.estimatedFare.toFixed(0)}/seat
              </Text>
            </View>
          </View>
        );
      })}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  etaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
});
