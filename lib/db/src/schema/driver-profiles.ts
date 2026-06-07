import { pgTable, integer, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const driverProfilesTable = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  licenseNumber: text("license_number"),
  rating: real("rating").notNull().default(5.0),
  totalTrips: integer("total_trips").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDriverProfileSchema = createInsertSchema(driverProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfilesTable.$inferSelect;
