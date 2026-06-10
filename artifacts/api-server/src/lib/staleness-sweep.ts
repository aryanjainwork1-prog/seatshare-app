import { lt, eq, and, isNotNull } from "drizzle-orm";
import { db, driverProfilesTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_STALE_THRESHOLD_MINUTES = 15;

function getThresholdMinutes(): number {
  const raw = process.env["DRIVER_STALE_THRESHOLD_MINUTES"];
  if (!raw) return DEFAULT_STALE_THRESHOLD_MINUTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_THRESHOLD_MINUTES;
}

export async function sweepStaleDrivers(): Promise<void> {
  const thresholdMinutes = getThresholdMinutes();
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  try {
    const result = await db
      .update(driverProfilesTable)
      .set({ isOnline: false })
      .where(
        and(
          eq(driverProfilesTable.isOnline, true),
          isNotNull(driverProfilesTable.locationUpdatedAt),
          lt(driverProfilesTable.locationUpdatedAt, cutoff),
        ),
      )
      .returning({ id: driverProfilesTable.id });

    if (result.length > 0) {
      logger.info(
        { count: result.length, thresholdMinutes },
        "Marked stale drivers offline",
      );
    }
  } catch (err) {
    logger.error({ err }, "staleness-sweep: failed to sweep stale drivers");
  }
}

const SWEEP_INTERVAL_MS = 60 * 1000;

export function startStalenessSweep(): () => void {
  logger.info(
    { thresholdMinutes: getThresholdMinutes(), intervalMs: SWEEP_INTERVAL_MS },
    "Starting driver staleness sweep",
  );

  void sweepStaleDrivers();

  const handle = setInterval(() => {
    void sweepStaleDrivers();
  }, SWEEP_INTERVAL_MS);

  return () => clearInterval(handle);
}
