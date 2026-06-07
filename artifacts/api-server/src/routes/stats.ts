import { Router, type IRouter } from "express";
import { eq, count, sum, desc, gte, lte, and } from "drizzle-orm";
import { db, usersTable, driverProfilesTable, tripsTable, bookingsTable, paymentsTable, supportTicketsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(usersTable);
  const [{ totalDrivers }] = await db.select({ totalDrivers: count() }).from(driverProfilesTable);
  const [{ totalTrips }] = await db.select({ totalTrips: count() }).from(tripsTable);
  const [{ activeTrips }] = await db.select({ activeTrips: count() }).from(tripsTable).where(eq(tripsTable.status, "active"));
  const [{ totalBookings }] = await db.select({ totalBookings: count() }).from(bookingsTable);
  const [{ pendingBookings }] = await db.select({ pendingBookings: count() }).from(bookingsTable).where(eq(bookingsTable.status, "pending"));
  const [{ openTickets }] = await db.select({ openTickets: count() }).from(supportTicketsTable).where(eq(supportTicketsTable.status, "open"));
  const [{ onlineDrivers }] = await db.select({ onlineDrivers: count() }).from(driverProfilesTable).where(eq(driverProfilesTable.isOnline, true));

  const revenueResult = await db.select({ totalRevenue: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.status, "completed"));
  const totalRevenue = Number(revenueResult[0]?.totalRevenue ?? 0);

  res.json({
    totalUsers,
    totalDrivers,
    totalTrips,
    activeTrips,
    totalBookings,
    pendingBookings,
    totalRevenue,
    openTickets,
    onlineDrivers,
  });
});

router.get("/stats/activity", async (_req, res): Promise<void> => {
  const recentTrips = await db.select().from(tripsTable).orderBy(desc(tripsTable.createdAt)).limit(5);
  const recentBookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)).limit(5);
  const recentUsers = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);

  const now = new Date();
  const tripsByDay: { date: string; value: number }[] = [];
  const revenueByDay: { date: string; value: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const [dayTrips] = await db
      .select({ c: count() })
      .from(tripsTable)
      .where(and(gte(tripsTable.createdAt, startOfDay), lte(tripsTable.createdAt, endOfDay)));

    const [dayRevenue] = await db
      .select({ s: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(and(gte(paymentsTable.createdAt, startOfDay), lte(paymentsTable.createdAt, endOfDay)));

    tripsByDay.push({ date: dateStr, value: Number(dayTrips?.c ?? 0) });
    revenueByDay.push({ date: dateStr, value: Number(dayRevenue?.s ?? 0) });
  }

  res.json({
    recentTrips,
    recentBookings,
    recentUsers,
    tripsByDay,
    revenueByDay,
  });
});

export default router;
