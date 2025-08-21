import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { disablePersistentLogin } from "@/lib/auth";
import Login from "@/pages/login";
import Chat from "@/pages/chat";
import Conversations from "@/pages/conversations";
import Admin from "@/pages/admin";
import MonitorSessions from "@/pages/monitor-sessions";
import type { User } from "@shared/schema";

type Screen = "login" | "conversations" | "chat" | "admin" | "monitor-sessions";

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGodMode, setIsGodMode] = useState(false);
  const [godModeTarget, setGodModeTarget] = useState<string>("");
  const [currentConversation, setCurrentConversation] = useState<{ userId: string; username: string } | null>(null);

  // Handle URL changes for navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the #
      if (hash === 'admin' && currentUser?.isAdmin) {
        setCurrentScreen("admin");
      } else if (hash === 'conversations' && currentUser) {
        setCurrentScreen("conversations");
        setCurrentConversation(null);
        // Reset God Mode when returning to conversations
        setIsGodMode(false);
        setGodModeTarget("");
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check initial hash

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentUser]);

  const handleUserUpdate = (updatedData: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedData });
    }
  };

  const { 
    isConnected, 
    messages, 
    conversations,
    user: wsUser, 
    authenticate, 
    sendMessage,
    loadConversation,
    leaveConversation,
    refreshConversations,
    viewUserAsGod,
    getUserPresenceStatus 
  } = useWebSocket();

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Admin23 accede direttamente alla pagina admin, gli altri admin alle conversazioni
    if (user.isAdmin && user.username === "admin23") {
      setCurrentScreen("admin");
    } else {
      setCurrentScreen("conversations");
    }
  };

  const handleWebSocketAuth = (username: string, password: string) => {
    authenticate(username, password);
  };

  const handleLogout = () => {
    // Clear persistent login credentials when user explicitly logs out
    disablePersistentLogin();
    setCurrentUser(null);
    setCurrentScreen("login");
    setIsGodMode(false);
    setGodModeTarget("");
    setCurrentConversation(null);
  };

  const handleViewUser = (username: string) => {
    setIsGodMode(true);
    setGodModeTarget(username);
    setCurrentScreen("conversations");
    viewUserAsGod(username);
  };

  const handleExitGodMode = () => {
    setIsGodMode(false);
    setGodModeTarget("");
    setCurrentScreen("admin");
    setCurrentConversation(null);
  };

  const handleSendMessage = (content: string, recipientId: string) => {
    console.log('📡 APP - Invio messaggio:', {
      contenuto: content,
      mittente: currentUser?.username,
      destinatario: recipientId
    });
    
    if (!currentUser) {
      console.error('❌ Utente non autenticato');
      return;
    }

    // Usa la funzione sendMessage dal hook WebSocket
    sendMessage(content, recipientId);
  };

  const handleSelectConversation = async (userId: string, username: string) => {
    console.log('💬 Aprendo conversazione con:', username, 'ID:', userId);
    
    // Salva SEMPRE la conversazione quando viene aperta (tramite ricerca o lista)
    if (currentUser) {
      try {
        console.log('💾 Salvataggio automatico conversazione:', currentUser.id, '<->', userId);
        await fetch('/api/conversations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: currentUser.id, 
            otherUserId: userId 
          })
        });
        console.log('✅ Conversazione salvata automaticamente');
        
        // Refresh lista conversazioni IMMEDIATAMENTE usando WebSocket
        if (refreshConversations) {
          refreshConversations();
        }
        
        // Refresh anche con queryClient per sicurezza
        handleConversationRemoved();
        
        // Ultimo refresh dopo delay per essere certi
        setTimeout(() => {
          if (refreshConversations) {
            refreshConversations();
          }
        }, 1000);
      } catch (error) {
        console.error('❌ Errore salvataggio conversazione:', error);
      }
    }
    
    setCurrentConversation({ userId, username });
    setCurrentScreen("chat");
    if (currentUser) {
      console.log('🔄 Caricamento messaggi per conversazione:', currentUser.id, '<->', userId);
      await loadConversation(currentUser.id, userId);
    }
  };

  const handleBackToConversations = async () => {
    console.log('🔙 Tornando alle conversazioni...');
    
    // Leave current conversation properly  
    if (currentConversation && currentUser) {
      await leaveConversation(currentUser.id, currentConversation.userId);
    }
    
    // Clear conversation state
    setCurrentConversation(null);
    
    // Reset God Mode when going back
    if (isGodMode) {
      setIsGodMode(false);
      setGodModeTarget("");
    }
    
    // FORZA REFRESH CONVERSAZIONI QUANDO TORNI INDIETRO
    console.log('🔄 Refresh automatico conversazioni...');
    if (refreshConversations) {
      refreshConversations();
    }
    
    // Force refresh cache
    handleConversationRemoved();
    
    // Navigate to conversations regardless of admin status when using back button
    setCurrentScreen("conversations");
    
    // Force URL hash update for consistent navigation
    window.location.hash = '#conversations';
  };

  const handleConversationRemoved = () => {
    // Force refresh conversations by invalidating the query cache
    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    if (!currentUser?.isAdmin) return;
    
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, editedBy: currentUser.id }),
      });
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  return (
    <div className="min-h-screen">
      {currentScreen === "login" && (
        <Login 
          onLogin={handleLogin}
          onWebSocketAuth={handleWebSocketAuth}
        />
      )}
      
      {currentScreen === "conversations" && currentUser && (
        <Conversations
          user={currentUser}
          conversations={conversations}
          onSelectConversation={handleSelectConversation}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          onConversationRemoved={handleConversationRemoved}
          getUserPresenceStatus={getUserPresenceStatus}
          isGodMode={isGodMode}
          godModeTarget={godModeTarget}
          onExitGodMode={handleExitGodMode}
        />
      )}
      
      {currentScreen === "chat" && currentUser && currentConversation && (
        <Chat
          user={currentUser}
          messages={messages}
          recipientId={currentConversation.userId}
          recipientUsername={currentConversation.username}
          onSendMessage={handleSendMessage}
          getUserPresenceStatus={getUserPresenceStatus}
          onBack={handleBackToConversations}
          onLogout={handleLogout}
          isGodMode={isGodMode}
          godModeTarget={godModeTarget}
          onExitGodMode={handleExitGodMode}
          onEditMessage={handleEditMessage}
        />
      )}
      
      {currentScreen === "admin" && (
        <Admin
          onLogout={handleLogout}
          onViewUser={handleViewUser}
          onMonitorSessions={() => setCurrentScreen("monitor-sessions")}
          currentUser={currentUser ? { username: currentUser.username, id: currentUser.id } : undefined}
        />
      )}
      
      {currentScreen === "monitor-sessions" && (
        <MonitorSessions
          onBack={() => setCurrentScreen("admin")}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
