import { Router, type IRouter } from "express";
import { count, desc } from "drizzle-orm";
import { db, adminLogsTable } from "@workspace/db";
import { ListAdminLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin-logs", async (req, res): Promise<void> => {
  const parsed = ListAdminLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 50 } = parsed.data;
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: count() }).from(adminLogsTable);
  const data = await db.select().from(adminLogsTable).limit(limit).offset(offset).orderBy(desc(adminLogsTable.createdAt));

  res.json({ data, total, page, limit });
});

export default router;
