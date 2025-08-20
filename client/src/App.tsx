import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import Login from "@/pages/login";
import MainChat from "@/pages/main-chat";
import Admin from "@/pages/admin";
import type { User } from "@shared/schema";

type Screen = "login" | "chat" | "admin";

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGodMode, setIsGodMode] = useState(false);
  const [godModeTarget, setGodModeTarget] = useState<string>("");
  const [currentConversation, setCurrentConversation] = useState<{ userId: string; username: string } | null>(null);

  const { 
    isConnected, 
    messages, 
    conversations,
    user: wsUser, 
    authenticate, 
    sendMessage,
    loadConversation,
    viewUserAsGod 
  } = useWebSocket();

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.isAdmin) {
      setCurrentScreen("admin");
    } else {
      setCurrentScreen("chat");
    }
  };

  const handleWebSocketAuth = (username: string, password: string) => {
    authenticate(username, password);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen("login");
    setIsGodMode(false);
    setGodModeTarget("");
    setCurrentConversation(null);
  };

  const handleViewUser = (username: string) => {
    setIsGodMode(true);
    setGodModeTarget(username);
    setCurrentScreen("chat");
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

  const handleBackToConversations = () => {
    setCurrentConversation(null);
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
      
      {currentScreen === "chat" && currentUser && (
        <MainChat
          user={currentUser}
          messages={messages}
          conversations={conversations}
          currentConversation={currentConversation}
          onSendMessage={sendMessage}
          onSelectConversation={handleSelectConversation}
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
