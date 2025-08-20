import { type User, type Message, type InsertUser, type Invitation, type SavedConversation } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private messages: Map<string, Message>;
  private invitations: Map<string, Invitation>;
  private savedConversations: Map<string, SavedConversation>;
  private activeConversations: Map<string, Set<string>>; // conversationId -> Set of active userIds
  private onlineUsers: Set<string>; // Set of online user IDs

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.invitations = new Map();
    this.savedConversations = new Map();
    this.activeConversations = new Map();
    this.onlineUsers = new Set();
    
    // Start VPN load balancing
    vpnService.startLoadBalancing();
    
    // Create admin user
    const adminId = randomUUID();
    const adminRealIp = this.generateRandomIP();
    const { maskedIp: adminMaskedIp, vpnServer: adminVpnServer } = vpnService.maskIP(adminRealIp);
    
    const admin: User = {
      id: adminId,
      username: "admin23",
      password: "5550123",
      isAdmin: true,
      isInvited: true,
      invitedBy: null,
      lastActivity: new Date(),
      location: "Secure Network",
      messageCount: "0",
      realIp: adminRealIp,
      maskedIp: adminMaskedIp,
      vpnServer: adminVpnServer.name,
      vpnCountry: adminVpnServer.country,
    };
    this.users.set(adminId, admin);
    
    // Create some demo users
    const demoUsers = [
      { username: "john.doe", name: "John Doe", location: "Milan, IT" },
      { username: "maria.rossi", name: "Maria Rossi", location: "Rome, IT" },
      { username: "luca.bianchi", name: "Luca Bianchi", location: "Naples, IT" }
    ];
    
    demoUsers.forEach(user => {
      const id = randomUUID();
      const realIp = this.generateRandomIP();
      const { maskedIp, vpnServer } = vpnService.maskIP(realIp);
      
      const demoUser: User = {
        id,
        username: user.username,
        password: "demo123",
        isAdmin: false,
        isInvited: true,
        invitedBy: adminId,
        lastActivity: new Date(),
        location: `${vpnServer.city}, ${vpnServer.country}`,
        messageCount: Math.floor(Math.random() * 100).toString(),
        realIp,
        maskedIp,
        vpnServer: vpnServer.name,
        vpnCountry: vpnServer.country,
      };
      this.users.set(id, demoUser);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser & { isInvited?: boolean; invitedBy?: string }): Promise<User> {
    const id = randomUUID();
    
    // Generate VPN masking for new user
    const realIp = this.generateRandomIP();
    const { maskedIp, vpnServer } = vpnService.maskIP(realIp);
    
    const user: User = { 
      ...insertUser, 
      id,
      isAdmin: false,
      isInvited: insertUser.isInvited || false,
      invitedBy: insertUser.invitedBy || null,
      lastActivity: new Date(),
      location: `${vpnServer.city}, ${vpnServer.country}`,
      messageCount: "0",
      realIp,
      maskedIp,
      vpnServer: vpnServer.name,
      vpnCountry: vpnServer.country,
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => !user.isAdmin);
  }

  async createUserWithCredentials(invitedBy: string): Promise<{ user: User; credentials: { username: string; password: string } }> {
    // Generate secure credentials
    const username = `user_${Math.random().toString(36).substring(2, 8)}`;
    const password = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8).toUpperCase() + "@" + Math.floor(Math.random() * 99);
    
    const user = await this.createUser({
      username,
      password,
      isInvited: true,
      invitedBy
    });
    
    return {
      user,
      credentials: { username, password }
    };
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || user.isAdmin) {
      return false; // Cannot delete admin or non-existent users
    }
    
    // Delete user's messages
    const userMessages = Array.from(this.messages.values()).filter(msg => msg.userId === userId);
    userMessages.forEach(msg => this.messages.delete(msg.id));
    
    // Delete user
    return this.users.delete(userId);
  }

  async updateUserActivity(userId: string, realIp?: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastActivity = new Date();
      
      // Update IP if provided
      if (realIp && realIp !== user.realIp) {
        user.realIp = realIp;
        
        // Re-mask the new IP
        const { maskedIp, vpnServer } = vpnService.maskIP(realIp);
        user.maskedIp = maskedIp;
        user.vpnServer = vpnServer.name;
        user.vpnCountry = vpnServer.country;
        user.location = `${vpnServer.city}, ${vpnServer.country}`;
      }
      
      this.users.set(userId, user);
    }
  }

  async rotateUserVPN(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user && user.realIp) {
      const currentVpnId = vpnService.getAllServers().find(s => s.name === user.vpnServer)?.id;
      const { maskedIp, vpnServer } = vpnService.rotateVPN(currentVpnId);
      
      user.maskedIp = maskedIp;
      user.vpnServer = vpnServer.name;
      user.vpnCountry = vpnServer.country;
      user.location = `${vpnServer.city}, ${vpnServer.country}`;
      
      this.users.set(userId, user);
      return user;
    }
    return undefined;
  }

  async createMessage(message: { content: string; userId: string; recipientId: string; username: string }): Promise<Message> {
    const id = randomUUID();
    const newMessage: Message = {
      id,
      content: message.content,
      userId: message.userId,
      recipientId: message.recipientId,
      username: message.username,
      timestamp: new Date(),
      isEncrypted: true,
      editedBy: null,
      editedAt: null,
    };
    this.messages.set(id, newMessage);
    
    // Update user message count
    const user = this.users.get(message.userId);
    if (user && user.messageCount) {
      user.messageCount = (parseInt(user.messageCount) + 1).toString();
      this.users.set(message.userId, user);
    }
    
    return newMessage;
  }

  async clearConversation(userId1: string, userId2: string): Promise<void> {
    // Delete all messages between these two users
    const messagesToDelete = Array.from(this.messages.values()).filter(message => 
      (message.userId === userId1 && message.recipientId === userId2) ||
      (message.userId === userId2 && message.recipientId === userId1)
    );
    
    messagesToDelete.forEach(message => {
      this.messages.delete(message.id);
    });
  }

  // Track active users in conversations
  joinConversation(userId1: string, userId2: string, activeUserId: string): void {
    const conversationId = this.getConversationId(userId1, userId2);
    if (!this.activeConversations.has(conversationId)) {
      this.activeConversations.set(conversationId, new Set());
    }
    this.activeConversations.get(conversationId)!.add(activeUserId);
  }

  leaveConversation(userId1: string, userId2: string, activeUserId: string): void {
    const conversationId = this.getConversationId(userId1, userId2);
    const activeUsers = this.activeConversations.get(conversationId);
    
    if (activeUsers) {
      activeUsers.delete(activeUserId);
      
      // Clear conversation immediately when user leaves
      this.clearConversation(userId1, userId2);
      
      // Clean up tracking if no users active
      if (activeUsers.size === 0) {
        this.activeConversations.delete(conversationId);
      }
    }
  }

  private getConversationId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('-');
  }

  async getConversationMessages(userId1: string, userId2: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.userId === userId1 && message.recipientId === userId2) ||
        (message.userId === userId2 && message.recipientId === userId1)
      )
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async getConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>> {
    const userMessages = Array.from(this.messages.values())
      .filter(message => message.userId === userId || message.recipientId === userId);
    
    const conversationMap = new Map<string, { userId: string; username: string; lastMessage?: Message; unreadCount: number }>();
    
    // Add conversations with messages
    for (const message of userMessages) {
      const otherUserId = message.userId === userId ? message.recipientId : message.userId;
      const otherUser = this.users.get(otherUserId);
      
      if (otherUser) {
        const existing = conversationMap.get(otherUserId);
        const isUnread = message.recipientId === userId; // Messages sent TO current user are potentially unread
        
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          username: otherUser.username,
          lastMessage: !existing || (message.timestamp! > existing.lastMessage?.timestamp!) ? message : existing.lastMessage,
          unreadCount: (existing?.unreadCount || 0) + (isUnread ? 1 : 0)
        });
      }
    }
    
    // Add saved conversations without messages
    const savedConversations = Array.from(this.savedConversations.values())
      .filter(saved => saved.userId === userId);
    
    savedConversations.forEach(saved => {
      if (!conversationMap.has(saved.otherUserId)) {
        const otherUser = this.users.get(saved.otherUserId);
        if (otherUser) {
          conversationMap.set(saved.otherUserId, {
            userId: saved.otherUserId,
            username: otherUser.username,
            lastMessage: undefined,
            unreadCount: 0
          });
        }
      }
    });
    
    return Array.from(conversationMap.values())
      .sort((a, b) => {
        const aTime = a.lastMessage?.timestamp?.getTime() || 0;
        const bTime = b.lastMessage?.timestamp?.getTime() || 0;
        return bTime - aTime;
      });
  }

  async saveConversation(userId: string, otherUserId: string): Promise<void> {
    // Check if already saved (both directions)
    const existingForward = Array.from(this.savedConversations.values())
      .find(saved => saved.userId === userId && saved.otherUserId === otherUserId);
    const existingReverse = Array.from(this.savedConversations.values())
      .find(saved => saved.userId === otherUserId && saved.otherUserId === userId);
    
    if (!existingForward) {
      const savedConversation: SavedConversation = {
        id: randomUUID(),
        userId,
        otherUserId,
        createdAt: new Date()
      };
      this.savedConversations.set(savedConversation.id, savedConversation);
    }
    
    if (!existingReverse) {
      const savedConversationReverse: SavedConversation = {
        id: randomUUID(),
        userId: otherUserId,
        otherUserId: userId,
        createdAt: new Date()
      };
      this.savedConversations.set(savedConversationReverse.id, savedConversationReverse);
    }
  }

  async removeSavedConversation(userId: string, otherUserId: string): Promise<void> {
    // Remove saved conversation (both directions)
    const toRemove = Array.from(this.savedConversations.entries())
      .filter(([_, saved]) => 
        (saved.userId === userId && saved.otherUserId === otherUserId) ||
        (saved.userId === otherUserId && saved.otherUserId === userId)
      );
    
    toRemove.forEach(([id, _]) => {
      this.savedConversations.delete(id);
    });
  }

  async getAllMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort((a, b) => 
      a.timestamp!.getTime() - b.timestamp!.getTime()
    );
  }

  async getMessagesByUser(userId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.userId === userId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async editMessage(messageId: string, content: string, editedBy: string): Promise<Message | undefined> {
    const message = this.messages.get(messageId);
    if (message) {
      message.content = content;
      message.editedBy = editedBy;
      message.editedAt = new Date();
      this.messages.set(messageId, message);
      return message;
    }
    return undefined;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    return this.messages.delete(messageId);
  }

  async createInvitation(email: string, invitedBy: string): Promise<Invitation> {
    const id = randomUUID();
    const invitation: Invitation = {
      id,
      email,
      invitedBy,
      used: false,
      createdAt: new Date(),
    };
    this.invitations.set(id, invitation);
    return invitation;
  }

  async getInvitation(email: string): Promise<Invitation | undefined> {
    return Array.from(this.invitations.values()).find(
      (invitation) => invitation.email === email && !invitation.used
    );
  }

  async markInvitationUsed(email: string): Promise<void> {
    const invitation = await this.getInvitation(email);
    if (invitation) {
      invitation.used = true;
      this.invitations.set(invitation.id, invitation);
    }
  }

  private generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  // Presence management methods
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
    const conversationId = this.getConversationId(userId1, userId2);
    const activeUsers = this.activeConversations.get(conversationId);
    return activeUsers ? Array.from(activeUsers) : [];
  }

  getUserPresenceStatus(userId: string, currentUserId: string, currentChatUserId?: string): 'online' | 'offline' | 'in-your-chat' {
    if (!this.isUserOnline(userId)) {
      return 'offline';
    }
    
    // Check if user is in the same chat as current user
    if (currentChatUserId && currentChatUserId === userId) {
      const usersInChat = this.getUsersInChat(currentUserId, userId);
      if (usersInChat.includes(userId) && usersInChat.includes(currentUserId)) {
        return 'in-your-chat';
      }
    }
    
    return 'online';
  }

  getAllOnlineUsers(): string[] {
    return Array.from(this.onlineUsers);
  }
}

export const storage = new MemStorage();
