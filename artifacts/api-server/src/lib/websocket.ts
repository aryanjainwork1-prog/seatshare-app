import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { and, eq, inArray } from "drizzle-orm";
import { db, bookingsTable, driverProfilesTable, tripsTable } from "@workspace/db";
import { logger } from "./logger";
import { verifyAccessToken } from "./jwt";

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

function extractToken(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get("token");
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
          const [profile] = await db
            .select({ currentLat: driverProfilesTable.currentLat, currentLng: driverProfilesTable.currentLng })
            .from(driverProfilesTable)
            .where(eq(driverProfilesTable.userId, msg.driverUserId))
            .limit(1);

          if (profile?.currentLat != null && profile?.currentLng != null) {
            ws.send(JSON.stringify({
              type: "driver_location",
              driverUserId: driverUserIdStr,
              lat: profile.currentLat,
              lng: profile.currentLng,
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
