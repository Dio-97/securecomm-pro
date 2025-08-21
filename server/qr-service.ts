import QRCode from 'qrcode';
import * as crypto from 'crypto';

export interface QRVerificationData {
  userId: string;
  username: string;
  publicKey: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

export interface UserIdentityQRData {
  type: 'user_identity';
  userId: string;
  username: string;
  deviceId: string;
  publicKey: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

export class QRService {
  private static instance: QRService;
  
  static getInstance(): QRService {
    if (!QRService.instance) {
      QRService.instance = new QRService();
    }
    return QRService.instance;
  }

  // Generate QR code for user verification
  async generateVerificationQR(userId: string, username: string, publicKey: string): Promise<string> {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Create verification data
    const verificationData: QRVerificationData = {
      userId,
      username,
      publicKey,
      timestamp,
      nonce,
      signature: this.signData(`${userId}:${username}:${publicKey}:${timestamp}:${nonce}`)
    };

    // Generate QR code as data URL
    try {
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(verificationData), {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Verify QR code data
  verifyQRCode(qrData: string): { isValid: boolean; data?: QRVerificationData } {
    try {
      const data: QRVerificationData = JSON.parse(qrData);
      
      // Verify signature
      const expectedSignature = this.signData(`${data.userId}:${data.username}:${data.publicKey}:${data.timestamp}:${data.nonce}`);
      if (data.signature !== expectedSignature) {
        return { isValid: false };
      }
      
      // Check timestamp (valid for 5 minutes)
      const now = Date.now();
      const ageInMinutes = (now - data.timestamp) / (1000 * 60);
      if (ageInMinutes > 5) {
        return { isValid: false };
      }
      
      return { isValid: true, data };
    } catch (error) {
      return { isValid: false };
    }
  }

  // Generate unique device identity QR for user
  async generateUserIdentityQR(userId: string, username: string, publicKey: string): Promise<string> {
    const timestamp = Date.now();
    const deviceId = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const identityData: UserIdentityQRData = {
      type: 'user_identity',
      userId,
      username,
      deviceId,
      publicKey,
      timestamp,
      nonce,
      signature: this.signData(`${userId}:${username}:${deviceId}:${publicKey}:${timestamp}:${nonce}`)
    };

    try {
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(identityData), {
        width: 300,
        margin: 3,
        color: {
          dark: '#2563eb',
          light: '#ffffff'
        }
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating user identity QR code:', error);
      throw new Error('Failed to generate user identity QR code');
    }
  }

  // Verify user identity QR code
  verifyUserIdentityQR(qrData: string): { isValid: boolean; data?: UserIdentityQRData } {
    try {
      const data: UserIdentityQRData = JSON.parse(qrData);
      
      if (data.type !== 'user_identity') {
        return { isValid: false };
      }
      
      // Verify signature
      const expectedSignature = this.signData(`${data.userId}:${data.username}:${data.deviceId}:${data.publicKey}:${data.timestamp}:${data.nonce}`);
      if (data.signature !== expectedSignature) {
        return { isValid: false };
      }
      
      // Check timestamp (valid for 30 minutes for identity verification)
      const now = Date.now();
      const ageInMinutes = (now - data.timestamp) / (1000 * 60);
      if (ageInMinutes > 30) {
        return { isValid: false };
      }
      
      return { isValid: true, data };
    } catch (error) {
      return { isValid: false };
    }
  }

  // Generate identity verification QR for new conversations
  async generateConversationVerificationQR(
    senderId: string, 
    senderUsername: string, 
    recipientId: string,
    recipientUsername: string
  ): Promise<string> {
    const timestamp = Date.now();
    const conversationId = this.generateConversationId(senderId, recipientId);
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const verificationData = {
      type: 'conversation_verification',
      senderId,
      senderUsername,
      recipientId,
      recipientUsername,
      conversationId,
      timestamp,
      nonce,
      signature: this.signData(`${senderId}:${recipientId}:${conversationId}:${timestamp}:${nonce}`)
    };

    try {
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(verificationData), {
        width: 300,
        margin: 3,
        color: {
          dark: '#1a365d',
          light: '#ffffff'
        }
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating conversation QR code:', error);
      throw new Error('Failed to generate conversation verification QR code');
    }
  }

  // Verify conversation QR code
  verifyConversationQR(qrData: string, expectedSenderId: string, expectedRecipientId: string): boolean {
    try {
      const data = JSON.parse(qrData);
      
      if (data.type !== 'conversation_verification') {
        return false;
      }
      
      // Verify signature
      const expectedSignature = this.signData(`${data.senderId}:${data.recipientId}:${data.conversationId}:${data.timestamp}:${data.nonce}`);
      if (data.signature !== expectedSignature) {
        return false;
      }
      
      // Verify participants
      if (data.senderId !== expectedSenderId || data.recipientId !== expectedRecipientId) {
        return false;
      }
      
      // Check timestamp (valid for 10 minutes for conversation setup)
      const now = Date.now();
      const ageInMinutes = (now - data.timestamp) / (1000 * 60);
      if (ageInMinutes > 10) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate conversation ID from two user IDs
  private generateConversationId(userId1: string, userId2: string): string {
    // Sort to ensure consistent ID regardless of order
    const sortedIds = [userId1, userId2].sort();
    return crypto.createHash('sha256').update(sortedIds.join(':')).digest('hex');
  }

  // Sign data with server secret
  private signData(data: string): string {
    const secret = process.env.QR_SIGNING_SECRET || 'default-development-secret-change-in-production';
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}

export const qrService = QRService.getInstance();