import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setBaseUrl } from "@workspace/api-client-react";
import "@/lib/backgroundLocation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ModeProvider } from "@/context/ModeContext";
import { useNotifications } from "@/hooks/useNotifications";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useNotifications(isAuthenticated);

  const topSegment = segments[0] as string | undefined;

  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingDone(null);
      return;
    }
    AsyncStorage.getItem("seatshare_onboarding_completed").then((v) => {
      setOnboardingDone(!!v);
    });
  }, [isAuthenticated, topSegment]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && onboardingDone === null) return;

    const inAuth = topSegment === "(auth)";
    const inOnboarding = topSegment === "onboarding";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/welcome");
    } else if (isAuthenticated && !onboardingDone && !inOnboarding && !inAuth) {
      router.replace("/onboarding");
    } else if (isAuthenticated && onboardingDone && inAuth) {
      router.replace("/");
    } else if (isAuthenticated && onboardingDone && inOnboarding) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, onboardingDone, topSegment]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trip" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="tracking" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ModeProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ModeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
