/**
 * Seed script — run once to populate required bootstrap data.
 * Usage: pnpm --filter @workspace/db run seed
 *
 * Idempotent: safe to run multiple times.
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { usersTable } from "./schema/users.js";

// ─── Admin user ──────────────────────────────────────────────────────────────
const ADMIN_PHONE = "+91-9876543001";
const ADMIN_EMAIL = "admin@seatshare.com";
const ADMIN_PASSWORD = "admin123";

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

const existing = await db
  .select({ id: usersTable.id, role: usersTable.role })
  .from(usersTable)
  .where(eq(usersTable.phone, ADMIN_PHONE));

if (existing.length > 0) {
  await db
    .update(usersTable)
    .set({ email: ADMIN_EMAIL, passwordHash, role: "admin" })
    .where(eq(usersTable.phone, ADMIN_PHONE));
  console.log(`[seed] Admin user updated (phone: ${ADMIN_PHONE}, email: ${ADMIN_EMAIL})`);
} else {
  await db.insert(usersTable).values({
    phone: ADMIN_PHONE,
    email: ADMIN_EMAIL,
    name: "Super Admin",
    role: "admin",
    status: "active",
    passwordHash,
  });
  console.log(`[seed] Admin user inserted (phone: ${ADMIN_PHONE}, email: ${ADMIN_EMAIL})`);
}

console.log("[seed] Done.");
await pool.end();
