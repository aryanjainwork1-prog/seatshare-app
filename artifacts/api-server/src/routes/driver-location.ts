import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, driverProfilesTable } from "@workspace/db";
import { broadcastDriverLocation, notifyNearbyPassengers } from "../lib/websocket";

const router: IRouter = Router();

router.post("/driver-location", async (req, res): Promise<void> => {
  const caller = req.user!;
  if (caller.role !== "driver") {
    res.status(403).json({ error: "Driver role required" });
    return;
  }

  const { lat, lng } = req.body as { lat: unknown; lng: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng must be numbers" });
    return;
  }

  await db
    .update(driverProfilesTable)
    .set({ currentLat: lat, currentLng: lng })
    .where(eq(driverProfilesTable.userId, caller.sub));

  broadcastDriverLocation(caller.sub, lat, lng);
  notifyNearbyPassengers(caller.sub, lat, lng).catch(() => {});

  res.json({ ok: true });
});

export default router;
