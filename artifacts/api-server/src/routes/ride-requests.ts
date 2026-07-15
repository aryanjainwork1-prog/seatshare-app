import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc } from "drizzle-orm";
import { db, rideRequestsTable, usersTable, driverProfilesTable, adminLogsTable } from "@workspace/db";
import {
  ListRideRequestsQueryParams,
  GetRideRequestParams,
  CreateRideRequestBody,
  UpdateRideRequestBody,
} from "@workspace/api-zod";
import { requireRole } from "../middleware/auth";
import { broadcastRideRequestEvent } from "../lib/websocket";
import { sanitizeUser } from "../lib/sanitize";

const router: IRouter = Router();

async function enrichRideRequest(request: typeof rideRequestsTable.$inferSelect) {
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, request.passengerId));

  let assignedDriver: typeof driverProfilesTable.$inferSelect | null = null;
  if (request.assignedDriverProfileId != null) {
    const [profile] = await db
      .select()
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.id, request.assignedDriverProfileId));
    assignedDriver = profile ?? null;
  }

  return {
    ...request,
    passenger: passenger ? sanitizeUser(passenger) : null,
    assignedDriver,
  };
}

// List ride requests — admins see all; passengers only their own
router.get("/ride-requests", async (req, res): Promise<void> => {
  const parsed = ListRideRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, passengerId, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(rideRequestsTable.status, status));

  // Non-admins may only see their own ride requests
  if (req.user?.role !== "admin") {
    conditions.push(eq(rideRequestsTable.passengerId, req.user!.sub));
  } else if (passengerId) {
    conditions.push(eq(rideRequestsTable.passengerId, passengerId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(rideRequestsTable).where(whereClause);
  const rows = await db
    .select()
    .from(rideRequestsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(rideRequestsTable.createdAt));

  const data = await Promise.all(rows.map(enrichRideRequest));
  res.json({ data, total, page, limit });
});

// Passenger submits a ride request. No matching, no assignment — persist only.
router.post("/ride-requests", async (req, res): Promise<void> => {
  const parsed = CreateRideRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(rideRequestsTable)
    .values({
      passengerId: req.user!.sub,
      pickupAddress: parsed.data.pickupAddress,
      dropoffAddress: parsed.data.dropoffAddress,
      pickupLat: parsed.data.pickupLat ?? null,
      pickupLng: parsed.data.pickupLng ?? null,
      dropoffLat: parsed.data.dropoffLat ?? null,
      dropoffLng: parsed.data.dropoffLng ?? null,
      preferredDepartureTime: parsed.data.preferredDepartureTime ?? null,
      preferredArrivalTime: parsed.data.preferredArrivalTime ?? null,
      preferences: parsed.data.preferences ?? null,
      walkingDistanceKm: parsed.data.walkingDistanceKm ?? null,
      status: "pending",
    })
    .returning();

  req.log.info({ rideRequestId: created.id, passengerId: created.passengerId }, "Ride request created");
  broadcastRideRequestEvent("ride_request_created", created.id);

  res.status(201).json(await enrichRideRequest(created));
});

// Get one ride request — admin or owning passenger
router.get("/ride-requests/:id", async (req, res): Promise<void> => {
  const parsed = GetRideRequestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [request] = await db.select().from(rideRequestsTable).where(eq(rideRequestsTable.id, parsed.data.id));
  if (!request) {
    res.status(404).json({ error: "Ride request not found" });
    return;
  }

  if (req.user?.role !== "admin" && request.passengerId !== req.user?.sub) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(await enrichRideRequest(request));
});

// Admin dispatch actions: approve / reject / assign driver / edit pickup+dropoff / notes / status
router.patch("/ride-requests/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const paramsParsed = GetRideRequestParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateRideRequestBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(rideRequestsTable)
    .where(eq(rideRequestsTable.id, paramsParsed.data.id));
  if (!existing) {
    res.status(404).json({ error: "Ride request not found" });
    return;
  }

  const updates: Partial<typeof rideRequestsTable.$inferInsert> = {};
  if (bodyParsed.data.status !== undefined) updates.status = bodyParsed.data.status;
  if (bodyParsed.data.pickupAddress !== undefined) updates.pickupAddress = bodyParsed.data.pickupAddress;
  if (bodyParsed.data.dropoffAddress !== undefined) updates.dropoffAddress = bodyParsed.data.dropoffAddress;
  if (bodyParsed.data.adminNotes !== undefined) updates.adminNotes = bodyParsed.data.adminNotes;
  if (bodyParsed.data.assignedDriverProfileId !== undefined) {
    if (bodyParsed.data.assignedDriverProfileId !== null) {
      const [profile] = await db
        .select({ id: driverProfilesTable.id })
        .from(driverProfilesTable)
        .where(eq(driverProfilesTable.id, bodyParsed.data.assignedDriverProfileId));
      if (!profile) {
        res.status(404).json({ error: "Driver profile not found" });
        return;
      }
    }
    updates.assignedDriverProfileId = bodyParsed.data.assignedDriverProfileId;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(rideRequestsTable)
    .set(updates)
    .where(eq(rideRequestsTable.id, paramsParsed.data.id))
    .returning();

  await db.insert(adminLogsTable).values({
    adminId: req.user!.sub,
    action: "update_ride_request",
    entityType: "ride_request",
    entityId: updated.id,
    details: JSON.stringify(updates),
  });

  broadcastRideRequestEvent("ride_request_updated", updated.id);

  res.json(await enrichRideRequest(updated));
});

export default router;
