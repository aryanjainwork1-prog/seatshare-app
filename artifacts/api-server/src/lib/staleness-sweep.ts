import { lt, eq, and, isNotNull, inArray } from "drizzle-orm";
import { db, driverProfilesTable, adminLogsTable, usersTable } from "@workspace/db";
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
      .returning({
        id: driverProfilesTable.id,
        userId: driverProfilesTable.userId,
        locationUpdatedAt: driverProfilesTable.locationUpdatedAt,
      });

    if (result.length > 0) {
      logger.info(
        { count: result.length, thresholdMinutes },
        "Marked stale drivers offline",
      );

      // Fetch driver names so log entries are human-readable
      const userIds = result.map((r) => r.userId);
      const users = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds));
      const nameById = new Map(users.map((u) => [u.id, u.name ?? null]));

      // Write one admin-log entry per affected driver so admins can audit
      const logEntries = result.map((row) => {
        const driverName = nameById.get(row.userId) ?? `Driver #${row.id}`;
        const lastSeen = row.locationUpdatedAt
          ? row.locationUpdatedAt.toISOString()
          : "unknown";
        return {
          adminId: null as number | null,
          action: "auto_offline" as const,
          entityType: "driver_profile",
          entityId: row.id,
          details: `${driverName} — last location: ${lastSeen} (threshold: ${thresholdMinutes} min)`,
        };
      });

      await db.insert(adminLogsTable).values(logEntries);
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
