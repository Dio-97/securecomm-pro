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
import type { User } from "@shared/schema";

type Screen = "login" | "conversations" | "chat" | "admin";

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGodMode, setIsGodMode] = useState(false);
  const [godModeTarget, setGodModeTarget] = useState<string>("");
  const [currentConversation, setCurrentConversation] = useState<{ userId: string; username: string } | null>(null);

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
    viewUserAsGod,
    getUserPresenceStatus 
  } = useWebSocket();

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.isAdmin) {
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

  const handleSelectConversation = async (userId: string, username: string) => {
    setCurrentConversation({ userId, username });
    setCurrentScreen("chat");
    if (currentUser) {
      await loadConversation(currentUser.id, userId);
    }
  };

  const handleBackToConversations = async () => {
    if (currentConversation && currentUser) {
      await leaveConversation(currentUser.id, currentConversation.userId);
    }
    setCurrentConversation(null);
    setCurrentScreen(currentUser?.isAdmin ? "admin" : "conversations");
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
          onSendMessage={sendMessage}
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
