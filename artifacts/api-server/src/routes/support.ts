import { Router, type IRouter } from "express";
import { eq, and, SQL, count, desc } from "drizzle-orm";
import { db, supportTicketsTable, usersTable } from "@workspace/db";
import {
  ListSupportTicketsQueryParams,
  GetSupportTicketParams,
  CreateSupportTicketBody,
  UpdateSupportTicketBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichTicket(ticket: typeof supportTicketsTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ticket.userId));
  return { ...ticket, user: user ?? null };
}

router.get("/support-tickets", async (req, res): Promise<void> => {
  const parsed = ListSupportTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(supportTicketsTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(supportTicketsTable).where(whereClause);
  const tickets = await db.select().from(supportTicketsTable).where(whereClause).limit(limit).offset(offset).orderBy(desc(supportTicketsTable.createdAt));

  const data = await Promise.all(tickets.map(enrichTicket));
  res.json({ data, total, page, limit });
});

router.post("/support-tickets", async (req, res): Promise<void> => {
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [ticket] = await db.insert(supportTicketsTable).values({ ...parsed.data, status: "open" }).returning();
  res.status(201).json(await enrichTicket(ticket));
});

router.get("/support-tickets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupportTicketParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, params.data.id));
  if (!ticket) {
    res.status(404).json({ error: "Support ticket not found" });
    return;
  }

  res.json(await enrichTicket(ticket));
});

router.patch("/support-tickets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);

  const parsed = UpdateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [ticket] = await db.update(supportTicketsTable).set(parsed.data).where(eq(supportTicketsTable.id, id)).returning();
  if (!ticket) {
    res.status(404).json({ error: "Support ticket not found" });
    return;
  }

  res.json(await enrichTicket(ticket));
});

export default router;
