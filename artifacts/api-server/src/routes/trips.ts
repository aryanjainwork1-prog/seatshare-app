import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc } from "drizzle-orm";
import { db, tripsTable, driverProfilesTable, usersTable, vehiclesTable } from "@workspace/db";
import {
  ListTripsQueryParams,
  GetTripParams,
  CreateTripBody,
  UpdateTripBody,
  CancelTripBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichTrip(trip: typeof tripsTable.$inferSelect) {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, trip.driverProfileId));
  if (!profile) return { ...trip, driverProfile: null };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  // Prefer the specific vehicle attached to this trip; fall back to driver's first vehicle
  const vehicleQuery = trip.vehicleId
    ? db.select().from(vehiclesTable).where(eq(vehiclesTable.id, trip.vehicleId))
    : db.select().from(vehiclesTable).where(eq(vehiclesTable.driverProfileId, profile.id));
  const [vehicle] = await vehicleQuery;
  return { ...trip, driverProfile: { ...profile, user: user ?? null, vehicle: vehicle ?? null } };
}

router.get("/trips", async (req, res): Promise<void> => {
  const parsed = ListTripsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, driverProfileId, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(tripsTable.status, status));
  if (driverProfileId) conditions.push(eq(tripsTable.driverProfileId, driverProfileId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(tripsTable).where(whereClause);
  const trips = await db.select().from(tripsTable).where(whereClause).limit(limit).offset(offset).orderBy(desc(tripsTable.createdAt));

  const data = await Promise.all(trips.map(enrichTrip));
  res.json({ data, total, page, limit });
});

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.vehicleId != null) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, parsed.data.vehicleId));
    if (!v || v.driverProfileId !== parsed.data.driverProfileId) {
      res.status(400).json({ error: "Vehicle does not belong to this driver" });
      return;
    }
  }

  const [trip] = await db.insert(tripsTable).values({
    ...parsed.data,
    departureTime: new Date(parsed.data.departureTime),
  }).returning();

  res.status(201).json(await enrichTrip(trip));
});

router.get("/trips/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTripParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.id));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(await enrichTrip(trip));
});

router.patch("/trips/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trip] = await db.update(tripsTable).set(parsed.data).where(eq(tripsTable.id, id)).returning();
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(await enrichTrip(trip));
});

router.patch("/trips/:id/cancel", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = CancelTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trip] = await db.update(tripsTable)
    .set({ status: "cancelled", cancellationReason: parsed.data.reason ?? null })
    .where(eq(tripsTable.id, id))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(await enrichTrip(trip));
});

export default router;
