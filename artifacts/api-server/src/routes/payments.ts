import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc } from "drizzle-orm";
import { db, paymentsTable } from "@workspace/db";
import {
  ListPaymentsQueryParams,
  GetPaymentParams,
  CreatePaymentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payments", async (req, res): Promise<void> => {
  const parsed = ListPaymentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, bookingId, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(paymentsTable.status, status));
  if (bookingId) conditions.push(eq(paymentsTable.bookingId, bookingId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(paymentsTable).where(whereClause);
  const data = await db.select().from(paymentsTable).where(whereClause).limit(limit).offset(offset).orderBy(desc(paymentsTable.createdAt));

  res.json({ data, total, page, limit });
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({
    ...parsed.data,
    status: "pending",
  }).returning();

  res.status(201).json(payment);
});

router.get("/payments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPaymentParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  res.json(payment);
});

export default router;
