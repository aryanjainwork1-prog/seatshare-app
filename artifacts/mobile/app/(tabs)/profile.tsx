import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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
import { useDemoMode } from "@/context/DemoModeContext";
import { useMode } from "@/context/ModeContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { mode, setMode } = useMode();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [emailInput, setEmailInput] = useState(user?.email ?? "");
  const [ageInput, setAgeInput] = useState(user?.age ? String(user.age) : "");
  const [genderInput, setGenderInput] = useState(user?.gender ?? "");
  const [workplaceInput, setWorkplaceInput] = useState(user?.workplace ?? "");
  const [officeInput, setOfficeInput] = useState(user?.officeLocation ?? "");
  const [bioInput, setBioInput] = useState(user?.bio ?? "");

  function handleVersionTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      toggleDemoMode();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isDemoMode ? "Demo Mode Off" : "Demo Mode On",
        isDemoMode
          ? "Demo Mode has been disabled."
          : "Demo Mode enabled. Use demo accounts to test the full ride-sharing flow.",
      );
    }
  }

  const updateMeMutation = useUpdateMe();

  useEffect(() => {
    setNameInput(user?.name ?? "");
    setEmailInput(user?.email ?? "");
    setAgeInput(user?.age ? String(user.age) : "");
    setGenderInput(user?.gender ?? "");
    setWorkplaceInput(user?.workplace ?? "");
    setOfficeInput(user?.officeLocation ?? "");
    setBioInput(user?.bio ?? "");
  }, [user?.name, user?.email, user?.age, user?.gender, user?.workplace, user?.officeLocation, user?.bio]);

  const initials = (user?.name ?? user?.phone ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSave() {
    if (!user?.id) return;
    try {
      const ageNum = ageInput.trim() ? parseInt(ageInput.trim(), 10) : undefined;
      const updated = await updateMeMutation.mutateAsync({
        data: {
          name: nameInput || undefined,
          email: emailInput || undefined,
          age: ageNum && !isNaN(ageNum) ? ageNum : undefined,
          gender: genderInput || undefined,
          workplace: workplaceInput || undefined,
          officeLocation: officeInput || undefined,
          bio: bioInput.trim() || undefined,
        },
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

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="briefcase" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Workplace / Company"
              placeholderTextColor={colors.mutedForeground}
              value={workplaceInput}
              onChangeText={setWorkplaceInput}
            />
          </View>

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="map-pin" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Office location"
              placeholderTextColor={colors.mutedForeground}
              value={officeInput}
              onChangeText={setOfficeInput}
            />
          </View>

          <View style={[styles.bioInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="file-text" size={16} color={colors.mutedForeground} style={styles.bioIcon} />
            <TextInput
              style={[styles.bioInputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Short bio — introduce yourself to passengers (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={bioInput}
              onChangeText={(t) => setBioInput(t.slice(0, 200))}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={[styles.bioCounter, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {bioInput.length}/200
            </Text>
          </View>

          <View style={styles.editRow}>
            <View style={[styles.inputRow, styles.inputHalf, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Age"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                value={ageInput}
                onChangeText={setAgeInput}
                maxLength={3}
              />
            </View>
            <View style={[styles.genderRow, styles.inputHalf]}>
              {(["M", "F", "—"] as const).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGenderInput(g === "—" ? "" : g)}
                  style={[
                    styles.genderBtn,
                    {
                      backgroundColor: genderInput === (g === "—" ? "" : g) ? colors.primary : colors.muted,
                      borderColor: genderInput === (g === "—" ? "" : g) ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: genderInput === (g === "—" ? "" : g) ? colors.primaryForeground : colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.editActions}>
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => {
                setEditing(false);
                setNameInput(user?.name ?? "");
                setEmailInput(user?.email ?? "");
                setAgeInput(user?.age ? String(user.age) : "");
                setGenderInput(user?.gender ?? "");
                setWorkplaceInput(user?.workplace ?? "");
                setOfficeInput(user?.officeLocation ?? "");
                setBioInput(user?.bio ?? "");
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
        <>
          {/* Profile completeness nudge — shown when key passenger details are missing */}
          {isPassenger && (!user?.workplace && !user?.age && !user?.gender) && (
            <Pressable
              style={[styles.completionNudge, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}33` }]}
              onPress={() => setEditing(true)}
            >
              <View style={[styles.completionIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Feather name="user-check" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.completionTitle, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  Complete your profile
                </Text>
                <Text style={[styles.completionSub, { color: colors.primary, fontFamily: "Inter_400Regular", opacity: 0.8 }]}>
                  Drivers see your workplace and personal details on ride requests — complete your profile to get more rides accepted.
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.primary} />
            </Pressable>
          )}

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

            {/* Workplace row — always visible; tappable to open edit when empty */}
            <Pressable style={styles.infoRow} onPress={!user?.workplace && !user?.officeLocation ? () => setEditing(true) : undefined}>
              <Feather name="briefcase" size={15} color={colors.mutedForeground} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Work</Text>
              {(user?.workplace || user?.officeLocation) ? (
                <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {[user?.workplace, user?.officeLocation].filter(Boolean).join(" · ")}
                </Text>
              ) : (
                <Text style={[styles.infoValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Tap to add workplace
                </Text>
              )}
            </Pressable>
            <View style={[styles.infoSep, { backgroundColor: colors.border }]} />

            {/* Age / gender row — always visible; tappable to open edit when empty */}
            <Pressable style={styles.infoRow} onPress={!user?.age && !user?.gender ? () => setEditing(true) : undefined}>
              <Feather name="user" size={15} color={colors.mutedForeground} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>About</Text>
              {(user?.age || user?.gender) ? (
                <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {[user?.age ? `${user.age} yrs` : null, user?.gender === "M" ? "Male" : user?.gender === "F" ? "Female" : null].filter(Boolean).join(" · ")}
                </Text>
              ) : (
                <Text style={[styles.infoValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Tap to add age &amp; gender
                </Text>
              )}
            </Pressable>

            {user?.bio && (
              <>
                <View style={[styles.infoSep, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Feather name="file-text" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Bio</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_400Regular", textAlign: "left" }]}>
                    {user.bio}
                  </Text>
                </View>
              </>
            )}
          </View>
        </>
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

      {isDemoMode && (
        <View style={[styles.demoBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.demoBadgeText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
            Demo Mode Active
          </Text>
        </View>
      )}

      <Pressable onPress={handleVersionTap} hitSlop={12} style={styles.versionLabel}>
        <Text style={[styles.versionText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          SeatShare v1.0.0
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
  editRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: { flex: 1 },
  genderRow: {
    flexDirection: "row",
    gap: 6,
  },
  genderBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  completionNudge: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  completionTitle: { fontSize: 14, marginBottom: 2 },
  completionSub: { fontSize: 12, lineHeight: 17 },
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
  bioInputWrap: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  bioIcon: { alignSelf: "flex-start" },
  bioInputText: { fontSize: 15, minHeight: 64, flex: 1 },
  bioCounter: { fontSize: 12, textAlign: "right" },
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
  demoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoBadgeText: { fontSize: 13 },
  versionLabel: {
    alignItems: "center",
    paddingVertical: 20,
  },
  versionText: { fontSize: 12 },
});
