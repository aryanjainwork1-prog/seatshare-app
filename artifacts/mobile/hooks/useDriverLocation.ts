import { useEffect, useRef, useState } from "react";

interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

interface UseDriverLocationOptions {
  driverUserId: number | null | undefined;
  accessToken: string | null;
  enabled?: boolean;
}

interface UseDriverLocationResult {
  location: DriverLocation | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Connects to the WebSocket server and subscribes to a specific driver's live location.
 * Only works on native platforms (iOS/Android). On web, returns null location.
 */
export function useDriverLocation({
  driverUserId,
  accessToken,
  enabled = true,
}: UseDriverLocationOptions): UseDriverLocationResult {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !driverUserId || !accessToken || !process.env.EXPO_PUBLIC_DOMAIN) {
      return;
    }

    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const wsUrl = `wss://${process.env.EXPO_PUBLIC_DOMAIN}/ws?token=${accessToken}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          setIsConnected(true);
          setError(null);
          ws.send(
            JSON.stringify({
              type: "subscribe_driver",
              driverUserId,
            })
          );
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data as string) as {
              type: string;
              lat?: number;
              lng?: number;
              updatedAt?: string;
              driverUserId?: string;
            };

            if (msg.type === "driver_location" && typeof msg.lat === "number" && typeof msg.lng === "number") {
              setLocation({
                lat: msg.lat,
                lng: msg.lng,
                updatedAt: msg.updatedAt ?? new Date().toISOString(),
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          wsRef.current = null;
          // Reconnect after 5 seconds
          reconnectTimerRef.current = setTimeout(() => {
            if (isMounted) connect();
          }, 5000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setError("Connection error");
          setIsConnected(false);
        };
      } catch {
        setError("Failed to connect");
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [driverUserId, accessToken, enabled]);

  return { location, isConnected, error };
}

/**
 * Compute great-circle distance between two lat/lng points using Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate ETA in minutes given distance in km, assuming avg city speed of 30 km/h.
 */
export function etaMinutes(distanceKm: number): number {
  return Math.ceil((distanceKm / 30) * 60);
}
