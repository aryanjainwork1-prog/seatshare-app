import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleSelect(role: "passenger" | "driver") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/(auth)/login", params: { role } });
  }

  function handleSocialLogin() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Coming Soon", "Google / Apple login is not available yet.");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0a1f4d", colors.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: topPad + 32 }]}>
        <View style={[styles.logoRing, { borderColor: colors.primary }]}>
          <View style={[styles.logoInner, { backgroundColor: colors.primary }]}>
            <Feather name="navigation" size={28} color={colors.primaryForeground} />
          </View>
        </View>
        <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          SeatShare
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Share the ride. Split the cost.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        <Pressable
          testID="passenger-card"
          style={({ pressed }) => [
            styles.roleCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => handleSelect("passenger")}
        >
          <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}22` }]}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Find a Ride
          </Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Book a seat on shared trips
          </Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.cardArrow} />
        </Pressable>

        <Pressable
          testID="driver-card"
          style={({ pressed }) => [
            styles.roleCard,
            { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => handleSelect("driver")}
        >
          <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="truck" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Offer a Ride
          </Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Publish your route, earn with seats
          </Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.cardArrow} />
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad + 24 }]}>
        <Text style={[styles.orText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          or continue with
        </Text>
        <View style={styles.socialRow}>
          <Pressable
            style={({ pressed }) => [
              styles.socialBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleSocialLogin}
          >
            <Ionicons name="logo-google" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.socialBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleSocialLogin}
          >
            <Ionicons name="logo-apple" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <Text style={[styles.terms, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
    flex: 1,
    justifyContent: "center",
    maxHeight: "45%",
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 32,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    textAlign: "center",
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    flex: 1,
    justifyContent: "center",
    maxHeight: "30%",
  },
  roleCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    flex: 1,
  },
  cardSub: {
    fontSize: 13,
    position: "absolute",
    left: 84,
    bottom: 14,
  },
  cardArrow: {
    marginLeft: "auto",
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  orText: {
    fontSize: 13,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  terms: {
    fontSize: 11,
    textAlign: "center",
  },
});
