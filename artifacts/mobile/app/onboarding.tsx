import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUpdateUser } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { BANGALORE_AREAS } from "@/constants/locations";

const COMMUTE_TYPES = [
  { id: "daily", label: "Daily", icon: "repeat" },
  { id: "weekly", label: "Few times/week", icon: "calendar" },
  { id: "occasional", label: "Occasionally", icon: "clock" },
] as const;

const TRAVEL_TIMES = [
  { id: "morning", label: "Morning", sub: "6am – 10am" },
  { id: "evening", label: "Evening", sub: "4pm – 9pm" },
  { id: "flexible", label: "Flexible", sub: "Anytime" },
] as const;

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const updateUserMutation = useUpdateUser();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [homeArea, setHomeArea] = useState("");
  const [homeAreaFocused, setHomeAreaFocused] = useState(false);
  const [destination, setDestination] = useState("");
  const [destFocused, setDestFocused] = useState(false);
  const [commuteType, setCommuteType] = useState<string>("daily");
  const [travelTime, setTravelTime] = useState<string>("morning");

  const homeSuggestions = homeArea.trim().length >= 2
    ? BANGALORE_AREAS.filter(a => a.toLowerCase().includes(homeArea.toLowerCase())).slice(0, 4)
    : [];
  const destSuggestions = destination.trim().length >= 2
    ? BANGALORE_AREAS.filter(a => a.toLowerCase().includes(destination.toLowerCase())).slice(0, 4)
    : [];

  async function handleNext() {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert("Required", "Please enter your name.");
        return;
      }
      setStep(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (step === 2) {
      setStep(3);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (step === 3) {
      await handleFinish();
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      if (user?.id && (name !== user.name || email !== user.email)) {
        const updated = await updateUserMutation.mutateAsync({
          id: user.id,
          data: {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
          },
        });
        await updateUser(updated);
      }
      await AsyncStorage.setItem("seatshare_onboarding_completed", "1");
      await AsyncStorage.setItem(
        "seatshare_onboarding_prefs",
        JSON.stringify({ homeArea, destination, commuteType, travelTime }),
      );
      if (email.trim()) {
        await AsyncStorage.setItem("seatshare_email_verified", "pending");
      } else {
        await AsyncStorage.setItem("seatshare_email_verified", "none");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch {
      Alert.alert("Error", "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i < step ? colors.primary : colors.border,
                  flex: 1,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="user" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Welcome to SeatShare
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Let's set up your profile in just a few steps.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Your name *
            </Text>
            <View style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Full name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Email address
            </Text>
            <View style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="you@example.com (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.phoneLine, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              <Feather name="check-circle" size={13} color={colors.success} />{"  "}
              Signed in as {user?.phone}
            </Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="map" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Your Commute
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Help us match you with the right rides.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Home area
            </Text>
            <View>
              <View style={[styles.input, { backgroundColor: colors.card, borderColor: homeAreaFocused ? colors.primary : colors.border }]}>
                <Feather name="home" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="e.g. Koramangala, Bangalore"
                  placeholderTextColor={colors.mutedForeground}
                  value={homeArea}
                  onChangeText={setHomeArea}
                  onFocus={() => setHomeAreaFocused(true)}
                  onBlur={() => setTimeout(() => setHomeAreaFocused(false), 150)}
                />
              </View>
              {homeAreaFocused && homeSuggestions.length > 0 && (
                <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {homeSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                      onPress={() => { setHomeArea(s); setHomeAreaFocused(false); }}
                    >
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Usual destination
            </Text>
            <View>
              <View style={[styles.input, { backgroundColor: colors.card, borderColor: destFocused ? colors.primary : colors.border }]}>
                <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.inputText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="e.g. Electronic City, Bangalore"
                  placeholderTextColor={colors.mutedForeground}
                  value={destination}
                  onChangeText={setDestination}
                  onFocus={() => setDestFocused(true)}
                  onBlur={() => setTimeout(() => setDestFocused(false), 150)}
                />
              </View>
              {destFocused && destSuggestions.length > 0 && (
                <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {destSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                      onPress={() => { setDestination(s); setDestFocused(false); }}
                    >
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.suggestionText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              How often do you commute?
            </Text>
            <View style={styles.chipRow}>
              {COMMUTE_TYPES.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: commuteType === c.id ? colors.primary : colors.card,
                      borderColor: commuteType === c.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setCommuteType(c.id); Haptics.selectionAsync(); }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: commuteType === c.id ? colors.primaryForeground : colors.foreground,
                        fontFamily: commuteType === c.id ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Preferred travel time
            </Text>
            <View style={styles.timeRow}>
              {TRAVEL_TIMES.map((t) => (
                <Pressable
                  key={t.id}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: travelTime === t.id ? `${colors.primary}22` : colors.card,
                      borderColor: travelTime === t.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setTravelTime(t.id); Haptics.selectionAsync(); }}
                >
                  <Text
                    style={[
                      styles.timeChipLabel,
                      {
                        color: travelTime === t.id ? colors.primary : colors.foreground,
                        fontFamily: travelTime === t.id ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                  <Text style={[styles.timeChipSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t.sub}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.success}22` }]}>
              <Feather name="mail" size={28} color={colors.success} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Verify your email
            </Text>
            {email.trim() ? (
              <>
                <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  We'll send a verification link to:
                </Text>
                <View style={[styles.emailBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="mail" size={16} color={colors.primary} />
                  <Text style={[styles.emailText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {email.trim()}
                  </Text>
                </View>
                <Text style={[styles.verifyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Check your inbox and tap the link to verify. You can still use SeatShare while you wait — some features will unlock after verification.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  You didn't add an email — you can skip this step.
                </Text>
                <Text style={[styles.verifyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Adding an email lets us notify you about bookings and keep your account safe. You can add one anytime from your profile.
                </Text>
              </>
            )}

            <View style={[styles.allSetBox, { backgroundColor: `${colors.primary}11`, borderColor: `${colors.primary}33` }]}>
              <Feather name="check-circle" size={18} color={colors.primary} />
              <Text style={[styles.allSetText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Your profile is set up! Tap below to start.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad + 12, borderTopColor: colors.border }]}>
        {step > 1 && (
          <Pressable
            style={[styles.backBtn, { borderColor: colors.border }]}
            onPress={() => { setStep(s => s - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
          onPress={handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                {step === TOTAL_STEPS ? "Get Started" : "Continue"}
              </Text>
              {step < TOTAL_STEPS && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressDot: {
    height: 4,
    borderRadius: 2,
  },
  stepLabel: { fontSize: 12 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  stepContainer: {
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  stepTitle: { fontSize: 24, letterSpacing: -0.5, lineHeight: 30 },
  stepSub: { fontSize: 15, lineHeight: 22 },
  fieldLabel: { fontSize: 14, marginTop: 8 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputText: { flex: 1, fontSize: 15 },
  suggestions: {
    position: "relative",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 100,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionText: { fontSize: 14, flex: 1 },
  phoneLine: { fontSize: 13, marginTop: 4 },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 14 },
  timeRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  timeChipLabel: { fontSize: 13 },
  timeChipSub: { fontSize: 11 },
  emailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emailText: { fontSize: 15 },
  verifyNote: { fontSize: 14, lineHeight: 20 },
  allSetBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  allSetText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  backBtn: {
    width: 48,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnText: { fontSize: 16 },
});
