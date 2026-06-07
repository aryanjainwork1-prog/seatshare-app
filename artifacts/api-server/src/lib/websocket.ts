import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { eq } from "drizzle-orm";
import { db, driverProfilesTable } from "@workspace/db";
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

type IncomingWsMessage = LocationMessage | SubscribeMessage;

// Tracks admin clients subscribed to the live driver map feed
const adminClients = new Set<WebSocket>();

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

        // Broadcast to subscribed admin clients
        const broadcast = JSON.stringify({
          type: "driver_location",
          driverUserId: userId,
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        });

        for (const client of adminClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          } else {
            adminClients.delete(client);
          }
        }
      }
    });

    ws.on("close", () => {
      adminClients.delete(ws);
      logger.debug({ userId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, userId }, "WebSocket error");
      adminClients.delete(ws);
    });

    ws.send(JSON.stringify({ type: "connected", userId, role: userRole }));
  });

  logger.info("WebSocket server mounted at /ws");
}
