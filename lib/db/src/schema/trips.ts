import { pgTable, integer, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driverProfilesTable } from "./driver-profiles";

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  driverProfileId: integer("driver_profile_id").notNull().references(() => driverProfilesTable.id),
  originAddress: text("origin_address").notNull(),
  destAddress: text("dest_address").notNull(),
  originLat: real("origin_lat").notNull(),
  originLng: real("origin_lng").notNull(),
  destLat: real("dest_lat").notNull(),
  destLng: real("dest_lng").notNull(),
  availableSeats: integer("available_seats").notNull(),
  maxDeviationKm: real("max_deviation_km").notNull().default(5.0),
  status: text("status").notNull().default("pending"),
  farePerSeat: real("fare_per_seat").notNull(),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
