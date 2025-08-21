import { type User, type Message, type InsertUser, type Invitation, type SavedConversation, type SharedFile, type CryptoSession } from "@shared/schema";
import { users, messages, invitations, savedConversations, sharedFiles, cryptoSessions } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { vpnService } from "./vpn-service";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isInvited?: boolean; invitedBy?: string }): Promise<User>;
  createUserWithCredentials(invitedBy: string): Promise<{ user: User; credentials: { username: string; password: string } }>;
  deleteUser(userId: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  updateUserActivity(userId: string, realIp?: string): Promise<void>;
  rotateUserVPN(userId: string): Promise<User | undefined>;
  updateUsername(userId: string, username: string): Promise<boolean>;
  updateUserAvatar(userId: string, avatar: string): Promise<boolean>;
  updateUserCredentials(userId: string, credentials: { username?: string; password?: string }): Promise<boolean>;
  promoteUserToAdmin(userId: string): Promise<boolean>;
  
  // Presence management
  setUserOnline(userId: string): Promise<void>;
  setUserOffline(userId: string): Promise<void>;
  isUserOnline(userId: string): boolean;
  getUsersInChat(userId1: string, userId2: string): string[];
  getUserPresenceStatus(userId: string, currentUserId: string, currentChatUserId?: string): 'online' | 'offline' | 'in-your-chat';
  getAllOnlineUsers(): string[];
  
  // Message management
  createMessage(message: { content: string; userId: string; recipientId: string; username: string }): Promise<Message>;
  getAllMessages(): Promise<Message[]>;
  getMessagesByUser(userId: string): Promise<Message[]>;
  getConversationMessages(userId1: string, userId2: string): Promise<Message[]>;
  getConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>>;
  clearConversation(userId1: string, userId2: string): Promise<void>;
  saveConversation(userId: string, otherUserId: string): Promise<void>;
  removeSavedConversation(userId: string, otherUserId: string): Promise<void>;
  editMessage(messageId: string, content: string, editedBy: string): Promise<Message | undefined>;
  deleteMessage(messageId: string): Promise<boolean>;
  
  // Invitation management
  createInvitation(email: string, invitedBy: string): Promise<Invitation>;
  getInvitation(email: string): Promise<Invitation | undefined>;
  markInvitationUsed(email: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private activeConversations: Map<string, Set<string>> = new Map();
  private onlineUsers: Set<string> = new Set();

  constructor() {
    this.initializeDatabase();
    vpnService.startLoadBalancing();
  }

  private async initializeDatabase() {
    // Check if admin user exists
    const adminUser = await this.getUserByUsername("admin23");
    if (!adminUser) {
      await this.createAdminUser();
    }
  }

  private async createAdminUser() {
    const adminRealIp = this.generateRandomIP();
    const { maskedIp: adminMaskedIp, vpnServer: adminVpnServer } = vpnService.maskIP(adminRealIp);

    await db.insert(users).values({
      username: "admin23",
      password: "5550123",
      isAdmin: true,
      isInvited: true,
      lastActivity: new Date(),
      location: "🏢 HQ Office",
      realIp: adminRealIp,
      maskedIp: adminMaskedIp,
      vpnServer: adminVpnServer.name || "Zurich-01",
      vpnCountry: "Switzerland",
      messageCount: "0",
      isVerified: true,
    });
  }

  private generateRandomIP(): string {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(userData: InsertUser & { isInvited?: boolean; invitedBy?: string }): Promise<User> {
    const realIp = this.generateRandomIP();
    const { maskedIp, vpnServer } = vpnService.maskIP(realIp);

    const [user] = await db.insert(users).values({
      ...userData,
      lastActivity: new Date(),
      location: "🏢 Office",
      realIp,
      maskedIp,
      vpnServer: vpnServer.name || "Rome-01",
      vpnCountry: "Italy",
      messageCount: "0",
      isVerified: false,
    }).returning();

    return user;
  }

  async createUserWithCredentials(invitedBy: string): Promise<{ user: User; credentials: { username: string; password: string } }> {
    const adjectives = ["Smart", "Wise", "Bold", "Swift", "Calm", "Bright", "Sharp", "Quick"];
    const nouns = ["Fox", "Eagle", "Lion", "Wolf", "Bear", "Hawk", "Tiger", "Lynx"];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 99) + 1;
    
    const username = `${adjective}${noun}${number}`;
    const password = Math.random().toString(36).substring(2, 12);

    const user = await this.createUser({
      username,
      password,
      isInvited: true,
      invitedBy,
    });

    return { user, credentials: { username, password } };
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserActivity(userId: string, realIp?: string): Promise<void> {
    const updates: Partial<User> = { lastActivity: new Date() };
    if (realIp) {
      updates.realIp = realIp;
      const { maskedIp, vpnServer } = vpnService.maskIP(realIp);
      updates.maskedIp = maskedIp;
      updates.vpnServer = vpnServer.name || "Rome-01";
    }
    await db.update(users).set(updates).where(eq(users.id, userId));
  }

  async rotateUserVPN(userId: string): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const rotationResult = vpnService.rotateVPN();
    
    const [updatedUser] = await db.update(users).set({
      maskedIp: rotationResult.maskedIp,
      vpnServer: rotationResult.vpnServer.name || "Rome-01", 
      vpnCountry: rotationResult.vpnServer.country || "Italy",
      location: rotationResult.vpnServer.location || "🏢 Office",
    }).where(eq(users.id, userId)).returning();

    return updatedUser || undefined;
  }

  async updateUsername(userId: string, username: string): Promise<boolean> {
    const result = await db.update(users).set({ username }).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  async updateUserAvatar(userId: string, avatar: string): Promise<boolean> {
    const result = await db.update(users).set({ avatar }).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  async updateUserCredentials(userId: string, credentials: { username?: string; password?: string }): Promise<boolean> {
    const result = await db.update(users).set(credentials).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  async promoteUserToAdmin(userId: string): Promise<boolean> {
    const result = await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  // Presence management (in-memory for real-time performance)
  async setUserOnline(userId: string): Promise<void> {
    this.onlineUsers.add(userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    this.onlineUsers.delete(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getUsersInChat(userId1: string, userId2: string): string[] {
    const conversationId = [userId1, userId2].sort().join('-');
    return Array.from(this.activeConversations.get(conversationId) || []);
  }

  getUserPresenceStatus(userId: string, currentUserId: string, currentChatUserId?: string): 'online' | 'offline' | 'in-your-chat' {
    if (!this.isUserOnline(userId)) return 'offline';
    if (currentChatUserId && this.getUsersInChat(currentUserId, currentChatUserId).includes(userId)) {
      return 'in-your-chat';
    }
    return 'online';
  }

  getAllOnlineUsers(): string[] {
    return Array.from(this.onlineUsers);
  }

  // Message management
  async createMessage(messageData: { content: string; userId: string; recipientId: string; username: string }): Promise<Message> {
    const [message] = await db.insert(messages).values({
      ...messageData,
      isEncrypted: true,
    }).returning();

    // Update message count
    const user = await this.getUser(messageData.userId);
    if (user) {
      const newCount = (parseInt(user.messageCount || "0") + 1).toString();
      await db.update(users).set({ messageCount: newCount }).where(eq(users.id, messageData.userId));
    }

    return message;
  }

  async getAllMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.timestamp));
  }

  async getMessagesByUser(userId: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.userId, userId));
  }

  async getConversationMessages(userId1: string, userId2: string): Promise<Message[]> {
    return await db.select().from(messages).where(
      or(
        and(eq(messages.userId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.userId, userId2), eq(messages.recipientId, userId1))
      )
    ).orderBy(desc(messages.timestamp));
  }

  async getConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>> {
    const userMessages = await db.select().from(messages).where(
      or(eq(messages.userId, userId), eq(messages.recipientId, userId))
    ).orderBy(desc(messages.timestamp));

    const conversations = new Map<string, { userId: string; username: string; lastMessage?: Message; unreadCount: number }>();

    for (const message of userMessages) {
      const otherUserId = message.userId === userId ? message.recipientId : message.userId;
      const otherUsername = message.userId === userId ? 
        (await this.getUser(message.recipientId))?.username || "Unknown" :
        message.username;

      if (!conversations.has(otherUserId)) {
        conversations.set(otherUserId, {
          userId: otherUserId,
          username: otherUsername,
          lastMessage: message,
          unreadCount: 0
        });
      }
    }

    return Array.from(conversations.values());
  }

  async clearConversation(userId1: string, userId2: string): Promise<void> {
    await db.delete(messages).where(
      or(
        and(eq(messages.userId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.userId, userId2), eq(messages.recipientId, userId1))
      )
    );
  }

  async saveConversation(userId: string, otherUserId: string): Promise<void> {
    await db.insert(savedConversations).values({
      userId,
      otherUserId,
    });
  }

  async removeSavedConversation(userId: string, otherUserId: string): Promise<void> {
    await db.delete(savedConversations).where(
      and(eq(savedConversations.userId, userId), eq(savedConversations.otherUserId, otherUserId))
    );
  }

  async editMessage(messageId: string, content: string, editedBy: string): Promise<Message | undefined> {
    const [message] = await db.update(messages).set({
      content,
      editedBy,
      editedAt: new Date(),
    }).where(eq(messages.id, messageId)).returning();

    return message || undefined;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, messageId));
    return result.rowCount! > 0;
  }

  // Invitation management
  async createInvitation(email: string, invitedBy: string): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values({
      email,
      invitedBy,
      used: false,
    }).returning();

    return invitation;
  }

  async getInvitation(email: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.email, email));
    return invitation || undefined;
  }

  async markInvitationUsed(email: string): Promise<void> {
    await db.update(invitations).set({ used: true }).where(eq(invitations.email, email));
  }
}

export const storage = new DatabaseStorage();