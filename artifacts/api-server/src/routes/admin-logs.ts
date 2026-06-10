import { Router, type IRouter } from "express";
import { count, desc, eq, and } from "drizzle-orm";
import { db, adminLogsTable } from "@workspace/db";
import { ListAdminLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin-logs", async (req, res): Promise<void> => {
  const parsed = ListAdminLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 50, action } = parsed.data;
  const offset = (page - 1) * limit;

  const where = action ? eq(adminLogsTable.action, action) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(adminLogsTable)
    .where(where);

  const data = await db
    .select()
    .from(adminLogsTable)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(adminLogsTable.createdAt));

  res.json({ data, total, page, limit });
});

export default router;
