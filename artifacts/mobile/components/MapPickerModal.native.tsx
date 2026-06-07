import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (picked: PickedLocation) => void;
  initialLat?: number;
  initialLng?: number;
  title: string;
  pinColor: string;
}

export function MapPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLat = 12.9716,
  initialLng = 77.5946,
  title,
  pinColor,
}: MapPickerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [region, setRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);

  async function handleRegionChangeComplete(newRegion: typeof region) {
    setRegion(newRegion);
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
      });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.district ?? r.subregion, r.city ?? r.region]
          .filter(Boolean)
          .join(", ");
        setAddress(parts);
      } else {
        setAddress("");
      }
    } catch {
      setAddress("");
    } finally {
      setResolving(false);
    }
  }

  function handleConfirm() {
    onConfirm({
      lat: region.latitude,
      lng: region.longitude,
      address:
        address.trim() ||
        `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={styles.headerSideBtn}
            hitSlop={12}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>

          <Text
            style={[
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {title}
          </Text>

          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.confirmText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Confirm
            </Text>
          </Pressable>
        </View>

        <View style={styles.hint}>
          <Feather name="move" size={13} color={colors.mutedForeground} />
          <Text
            style={[
              styles.hintText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Drag the map to position the pin
          </Text>
        </View>

        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            initialRegion={region}
            onRegionChangeComplete={handleRegionChangeComplete}
          />

          <View style={styles.pinOverlay} pointerEvents="none">
            <View style={styles.pinStack}>
              <Feather name="map-pin" size={40} color={pinColor} />
              <View
                style={[
                  styles.pinShadow,
                  { backgroundColor: `${pinColor}55` },
                ]}
              />
            </View>
          </View>
        </View>

        <View
          style={[
            styles.addressBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={[styles.pinDot, { backgroundColor: pinColor }]} />
          {resolving ? (
            <ActivityIndicator
              size="small"
              color={colors.mutedForeground}
              style={styles.spinner}
            />
          ) : (
            <Text
              style={[
                styles.addressText,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={2}
            >
              {address || "Drag the map to set location"}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerSideBtn: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    textAlign: "center",
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmText: { fontSize: 14 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintText: { fontSize: 12 },
  mapWrapper: {
    flex: 1,
    position: "relative",
  },
  map: { flex: 1 },
  pinOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pinStack: {
    alignItems: "center",
    marginBottom: 40,
  },
  pinShadow: {
    width: 18,
    height: 7,
    borderRadius: 9,
    marginTop: -6,
  },
  addressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  spinner: { marginRight: 4 },
  addressText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
