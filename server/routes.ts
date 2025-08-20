import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { loginSchema, insertMessageSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { vpnService } from "./vpn-service";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const connectedClients = new Set<AuthenticatedWebSocket>();

  // Authentication endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Get client IP and update user activity
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      await storage.updateUserActivity(user.id, clientIp);
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          isAdmin: user.isAdmin,
          maskedIp: user.maskedIp,
          vpnServer: user.vpnServer,
          vpnCountry: user.vpnCountry
        } 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithStatus = users.map(user => ({
        id: user.id,
        username: user.username,
        lastActivity: user.lastActivity,
        location: user.location,
        messageCount: user.messageCount,
        initials: user.username.split('.').map(n => n[0].toUpperCase()).join(''),
        name: user.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' '),
      }));
      res.json(usersWithStatus);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get messages for a specific user (admin only)
  app.get("/api/messages/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const messages = await storage.getMessagesByUser(userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Get all messages
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getAllMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Get conversations for a user
  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get messages for a specific conversation
  app.get("/api/conversations/:userId1/:userId2", async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const messages = await storage.getConversationMessages(userId1, userId2);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation messages" });
    }
  });

  // Join conversation (track active user)
  app.post("/api/conversations/:userId1/:userId2/join", async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const { activeUserId } = req.body;
      
      (storage as any).joinConversation(userId1, userId2, activeUserId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to join conversation" });
    }
  });

  // Leave conversation (track user exit)
  app.post("/api/conversations/:userId1/:userId2/leave", async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const { activeUserId } = req.body;
      
      (storage as any).leaveConversation(userId1, userId2, activeUserId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to leave conversation" });
    }
  });

  // Save conversation for future access
  app.post("/api/conversations/save", async (req, res) => {
    try {
      const { userId, otherUserId } = req.body;
      await storage.saveConversation(userId, otherUserId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to save conversation" });
    }
  });

  // Search users by username
  app.get("/api/users/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      const allUsers = await storage.getAllUsers();
      const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase())
      ).map(user => ({
        id: user.id,
        username: user.username,
        initials: user.username.split('.').map(n => n[0].toUpperCase()).join(''),
        name: user.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' '),
        lastActivity: user.lastActivity,
        location: user.location
      }));
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Edit message (admin only)
  app.put("/api/messages/:messageId", async (req, res) => {
    try {
      const { messageId } = req.params;
      const { content, editedBy } = req.body;
      
      const message = await storage.editMessage(messageId, content, editedBy);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Broadcast message edit to all connected clients
      broadcastToClients({ 
        type: 'message_edited', 
        message 
      });
      
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to edit message" });
    }
  });

  // Delete message (admin only)
  app.delete("/api/messages/:messageId", async (req, res) => {
    try {
      const { messageId } = req.params;
      const success = await storage.deleteMessage(messageId);
      
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Broadcast message deletion to all connected clients
      broadcastToClients({ 
        type: 'message_deleted', 
        messageId 
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Create user with auto-generated credentials (admin only)
  app.post("/api/users/create", async (req, res) => {
    try {
      const { invitedBy } = req.body;
      const result = await storage.createUserWithCredentials(invitedBy);
      
      res.json({
        user: {
          id: result.user.id,
          username: result.user.username,
          lastActivity: result.user.lastActivity,
          location: result.user.location,
          messageCount: result.user.messageCount,
          initials: result.user.username.split('_').map(n => n[0].toUpperCase()).join(''),
          name: result.user.username.split('_').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')
        },
        credentials: result.credentials
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or cannot be deleted" });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get VPN servers status
  app.get("/api/vpn/servers", async (req, res) => {
    try {
      const servers = vpnService.getAllServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VPN servers" });
    }
  });

  // Rotate VPN for user
  app.post("/api/vpn/rotate", async (req, res) => {
    try {
      const { userId } = req.body;
      const updatedUser = await storage.rotateUserVPN(userId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        maskedIp: updatedUser.maskedIp,
        vpnServer: updatedUser.vpnServer,
        vpnCountry: updatedUser.vpnCountry,
        location: updatedUser.location
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to rotate VPN" });
    }
  });

  // WebSocket connection handling
  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            const user = await storage.getUserByUsername(message.username);
            if (user && user.password === message.password) {
              ws.userId = user.id;
              ws.username = user.username;
              ws.isAdmin = user.isAdmin || false;
              connectedClients.add(ws);
              
              ws.send(JSON.stringify({ 
                type: 'auth_success', 
                user: { 
                  id: user.id, 
                  username: user.username, 
                  isAdmin: user.isAdmin 
                } 
              }));
              
              // Send user's conversations instead of all messages
              const conversations = await storage.getConversations(user.id);
              ws.send(JSON.stringify({ 
                type: 'conversations_list', 
                conversations 
              }));
              
              // Broadcast user joined
              broadcastToClients({ 
                type: 'user_joined', 
                username: user.username 
              }, ws);
            } else {
              ws.send(JSON.stringify({ type: 'auth_error' }));
            }
            break;
            
          case 'send_message':
            if (ws.userId && ws.username && message.recipientId) {
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                recipientId: message.recipientId,
                username: ws.username,
              });
              
              // Send to sender and recipient only
              const recipientClient = Array.from(connectedClients).find(client => client.userId === message.recipientId);
              const senderClient = Array.from(connectedClients).find(client => client.userId === ws.userId);
              
              const messageData = { 
                type: 'new_message', 
                message: newMessage 
              };
              
              if (recipientClient && recipientClient.readyState === WebSocket.OPEN) {
                recipientClient.send(JSON.stringify(messageData));
              }
              if (senderClient && senderClient.readyState === WebSocket.OPEN) {
                senderClient.send(JSON.stringify(messageData));
              }
              
              await storage.updateUserActivity(ws.userId);
            }
            break;
            
          case 'god_mode_view':
            if (ws.isAdmin) {
              const targetUser = await storage.getUserByUsername(message.targetUsername);
              if (targetUser) {
                const userMessages = await storage.getMessagesByUser(targetUser.id);
                ws.send(JSON.stringify({ 
                  type: 'god_mode_messages', 
                  messages: userMessages,
                  targetUser: targetUser 
                }));
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      if (ws.username) {
        broadcastToClients({ 
          type: 'user_left', 
          username: ws.username 
        }, ws);
      }
    });
  });

  function broadcastToClients(message: any, excludeWs?: AuthenticatedWebSocket) {
    connectedClients.forEach(client => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}
