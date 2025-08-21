import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  avatar: text("avatar"), // Base64 image or URL
  isAdmin: boolean("is_admin").default(false),
  isInvited: boolean("is_invited").default(false),
  invitedBy: varchar("invited_by"),
  lastActivity: timestamp("last_activity").defaultNow(),
  location: text("location"),
  messageCount: text("message_count").default("0"),
  realIp: text("real_ip"),
  maskedIp: text("masked_ip"),
  vpnServer: text("vpn_server"),
  vpnCountry: text("vpn_country"),
  // Signal Protocol keys
  identityKey: text("identity_key"),
  publicKey: text("public_key"),
  privateKey: text("private_key"),
  signedPreKey: text("signed_pre_key"),
  oneTimeKeys: text("one_time_keys"),
  // QR verification
  verificationQR: text("verification_qr"),
  isVerified: boolean("is_verified").default(false),
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
  // E2E Encryption
  encryptedContent: text("encrypted_content"),
  sessionId: text("session_id"),
  messageKey: text("message_key"),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedConversations = pgTable("saved_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  otherUserId: varchar("other_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  savedAt: timestamp("saved_at").defaultNow(),
  // E2E Session management
  sessionKey: text("session_key"),
  isVerified: boolean("is_verified").default(false),
});

// Nuova tabella per tracciare lo stato individuale delle conversazioni
export const conversationStates = pgTable("conversation_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  otherUserId: varchar("other_user_id").references(() => users.id).notNull(),
  lastSeenMessageId: varchar("last_seen_message_id"),
  isActiveInChat: boolean("is_active_in_chat").default(false),
  hasUnreadMessages: boolean("has_unread_messages").default(false),
  conversationCleared: boolean("conversation_cleared").default(false),
  lastActivity: timestamp("last_activity").defaultNow(),
});

export const sharedFiles = pgTable("shared_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: text("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  conversationId: text("conversation_id").notNull(),
  encryptionKey: text("encryption_key").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  downloadCount: text("download_count").default("0"),
  maxDownloads: text("max_downloads").default("10"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoSessions = pgTable("crypto_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId1: varchar("user_id_1").references(() => users.id).notNull(),
  userId2: varchar("user_id_2").references(() => users.id).notNull(),
  sessionState: text("session_state").notNull(),
  ratchetKey: text("ratchet_key").notNull(),
  messageNumber: text("message_number").default("0"),
  previousCounter: text("previous_counter").default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
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

export const insertConversationStateSchema = createInsertSchema(conversationStates);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type SavedConversation = typeof savedConversations.$inferSelect;
export type SharedFile = typeof sharedFiles.$inferSelect;
export type CryptoSession = typeof cryptoSessions.$inferSelect;
export type ConversationState = typeof conversationStates.$inferSelect;
export type InsertConversationState = z.infer<typeof insertConversationStateSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
