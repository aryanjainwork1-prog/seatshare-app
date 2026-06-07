import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tripsTable, driverProfilesTable, vehiclesTable, usersTable } from "@workspace/db";
import { MatchDriversBody } from "@workspace/api-zod";
import { haversineKm, computeMatchScore, estimateEta } from "../lib/matching";

const router: IRouter = Router();

router.post("/match", async (req, res): Promise<void> => {
  const parsed = MatchDriversBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { passengerLat, passengerLng, destLat, destLng, maxResults = 10 } = parsed.data;

  const activeTrips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.status, "pending")));

  const results = [];

  for (const trip of activeTrips) {
    if (trip.availableSeats <= 0) continue;

    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, trip.driverProfileId));
    if (!profile || !profile.isOnline) continue;

    const { deviationKm, score } = computeMatchScore(
      passengerLat, passengerLng,
      destLat, destLng,
      trip.originLat, trip.originLng,
      trip.destLat, trip.destLng,
      profile.rating,
      trip.availableSeats
    );

    if (deviationKm > trip.maxDeviationKm) continue;

    const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.driverProfileId, profile.id));
    if (!vehicle) continue;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));

    const driverLat = profile.currentLat ?? trip.originLat;
    const driverLng = profile.currentLng ?? trip.originLng;
    const etaMinutes = estimateEta(passengerLat, passengerLng, driverLat, driverLng);

    const tripDist = haversineKm(passengerLat, passengerLng, destLat, destLng);
    const estimatedFare = Math.max(trip.farePerSeat, tripDist * 12);

    results.push({
      trip,
      driverProfile: { ...profile, user: user ?? null, vehicle: vehicle ?? null },
      vehicle,
      estimatedFare: Math.round(estimatedFare),
      deviationKm: Math.round(deviationKm * 10) / 10,
      matchScore: Math.round(score * 100) / 100,
      etaMinutes,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  const matches = results.slice(0, maxResults);

  res.json({ matches });
});

export default router;
