import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
  isInvited: boolean("is_invited").default(false),
  invitedBy: varchar("invited_by"),
  lastActivity: timestamp("last_activity").defaultNow(),
  location: text("location"),
  messageCount: text("message_count").default("0"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  username: text("username").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isEncrypted: boolean("is_encrypted").default(true),
  editedBy: varchar("edited_by").references(() => users.id),
  editedAt: timestamp("edited_at"),
  viewedAt: timestamp("viewed_at"),
  destructionScheduled: boolean("destruction_scheduled").default(false),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
