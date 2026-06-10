import { pgTable, integer, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driverProfilesTable } from "./driver-profiles";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  driverProfileId: integer("driver_profile_id").notNull().references(() => driverProfilesTable.id),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  color: text("color").notNull(),
  licensePlate: text("license_plate").notNull().unique(),
  capacity: integer("capacity").notNull(),
  bodyType: text("body_type"),
  conditionNote: text("condition_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
