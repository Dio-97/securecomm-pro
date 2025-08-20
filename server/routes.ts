import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { loginSchema, insertMessageSchema } from "@shared/schema";
import { randomUUID } from "crypto";

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
      
      // Update user activity
      await storage.updateUserActivity(user.id);
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          isAdmin: user.isAdmin 
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
              
              // Send recent messages
              const messages = await storage.getAllMessages();
              ws.send(JSON.stringify({ 
                type: 'message_history', 
                messages: messages.slice(-50) 
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
            if (ws.userId && ws.username) {
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                username: ws.username,
              });
              
              // Broadcast to all connected clients
              broadcastToClients({ 
                type: 'new_message', 
                message: newMessage 
              });
              
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
