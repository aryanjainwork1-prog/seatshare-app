import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc } from "drizzle-orm";
import { db, bookingsTable, tripsTable, usersTable } from "@workspace/db";
import {
  ListBookingsQueryParams,
  GetBookingParams,
  CreateBookingBody,
  AcceptBookingBody,
  RejectBookingBody,
  CompleteBookingBody,
} from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router: IRouter = Router();

async function enrichBooking(booking: typeof bookingsTable.$inferSelect) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, booking.passengerId));
  return { ...booking, trip: trip ?? null, passenger: passenger ?? null };
}

router.get("/bookings", async (req, res): Promise<void> => {
  const parsed = ListBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, tripId, passengerId, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(bookingsTable.status, status));
  if (tripId) conditions.push(eq(bookingsTable.tripId, tripId));
  if (passengerId) conditions.push(eq(bookingsTable.passengerId, passengerId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(bookingsTable).where(whereClause);
  const bookings = await db.select().from(bookingsTable).where(whereClause).limit(limit).offset(offset).orderBy(desc(bookingsTable.createdAt));

  const data = await Promise.all(bookings.map(enrichBooking));
  res.json({ data, total, page, limit });
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, parsed.data.tripId));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const fare = trip.farePerSeat;
  const [booking] = await db.insert(bookingsTable).values({
    ...parsed.data,
    fare,
    status: "pending",
  }).returning();

  res.status(201).json(await enrichBooking(booking));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBookingParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id));
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(await enrichBooking(booking));
});

router.patch("/bookings/:id/accept", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  AcceptBookingBody.safeParse(req.body);

  const boardingCode = randomBytes(3).toString("hex").toUpperCase();
  const [booking] = await db.update(bookingsTable)
    .set({ status: "accepted", boardingCode })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(await enrichBooking(booking));
});

router.patch("/bookings/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = RejectBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [booking] = await db.update(bookingsTable)
    .set({ status: "rejected", rejectionReason: parsed.data.reason ?? null })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(await enrichBooking(booking));
});

router.patch("/bookings/:id/complete", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  CompleteBookingBody.safeParse(req.body);

  const [booking] = await db.update(bookingsTable)
    .set({ status: "completed" })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(await enrichBooking(booking));
});

export default router;
