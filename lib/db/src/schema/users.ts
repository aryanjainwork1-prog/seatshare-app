import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("passenger"),
  status: text("status").notNull().default("active"),
  age: integer("age"),
  gender: text("gender"),
  workplace: text("workplace"),
  officeLocation: text("office_location"),
  passwordHash: text("password_hash"),
  refreshToken: text("refresh_token"),
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
