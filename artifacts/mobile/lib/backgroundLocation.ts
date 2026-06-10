import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

export const BACKGROUND_LOCATION_TASK = "seatshare-background-location";

const BG_TOKEN_KEY = "seatshare_bg_token";
const BG_DOMAIN_KEY = "seatshare_bg_domain";

interface LocationTaskData {
  locations: Location.LocationObject[];
}

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error || !data) return;

    const locations = data.locations;
    if (!locations || locations.length === 0) return;

    const location = locations[locations.length - 1];
    if (!location) return;

    try {
      const [token, domain] = await Promise.all([
        AsyncStorage.getItem(BG_TOKEN_KEY),
        AsyncStorage.getItem(BG_DOMAIN_KEY),
      ]);

      if (!token || !domain) return;

      await fetch(`https://${domain}/api/driver-location`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        }),
      });
    } catch {
      // Background fetch failures are silent — connection may be temporarily unavailable
    }
  },
);

export async function storeBgLocationCredentials(
  token: string,
  domain: string,
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(BG_TOKEN_KEY, token),
    AsyncStorage.setItem(BG_DOMAIN_KEY, domain),
  ]);
}

export async function clearBgLocationCredentials(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(BG_TOKEN_KEY),
    AsyncStorage.removeItem(BG_DOMAIN_KEY),
  ]);
}

export async function startBackgroundLocationTask(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (alreadyRunning) return true;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      timeInterval: 60000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "SeatShare is active",
        notificationBody: "Sharing your location with passengers",
        notificationColor: "#0f766e",
      },
      pausesUpdatesAutomatically: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundLocationTask(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // ignore — task may not have been registered
  }
}
