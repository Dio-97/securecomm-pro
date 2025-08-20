import { type User, type Message, type InsertUser, type Invitation } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isInvited?: boolean; invitedBy?: string }): Promise<User>;
  createUserWithCredentials(invitedBy: string): Promise<{ user: User; credentials: { username: string; password: string } }>;
  deleteUser(userId: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  updateUserActivity(userId: string): Promise<void>;
  
  // Message management
  createMessage(message: { content: string; userId: string; username: string }): Promise<Message>;
  getAllMessages(): Promise<Message[]>;
  getMessagesByUser(userId: string): Promise<Message[]>;
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

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.invitations = new Map();
    
    // Create admin user
    const adminId = randomUUID();
    const admin: User = {
      id: adminId,
      username: "admin23",
      password: "5550123",
      isAdmin: true,
      isInvited: true,
      invitedBy: null,
      lastActivity: new Date(),
      location: "System",
      messageCount: "0",
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
      const demoUser: User = {
        id,
        username: user.username,
        password: "demo123",
        isAdmin: false,
        isInvited: true,
        invitedBy: adminId,
        lastActivity: new Date(),
        location: user.location,
        messageCount: Math.floor(Math.random() * 100).toString(),
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
    const user: User = { 
      ...insertUser, 
      id,
      isAdmin: false,
      isInvited: insertUser.isInvited || false,
      invitedBy: insertUser.invitedBy || null,
      lastActivity: new Date(),
      location: "Unknown",
      messageCount: "0",
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

  async updateUserActivity(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastActivity = new Date();
      this.users.set(userId, user);
    }
  }

  async createMessage(message: { content: string; userId: string; username: string }): Promise<Message> {
    const id = randomUUID();
    const newMessage: Message = {
      id,
      content: message.content,
      userId: message.userId,
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
}

export const storage = new MemStorage();
