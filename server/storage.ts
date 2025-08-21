import { type User, type Message, type InsertUser, type Invitation, type SavedConversation, type SharedFile, type CryptoSession, type ConversationState, type InsertConversationState } from "@shared/schema";
import { users, messages, invitations, savedConversations, sharedFiles, cryptoSessions, conversationStates } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
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
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<boolean>;
  updateUserPassword(userId: string, password: string): Promise<boolean>;
  
  // Presence management
  setUserOnline(userId: string): Promise<void>;
  setUserOffline(userId: string): Promise<void>;
  isUserOnline(userId: string): boolean;
  getUsersInChat(userId1: string, userId2: string): string[];
  getUserPresenceStatus(userId: string, currentUserId: string, currentChatUserId?: string): 'online' | 'offline' | 'in-your-chat';
  getAllOnlineUsers(): string[];
  joinConversation(userId: string, otherUserId: string, joinedUserId: string): void;
  leaveConversation(userId: string, otherUserId: string, leftUserId: string): Promise<void>;
  
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
  
  // Advanced conversation state management
  getUserConversationState(userId: string, otherUserId: string): Promise<ConversationState | undefined>;
  updateConversationState(userId: string, otherUserId: string, updates: Partial<ConversationState>): Promise<void>;
  markConversationAsCleared(userId: string, otherUserId: string): Promise<void>;
  checkAndDestroyMessages(userId1: string, userId2: string): Promise<void>;
  
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
    const [user] = await db.select().from(users).where(eq(sql`LOWER(${users.username})`, username.toLowerCase()));
    return user || undefined;
  }

  async createUser(userData: InsertUser & { isInvited?: boolean; invitedBy?: string; location?: string; isAdmin?: boolean }): Promise<User> {
    // Check if username already exists (case-insensitive)
    const existingUser = await this.getUserByUsername(userData.username);
    if (existingUser) {
      throw new Error(`Username "${userData.username}" already exists`);
    }
    
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
      // Assicurati che sia immediatamente ricercabile
      isAdmin: false
    }).returning();

    // Log per tracciare la creazione di nuovi utenti
    console.log(`✅ Nuovo utente creato e indicizzato per la ricerca: ${user.username} (ID: ${user.id.slice(0, 8)}...)`);
    console.log(`📊 Stato ricerca: Username="${user.username}", Admin=${user.isAdmin}, Location="${user.location}"`);
    
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
    try {
      // Impedisci di eliminare admin23
      const user = await this.getUser(userId);
      if (!user || user.username === "admin23") {
        return false;
      }

      const result = await db.delete(users).where(eq(users.id, userId));
      return result.rowCount! > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    console.log(`🔍 Ricerca utenti: Trovati ${allUsers.length} utenti totali nel database`);
    return allUsers;
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
      location: "🏢 Office",
    }).where(eq(users.id, userId)).returning();

    return updatedUser || undefined;
  }

  async updateUsername(userId: string, username: string): Promise<boolean> {
    try {
      // Impedisci di modificare admin23
      const user = await this.getUser(userId);
      if (!user || user.username === "admin23") {
        return false;
      }

      // Controlla se l'username esiste già
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        return false;
      }

      const result = await db.update(users).set({ username }).where(eq(users.id, userId));
      return result.rowCount! > 0;
    } catch (error) {
      console.error('Error updating username:', error);
      return false;
    }
  }

  async updateUserAvatar(userId: string, avatar: string): Promise<boolean> {
    const result = await db.update(users).set({ avatar }).where(eq(users.id, userId));
    return result.rowCount! > 0;
  }

  async updateUserCredentials(userId: string, credentials: { username?: string; password?: string }): Promise<boolean> {
    // Check if new username already exists (case-insensitive)
    if (credentials.username) {
      const existingUser = await this.getUserByUsername(credentials.username);
      if (existingUser && existingUser.id !== userId) {
        throw new Error(`Username "${credentials.username}" already exists`);
      }
    }
    
    const result = await db.update(users).set(credentials).where(eq(users.id, userId));
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
    // Controlla lo stato della conversazione per userId1
    const conversationState = await this.getUserConversationState(userId1, userId2);
    
    // Se la conversazione è stata cleared per questo utente, non mostra messaggi
    if (conversationState?.conversationCleared) {
      return [];
    }
    
    return await db.select().from(messages).where(
      or(
        and(eq(messages.userId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.userId, userId2), eq(messages.recipientId, userId1))
      )
    ).orderBy(desc(messages.timestamp));
  }

  async getConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>> {
    console.log('📋 Caricamento conversazioni per utente:', userId);
    
    // 1. Ottieni tutte le conversazioni salvate esplicitamente
    const savedConvs = await db.select({
      otherUserId: savedConversations.otherUserId,
      savedAt: savedConversations.createdAt // Usa createdAt invece di savedAt
    }).from(savedConversations)
      .where(eq(savedConversations.userId, userId));
    
    console.log('💾 Conversazioni salvate trovate:', savedConvs.length);
    
    // 2. Trova tutti i messaggi dell'utente e identifica gli altri partecipanti
    const userMessages = await db.select().from(messages).where(
      or(
        eq(messages.userId, userId),
        eq(messages.recipientId, userId)
      )
    );

    // 3. Crea un set degli ID degli altri utenti (messaggi + conversazioni salvate)
    const otherUserIds = new Set<string>();
    userMessages.forEach(message => {
      if (message.userId === userId) {
        otherUserIds.add(message.recipientId);
      } else {
        otherUserIds.add(message.userId);
      }
    });
    
    // Aggiungi anche gli utenti dalle conversazioni salvate
    savedConvs.forEach(conv => otherUserIds.add(conv.otherUserId));

    console.log('👥 Utenti coinvolti totali:', otherUserIds.size);

    const conversations = new Map<string, { userId: string; username: string; lastMessage?: Message; unreadCount: number }>();

    // 4. Per ogni ID utente trovato, ottieni i dettagli dell'utente e l'ultimo messaggio
    for (const otherUserId of Array.from(otherUserIds)) {
      const otherUser = await this.getUser(otherUserId);
      if (!otherUser) continue;

      const conversationState = await this.getUserConversationState(userId, otherUser.id);
      const savedConv = savedConvs.find(sc => sc.otherUserId === otherUserId);
      
      // Mostra la conversazione solo se non è stata cleared
      const shouldShowMessages = !conversationState?.conversationCleared;
      
      let lastMessage = undefined;
      if (shouldShowMessages) {
        // Ottieni l'ultimo messaggio della conversazione
        const [message] = await db.select().from(messages).where(
          or(
            and(eq(messages.userId, userId), eq(messages.recipientId, otherUser.id)),
            and(eq(messages.userId, otherUser.id), eq(messages.recipientId, userId))
          )
        ).orderBy(desc(messages.timestamp)).limit(1);
        lastMessage = message || undefined;
      }

      // Includi la conversazione se: ha messaggi O è stata salvata esplicitamente
      if (lastMessage || savedConv || !conversationState?.conversationCleared) {
        conversations.set(otherUser.id, {
          userId: otherUser.id,
          username: otherUser.username,
          lastMessage: lastMessage,
          unreadCount: 0
        });
        
        console.log('✅ Conversazione inclusa:', otherUser.username, savedConv ? '(salvata)' : '(con messaggi)');
      }
    }

    const result = Array.from(conversations.values()).sort((a, b) => {
      // Priorità: conversazioni con messaggi recenti, poi conversazioni salvate
      const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 
                    savedConvs.find(sc => sc.otherUserId === a.userId)?.savedAt.getTime() || 0;
      const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 
                    savedConvs.find(sc => sc.otherUserId === b.userId)?.savedAt.getTime() || 0;
      return timeB - timeA;
    });

    console.log('📋 Conversazioni finali restituite:', result.length);
    return result;
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
    console.log('💾 SALVATAGGIO CONVERSAZIONE NEL DATABASE:', { userId, otherUserId });
    
    try {
      // Verifica se la conversazione esiste già
      const existing = await db.select().from(savedConversations).where(
        and(
          eq(savedConversations.userId, userId),
          eq(savedConversations.otherUserId, otherUserId)
        )
      );

      if (existing.length === 0) {
        await db.insert(savedConversations).values({
          userId,
          otherUserId
        });
        console.log('✅ Nuova conversazione salvata nel database');
      } else {
        console.log('📋 Conversazione già esistente nel database');
      }
    } catch (error) {
      console.error('❌ Errore salvataggio conversazione:', error);
      throw error;
    }
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

  // Conversation management functions
  joinConversation(userId: string, otherUserId: string, joinedUserId: string): void {
    const conversationKey = [userId, otherUserId].sort().join('-');
    
    if (!this.activeConversations.has(conversationKey)) {
      this.activeConversations.set(conversationKey, new Set());
    }
    
    this.activeConversations.get(conversationKey)!.add(joinedUserId);
    
    // Reset dello stato della conversazione quando l'utente rientra
    this.updateConversationState(joinedUserId, otherUserId, {
      isActiveInChat: true,
      conversationCleared: false,
    }).catch(console.error);
  }

  async leaveConversation(userId: string, otherUserId: string, leftUserId: string): Promise<void> {
    const conversationKey = [userId, otherUserId].sort().join('-');
    
    if (this.activeConversations.has(conversationKey)) {
      this.activeConversations.get(conversationKey)!.delete(leftUserId);
      
      // Aggiorna lo stato della conversazione per l'utente che esce
      await this.markConversationAsCleared(leftUserId, otherUserId);
      
      // Se non ci sono più utenti attivi nella conversazione, controlla se distruggere i messaggi
      const conversationUsers = this.activeConversations.get(conversationKey);
      if (conversationUsers && conversationUsers.size === 0) {
        await this.checkAndDestroyMessages(userId, otherUserId);
        this.activeConversations.delete(conversationKey);
      }
    }
  }

  // Nuove implementazioni per la gestione avanzata dello stato delle conversazioni
  async getUserConversationState(userId: string, otherUserId: string): Promise<ConversationState | undefined> {
    const [state] = await db.select().from(conversationStates).where(
      and(eq(conversationStates.userId, userId), eq(conversationStates.otherUserId, otherUserId))
    );
    return state || undefined;
  }

  async updateConversationState(userId: string, otherUserId: string, updates: Partial<ConversationState>): Promise<void> {
    const existingState = await this.getUserConversationState(userId, otherUserId);
    
    if (existingState) {
      await db.update(conversationStates).set({
        ...updates,
        lastActivity: new Date(),
      }).where(
        and(eq(conversationStates.userId, userId), eq(conversationStates.otherUserId, otherUserId))
      );
    } else {
      await db.insert(conversationStates).values({
        userId,
        otherUserId,
        ...updates,
        lastActivity: new Date(),
      });
    }
  }

  async markConversationAsCleared(userId: string, otherUserId: string): Promise<void> {
    await this.updateConversationState(userId, otherUserId, {
      conversationCleared: true,
      isActiveInChat: false,
      hasUnreadMessages: false,
    });
  }

  async checkAndDestroyMessages(userId1: string, userId2: string): Promise<void> {
    // Controlla se entrambi gli utenti hanno la conversazione marcata come cleared
    const state1 = await this.getUserConversationState(userId1, userId2);
    const state2 = await this.getUserConversationState(userId2, userId1);
    
    const bothCleared = (state1?.conversationCleared || false) && (state2?.conversationCleared || false);
    
    if (bothCleared) {
      // Distruggi permanentemente tutti i messaggi tra questi utenti
      await db.delete(messages).where(
        or(
          and(eq(messages.userId, userId1), eq(messages.recipientId, userId2)),
          and(eq(messages.userId, userId2), eq(messages.recipientId, userId1))
        )
      );
      
      // Rimuovi anche gli stati delle conversazioni
      await db.delete(conversationStates).where(
        or(
          and(eq(conversationStates.userId, userId1), eq(conversationStates.otherUserId, userId2)),
          and(eq(conversationStates.userId, userId2), eq(conversationStates.otherUserId, userId1))
        )
      );
      
      console.log(`🔥 Messaggi distrutti permanentemente tra ${userId1} e ${userId2}`);
    }
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<boolean> {
    try {
      // Impedisci di modificare admin23
      const user = await this.getUser(userId);
      if (!user || user.username === "admin23") {
        return false;
      }

      await db.update(users).set({ isAdmin }).where(eq(users.id, userId));
      return true;
    } catch (error) {
      console.error('Error updating admin status:', error);
      return false;
    }
  }

  async updateUserPassword(userId: string, password: string): Promise<boolean> {
    try {
      // Impedisci di modificare admin23
      const user = await this.getUser(userId);
      if (!user || user.username === "admin23") {
        return false;
      }

      await db.update(users).set({ password }).where(eq(users.id, userId));
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();