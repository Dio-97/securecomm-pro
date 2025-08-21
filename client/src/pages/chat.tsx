import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Settings, LogOut, User, Lock, ShieldQuestion, ArrowLeft, QrCode, Shield, FileUp, X, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { MessageBubble } from "@/components/message-bubble";
import { WalkieTalkie, useAudioPlayer } from "@/components/walkie-talkie";
import { PresenceIndicator } from "@/components/presence-indicator";
import { QRCodeModal } from "@/components/QRCodeModal";
import { VPNStatus } from "@/components/vpn-status";
import type { Message, User as UserType } from "@shared/schema";

interface ChatProps {
  user: UserType;
  messages: Message[];
  recipientId: string;
  recipientUsername: string;
  onSendMessage: (content: string, recipientId: string) => void;
  onBack: () => void;
  onLogout: () => void;
  isGodMode?: boolean;
  godModeTarget?: string;
  onExitGodMode?: () => void;
  onEditMessage?: (messageId: string, content: string) => void;
  getUserPresenceStatus?: (userId: string) => 'online' | 'offline' | 'in-your-chat';
  onSendAudio?: (audioData: Blob, recipientId: string) => void;
}

export default function Chat({ 
  user, 
  messages,
  recipientId,
  recipientUsername,
  onSendMessage, 
  onBack,
  onLogout,
  isGodMode = false,
  godModeTarget,
  onExitGodMode,
  onEditMessage,
  getUserPresenceStatus,
  onSendAudio
}: ChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrMode, setQRMode] = useState<'generate' | 'scan'>('generate');
  const [qrPurpose, setQRPurpose] = useState<'message' | 'file'>('message');
  const [showVPNPanel, setShowVPNPanel] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showChatVerificationConfirm, setShowChatVerificationConfirm] = useState(false);

  // Admin23 è esente dalla verifica QR - tutte le funzioni disponibili senza verifica
  const isAdmin23Chat = recipientUsername === "admin23" || user.username === "admin23";
  const [isConversationVerified, setIsConversationVerified] = useState(isAdmin23Chat);
  const [isFirstMessage, setIsFirstMessage] = useState(messages.length === 0);
  const [isFirstFileShare, setIsFirstFileShare] = useState(true);
  const [pendingFileUpload, setPendingFileUpload] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { playAudioData } = useAudioPlayer();

  // Determina se il walkie-talkie è abilitato (entrambi gli utenti nella stessa chat)
  const isWalkieTalkieEnabled = getUserPresenceStatus ? 
    getUserPresenceStatus(recipientId) === 'in-your-chat' &&
    getUserPresenceStatus(user.id) === 'in-your-chat' :
    false;

  const handleSendAudio = (audioData: Blob) => {
    if (onSendAudio) {
      onSendAudio(audioData, recipientId);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    // Admin23 chat è esente dalla verifica QR - invia direttamente
    if (isAdmin23Chat) {
      onSendMessage(newMessage, recipientId);
      setNewMessage("");
      setIsFirstMessage(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }
    
    // Check if this is the first message and conversation needs verification
    if (isFirstMessage && !isConversationVerified) {
      setQRPurpose('message');
      setQRMode('scan');
      setShowChatVerificationConfirm(true);
      return;
    }
    
    onSendMessage(newMessage, recipientId);
    setNewMessage("");
    setIsFirstMessage(false);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const displayName = isGodMode ? godModeTarget : recipientUsername;

  // Handle QR code verification
  const handleQRGenerated = async (qrCode: string) => {
    // QR code generated for recipient to scan
    console.log('QR code generated for conversation verification');
  };

  const handleChatVerificationConfirm = () => {
    setShowChatVerificationConfirm(false);
    setQRMode('scan');
    setShowQRModal(true);
  };

  const handleChatVerificationCancel = () => {
    setShowChatVerificationConfirm(false);
  };





  const handleQRScanned = async (result: any) => {
    if (result.isValid) {
      setIsConversationVerified(true);
      setShowQRModal(false);
      
      // Handle based on the purpose
      if (qrPurpose === 'message') {
        // Send the pending message
        if (newMessage.trim()) {
          onSendMessage(newMessage, recipientId);
          setNewMessage("");
          setIsFirstMessage(false);
        }
      } else if (qrPurpose === 'file') {
        // After verification for file sharing, open the file upload modal
        if (pendingFileUpload) {
          await uploadFile(pendingFileUpload);
        } else {
          // If no pending file, just open the file upload modal
          setShowFileUpload(true);
        }
      }
    }
  };

  // Handle file selection and upload (conversation is already verified at this point)
  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Since we only reach here when conversation is verified, upload immediately
    uploadFile(file);
  };

  // Actual file upload function
  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', `${user.id}-${recipientId}`);
    formData.append('expirationHours', '24');
    formData.append('maxDownloads', '10');

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        // Send file share message
        onSendMessage(`📎 Shared file: ${result.filename} (expires ${new Date(result.expiresAt).toLocaleString()})`, recipientId);
        setIsFirstFileShare(false);
      }
    } catch (error) {
      console.error('File upload failed:', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowFileUpload(false);
    setPendingFileUpload(null);
  };

  useEffect(() => {
    setIsFirstMessage(messages.length === 0);
    // Reset file sharing state when conversation changes
    if (messages.length > 0) {
      setIsFirstFileShare(false);
    }
  }, [messages.length]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* God Mode Indicator */}
      {isGodMode && (
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-center py-2 text-sm font-semibold">
          <ShieldQuestion className="w-4 h-4 inline mr-2" />
          GOD MODE ACTIVE - VIEWING AS USER
          <Button 
            variant="secondary" 
            size="sm" 
            className="ml-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white border-opacity-30"
            onClick={onExitGodMode}
          >
            Exit God Mode
          </Button>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8 bg-primary">
            <AvatarFallback>
              {recipientUsername.split('.').map(n => n[0].toUpperCase()).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm text-card-foreground">
              {recipientUsername.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-muted-foreground">
                <Lock className="w-3 h-3 inline mr-1" />
                Encrypted
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowVPNPanel(true)}
            title="Security & Protection"
          >
            <Shield className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              // Check if conversation is verified before allowing file upload
              if (!isConversationVerified) {
                setQRPurpose('file');
                setQRMode('generate');
                setShowQRModal(true);
              } else {
                setShowFileUpload(true);
              }
            }}
            title="Share Encrypted File"
          >
            <FileUp className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowChatVerificationConfirm(true)}
            title="Verifica Chat"
          >
            <QrCode className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? "☀️" : "🌙"}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 chat-background ${theme === 'dark' ? 'dark' : ''}`}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwnMessage={message.userId === user.id}
            canEdit={isGodMode}
            onEdit={onEditMessage}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-card border-t p-4">
        <div className="flex items-end space-x-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              // Admin23 chat è esente dalla verifica QR - accesso diretto ai file
              if (isAdmin23Chat || isConversationVerified) {
                setShowFileUpload(true);
              } else {
                setQRPurpose('file');
                setQRMode('generate');
                setShowQRModal(true);
              }
            }}
            title="Attach File"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type an encrypted message..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
          </div>
          
          <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3" />
            <span>Messages cleared when both users exit</span>
            <span>•</span>
            <span>IP: {user.maskedIp?.split('.').slice(0, -1).join('.')}.xxx (Masked via {user.vpnCountry})</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3 inline mr-1" />
            <span>Private conversation</span>
          </div>
        </div>
      </div>

      {/* VPN Panel */}
      {showVPNPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">VPN Status</h3>
              <Button onClick={() => setShowVPNPanel(false)} variant="ghost" size="sm">
                ✕
              </Button>
            </div>
            
            <VPNStatus user={user} onVPNRotate={(newData) => {
              // Update user VPN data in parent component if needed
              console.log('VPN rotated:', newData);
            }} />
            
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-muted-foreground text-center mb-2">
                🔄 Server cambia automaticamente ogni 15 min
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/vpn/rotate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id })
                    });
                    const newData = await response.json();
                    console.log('Manual VPN rotation:', newData);
                    // Trigger refresh of VPN status
                    window.location.reload();
                  } catch (error) {
                    console.error('Failed to rotate VPN:', error);
                  }
                }}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Cambia Server Ora
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Chat Verification Confirmation */}
      {showChatVerificationConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full">
                <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Verifica Chat
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300">
                Stai per aprire la fotocamera per scansionare un codice QR e verificare l'identità del tuo interlocutore. Vuoi continuare?
              </p>
              
              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={handleChatVerificationCancel}
                  variant="outline"
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button 
                  onClick={handleChatVerificationConfirm}
                  className="flex-1"
                >
                  OK, Continua
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        mode={qrMode}
        onQRGenerated={handleQRGenerated}
        onQRScanned={handleQRScanned}
        generationData={{
          userId: user.id,
          username: user.username,
          publicKey: user.publicKey || 'demo-key'
        }}
        title="Scan QR Code per Verifica Chat"
      />

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                Share Encrypted File
              </h3>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => {
                    setQRPurpose('file');
                    setQRMode('generate');
                    setShowQRModal(true);
                    setShowFileUpload(false);
                  }} 
                  variant="ghost" 
                  size="sm"
                  title="Generate File QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => setShowFileUpload(false)} 
                  variant="ghost" 
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Files are encrypted with AES-256 and automatically deleted after 24 hours or 10 downloads.
              </div>
              
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelection}
                className="w-full"
                accept="*/*"
              />
              
              <div className="text-xs text-gray-500">
                Maximum file size: 50MB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
