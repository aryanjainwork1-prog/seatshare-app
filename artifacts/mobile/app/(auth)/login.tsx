import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSendOtp, useVerifyOtp } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");

  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    setError("");
    try {
      const result = await sendOtpMutation.mutateAsync({ data: { phone: `+91${cleaned}` } });
      setSessionId(result.sessionId);
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Failed to send OTP. Try again.");
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) {
      setError("Enter the OTP");
      return;
    }
    setError("");
    try {
      const tokens = await verifyOtpMutation.mutateAsync({
        data: {
          phone: `+91${phone.replace(/\D/g, "")}`,
          otp,
          sessionId: sessionId!,
          role: role ?? "passenger",
        },
      });
      await login(tokens);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch {
      setError("Invalid OTP. Try again.");
    }
  }

  function handleSocialLogin() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Coming Soon", "Google / Apple login is not available yet.");
  }

  const isLoading = sendOtpMutation.isPending || verifyOtpMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          testID="back-button"
          onPress={() => (step === "otp" ? setStep("phone") : router.back())}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={[styles.roleChip, { backgroundColor: `${colors.primary}22`, borderColor: colors.primary }]}>
            {role === "driver" ? (
              <Feather name="truck" size={14} color={colors.primary} />
            ) : (
              <Ionicons name="person" size={14} color={colors.primary} />
            )}
            <Text style={[styles.roleText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {role === "driver" ? "Driver" : "Passenger"}
            </Text>
          </View>
        </View>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {step === "phone" ? "Enter your number" : "Verify your number"}
        </Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {step === "phone"
            ? "We'll send a one-time code to verify you"
            : `Code sent to +91 ${phone}`}
        </Text>

        {step === "phone" ? (
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.countryCode, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              +91
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TextInput
              testID="phone-input"
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="9876543210"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
              autoFocus
            />
          </View>
        ) : (
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <TextInput
              testID="otp-input"
              style={[styles.input, styles.otpInput, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              placeholder="• • • • • •"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleVerifyOtp}
              autoFocus
            />
          </View>
        )}

        {error !== "" && (
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
            {error}
          </Text>
        )}

        <Pressable
          testID="continue-button"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.8 : 1 },
          ]}
          onPress={step === "phone" ? handleSendOtp : handleVerifyOtp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
              {step === "phone" ? "Send Code" : "Verify & Continue"}
            </Text>
          )}
        </Pressable>

        {step === "otp" && (
          <Pressable onPress={() => { setStep("phone"); setOtp(""); setError(""); }}>
            <Text style={[styles.resendText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
              Resend code
            </Text>
          </Pressable>
        )}
      </View>

      {step === "phone" && (
        <View style={[styles.socialSection, { paddingBottom: bottomPad + 24 }]}>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              or
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleSocialLogin}
            >
              <Ionicons name="logo-google" size={22} color={colors.foreground} />
              <Text style={[styles.socialText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Google
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleSocialLogin}
            >
              <Ionicons name="logo-apple" size={22} color={colors.foreground} />
              <Text style={[styles.socialText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Apple
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  roleText: {
    fontSize: 13,
  },
  heading: {
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subheading: {
    fontSize: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
    marginTop: 8,
  },
  countryCode: {
    fontSize: 16,
  },
  divider: {
    width: 1,
    height: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  otpInput: {
    fontSize: 22,
    letterSpacing: 8,
  },
  errorText: {
    fontSize: 13,
    marginTop: -8,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 16,
  },
  resendText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: -4,
  },
  socialSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 13,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  socialText: {
    fontSize: 14,
  },
});
