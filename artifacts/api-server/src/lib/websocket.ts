import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { and, eq, inArray } from "drizzle-orm";
import { db, bookingsTable, driverProfilesTable, tripsTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { verifyAccessToken } from "./jwt";
import { sendPushNotification } from "./push";

interface LocationMessage {
  type: "location";
  lat: number;
  lng: number;
}

interface SubscribeMessage {
  type: "subscribe_map";
}

interface SubscribeDriverMessage {
  type: "subscribe_driver";
  driverUserId: number;
}

type IncomingWsMessage = LocationMessage | SubscribeMessage | SubscribeDriverMessage;

// Tracks admin clients subscribed to the live driver map feed
const adminClients = new Set<WebSocket>();

// Tracks passenger clients subscribed to a specific driver's location
// Key: driverUserId (as string), Value: Set of WebSocket clients
const passengerClients = new Map<string, Set<WebSocket>>();

// Reverse map to clean up on disconnect
const clientDriverSubscription = new Map<WebSocket, string>();

// Tracks bookings that have already received a "driver nearby" notification
// Key: `${driverUserId}:${bookingId}`, Value: timestamp when notified
const nearbyNotifiedAt = new Map<string, number>();
const NEARBY_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const NEARBY_THRESHOLD_KM = 1.0;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function extractToken(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get("token");
}

async function notifyNearbyPassengers(driverUserId: number, lat: number, lng: number): Promise<void> {
  try {
    // Find the driver profile
    const [profile] = await db
      .select({ id: driverProfilesTable.id })
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.userId, driverUserId))
      .limit(1);

    if (!profile) return;

    // Find accepted bookings for this driver's active trips
    const acceptedBookings = await db
      .select({
        bookingId: bookingsTable.id,
        passengerId: bookingsTable.passengerId,
        pickupLat: bookingsTable.pickupLat,
        pickupLng: bookingsTable.pickupLng,
        pickupAddress: bookingsTable.pickupAddress,
      })
      .from(bookingsTable)
      .innerJoin(tripsTable, eq(tripsTable.id, bookingsTable.tripId))
      .where(
        and(
          eq(tripsTable.driverProfileId, profile.id),
          inArray(bookingsTable.status, ["accepted"]),
        ),
      );

    const now = Date.now();
    // Prune old cooldown entries
    for (const [key, ts] of nearbyNotifiedAt) {
      if (now - ts > NEARBY_COOLDOWN_MS) nearbyNotifiedAt.delete(key);
    }

    for (const booking of acceptedBookings) {
      if (booking.pickupLat == null || booking.pickupLng == null) continue;

      const distKm = haversineKm(lat, lng, booking.pickupLat, booking.pickupLng);
      if (distKm > NEARBY_THRESHOLD_KM) continue;

      const dedupKey = `${driverUserId}:${booking.bookingId}`;
      if (nearbyNotifiedAt.has(dedupKey)) continue;

      nearbyNotifiedAt.set(dedupKey, now);

      // Look up passenger's push token
      const [passenger] = await db
        .select({ expoPushToken: usersTable.expoPushToken, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, booking.passengerId))
        .limit(1);

      if (passenger?.expoPushToken) {
        sendPushNotification({
          to: passenger.expoPushToken,
          title: "Your driver is nearby! 📍",
          body: `Your driver is less than ${Math.round(distKm * 1000)} m away from ${booking.pickupAddress}. Get ready!`,
          data: { screen: "bookings", bookingId: booking.bookingId },
        }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err }, "notifyNearbyPassengers failed");
  }
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const token = extractToken(req);
    const payload = token ? verifyAccessToken(token) : null;

    // Reject unauthenticated connections immediately
    if (!payload) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close(1008, "Authentication required");
      logger.warn("WebSocket connection rejected: no valid token");
      return;
    }

    const { sub: userId, role: userRole } = payload;
    logger.info({ userId, userRole }, "WebSocket client connected");

    ws.on("message", async (raw) => {
      let msg: IncomingWsMessage;
      try {
        msg = JSON.parse(raw.toString()) as IncomingWsMessage;
      } catch {
        return;
      }

      if (msg.type === "subscribe_map") {
        if (userRole !== "admin") {
          ws.send(JSON.stringify({ type: "error", message: "Admin role required to subscribe to map" }));
          return;
        }
        adminClients.add(ws);
        logger.debug({ userId }, "Admin subscribed to map feed");
        ws.send(JSON.stringify({ type: "subscribed" }));
        return;
      }

      if (msg.type === "subscribe_driver") {
        if (userRole !== "passenger") {
          ws.send(JSON.stringify({ type: "error", message: "Passenger role required to subscribe to driver" }));
          return;
        }

        const driverUserIdStr = String(msg.driverUserId);

        // Authorization: verify passenger has an accepted/in_progress booking with this driver
        try {
          const [driverProfile] = await db
            .select({ id: driverProfilesTable.id })
            .from(driverProfilesTable)
            .where(eq(driverProfilesTable.userId, msg.driverUserId))
            .limit(1);

          if (!driverProfile) {
            ws.send(JSON.stringify({ type: "error", message: "Driver not found" }));
            logger.warn({ userId, driverUserId: driverUserIdStr }, "subscribe_driver: driver profile not found");
            return;
          }

          const [activeBooking] = await db
            .select({ id: bookingsTable.id })
            .from(bookingsTable)
            .innerJoin(tripsTable, eq(tripsTable.id, bookingsTable.tripId))
            .where(
              and(
                eq(bookingsTable.passengerId, userId),
                inArray(bookingsTable.status, ["accepted", "in_progress"]),
                eq(tripsTable.driverProfileId, driverProfile.id),
              ),
            )
            .limit(1);

          if (!activeBooking) {
            ws.send(JSON.stringify({ type: "error", message: "No active booking with this driver" }));
            logger.warn({ userId, driverUserId: driverUserIdStr }, "subscribe_driver: unauthorized — no active booking");
            return;
          }
        } catch (err) {
          logger.error({ err }, "subscribe_driver: authorization check failed");
          ws.send(JSON.stringify({ type: "error", message: "Authorization check failed" }));
          return;
        }

        // Remove any previous subscription for this client
        const prevDriverId = clientDriverSubscription.get(ws);
        if (prevDriverId) {
          passengerClients.get(prevDriverId)?.delete(ws);
        }

        // Register new subscription
        if (!passengerClients.has(driverUserIdStr)) {
          passengerClients.set(driverUserIdStr, new Set());
        }
        passengerClients.get(driverUserIdStr)!.add(ws);
        clientDriverSubscription.set(ws, driverUserIdStr);

        logger.debug({ userId, driverUserId: driverUserIdStr }, "Passenger subscribed to driver location");

        // Send current driver location from DB (authorization already passed above)
        try {
          const [driverProfile] = await db
            .select({ currentLat: driverProfilesTable.currentLat, currentLng: driverProfilesTable.currentLng })
            .from(driverProfilesTable)
            .where(eq(driverProfilesTable.userId, msg.driverUserId))
            .limit(1);

          if (driverProfile?.currentLat != null && driverProfile?.currentLng != null) {
            ws.send(JSON.stringify({
              type: "driver_location",
              driverUserId: driverUserIdStr,
              lat: driverProfile.currentLat,
              lng: driverProfile.currentLng,
              updatedAt: new Date().toISOString(),
            }));
          }
        } catch (err) {
          logger.error({ err }, "Failed to fetch initial driver location");
        }

        ws.send(JSON.stringify({ type: "subscribed_driver", driverUserId: driverUserIdStr }));
        return;
      }

      if (msg.type === "location") {
        // Only drivers can send location updates; derive driverId from token (never trust client)
        if (userRole !== "driver") {
          ws.send(JSON.stringify({ type: "error", message: "Driver role required to send location" }));
          return;
        }

        const { lat, lng } = msg;
        if (typeof lat !== "number" || typeof lng !== "number") {
          ws.send(JSON.stringify({ type: "error", message: "lat and lng must be numbers" }));
          return;
        }

        // Update DB using authenticated userId, not any client-supplied id
        await db
          .update(driverProfilesTable)
          .set({ currentLat: lat, currentLng: lng })
          .where(eq(driverProfilesTable.userId, userId));

        const broadcast = JSON.stringify({
          type: "driver_location",
          driverUserId: userId,
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        });

        // Broadcast to subscribed admin clients
        for (const client of adminClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          } else {
            adminClients.delete(client);
          }
        }

        // Broadcast to subscribed passenger clients tracking this driver
        const subscribedPassengers = passengerClients.get(String(userId));
        if (subscribedPassengers) {
          for (const client of subscribedPassengers) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            } else {
              subscribedPassengers.delete(client);
              clientDriverSubscription.delete(client);
            }
          }
        }

        // Send push notification to passengers if driver is nearby their pickup
        notifyNearbyPassengers(userId, lat, lng).catch(() => {});
      }
    });

    ws.on("close", () => {
      adminClients.delete(ws);

      // Clean up passenger driver subscription
      const driverIdStr = clientDriverSubscription.get(ws);
      if (driverIdStr) {
        passengerClients.get(driverIdStr)?.delete(ws);
        clientDriverSubscription.delete(ws);
      }

      logger.debug({ userId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, userId }, "WebSocket error");
      adminClients.delete(ws);

      const driverIdStr = clientDriverSubscription.get(ws);
      if (driverIdStr) {
        passengerClients.get(driverIdStr)?.delete(ws);
        clientDriverSubscription.delete(ws);
      }
    });

    ws.send(JSON.stringify({ type: "connected", userId, role: userRole }));
  });

  logger.info("WebSocket server mounted at /ws");
}
