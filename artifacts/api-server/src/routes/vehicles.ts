import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, vehiclesTable } from "@workspace/db";
import {
  ListVehiclesQueryParams,
  GetVehicleParams,
  CreateVehicleBody,
  UpdateVehicleBody,
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

  const [vehicle] = await db.update(vehiclesTable).set(parsed.data).where(eq(vehiclesTable.id, id)).returning();
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.json(vehicle);
});

export default router;
