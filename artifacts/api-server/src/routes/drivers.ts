import { Router, type IRouter } from "express";
import { eq, and, SQL, count } from "drizzle-orm";
import { db, driverProfilesTable, usersTable, vehiclesTable } from "@workspace/db";
import {
  ListDriverProfilesQueryParams,
  GetDriverProfileParams,
  UpdateDriverProfileBody,
  VerifyDriverProfileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichProfile(profile: typeof driverProfilesTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.driverProfileId, profile.id));
  return { ...profile, user: user ?? null, vehicle: vehicle ?? null };
}

router.get("/driver-profiles", async (req, res): Promise<void> => {
  const parsed = ListDriverProfilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isOnline, isVerified, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (isOnline !== undefined) conditions.push(eq(driverProfilesTable.isOnline, isOnline));
  if (isVerified !== undefined) conditions.push(eq(driverProfilesTable.isVerified, isVerified));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(driverProfilesTable).where(whereClause);
  const profiles = await db.select().from(driverProfilesTable).where(whereClause).limit(limit).offset(offset).orderBy(driverProfilesTable.createdAt);

  const data = await Promise.all(profiles.map(enrichProfile));
  res.json({ data, total, page, limit });
});

router.get("/driver-profiles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDriverProfileParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, params.data.id));
  if (!profile) {
    res.status(404).json({ error: "Driver profile not found" });
    return;
  }

  res.json(await enrichProfile(profile));
});

router.patch("/driver-profiles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = UpdateDriverProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.update(driverProfilesTable).set(parsed.data).where(eq(driverProfilesTable.id, id)).returning();
  if (!profile) {
    res.status(404).json({ error: "Driver profile not found" });
    return;
  }

  res.json(await enrichProfile(profile));
});

router.patch("/driver-profiles/:id/verify", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = VerifyDriverProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.update(driverProfilesTable)
    .set({ isVerified: parsed.data.verified })
    .where(eq(driverProfilesTable.id, id))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Driver profile not found" });
    return;
  }

  res.json(await enrichProfile(profile));
});

export default router;
