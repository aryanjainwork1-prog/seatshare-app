import { Router, type IRouter } from "express";
import { eq, and, SQL, count, avg, desc } from "drizzle-orm";
import { db, ratingsTable, usersTable } from "@workspace/db";
import {
  ListRatingsQueryParams,
  CreateRatingBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ratings", async (req, res): Promise<void> => {
  const parsed = ListRatingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ratedId, raterId, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (ratedId) conditions.push(eq(ratingsTable.ratedId, ratedId));
  if (raterId) conditions.push(eq(ratingsTable.raterId, raterId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(ratingsTable).where(whereClause);
  const data = await db.select().from(ratingsTable).where(whereClause).limit(limit).offset(offset).orderBy(desc(ratingsTable.createdAt));

  res.json({ data, total, page, limit });
});

router.post("/ratings", async (req, res): Promise<void> => {
  const parsed = CreateRatingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rating] = await db.insert(ratingsTable).values(parsed.data).returning();

  const [{ avgScore }] = await db
    .select({ avgScore: avg(ratingsTable.score) })
    .from(ratingsTable)
    .where(eq(ratingsTable.ratedId, parsed.data.ratedId));

  if (avgScore != null) {
    await db
      .update(usersTable)
      .set({ averageRating: Number(avgScore) })
      .where(eq(usersTable.id, parsed.data.ratedId));
  }

  res.status(201).json(rating);
});

export default router;
