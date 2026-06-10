import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MatchResult } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface Props {
  drivers: MatchResult[];
  userLat: number;
  userLng: number;
}

export function NearbyDriversMap({ drivers }: Props) {
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
        return (
          <View key={item.trip.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="truck" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                {driverName}
              </Text>
              {vehicle && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  {vehicle.make} {vehicle.model} · {vehicle.capacity} seats
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              {item.etaMinutes !== undefined && (
                <Text style={{ color: colors.success, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                  {item.etaMinutes} min
                </Text>
              )}
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
});
