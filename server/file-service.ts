import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { cryptoService } from './crypto-service';

export interface EncryptedFile {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  conversationId: string;
  encryptionKey: string;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  createdAt: Date;
  isExpired: boolean;
}

export interface FileUploadResult {
  fileId: string;
  filename: string;
  size: number;
  expiresAt: Date;
  downloadUrl: string;
}

export class FileService {
  private static instance: FileService;
  private uploadDir: string = './uploads';
  private files: Map<string, EncryptedFile> = new Map();
  
  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  constructor() {
    this.initializeUploadDirectory();
    this.startExpirationCleanup();
  }

  // Upload and encrypt file
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    conversationId: string,
    expirationHours: number = 24,
    maxDownloads: number = 10
  ): Promise<FileUploadResult> {
    try {
      const fileId = randomUUID();
      const filename = `encrypted_${fileId}.bin`;
      const filePath = path.join(this.uploadDir, filename);

      // Encrypt file
      const { encrypted, key } = cryptoService.encryptFile(fileBuffer);
      
      // Save encrypted file to disk
      await fs.writeFile(filePath, encrypted);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);

      // Store file metadata
      const encryptedFile: EncryptedFile = {
        id: fileId,
        filename,
        originalName,
        fileSize: fileBuffer.length,
        mimeType,
        uploadedBy,
        conversationId,
        encryptionKey: key,
        expiresAt,
        downloadCount: 0,
        maxDownloads,
        createdAt: new Date(),
        isExpired: false
      };

      this.files.set(fileId, encryptedFile);

      console.log(`File ${originalName} uploaded and encrypted as ${filename}, expires at ${expiresAt}`);

      return {
        fileId,
        filename: originalName,
        size: fileBuffer.length,
        expiresAt,
        downloadUrl: `/api/files/download/${fileId}`
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload and encrypt file');
    }
  }

  // Download and decrypt file
  async downloadFile(fileId: string, userId: string): Promise<{ buffer: Buffer; metadata: EncryptedFile } | null> {
    try {
      const file = this.files.get(fileId);
      if (!file) {
        console.log(`File ${fileId} not found`);
        return null;
      }

      // Check if file is expired
      if (file.isExpired || new Date() > file.expiresAt) {
        console.log(`File ${fileId} has expired`);
        await this.deleteExpiredFile(fileId);
        return null;
      }

      // Check download limits
      if (file.downloadCount >= file.maxDownloads) {
        console.log(`File ${fileId} has reached maximum download limit`);
        file.isExpired = true;
        this.files.set(fileId, file);
        return null;
      }

      // Verify user has access to this conversation
      if (!this.verifyFileAccess(file, userId)) {
        console.log(`User ${userId} does not have access to file ${fileId}`);
        return null;
      }

      const filePath = path.join(this.uploadDir, file.filename);

      // Read encrypted file
      const encryptedBuffer = await fs.readFile(filePath);

      // Decrypt file
      const decryptedBuffer = cryptoService.decryptFile(encryptedBuffer, file.encryptionKey, '');

      // Update download count
      file.downloadCount += 1;
      this.files.set(fileId, file);

      console.log(`File ${file.originalName} downloaded by user ${userId} (${file.downloadCount}/${file.maxDownloads})`);

      return {
        buffer: decryptedBuffer,
        metadata: file
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }

  // Get file metadata
  getFileMetadata(fileId: string, userId: string): EncryptedFile | null {
    const file = this.files.get(fileId);
    if (!file || !this.verifyFileAccess(file, userId)) {
      return null;
    }
    return file;
  }

  // Get files for conversation
  getConversationFiles(conversationId: string, userId: string): EncryptedFile[] {
    return Array.from(this.files.values())
      .filter(file => 
        file.conversationId === conversationId && 
        !file.isExpired && 
        new Date() <= file.expiresAt &&
        this.verifyFileAccess(file, userId)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Delete file
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const file = this.files.get(fileId);
      if (!file || file.uploadedBy !== userId) {
        return false;
      }

      const filePath = path.join(this.uploadDir, file.filename);
      
      // Delete physical file
      await fs.unlink(filePath);
      
      // Remove from memory
      this.files.delete(fileId);

      console.log(`File ${file.originalName} deleted by user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // Verify user has access to file
  private verifyFileAccess(file: EncryptedFile, userId: string): boolean {
    // User is uploader or part of the conversation
    // This would need to be enhanced with proper conversation member checking
    return file.uploadedBy === userId || file.conversationId.includes(userId);
  }

  // Clean up expired files
  private async deleteExpiredFile(fileId: string): Promise<void> {
    try {
      const file = this.files.get(fileId);
      if (!file) return;

      const filePath = path.join(this.uploadDir, file.filename);
      await fs.unlink(filePath);
      this.files.delete(fileId);

      console.log(`Expired file ${file.originalName} deleted`);
    } catch (error) {
      console.error('Error deleting expired file:', error);
    }
  }

  // Initialize upload directory
  private async initializeUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log(`Upload directory initialized at ${this.uploadDir}`);
    } catch (error) {
      console.error('Error initializing upload directory:', error);
    }
  }

  // Start automatic cleanup of expired files
  private startExpirationCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredFiles = Array.from(this.files.entries())
        .filter(([_, file]) => now > file.expiresAt || file.isExpired);

      expiredFiles.forEach(([fileId, _]) => {
        this.deleteExpiredFile(fileId);
      });

      if (expiredFiles.length > 0) {
        console.log(`Cleaned up ${expiredFiles.length} expired files`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  // Get file statistics
  getFileStats(userId?: string): { totalFiles: number; totalSize: number; expiredFiles: number } {
    const userFiles = userId 
      ? Array.from(this.files.values()).filter(f => f.uploadedBy === userId)
      : Array.from(this.files.values());

    const totalFiles = userFiles.length;
    const totalSize = userFiles.reduce((sum, file) => sum + file.fileSize, 0);
    const expiredFiles = userFiles.filter(f => f.isExpired || new Date() > f.expiresAt).length;

    return { totalFiles, totalSize, expiredFiles };
  }
}

export const fileService = FileService.getInstance();