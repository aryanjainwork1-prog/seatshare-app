import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, vehiclesTable, driverProfilesTable } from "@workspace/db";
import {
  ListVehiclesQueryParams,
  GetVehicleParams,
  CreateVehicleBody,
  UpdateVehicleBody,
  DeleteVehicleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vehicles", async (req, res): Promise<void> => {
  const parsed = ListVehiclesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, driverProfileId } = parsed.data;
  const offset = (page - 1) * limit;

  const where = driverProfileId ? eq(vehiclesTable.driverProfileId, driverProfileId) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(vehiclesTable).where(where);
  const data = await db.select().from(vehiclesTable).where(where).limit(limit).offset(offset).orderBy(vehiclesTable.createdAt);

  res.json({ data, total, page, limit });
});

router.post("/vehicles", async (req, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (req.user!.role !== "admin") {
    const [callerProfile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.user!.sub));
    if (!callerProfile || parsed.data.driverProfileId !== callerProfile.id) {
      res.status(403).json({ error: "Forbidden: driverProfileId does not belong to caller" });
      return;
    }
  }

  const [vehicle] = await db.insert(vehiclesTable).values(parsed.data).returning();
  res.status(201).json(vehicle);
});

router.get("/vehicles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetVehicleParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, params.data.id));
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.json(vehicle);
});

router.patch("/vehicles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = UpdateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (req.user!.role !== "admin") {
    const [callerProfile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.user!.sub));
    if (!callerProfile || existing.driverProfileId !== callerProfile.id) {
      res.status(403).json({ error: "Forbidden: vehicle belongs to a different driver" });
      return;
    }
  }

  const [vehicle] = await db.update(vehiclesTable).set(parsed.data).where(eq(vehiclesTable.id, id)).returning();
  res.json(vehicle);
});

router.delete("/vehicles/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteVehicleParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (req.user!.role !== "admin") {
    const [callerProfile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.user!.sub));
    if (!callerProfile || existing.driverProfileId !== callerProfile.id) {
      res.status(403).json({ error: "Forbidden: vehicle belongs to a different driver" });
      return;
    }
  }

  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, params.data.id));
  res.status(204).end();
});

export default router;
