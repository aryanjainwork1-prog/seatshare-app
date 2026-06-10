import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUpdateMe } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useMode } from "@/context/ModeContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { mode, setMode } = useMode();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [emailInput, setEmailInput] = useState(user?.email ?? "");

  const updateMeMutation = useUpdateMe();

  useEffect(() => {
    setNameInput(user?.name ?? "");
    setEmailInput(user?.email ?? "");
  }, [user?.name, user?.email]);

  const initials = (user?.name ?? user?.phone ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSave() {
    if (!user?.id) return;
    try {
      const updated = await updateMeMutation.mutateAsync({
        data: { name: nameInput || undefined, email: emailInput || undefined },
      });
      await updateUser(updated);
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update profile");
    }
  }

  async function handleLogout() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
        },
      },
    ]);
  }

  const isDriver = user?.role === "driver";
  const isPassenger = !isDriver;

  function handleModeSwitch(target: "passenger" | "driver") {
    if (target === "driver" && !isDriver) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode(target);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Profile
        </Text>
        {!editing && (
          <Pressable onPress={() => setEditing(true)}>
            <Feather name="edit-2" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}33` }]}>
          <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            {initials}
          </Text>
        </View>
        {!editing && (
          <>
            <Text style={[styles.displayName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {user?.name ?? "No name set"}
            </Text>
            <Text style={[styles.phone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {user?.phone}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.modeCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          I'm travelling as…
        </Text>
        <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
          <Pressable
            style={[
              styles.segmentBtn,
              mode === "passenger" && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
            ]}
            onPress={() => handleModeSwitch("passenger")}
          >
            <Feather
              name="users"
              size={15}
              color={mode === "passenger" ? colors.primary : colors.mutedForeground}
            />
            <Text style={[
              styles.segmentText,
              {
                color: mode === "passenger" ? colors.primary : colors.mutedForeground,
                fontFamily: mode === "passenger" ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}>
              Passenger
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentBtn,
              mode === "driver" && isDriver && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
              !isDriver && styles.segmentBtnDisabled,
            ]}
            onPress={() => {
              if (!isDriver) {
                Alert.alert(
                  "Driver registration required",
                  "To offer rides, you need to register as a driver first. Contact support or sign up as a driver.",
                );
                return;
              }
              handleModeSwitch("driver");
            }}
          >
            <Feather
              name="truck"
              size={15}
              color={
                !isDriver
                  ? colors.mutedForeground
                  : mode === "driver"
                    ? colors.primary
                    : colors.mutedForeground
              }
            />
            <Text style={[
              styles.segmentText,
              {
                color: !isDriver
                  ? colors.mutedForeground
                  : mode === "driver"
                    ? colors.primary
                    : colors.mutedForeground,
                fontFamily: mode === "driver" && isDriver ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}>
              Driver
            </Text>
            {!isDriver && (
              <View style={[styles.lockBadge, { backgroundColor: `${colors.mutedForeground}22` }]}>
                <Feather name="lock" size={9} color={colors.mutedForeground} />
              </View>
            )}
          </Pressable>
        </View>
        <Text style={[styles.modeDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {mode === "driver" && isDriver
            ? "Driver Mode — offer rides, manage trips, track earnings."
            : isDriver
              ? "Passenger Mode — find and book shared rides."
              : "Passenger Mode active. Register as a driver to offer rides."}
        </Text>
      </View>

      {editing ? (
        <View style={[styles.editCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.editTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Edit Profile
          </Text>

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              value={nameInput}
              onChangeText={setNameInput}
            />
          </View>

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.editActions}>
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => {
                setEditing(false);
                setNameInput(user?.name ?? "");
                setEmailInput(user?.email ?? "");
              }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primary, flex: 1, opacity: pressed || updateMeMutation.isPending ? 0.8 : 1 },
              ]}
              onPress={handleSave}
              disabled={updateMeMutation.isPending}
            >
              {updateMeMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Feather name="phone" size={15} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Phone</Text>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{user?.phone}</Text>
          </View>
          <View style={[styles.infoSep, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Feather name="mail" size={15} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Email</Text>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{user?.email ?? "—"}</Text>
          </View>
          <View style={[styles.infoSep, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={15} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Role</Text>
            <View style={[styles.roleBadge, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                {user?.role ?? "passenger"}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Pressable
        testID="logout-button"
        style={({ pressed }) => [
          styles.logoutBtn,
          { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
          Sign Out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22 },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28 },
  displayName: { fontSize: 20 },
  phone: { fontSize: 14 },
  modeCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  modeCardTitle: { fontSize: 14 },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentBtnDisabled: {
    opacity: 0.5,
  },
  segmentText: { fontSize: 14 },
  lockBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeDesc: { fontSize: 12, lineHeight: 18 },
  editCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  editTitle: { fontSize: 16, marginBottom: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  inputText: { flex: 1, fontSize: 15 },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15 },
  saveBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 15 },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  infoLabel: { fontSize: 14, width: 50 },
  infoValue: { flex: 1, fontSize: 14, textAlign: "right" },
  infoSep: { height: 1, marginHorizontal: 12 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleBadgeText: { fontSize: 12 },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logoutText: { fontSize: 15 },
});
