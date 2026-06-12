import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const STALENESS_KEY = "staleness_threshold_minutes";
const DEFAULT_THRESHOLD = 15;

function envThreshold(): number {
  const raw = process.env["DRIVER_STALE_THRESHOLD_MINUTES"];
  if (!raw) return DEFAULT_THRESHOLD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const row = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, STALENESS_KEY))
    .limit(1);

  if (row.length > 0) {
    const minutes = Number(row[0]!.value);
    res.json({ stalenessThresholdMinutes: minutes, source: "db" as const });
  } else {
    res.json({ stalenessThresholdMinutes: envThreshold(), source: "env" as const });
  }
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { stalenessThresholdMinutes } = parsed.data;

  await db
    .insert(platformSettingsTable)
    .values({ key: STALENESS_KEY, value: String(stalenessThresholdMinutes) })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: {
        value: String(stalenessThresholdMinutes),
        updatedAt: new Date(),
      },
    });

  res.json({ stalenessThresholdMinutes, source: "db" as const });
});

export default router;
