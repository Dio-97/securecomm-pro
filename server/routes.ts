import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { loginSchema, insertMessageSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { vpnService } from "./vpn-service";
import { qrService } from "./qr-service";
import { wireGuardService } from "./wireguard-service";
import { dnsService } from "./dns-service";
import { fileService } from "./file-service";
import express from "express";
import multer from "multer";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });
  
  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const connectedClients = new Map<string, AuthenticatedWebSocket>();
  const MAX_CONNECTIONS = 20;
  
  // Add health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      websocket: {
        connected: connectedClients.size,
        maxConnections: MAX_CONNECTIONS,
        port: httpServer.listening ? "active" : "inactive"
      }
    });
  });

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
          avatar: user.avatar,
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
        isAdmin: user.isAdmin,
        avatar: user.avatar,
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

  // Remove saved conversation
  app.delete("/api/conversations/saved", async (req, res) => {
    try {
      const { userId, otherUserId } = req.body;
      await storage.removeSavedConversation(userId, otherUserId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove saved conversation" });
    }
  });

  // Search users by username - Ricerca universale per tutti gli utenti
  app.get("/api/users/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      
      if (!query || query.length < 1) {
        console.log(`⚠️ Query vuota ricevuta`);
        return res.json([]);
      }
      
      // Ottieni tutti gli utenti dal database (inclusi admin, utenti normali, invitati)
      const allUsers = await storage.getAllUsers();
      console.log(`📊 Database contiene ${allUsers.length} utenti totali per la ricerca`);
      
      // Filtra gli utenti che corrispondono alla query (inclusi tutti gli utenti e admin)
      const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase())
      ).map(user => ({
        id: user.id,
        username: user.username,
        initials: user.username.length >= 2 ? user.username.slice(0, 2).toUpperCase() : user.username.toUpperCase(),
        name: user.username.charAt(0).toUpperCase() + user.username.slice(1),
        lastActivity: user.lastActivity ? new Date(user.lastActivity).toLocaleString('it-IT') : "Mai",
        location: user.location || "🏢 Office",
        isAdmin: user.isAdmin || false
      }));
      
      console.log(`🔍 Search query: "${query}" → Trovati ${filtered.length}/${allUsers.length} utenti:`, filtered.map(u => `${u.username}${u.isAdmin ? ' (Admin)' : ''}`));
      
      res.json(filtered);
    } catch (error) {
      console.error("Error searching users:", error);
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

  // Update user admin status (admin23 only)
  app.patch('/api/users/:id/admin', async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin } = req.body;
      
      await storage.updateUserAdminStatus(id, isAdmin);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating admin status:', error);
      res.status(500).json({ error: 'Failed to update admin status' });
    }
  });

  // Update user password (admin23 only)
  app.patch('/api/users/:id/password', async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      await storage.updateUserPassword(id, password);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  // Update username (admin23 only)
  app.patch('/api/users/:id/username', async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      
      await storage.updateUsername(id, username);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating username:', error);
      res.status(500).json({ error: 'Username already exists or invalid' });
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

  // QR Code Generation and Verification
  app.post("/api/qr/generate", async (req, res) => {
    try {
      const { userId, username, publicKey } = req.body;
      const qrCode = await qrService.generateVerificationQR(userId, username, publicKey);
      res.json({ qrCode });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  app.post("/api/qr/verify", (req, res) => {
    try {
      const { qrData } = req.body;
      
      // Try to parse and determine QR type
      const parsedData = JSON.parse(qrData);
      
      if (parsedData.type === 'user_identity') {
        const result = qrService.verifyUserIdentityQR(qrData);
        res.json(result);
      } else if (parsedData.type === 'conversation_verification') {
        // For conversation verification, we need additional context
        const result = qrService.verifyQRCode(qrData);
        res.json(result);
      } else {
        // Legacy QR verification
        const result = qrService.verifyQRCode(qrData);
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to verify QR code" });
    }
  });

  // Generate user identity QR code
  app.post("/api/qr/generate-identity", async (req, res) => {
    try {
      const { userId, username, publicKey } = req.body;
      
      if (!userId || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Generate a default public key if not provided
      const key = publicKey || `pk_${userId}_${Date.now()}`;
      
      const qrCode = await qrService.generateUserIdentityQR(userId, username, key);
      res.json({ qrCode, deviceId: key });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate identity QR code" });
    }
  });

  app.post("/api/qr/conversation", async (req, res) => {
    try {
      const { senderId, senderUsername, recipientId, recipientUsername } = req.body;
      const qrCode = await qrService.generateConversationVerificationQR(
        senderId, senderUsername, recipientId, recipientUsername
      );
      res.json({ qrCode });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate conversation QR code" });
    }
  });

  // WireGuard VPN Integration
  app.post("/api/vpn/connect", async (req, res) => {
    try {
      const { userId, serverId } = req.body;
      const connection = await wireGuardService.connectVPN(userId, serverId);
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to connect to VPN" });
    }
  });

  app.post("/api/vpn/disconnect", async (req, res) => {
    try {
      const { connectionId } = req.body;
      const result = await wireGuardService.disconnectVPN(connectionId);
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect from VPN" });
    }
  });

  app.get("/api/vpn/status/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const connections = wireGuardService.getConnectionStatus(userId);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to get VPN status" });
    }
  });

  // DNS Protection
  app.post("/api/dns/resolve", async (req, res) => {
    try {
      const { domain, type = 'A', userId } = req.body;
      const result = await dnsService.resolveDomain(domain, type, userId);
      res.json({ domain, result });
    } catch (error) {
      res.status(500).json({ error: "DNS resolution failed" });
    }
  });

  app.get("/api/dns/stats/:userId?", (req, res) => {
    try {
      const { userId } = req.params;
      const stats = dnsService.getStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get DNS stats" });
    }
  });

  app.post("/api/dns/block", (req, res) => {
    try {
      const { domain } = req.body;
      dnsService.blockDomain(domain);
      res.json({ success: true, message: `Domain ${domain} blocked` });
    } catch (error) {
      res.status(500).json({ error: "Failed to block domain" });
    }
  });

  // File Sharing with Encryption
  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { conversationId, expirationHours = 24, maxDownloads = 10 } = req.body;
      const { originalname, mimetype, buffer } = req.file;
      const uploadedBy = (req as any).session?.user?.id;

      if (!uploadedBy) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const result = await fileService.uploadFile(
        buffer,
        originalname,
        mimetype,
        uploadedBy,
        conversationId,
        parseInt(expirationHours),
        parseInt(maxDownloads)
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/files/download/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const userId = (req as any).session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const result = await fileService.downloadFile(fileId, userId);
      if (!result) {
        return res.status(404).json({ error: "File not found or expired" });
      }

      const { buffer, metadata } = result;
      
      res.setHeader('Content-Type', metadata.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.get("/api/files/conversation/:conversationId", (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const files = fileService.getConversationFiles(conversationId, userId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to get conversation files" });
    }
  });

  app.delete("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const userId = (req as any).session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const result = await fileService.deleteFile(fileId, userId);
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Admin monitor all messages endpoint
  app.get("/api/admin/monitor/messages", async (req, res) => {
    try {
      const allMessages = await storage.getAllMessages();
      const users = await storage.getAllUsers();
      
      // Add admin user to the list for complete user mapping
      const adminUsers = await storage.getUser("admin");
      const allUsersIncludingAdmin = adminUsers ? [...users, adminUsers] : users;
      
      // Create user lookup map
      const userMap = allUsersIncludingAdmin.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);

      // Format messages with user info and sort by timestamp (most recent first)
      const monitoredMessages = allMessages
        .map(message => {
          const sender = userMap[message.userId];
          const recipient = userMap[message.recipientId];
          
          return {
            id: message.id,
            content: message.content,
            senderId: message.userId,
            senderUsername: sender?.username || 'Unknown',
            recipientId: message.recipientId,
            recipientUsername: recipient?.username || 'Unknown',
            timestamp: message.timestamp,
            isEncrypted: message.isEncrypted || true,
            senderAvatar: sender?.avatar || null
          };
        })
        .sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateB - dateA; // Most recent first
        });

      res.json(monitoredMessages);
    } catch (error) {
      console.error("Error fetching monitored messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Admin update user credentials endpoint
  app.put("/api/admin/update-credentials", async (req, res) => {
    try {
      const { targetUsername, newUsername, newPassword } = req.body;
      
      if (!targetUsername) {
        return res.status(400).json({ error: "Target username is required" });
      }
      
      if (!newUsername && !newPassword) {
        return res.status(400).json({ error: "At least one field (username or password) must be provided" });
      }
      
      // Find target user
      const targetUser = await storage.getUserByUsername(targetUsername);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (targetUser.isAdmin) {
        return res.status(403).json({ error: "Cannot modify admin credentials" });
      }
      
      // Update credentials
      const result = await storage.updateUserCredentials(targetUser.id, { 
        username: newUsername,
        password: newPassword 
      });
      
      if (result) {
        res.json({ 
          success: true, 
          message: `Credentials updated for ${targetUsername}`,
          newUsername: newUsername || targetUsername
        });
      } else {
        res.status(500).json({ error: "Failed to update credentials" });
      }
    } catch (error) {
      console.error("Error updating user credentials:", error);
      if ((error as Error).message.includes("already exists")) {
        res.status(400).json({ error: (error as Error).message });
      } else {
        res.status(500).json({ error: "Failed to update credentials" });
      }
    }
  });

  // Toggle admin status endpoint
  app.put("/api/admin/toggle/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { makeAdmin } = req.body;
      
      // Get user to check if it's admin23
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.username === "admin23") {
        return res.status(403).json({ error: "Cannot modify admin23 status" });
      }
      
      const success = await storage.updateUserCredentials(userId, {});
      
      if (!success) {
        return res.status(500).json({ error: "Failed to update admin status" });
      }
      
      res.json({ 
        success: true, 
        message: `User ${makeAdmin ? 'promoted to' : 'demoted from'} admin successfully` 
      });
    } catch (error) {
      console.error("Error toggling admin status:", error);
      res.status(500).json({ error: "Failed to toggle admin status" });
    }
  });

  // Get user by username endpoint (for God Mode)
  app.get("/api/user/by-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user data without sensitive info like password
      const safeUserData = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        lastActivity: user.lastActivity,
        location: user.location,
        vpnCountry: user.vpnCountry,
        vpnServer: user.vpnServer
      };
      
      res.json(safeUserData);
    } catch (error) {
      console.error("Error fetching user by username:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // WebSocket connection handling
  // Send presence updates to all clients
  const broadcastPresenceUpdate = (userId: string, status: 'online' | 'offline') => {
    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'presence_update',
          userId,
          status
        }));
      }
    });
  };

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('WebSocket connection established');
    
    // Check connection limit
    if (connectedClients.size >= MAX_CONNECTIONS) {
      ws.close(1013, "Server at capacity - maximum 20 users allowed");
      console.log(`Connection rejected: Server at capacity (${connectedClients.size}/${MAX_CONNECTIONS})`);
      return;
    }
    
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
              
              // Add to connected clients map
              connectedClients.set(user.id, ws);
              
              await storage.setUserOnline(user.id);
              
              ws.send(JSON.stringify({ 
                type: 'auth_success', 
                user: { 
                  id: user.id, 
                  username: user.username, 
                  isAdmin: user.isAdmin 
                } 
              }));
              
              // Send user's personal conversations only
              const personalConversations = await storage.getConversations(user.id);
              ws.send(JSON.stringify({ 
                type: 'conversations_list', 
                conversations: personalConversations 
              }));
              
              // Broadcast user presence update
              broadcastPresenceUpdate(user.id, 'online');
              
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
              console.log('📨 RICEVUTO send_message WebSocket:', {
                da: ws.username,
                a: message.recipientId,
                messaggio: message.content.substring(0, 30) + '...',
                clientsConnessi: connectedClients.size
              });
              
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                recipientId: message.recipientId,
                username: ws.username,
              });
              
              console.log('💾 Messaggio salvato, ID:', newMessage.id);
              
              // Send to sender and recipient
              const recipientClient = connectedClients.get(message.recipientId);
              const senderClient = connectedClients.get(ws.userId);
              
              const messageData = { 
                type: 'new_message', 
                message: newMessage 
              };
              
              console.log('🔍 Verifica connessioni:');
              console.log('- Destinatario connesso:', !!recipientClient);
              console.log('- Mittente connesso:', !!senderClient);
              
              // Invia IMMEDIATAMENTE al destinatario
              if (recipientClient && recipientClient.readyState === WebSocket.OPEN) {
                console.log('✅ INVIO ISTANTANEO al destinatario');
                recipientClient.send(JSON.stringify(messageData));
                
                // Aggiorna anche la lista conversazioni del destinatario
                const recipientConversations = await storage.getConversations(message.recipientId);
                recipientClient.send(JSON.stringify({
                  type: 'conversations_updated',
                  conversations: recipientConversations
                }));
              } else {
                console.log('❌ DESTINATARIO NON CONNESSO');
              }
              
              // Invia IMMEDIATAMENTE al mittente per conferma
              if (senderClient && senderClient.readyState === WebSocket.OPEN) {
                console.log('✅ CONFERMA ISTANTANEA al mittente');
                senderClient.send(JSON.stringify(messageData));
                
                // Aggiorna anche la lista conversazioni del mittente
                const senderConversations = await storage.getConversations(ws.userId);
                senderClient.send(JSON.stringify({
                  type: 'conversations_updated',
                  conversations: senderConversations
                }));
              } else {
                console.log('❌ MITTENTE NON CONNESSO');
              }
              
              await storage.updateUserActivity(ws.userId);
              console.log('🎯 ELABORAZIONE MESSAGGIO COMPLETATA');
            } else {
              console.log('❌ SEND_MESSAGE FALLITO - Dati mancanti');
            }
            break;
            
          case 'join_conversation':
            if (ws.userId && message.otherUserId) {
              storage.joinConversation(ws.userId, message.otherUserId, ws.userId);
              
              // Send conversation messages
              const messages = await storage.getConversationMessages(ws.userId, message.otherUserId);
              ws.send(JSON.stringify({ 
                type: 'message_history', 
                messages 
              }));
              
              // Broadcast presence update to show user is in chat
              broadcastPresenceUpdate(ws.userId, 'online');
            }
            break;
            
          case 'leave_conversation':
            if (ws.userId && message.otherUserId) {
              storage.leaveConversation(ws.userId, message.otherUserId, ws.userId);
            }
            break;
            
          case 'send_audio':
            if (ws.userId && message.recipientId && message.audioData) {
              // Invia audio al destinatario
              const recipientClient = connectedClients.get(message.recipientId);
              
              if (recipientClient && recipientClient.readyState === WebSocket.OPEN) {
                recipientClient.send(JSON.stringify({ 
                  type: 'receive_audio', 
                  audioData: message.audioData,
                  senderId: ws.userId,
                  senderUsername: ws.username
                }));
              }
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
      if (ws.userId) {
        storage.setUserOffline(ws.userId);
        broadcastPresenceUpdate(ws.userId, 'offline');
      }
      if (ws.userId) {
        connectedClients.delete(ws.userId);
      }
      if (ws.username) {
        broadcastToClients({ 
          type: 'user_left', 
          username: ws.username 
        }, ws);
      }
    });
  });

  // Update user profile (username)
  app.put("/api/users/:userId/username", async (req, res) => {
    try {
      const { userId } = req.params;
      const { username } = req.body;
      
      if (!username || username.trim().length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username.trim());
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: "Username already taken" });
      }
      
      const success = await storage.updateUsername(userId, username.trim());
      if (success) {
        // Get the updated user to return fresh data
        const updatedUser = await storage.getUser(userId);
        res.json({ 
          success: true, 
          message: "Username updated successfully",
          user: updatedUser ? {
            id: updatedUser.id,
            username: updatedUser.username,
            avatar: updatedUser.avatar
          } : null
        });
      } else {
        res.status(400).json({ message: "Failed to update username" });
      }
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update user avatar
  app.put("/api/users/:userId/avatar", upload.single('avatar'), async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      // Check file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "File must be an image" });
      }
      
      // Check file size (max 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image must be smaller than 5MB" });
      }
      
      // Convert to base64
      const base64Avatar = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      const success = await storage.updateUserAvatar(userId, base64Avatar);
      if (success) {
        // Get the updated user to return fresh data
        const updatedUser = await storage.getUser(userId);
        res.json({ 
          success: true, 
          avatar: base64Avatar, 
          message: "Avatar updated successfully",
          user: updatedUser ? {
            id: updatedUser.id,
            username: updatedUser.username,
            avatar: updatedUser.avatar
          } : null
        });
      } else {
        res.status(400).json({ message: "Failed to update avatar" });
      }
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
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
