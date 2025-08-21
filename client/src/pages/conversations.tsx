import { useState, useEffect } from "react";
import { Search, MessageCircle, Plus, Settings, LogOut, User, Lock, ShieldQuestion, X, Shield, QrCode, Upload, Edit3, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { SecurityPanel } from "@/components/SecurityPanel";
import { PresenceIndicator } from "@/components/presence-indicator";
import { QRCodeModal } from "@/components/QRCodeModal";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType, Message } from "@shared/schema";

interface ConversationsProps {
  user: UserType;
  conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>;
  onSelectConversation: (userId: string, username: string) => void;
  onLogout: () => void;
  onUserUpdate?: (updatedUser: Partial<UserType>) => void;
  onConversationRemoved?: () => void;
  getUserPresenceStatus?: (userId: string) => 'online' | 'offline' | 'in-your-chat';
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  location: string;
}

export default function Conversations({ user, conversations, onSelectConversation, onLogout, onUserUpdate, onConversationRemoved, getUserPresenceStatus }: ConversationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyDeviceQR, setShowMyDeviceQR] = useState(false);
  const [myDeviceQRCode, setMyDeviceQRCode] = useState<string>('');
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [newUsername, setNewUsername] = useState(user.username);
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const handleVPNRotate = (newData: { maskedIp: string; vpnServer: string; vpnCountry: string; location: string }) => {
    if (onUserUpdate) {
      onUserUpdate(newData);
    }
  };

  const handleRemoveConversation = async (otherUserId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent conversation from opening
    
    try {
      await apiRequest("DELETE", "/api/conversations/saved", {
        userId: user.id,
        otherUserId
      });
      
      // Refresh conversations list
      if (onConversationRemoved) {
        onConversationRemoved();
      }
    } catch (error) {
      console.error('Failed to remove conversation:', error);
    }
  };

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<SearchUser[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length > 2,
  });

  const handleStartConversation = async (userId: string, username: string) => {
    // Always save the conversation when clicking on a user to make it persistent
    try {
      await fetch('/api/conversations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otherUserId: userId })
      });
      
      // Trigger a refresh of the conversations list to show the new conversation immediately
      if (onConversationRemoved) {
        onConversationRemoved(); // This callback will refresh the parent component's conversations
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
    
    // Clear search and navigate to conversation
    setShowSearch(false);
    setSearchQuery("");
    onSelectConversation(userId, username);
  };

  const handleQRScanned = async (qrData: any) => {
    try {
      // Verify the QR code with the backend
      const response = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: JSON.stringify(qrData) })
      });
      
      const result = await response.json();
      
      if (result.isValid && result.data) {
        // Handle different types of QR codes
        if (result.data.type === 'user_identity') {
          // User identity QR - start conversation with the user
          await handleStartConversation(result.data.userId, result.data.username);
          
          // Show verification success message
          console.log(`✓ Verified identity: ${result.data.username} (Device: ${result.data.deviceId.slice(0, 8)}...)`);
          
        } else if (result.data.type === 'conversation_verification') {
          // Conversation verification QR
          const otherUserId = result.data.senderId === user.id ? result.data.recipientId : result.data.senderId;
          const otherUsername = result.data.senderId === user.id ? result.data.recipientUsername : result.data.senderUsername;
          
          await handleStartConversation(otherUserId, otherUsername);
          
        } else if (result.data.userId && result.data.username) {
          // Legacy user verification QR
          await handleStartConversation(result.data.userId, result.data.username);
        }
      } else {
        console.error('Invalid QR code or verification failed');
      }
    } catch (error) {
      console.error('Failed to verify QR code:', error);
    }
    
    setShowQRScanner(false);
  };

  const getActivityStatus = (lastActivity: string) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diffMinutes = Math.floor((now.getTime() - activity.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return { status: "online", color: "bg-green-500" };
    if (diffMinutes < 15) return { status: "away", color: "bg-yellow-500" };
    return { status: "offline", color: "bg-gray-500" };
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Errore",
        description: "Il file deve essere un'immagine",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Errore", 
        description: "L'immagine deve essere più piccola di 5MB",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'PUT',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        onUserUpdate?.({ avatar: data.avatar });
        toast({
          title: "Successo",
          description: "Immagine profilo aggiornata",
        });
        setShowAvatarUpload(false);
      } else {
        toast({
          title: "Errore",
          description: data.message || "Errore durante l'aggiornamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive"
      });
    }
  };

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      toast({
        title: "Errore",
        description: "Il nome utente deve essere di almeno 3 caratteri",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() })
      });

      const data = await response.json();
      
      if (response.ok) {
        onUserUpdate?.({ username: newUsername.trim() });
        toast({
          title: "Successo",
          description: "Nome utente aggiornato",
        });
        setShowUsernameEdit(false);
      } else {
        toast({
          title: "Errore",
          description: data.message || "Errore durante l'aggiornamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Errore", 
        description: "Errore di connessione",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`min-h-screen flex flex-col messaging-background ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar 
            className="w-8 h-8 bg-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowAvatarUpload(true)}
            title="Clicca per cambiare immagine profilo"
          >
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback>
                <User className="w-4 h-4 text-primary-foreground" />
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-sm text-card-foreground">{user.username}</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowUsernameEdit(true)}
                className="h-auto p-0 w-4 h-4 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Modifica nome utente"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
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
          <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)}>
            <Plus className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              try {
                const response = await fetch('/api/qr/generate-identity', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    userId: user.id, 
                    username: user.username 
                  })
                });
                
                const data = await response.json();
                setMyDeviceQRCode(data.qrCode);
                setShowMyDeviceQR(true);
              } catch (error) {
                console.error('Failed to generate device QR:', error);
              }
            }}
            title="Il mio QR dispositivo"
          >
            <QrCode className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSecurityPanel(true)}
            title="Security & Protection Center"
          >
            <Shield className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? "☀️" : "🌙"}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Search Section */}
      {showSearch && (
        <div className="bg-card border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search users by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchQuery.length > 2 && (
            <div className="mt-4 space-y-2">
              {searchLoading ? (
                <div className="text-center text-muted-foreground py-4">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((searchUser) => {
                  const activity = getActivityStatus(searchUser.lastActivity);
                  return (
                    <Card 
                      key={`search-${searchUser.id}`}
                      className="cursor-pointer hover:shadow-sm transition-all"
                      onClick={() => handleStartConversation(searchUser.id, searchUser.username)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10 bg-blue-500">
                            <AvatarFallback className="text-white font-semibold text-sm">
                              {searchUser.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-medium text-card-foreground">{searchUser.name}</h4>
                            <p className="text-xs text-muted-foreground">@{searchUser.username}</p>
                            <p className="text-xs text-muted-foreground">{searchUser.location}</p>
                          </div>
                          <div className={`w-3 h-3 ${activity.color} rounded-full`}></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-4">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Security Panel Quick Access */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">Sicurezza Attiva</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecurityPanel(true)}
            className="text-xs"
          >
            <Shield className="w-3 h-3 mr-1" />
            Centro Sicurezza
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          VPN: {user.vpnCountry} • DNS Sicuro: Attivo • QR: Disponibile
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Messages</h3>
          
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-foreground mb-2">No conversations yet</h4>
              <p className="text-sm text-muted-foreground mb-4">Start a conversation by searching for a user</p>
              <Button onClick={() => setShowSearch(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Start Conversation
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Card 
                  key={`conversation-${conversation.userId}`}
                  className="cursor-pointer hover:shadow-sm transition-all relative group"
                  onClick={() => onSelectConversation(conversation.userId, conversation.username)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12 bg-blue-500">
                          <AvatarFallback className="text-white font-semibold">
                            {conversation.username.split('.').map(n => n[0].toUpperCase()).join('')}
                          </AvatarFallback>
                        </Avatar>
                        {getUserPresenceStatus && (
                          <div className="absolute -bottom-1 -right-1">
                            <PresenceIndicator 
                              status={getUserPresenceStatus(conversation.userId)} 
                              size="md"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-card-foreground truncate">
                            {conversation.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
                          </h4>
                          <div className="flex items-center space-x-2">
                            {conversation.lastMessage && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(conversation.lastMessage.timestamp!), "HH:mm")}
                              </span>
                            )}
                            {conversation.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                              onClick={(e) => handleRemoveConversation(conversation.userId, e)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">@{conversation.username}</p>
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3" />
            <span>End-to-end encrypted</span>
            <span>•</span>
            <span>IP: {user.maskedIp?.split('.').slice(0, -1).join('.')}.xxx (Masked)</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3 inline mr-1" />
            <span>{conversations.length}</span> conversations • VPN: {user.vpnCountry}
          </div>
        </div>
      </div>

      {/* Security Panel */}
      <SecurityPanel 
        userId={user.id}
        username={user.username}
        isVisible={showSecurityPanel}
        onClose={() => setShowSecurityPanel(false)}
      />

      {/* My Device QR Modal */}
      {showMyDeviceQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full">
                <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Il mio QR Dispositivo
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Mostra questo QR ad altri utenti per verificare la tua identità nelle conversazioni.
              </p>
              
              {myDeviceQRCode && (
                <div className="bg-white p-4 rounded-lg border mx-auto max-w-64">
                  <img 
                    src={myDeviceQRCode} 
                    alt="Il mio QR dispositivo" 
                    className="w-full max-w-64 mx-auto"
                  />
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                Altri utenti possono scansionare questo QR per verificare la tua identità
              </div>
              
              <Button 
                onClick={() => {
                  setShowMyDeviceQR(false);
                  setMyDeviceQRCode('');
                }}
                className="w-full"
              >
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRCodeModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        mode="scan"
        onQRScanned={handleQRScanned}
        title="Scan QR Code"
      />

      {/* Avatar Upload Modal */}
      <Dialog open={showAvatarUpload} onOpenChange={setShowAvatarUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Cambia Immagine Profilo</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Clicca per selezionare un'immagine
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF fino a 5MB
                  </p>
                </div>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </Label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Username Edit Modal */}
      <Dialog open={showUsernameEdit} onOpenChange={setShowUsernameEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Modifica Nome Utente</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-username">Nuovo nome utente</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Inserisci nuovo nome utente"
                minLength={3}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleUsernameUpdate}
                className="flex-1"
                disabled={!newUsername.trim() || newUsername.trim().length < 3}
              >
                <Check className="w-4 h-4 mr-2" />
                Salva
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNewUsername(user.username);
                  setShowUsernameEdit(false);
                }}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}