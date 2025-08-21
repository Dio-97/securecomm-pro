import { useState, useEffect } from "react";
import { Search, MessageCircle, Plus, Settings, LogOut, User, Lock, ShieldQuestion, X, Shield, QrCode, Upload, Edit3, Check, Camera, Crown } from "lucide-react";
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
  isGodMode?: boolean;
  godModeTarget?: string;
  onExitGodMode?: () => void;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  location: string;
}

export default function Conversations({ user, conversations, onSelectConversation, onLogout, onUserUpdate, onConversationRemoved, getUserPresenceStatus, isGodMode = false, godModeTarget = "", onExitGodMode }: ConversationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyDeviceQR, setShowMyDeviceQR] = useState(false);
  const [myDeviceQRCode, setMyDeviceQRCode] = useState<string>('');
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [showUsernameEditIcon, setShowUsernameEditIcon] = useState(false);
  const [usernameEditTimer, setUsernameEditTimer] = useState<NodeJS.Timeout | null>(null);
  const [searchHideTimer, setSearchHideTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastSearchActivity, setLastSearchActivity] = useState<number>(Date.now());
  const [newUsername, setNewUsername] = useState(user.username);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showCredentialsEdit, setShowCredentialsEdit] = useState(false);
  const [newUsernameForEdit, setNewUsernameForEdit] = useState("");
  const [newPasswordForEdit, setNewPasswordForEdit] = useState("");
  const [targetUserData, setTargetUserData] = useState<UserType | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  // Fetch target user data when in God Mode
  const { data: targetUser } = useQuery<UserType>({
    queryKey: [`/api/user/by-username/${godModeTarget}`],
    enabled: isGodMode && !!godModeTarget,
  });

  // Update target user data when query completes
  useEffect(() => {
    if (targetUser && isGodMode) {
      setTargetUserData(targetUser);
    }
  }, [targetUser, isGodMode]);

  const handleVPNRotate = (newData: { maskedIp: string; vpnServer: string; vpnCountry: string; location: string }) => {
    if (onUserUpdate) {
      onUserUpdate(newData);
    }
  };

  const handleRandomServerSwitch = async () => {
    try {
      // Fetch available servers
      const serversResponse = await fetch('/api/vpn/servers');
      const servers = await serversResponse.json();
      
      if (servers.length === 0) {
        toast({
          title: "Errore",
          description: "Nessun server disponibile",
          variant: "destructive"
        });
        return;
      }

      // Get current server to avoid selecting the same one
      const currentCountry = user.vpnCountry;
      const availableServers = servers.filter((server: any) => server.country !== currentCountry);
      
      // If all servers are the same country, use all servers
      const serversToChooseFrom = availableServers.length > 0 ? availableServers : servers;
      
      // Select random server
      const randomServer = serversToChooseFrom[Math.floor(Math.random() * serversToChooseFrom.length)];
      
      // Connect to the new server
      const connectResponse = await fetch('/api/vpn/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          serverId: randomServer.id
        })
      });

      if (connectResponse.ok) {
        const result = await connectResponse.json();
        
        // Update user data with new server info
        const newUserData = {
          vpnServer: randomServer.name,
          vpnCountry: randomServer.country,
          maskedIp: result.maskedIp || user.maskedIp,
          location: randomServer.location || user.location
        };
        
        handleVPNRotate(newUserData);
        
        toast({
          title: "Server Cambiato",
          description: `Connesso a ${randomServer.country} (${randomServer.name})`,
        });
      } else {
        throw new Error('Failed to connect to server');
      }
    } catch (error) {
      console.error('Error switching server:', error);
      toast({
        title: "Errore",
        description: "Impossibile cambiare server. Riprova.",
        variant: "destructive"
      });
    }
  };

  const handleUsernameClick = () => {
    // Protect admin23 in God Mode
    if (isGodMode && godModeTarget === "admin23") {
      return;
    }
    
    // Clear any existing timer
    if (usernameEditTimer) {
      clearTimeout(usernameEditTimer);
    }
    
    // Show the edit icon with fade animation
    setShowUsernameEditIcon(true);
    
    // Set timer to hide the icon after 3 seconds
    const timer = setTimeout(() => {
      setShowUsernameEditIcon(false);
    }, 3000);
    
    setUsernameEditTimer(timer);
  };

  const handleSearchToggle = () => {
    // Clear any existing search hide timer
    if (searchHideTimer) {
      clearTimeout(searchHideTimer);
      setSearchHideTimer(null);
    }
    
    const wasSearchVisible = showSearch;
    setShowSearch(!showSearch);
    setSearchQuery("");
    
    if (!wasSearchVisible) {
      // Auto-focus the search input when opening search
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder="Search users by username..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          // Force keyboard to appear on mobile devices
          searchInput.click();
        }
      }, 100); // Small delay to ensure the input is rendered
      
      // Reset activity tracker when search opens
      setLastSearchActivity(Date.now());
    } else {
      // Hide keyboard when closing search manually
      hideKeyboard();
    }
  };

  const startSearchHideTimer = () => {
    // Clear any existing timer
    if (searchHideTimer) {
      clearTimeout(searchHideTimer);
    }
    
    // Set timer to hide search after 3 seconds of inactivity
    const timer = setTimeout(() => {
      if (searchQuery.trim() === "") {
        setShowSearch(false);
        setSearchQuery("");
      }
      setSearchHideTimer(null);
    }, 3000);
    
    setSearchHideTimer(timer);
  };

  // Function to hide keyboard
  const hideKeyboard = () => {
    // Blur any focused input to hide keyboard
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }
    
    // Additional mobile keyboard hiding techniques
    if (window.visualViewport) {
      // Force viewport to resize, which often closes keyboard
      window.scrollTo(0, 0);
    }
  };

  // Monitor search visibility changes to hide keyboard
  useEffect(() => {
    if (!showSearch) {
      // Hide keyboard when search is closed
      hideKeyboard();
    }
  }, [showSearch]);

  // Continuous monitoring for search inactivity
  useEffect(() => {
    if (!showSearch) return;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastSearchActivity;
      
      // If 3 seconds have passed without activity and search is empty
      if (timeSinceLastActivity >= 3000 && searchQuery.trim() === "") {
        setShowSearch(false);
        setSearchQuery("");
        if (searchHideTimer) {
          clearTimeout(searchHideTimer);
          setSearchHideTimer(null);
        }
        // Keyboard will be hidden by the showSearch useEffect above
      }
    };

    // Check every 500ms for inactivity
    const activityChecker = setInterval(checkInactivity, 500);

    return () => {
      clearInterval(activityChecker);
    };
  }, [showSearch, lastSearchActivity, searchQuery, searchHideTimer]);

  const resetSearchActivity = () => {
    setLastSearchActivity(Date.now());
    
    // Clear existing timer
    if (searchHideTimer) {
      clearTimeout(searchHideTimer);
      setSearchHideTimer(null);
    }
  };

  const handleClickOutsideSearch = () => {
    if (showSearch && searchQuery.trim() === "") {
      // Reset activity when clicking outside (starts the 3-second countdown)
      resetSearchActivity();
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (usernameEditTimer) {
        clearTimeout(usernameEditTimer);
      }
      if (searchHideTimer) {
        clearTimeout(searchHideTimer);
      }
    };
  }, [usernameEditTimer, searchHideTimer]);

  // Add click outside listener for search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Check if click is outside search area and floating button
      if (showSearch && !target.closest('.search-container') && !target.closest('.floating-search-btn')) {
        handleClickOutsideSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch, searchHideTimer]);

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
      setIsUploading(true);
      setUploadProgress(0);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle upload completion
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
      });

      xhr.open('PUT', `/api/users/${user.id}/avatar`);
      xhr.send(formData);

      const data = await uploadPromise;
      
      // Update user state with new avatar, completely replacing the old one
      onUserUpdate?.({ avatar: data.avatar });
      
      toast({
        title: "Successo",
        description: "Immagine profilo aggiornata",
      });
      setShowAvatarUpload(false);
      
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore durante l'upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
        // Update user state with new username, completely replacing the old one
        const updatedUsername = newUsername.trim();
        onUserUpdate?.({ username: updatedUsername });
        
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

  const handleCredentialsSubmit = async () => {
    if (!isGodMode || !godModeTarget) return;
    
    // Protect admin23
    if (godModeTarget === "admin23") {
      toast({
        title: "Operazione Non Consentita",
        description: "Non è possibile modificare le credenziali dell'admin principale",
        variant: "destructive",
      });
      return;
    }
    
    if (!newUsernameForEdit.trim() && !newPasswordForEdit.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci almeno un campo da modificare",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch('/api/admin/update-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUsername: godModeTarget,
          newUsername: newUsernameForEdit.trim() || undefined,
          newPassword: newPasswordForEdit.trim() || undefined
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Successo",
          description: `Credenziali di @${godModeTarget} aggiornate`,
        });
        setShowCredentialsEdit(false);
        setNewUsernameForEdit("");
        setNewPasswordForEdit("");
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
      {/* God Mode Banner */}
      {isGodMode && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="w-5 h-5" />
            <span className="font-bold">MODALITÀ DIO</span>
            <span className="text-red-200">- Visualizzando: @{godModeTarget}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitGodMode}
            className="text-white hover:bg-red-700"
          >
            <X className="w-4 h-4 mr-1" />
            Torna Indietro
          </Button>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-card border-b-2 border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar 
            className={`w-8 h-8 bg-primary ${
              isGodMode && godModeTarget === "admin23" 
                ? "cursor-default" 
                : "cursor-pointer hover:opacity-80 transition-opacity"
            }`}
            onClick={() => {
              if (!(isGodMode && godModeTarget === "admin23")) {
                setShowAvatarUpload(true);
              }
            }}
            title={
              isGodMode && godModeTarget === "admin23" 
                ? "Admin principale protetto" 
                : "Clicca per cambiare immagine profilo"
            }
          >
            {(isGodMode ? targetUserData?.avatar : user.avatar) ? (
              <img src={(isGodMode ? targetUserData?.avatar : user.avatar) || ''} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback>
                <User className="w-4 h-4 text-primary-foreground" />
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <h2 
                className={`font-semibold text-sm text-card-foreground ${
                  isGodMode && godModeTarget === "admin23"
                    ? "cursor-default"
                    : "cursor-pointer hover:opacity-75 transition-opacity"
                }`}
                onClick={() => {
                  if (!(isGodMode && godModeTarget === "admin23")) {
                    handleUsernameClick();
                  }
                }}
                title={
                  isGodMode && godModeTarget === "admin23"
                    ? "Admin principale protetto"
                    : "Tocca per modificare nome utente"
                }
              >
                {isGodMode ? (targetUserData?.username || godModeTarget) : user.username}
                {isGodMode && <span className="ml-2 text-red-500">(Vista Admin)</span>}
              </h2>
              {!(isGodMode && godModeTarget === "admin23") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowUsernameEdit(true)}
                  className={`h-auto p-0 w-4 h-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ${
                    showUsernameEditIcon ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                  title="Modifica nome utente"
                  style={{ 
                    visibility: showUsernameEditIcon ? 'visible' : 'hidden',
                    transform: showUsernameEditIcon ? 'scale(1)' : 'scale(0.95)'
                  }}
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
              )}
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
        
        <div className="flex items-center space-x-2">
          
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
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleTheme}
            className="transition-all duration-300 hover:scale-110 hover:rotate-12"
            title={`Passa al tema ${theme === 'dark' ? 'chiaro' : 'scuro'}`}
          >
            <span className="transition-transform duration-300 hover:scale-125">
              {theme === 'dark' ? "☀️" : "🌙"}
            </span>
          </Button>
          
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Search Section */}
      <div className={`search-container transition-all duration-300 ${
        showSearch 
          ? 'opacity-100 max-h-32 border-b' 
          : 'opacity-0 max-h-0 border-b-0'
      } bg-card overflow-hidden`}
      style={{ padding: showSearch ? '1rem' : '0' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search users by username..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Reset activity when user types
              resetSearchActivity();
            }}
            className="pl-10"
            autoFocus={showSearch}
            onFocus={() => {
              // Reset activity when user focuses on search
              resetSearchActivity();
            }}
            onBlur={() => {
              // Reset activity when user leaves search field
              resetSearchActivity();
            }}
            onClick={() => {
              // Reset activity when user clicks in search
              resetSearchActivity();
            }}
            onKeyDown={() => {
              // Reset activity on any key press (including navigation keys)
              resetSearchActivity();
            }}
            onMouseMove={() => {
              // Reset activity on mouse movement over input
              resetSearchActivity();
            }}
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

      {/* Security Panel Quick Access */}
      <div className="border-b p-4 space-y-3">
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
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium">Server VPN</span>
            <span className="text-xs text-muted-foreground">({user.vpnCountry})</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRandomServerSwitch}
            className="text-xs hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            Cambia Server
          </Button>
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
              <p className="text-sm text-muted-foreground">Start a conversation by searching for a user using the + button</p>
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
          <div className="flex items-center space-x-4">
            {user.isAdmin && user.username !== "admin23" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.hash = '#admin';
                }}
                className="text-xs bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900"
              >
                <Crown className="w-3 h-3 mr-1" />
                Passa ad Admin
              </Button>
            )}
            <div className="text-xs text-muted-foreground">
              <ShieldQuestion className="w-3 h-3 inline mr-1" />
              <span>{conversations.length}</span> conversations • VPN: {user.vpnCountry}
            </div>
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
      <Dialog 
        open={showAvatarUpload && !(isGodMode && godModeTarget === "admin23")} 
        onOpenChange={setShowAvatarUpload}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Cambia Immagine Profilo</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <Label htmlFor="avatar-upload" className={isUploading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {isUploading ? "Caricamento in corso..." : "Clicca per selezionare un'immagine"}
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
                  disabled={isUploading}
                />
              </Label>
            </div>
            
            {/* Progress Bar */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Upload in corso...</span>
                  <span className="font-medium text-primary">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-primary">{uploadProgress}%</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Username Edit Modal */}
      <Dialog 
        open={showUsernameEdit && !(isGodMode && godModeTarget === "admin23")} 
        onOpenChange={setShowUsernameEdit}
      >
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

      {/* Credentials Edit Modal (God Mode) */}
      <Dialog 
        open={showCredentialsEdit && !(isGodMode && godModeTarget === "admin23")} 
        onOpenChange={setShowCredentialsEdit}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Crown className="w-5 h-5 text-red-500" />
              <span>Modifica Credenziali - @{godModeTarget}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center">
                <Crown className="w-4 h-4 mr-2" />
                Modalità Admin - Modifica credenziali utente
              </p>
            </div>
            
            <div>
              <Label htmlFor="new-username-edit">Nuovo nome utente (opzionale)</Label>
              <Input
                id="new-username-edit"
                value={newUsernameForEdit}
                onChange={(e) => setNewUsernameForEdit(e.target.value)}
                placeholder="Lascia vuoto per non modificare"
                minLength={3}
              />
            </div>
            
            <div>
              <Label htmlFor="new-password-edit">Nuova password (opzionale)</Label>
              <Input
                id="new-password-edit"
                type="password"
                value={newPasswordForEdit}
                onChange={(e) => setNewPasswordForEdit(e.target.value)}
                placeholder="Lascia vuoto per non modificare"
                minLength={6}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleCredentialsSubmit}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!newUsernameForEdit.trim() && !newPasswordForEdit.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                Aggiorna Credenziali
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNewUsernameForEdit("");
                  setNewPasswordForEdit("");
                  setShowCredentialsEdit(false);
                }}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button for Search */}
      <Button
        onClick={handleSearchToggle}
        className={`floating-search-btn fixed right-6 w-14 h-14 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 z-50 ${
          theme === 'dark' 
            ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600' 
            : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200'
        } border-2 ${
          showSearch 
            ? 'opacity-0 scale-90 pointer-events-none' 
            : 'opacity-100 scale-100 pointer-events-auto'
        }`}
        style={{ bottom: 'calc(1.5rem + 3cm)' }}
        title="Cerca persone"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}