import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useRegisterPushToken } from "@workspace/api-client-react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationData {
  screen?: string;
  bookingId?: number;
  driverProfileId?: number;
  pickupLat?: number;
  pickupLng?: number;
}

function handleNotificationTap(data: NotificationData | undefined) {
  if (!data?.screen) return;

  if (data.screen === "tracking" && data.bookingId && data.driverProfileId) {
    router.push({
      pathname: "/tracking/[bookingId]",
      params: {
        bookingId: String(data.bookingId),
        driverProfileId: String(data.driverProfileId),
        driverName: "Driver",
        pickupLat: String(data.pickupLat ?? 0),
        pickupLng: String(data.pickupLng ?? 0),
      },
    });
    return;
  }

  if (data.screen === "bookings") {
    router.push("/(tabs)/bookings");
    return;
  }

  if (data.screen === "driver") {
    router.push("/(tabs)/driver");
    return;
  }
}

export function useNotifications(isAuthenticated: boolean) {
  const notifListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const registerPushToken = useRegisterPushToken();

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    async function setup() {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "SeatShare Notifications",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#0f766e",
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (tokenData.data) {
          registerPushToken.mutate({ data: { token: tokenData.data } });
        }
      } catch {
        // best-effort — ignore if token registration fails
      }
    }

    setup().catch(() => {});

    notifListenerRef.current = Notifications.addNotificationReceivedListener(() => {
      // received while app is foregrounded — alert is shown by setNotificationHandler
    });

    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData | undefined;
      handleNotificationTap(data);
    });

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [isAuthenticated]);

  // Handle notifications that launched the app from quit state
  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationData | undefined;
      handleNotificationTap(data);
    }).catch(() => {});
  }, [isAuthenticated]);
}
