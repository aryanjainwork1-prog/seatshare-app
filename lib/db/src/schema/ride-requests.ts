import { pgTable, integer, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { driverProfilesTable } from "./driver-profiles";

export const rideRequestsTable = pgTable("ride_requests", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
  pickupAddress: text("pickup_address").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  pickupLat: real("pickup_lat"),
  pickupLng: real("pickup_lng"),
  dropoffLat: real("dropoff_lat"),
  dropoffLng: real("dropoff_lng"),
  preferredDepartureTime: text("preferred_departure_time"),
  preferredArrivalTime: text("preferred_arrival_time"),
  preferences: text("preferences"),
  walkingDistanceKm: real("walking_distance_km"),
  status: text("status").notNull().default("pending"),
  assignedDriverProfileId: integer("assigned_driver_profile_id").references(() => driverProfilesTable.id),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRideRequestSchema = createInsertSchema(rideRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;
export type RideRequest = typeof rideRequestsTable.$inferSelect;
