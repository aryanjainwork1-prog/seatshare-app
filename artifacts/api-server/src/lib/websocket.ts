import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { db, driverProfilesTable } from "@workspace/db";
import { logger } from "./logger";
import { verifyAccessToken } from "./jwt";

interface LocationMessage {
  type: "location";
  driverId: number;
  lat: number;
  lng: number;
}

interface SubscribeMessage {
  type: "subscribe_map";
}

type IncomingMessage = LocationMessage | SubscribeMessage;

// Tracks admin clients subscribed to the map feed
const adminClients = new Set<WebSocket>();

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");

    let userId: number | null = null;
    let userRole: string | null = null;

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        userId = payload.sub;
        userRole = payload.role;
      }
    }

    logger.info({ userId, userRole }, "WebSocket client connected");

    ws.on("message", async (raw) => {
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(raw.toString()) as IncomingMessage;
      } catch {
        return;
      }

      if (msg.type === "subscribe_map") {
        if (userRole === "admin") {
          adminClients.add(ws);
          logger.debug({ userId }, "Admin subscribed to map feed");
          ws.send(JSON.stringify({ type: "subscribed" }));
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Admin role required" }));
        }
        return;
      }

      if (msg.type === "location") {
        const { driverId, lat, lng } = msg;
        if (!driverId || typeof lat !== "number" || typeof lng !== "number") return;

        // Update DB
        await db
          .update(driverProfilesTable)
          .set({ currentLat: lat, currentLng: lng })
          .where(eq(driverProfilesTable.userId, driverId));

        // Broadcast to admin clients
        const broadcast = JSON.stringify({
          type: "driver_location",
          driverId,
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

    // Send initial ping
    ws.send(JSON.stringify({ type: "connected" }));
  });

  logger.info("WebSocket server mounted at /ws");
}
