import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc, sql } from "drizzle-orm";
import { db, bookingsTable, tripsTable, usersTable, driverProfilesTable } from "@workspace/db";
import {
  ListBookingsQueryParams,
  GetBookingParams,
  CreateBookingBody,
  AcceptBookingBody,
  RejectBookingBody,
  CompleteBookingBody,
  CancelBookingBody,
} from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { sendPushNotification } from "../lib/push";
import type { Request, Response } from "express";

const router: IRouter = Router();

async function enrichBooking(booking: typeof bookingsTable.$inferSelect) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, booking.passengerId));
  return { ...booking, trip: trip ?? null, passenger: passenger ?? null };
}

async function getDriverPushToken(driverProfileId: number): Promise<string | null> {
  const [profile] = await db
    .select({ userId: driverProfilesTable.userId })
    .from(driverProfilesTable)
    .where(eq(driverProfilesTable.id, driverProfileId));
  if (!profile) return null;

  const [driverUser] = await db
    .select({ expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(eq(usersTable.id, profile.userId));
  return driverUser?.expoPushToken ?? null;
}

/**
 * Verifies that the requesting user is the driver who owns the booking's trip,
 * or is an admin. Returns the booking row if authorized, or sends 403/404 and returns null.
 */
async function requireBookingDriverOwnership(
  bookingId: number,
  req: Request,
  res: Response,
): Promise<(typeof bookingsTable.$inferSelect) | null> {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return null;
  }

  const requestingUserId = req.user?.sub;
  const requestingRole = req.user?.role;

  if (requestingRole === "admin") return booking;

  // Verify the requesting user is the driver who owns this booking's trip
  const [trip] = await db
    .select({ driverProfileId: tripsTable.driverProfileId })
    .from(tripsTable)
    .where(eq(tripsTable.id, booking.tripId));

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return null;
  }

  const [driverProfile] = await db
    .select({ userId: driverProfilesTable.userId })
    .from(driverProfilesTable)
    .where(eq(driverProfilesTable.id, trip.driverProfileId));

  if (!driverProfile || driverProfile.userId !== requestingUserId) {
    res.status(403).json({ error: "Forbidden: only the trip's driver can perform this action" });
    return null;
  }

  return booking;
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

  const enriched = await enrichBooking(booking);
  res.status(201).json(enriched);

  const passengerName = (enriched.passenger as { name?: string | null } | null)?.name ?? "A passenger";
  const driverToken = await getDriverPushToken(trip.driverProfileId);
  if (driverToken) {
    sendPushNotification({
      to: driverToken,
      title: "New Booking Request",
      body: `${passengerName} wants to join your trip: ${trip.originAddress} → ${trip.destAddress}`,
      data: { screen: "driver", bookingId: booking.id },
    }).catch(() => {});
  }
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

  const existingBooking = await requireBookingDriverOwnership(id, req, res);
  if (!existingBooking) return;

  const boardingCode = randomBytes(3).toString("hex").toUpperCase();
  const [booking] = await db.update(bookingsTable)
    .set({ status: "accepted", boardingCode })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const enriched = await enrichBooking(booking);
  res.json(enriched);

  const [passengerUser] = await db
    .select({ expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(eq(usersTable.id, booking.passengerId));

  const trip = enriched.trip as { originAddress?: string; destAddress?: string; driverProfileId?: number } | null;
  if (passengerUser?.expoPushToken) {
    sendPushNotification({
      to: passengerUser.expoPushToken,
      title: "Ride Confirmed! 🎉",
      body: `Your booking has been accepted${trip ? `: ${trip.originAddress} → ${trip.destAddress}` : ""}. Boarding code: ${boardingCode}`,
      data: {
        screen: "tracking",
        bookingId: id,
        driverProfileId: trip?.driverProfileId ?? 0,
        pickupLat: booking.pickupLat,
        pickupLng: booking.pickupLng,
      },
    }).catch(() => {});
  }
});

router.patch("/bookings/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = RejectBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existingBooking = await requireBookingDriverOwnership(id, req, res);
  if (!existingBooking) return;

  const [booking] = await db.update(bookingsTable)
    .set({ status: "rejected", rejectionReason: parsed.data.reason ?? null })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const enriched = await enrichBooking(booking);
  res.json(enriched);

  const [passengerUser] = await db
    .select({ expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(eq(usersTable.id, booking.passengerId));

  if (passengerUser?.expoPushToken) {
    sendPushNotification({
      to: passengerUser.expoPushToken,
      title: "Booking Update",
      body: `Unfortunately your booking was not accepted${parsed.data.reason ? `: ${parsed.data.reason}` : ". Try searching for another ride."}`,
      data: { screen: "bookings", bookingId: id },
    }).catch(() => {});
  }
});

router.patch("/bookings/:id/start", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const existingBooking = await requireBookingDriverOwnership(id, req, res);
  if (!existingBooking) return;

  const [booking] = await db.update(bookingsTable)
    .set({ status: "in_progress" })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const enriched = await enrichBooking(booking);
  res.json(enriched);

  const [passengerUser] = await db
    .select({ expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(eq(usersTable.id, booking.passengerId));

  const trip = enriched.trip as { originAddress?: string; destAddress?: string; driverProfileId?: number } | null;
  if (passengerUser?.expoPushToken) {
    sendPushNotification({
      to: passengerUser.expoPushToken,
      title: "Trip Started! 🚗",
      body: `Your ride is now in progress${trip ? ` to ${trip.destAddress}` : ""}. Enjoy your journey!`,
      data: {
        screen: "tracking",
        bookingId: id,
        driverProfileId: trip?.driverProfileId ?? 0,
        pickupLat: booking.pickupLat,
        pickupLng: booking.pickupLng,
      },
    }).catch(() => {});
  }
});

router.patch("/bookings/:id/complete", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  CompleteBookingBody.safeParse(req.body);

  const existingBooking = await requireBookingDriverOwnership(id, req, res);
  if (!existingBooking) return;

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

router.patch("/bookings/:id/cancel", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = CancelBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const requestingUserId = req.user?.sub;
  const requestingRole = req.user?.role;

  if (requestingRole !== "admin" && existing.passengerId !== requestingUserId) {
    res.status(403).json({ error: "Forbidden: only the passenger can cancel their booking" });
    return;
  }

  if (!["pending", "accepted"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot cancel a booking with status '${existing.status}'` });
    return;
  }

  const [booking] = await db.update(bookingsTable)
    .set({ status: "cancelled", rejectionReason: parsed.data.reason ?? null })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  if (existing.status === "accepted") {
    await db.update(usersTable)
      .set({ lateCancellations: sql`${usersTable.lateCancellations} + 1` })
      .where(eq(usersTable.id, booking.passengerId));
  }

  const enriched = await enrichBooking(booking);
  res.json(enriched);

  const [trip] = await db
    .select({ driverProfileId: tripsTable.driverProfileId, originAddress: tripsTable.originAddress, destAddress: tripsTable.destAddress })
    .from(tripsTable)
    .where(eq(tripsTable.id, booking.tripId));

  if (trip) {
    const driverToken = await getDriverPushToken(trip.driverProfileId);
    if (driverToken) {
      sendPushNotification({
        to: driverToken,
        title: "Booking Cancelled",
        body: `A passenger has cancelled their booking for your trip: ${trip.originAddress} → ${trip.destAddress}`,
        data: { screen: "driver", bookingId: id },
      }).catch(() => {});
    }
  }
});

export default router;
