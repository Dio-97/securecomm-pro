import React, { useState, useEffect } from "react";
import { Search, MessageCircle, Plus, Settings, LogOut, User, Lock, ShieldQuestion, X, Shield, Upload, Edit3, Check, Camera, Crown } from "lucide-react";
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
  onMessageSent?: (targetUserId: string) => void;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  location: string;
}

export default function Conversations({ user, conversations, onSelectConversation, onLogout, onUserUpdate, onConversationRemoved, getUserPresenceStatus, isGodMode = false, godModeTarget = "", onExitGodMode, onMessageSent }: ConversationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [newMessageConversations, setNewMessageConversations] = useState<Set<string>>(new Set());
  const [previousConversations, setPreviousConversations] = useState<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>>([]);
  const [lastSentMessageConversation, setLastSentMessageConversation] = useState<string | null>(null);

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
        toast({ duration: 1000, 
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
        
        toast({ duration: 1000, 
          title: "Server Cambiato",
          description: `Connesso a ${randomServer.country} (${randomServer.name})`,
        });
      } else {
        throw new Error('Failed to connect to server');
      }
    } catch (error) {
      console.error('Error switching server:', error);
      toast({ duration: 1000, 
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

  const { data: searchResults = [], isLoading: searchLoading, error: searchError } = useQuery<SearchUser[]>({
    queryKey: [`/api/users/search/${searchQuery}`],
    enabled: searchQuery.length >= 1,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Debug logging
  React.useEffect(() => {
    console.log('Search state updated:', { 
      searchQuery, 
      searchResults: searchResults || [], 
      searchLoading,
      searchError,
      enabled: searchQuery.length >= 1 
    });
    if (searchResults && searchResults.length > 0) {
      console.log('Search results:', searchResults);
    }
  }, [searchQuery, searchResults, searchLoading, searchError]);

  // Rilevamento nuovi messaggi per animazioni
  useEffect(() => {
    if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
      setPreviousConversations([]);
      return;
    }

    // Confronta con le conversazioni precedenti per rilevare nuovi messaggi
    const newMessageIds = new Set<string>();
    
    conversations.forEach((current) => {
      const previous = previousConversations.find(p => p.userId === current.userId);
      
      // Se la conversazione ha un nuovo messaggio o timestamp più recente
      if (previous && current.lastMessage && previous.lastMessage) {
        const currentTime = new Date(current.lastMessage.timestamp || 0).getTime();
        const previousTime = new Date(previous.lastMessage.timestamp || 0).getTime();
        
        if (currentTime > previousTime) {
          newMessageIds.add(current.userId);
          console.log('🆕 Nuovo messaggio rilevato per:', current.username);
        }
      } else if (current.lastMessage && !previous?.lastMessage) {
        // Prima volta che la conversazione ha un messaggio
        newMessageIds.add(current.userId);
        console.log('🎯 Primo messaggio rilevato per:', current.username);
      }
    });

    // Includi anche la conversazione per cui è stato inviato un messaggio
    if (lastSentMessageConversation) {
      newMessageIds.add(lastSentMessageConversation);
      console.log('📤 Messaggio inviato dall\'utente per:', lastSentMessageConversation);
      setLastSentMessageConversation(null); // Reset dopo l'utilizzo
    }

    // Aggiorna lo stato dei nuovi messaggi
    if (newMessageIds.size > 0) {
      setNewMessageConversations(newMessageIds);
      
      // Rimuovi l'evidenziazione dopo 2 secondi
      setTimeout(() => {
        setNewMessageConversations(new Set());
      }, 2000);
    }

    // Aggiorna le conversazioni precedenti
    setPreviousConversations([...conversations]);
  }, [conversations, lastSentMessageConversation]);

  // Funzione per notificare quando l'utente invia un messaggio
  const triggerMessageSentAnimation = (targetUserId: string) => {
    setLastSentMessageConversation(targetUserId);
    console.log('🎯 Trigger animazione per messaggio inviato a:', targetUserId);
  };

  // Esponi la funzione al componente padre tramite useEffect
  useEffect(() => {
    if (onMessageSent) {
      // Sostituisci la funzione onMessageSent con la nostra versione che attiva l'animazione
      const originalOnMessageSent = onMessageSent;
      (window as any).triggerMessageSentAnimation = triggerMessageSentAnimation;
    }
  }, [onMessageSent]);

  const handleStartConversation = async (userId: string, username: string) => {
    console.log('🔍 Avvio conversazione da ricerca:', username, 'ID:', userId);
    
    // Il salvataggio è ora gestito automaticamente in handleSelectConversation
    // Clear search and navigate to conversation
    setShowSearch(false);
    setSearchQuery("");
    onSelectConversation(userId, username);
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
      toast({ duration: 1000, 
        title: "Errore",
        description: "Il file deve essere un'immagine",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ duration: 1000, 
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
      
      toast({ duration: 1000, 
        title: "Successo",
        description: "Immagine profilo aggiornata",
      });
      setShowAvatarUpload(false);
      
    } catch (error) {
      toast({ duration: 1000, 
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
      toast({ duration: 1000, 
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
        
        toast({ duration: 1000, 
          title: "Successo",
          description: "Nome utente aggiornato",
        });
        setShowUsernameEdit(false);
      } else {
        toast({ duration: 1000, 
          title: "Errore",
          description: data.message || "Errore durante l'aggiornamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({ duration: 1000, 
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
      toast({ duration: 1000, 
        title: "Operazione Non Consentita",
        description: "Non è possibile modificare le credenziali dell'admin principale",
        variant: "destructive",
      });
      return;
    }
    
    if (!newUsernameForEdit.trim() && !newPasswordForEdit.trim()) {
      toast({ duration: 1000, 
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
        toast({ duration: 1000, 
          title: "Successo",
          description: `Credenziali di @${godModeTarget} aggiornate`,
        });
        setShowCredentialsEdit(false);
        setNewUsernameForEdit("");
        setNewPasswordForEdit("");
      } else {
        toast({ duration: 1000, 
          title: "Errore",
          description: data.message || "Errore durante l'aggiornamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({ duration: 1000, 
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
      <div className={`search-container transition-all duration-300 z-[9999] relative ${
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
              const value = e.target.value;
              console.log('Search query changed:', value);
              setSearchQuery(value);
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
          
          {searchQuery.length >= 1 && (
            <div className="search-results-overlay mt-4 space-y-2 p-2 max-h-64 overflow-y-auto"
                 style={{ 
                   position: 'fixed',
                   top: '140px',
                   left: '1rem',
                   right: '1rem',
                   zIndex: 99999
                 }}>
              {searchLoading ? (
                <div className="text-center text-muted-foreground py-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  Cercando utenti...
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground px-2 py-1 border-b">
                    {searchResults.filter(searchUser => searchUser.id !== user.id).length} utente{searchResults.filter(searchUser => searchUser.id !== user.id).length !== 1 ? 'i' : ''} trovato{searchResults.filter(searchUser => searchUser.id !== user.id).length !== 1 ? 'i' : ''}
                  </div>
                  {searchResults.filter(searchUser => searchUser.id !== user.id).map((searchUser) => {
                    const activity = getActivityStatus(searchUser.lastActivity);
                    return (
                      <Card 
                        key={`search-${searchUser.id}`}
                        className="cursor-pointer hover:shadow-sm transition-all hover:bg-accent"
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
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'online' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                  : getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'in-your-chat'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'online' 
                                  ? 'Online' 
                                  : getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'in-your-chat'
                                  ? 'In Chat'
                                  : 'Offline'
                                }
                              </span>
                              <div className={`w-3 h-3 rounded-full ${
                                getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'online' 
                                  ? 'bg-green-500' 
                                  : getUserPresenceStatus && getUserPresenceStatus(searchUser.id) === 'in-your-chat'
                                  ? 'bg-blue-500'
                                  : 'bg-red-500'
                              }`}></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <div className="text-sm">Nessun utente trovato per "{searchQuery}"</div>
                  <div className="text-xs mt-1">Prova con un altro nome utente</div>
                </div>
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
          
          {!conversations || conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-foreground mb-2">No conversations yet</h4>
              <p className="text-sm text-muted-foreground">Start a conversation by searching for a user using the + button</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.isArray(conversations) && conversations.map((conversation, index) => {
                const hasNewMessage = newMessageConversations.has(conversation.userId);
                const isFirstPosition = index === 0;
                
                return (
                  <Card 
                    key={`conversation-${conversation.userId}`}
                    className={`cursor-pointer hover:shadow-sm transition-all duration-500 ease-in-out relative group conversation-item ${
                      hasNewMessage 
                        ? isFirstPosition 
                          ? 'animate-priority ring-2 ring-blue-400 dark:ring-blue-600' 
                          : 'animate-new ring-2 ring-green-400 dark:ring-green-600'
                        : 'animate-in slide-in-from-right-2'
                    }`}
                    style={{
                      animationDelay: hasNewMessage ? '0ms' : `${index * 50}ms`,
                      transform: 'translateY(0)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      ...(hasNewMessage && {
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                        borderColor: isFirstPosition ? 'rgb(59, 130, 246)' : 'rgb(34, 197, 94)'
                      })
                    }}
                    onClick={() => onSelectConversation(conversation.userId, conversation.username)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12 bg-primary">
                          <AvatarFallback>
                            {conversation.username.split('.').map(n => n[0].toUpperCase()).join('')}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online Status Indicator */}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                          getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'online' 
                            ? 'bg-green-500' 
                            : getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'in-your-chat'
                            ? 'bg-blue-500'
                            : 'bg-red-500'
                        }`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-card-foreground truncate">
                            {conversation.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <div className="flex items-center space-x-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'online' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                  : getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'in-your-chat'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'online' 
                                  ? 'Online' 
                                  : getUserPresenceStatus && getUserPresenceStatus(conversation.userId) === 'in-your-chat'
                                  ? 'In Chat'
                                  : 'Offline'
                                }
                              </span>
                              {/* Pallino blu per messaggi non letti */}
                              {conversation.unreadCount > 0 && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                            {conversation.lastMessage && conversation.lastMessage.timestamp && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(conversation.lastMessage.timestamp), 'HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                        {conversation.unreadCount > 0 && (
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="bg-blue-500 text-white text-xs px-2 py-0.5">
                              {conversation.unreadCount} nuovo{conversation.unreadCount !== 1 ? 'i' : ''}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveConversation(conversation.userId, e);
                        }}
                        className="opacity-50 hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
                        title="Rimuovi conversazione"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card border-t p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3" />
            <span>End-to-end encrypted</span>
            <span>•</span>
            <span>IP: {user.maskedIp?.split('.').slice(0, -1).join('.')}.xxx (Masked)</span>
          </div>
          <div className="flex items-center space-x-4">
            {user.isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.hash = '#admin';
                }}
                className="text-xs bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 px-2 py-1 h-auto scale-75"
              >
                <Crown className="w-2.5 h-2.5 mr-1" />
                <span className="text-xs">Passa ad Admin</span>
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