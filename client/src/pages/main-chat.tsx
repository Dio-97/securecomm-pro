import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Settings, LogOut, User, Lock, ShieldQuestion, Search, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { MessageBubble } from "@/components/message-bubble";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Message, User as UserType } from "@shared/schema";

interface MainChatProps {
  user: UserType;
  messages: Message[];
  conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>;
  currentConversation: { userId: string; username: string } | null;
  onSendMessage: (content: string, recipientId: string) => void;
  onSelectConversation: (userId: string, username: string) => void;
  onLogout: () => void;
  isGodMode?: boolean;
  godModeTarget?: string;
  onExitGodMode?: () => void;
  onEditMessage?: (messageId: string, content: string) => void;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  location: string;
}

export default function MainChat({ 
  user, 
  messages, 
  conversations,
  currentConversation,
  onSendMessage, 
  onSelectConversation,
  onLogout,
  isGodMode = false,
  godModeTarget,
  onExitGodMode,
  onEditMessage
}: MainChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { theme, toggleTheme } = useTheme();

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<SearchUser[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length > 2,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentConversation) return;
    
    onSendMessage(newMessage, currentConversation.userId);
    setNewMessage("");
    
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

  const handleStartConversation = (userId: string, username: string) => {
    onSelectConversation(userId, username);
    setShowSearch(false);
    setSearchQuery("");
  };

  const getActivityStatus = (lastActivity: string) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diffMinutes = Math.floor((now.getTime() - activity.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return { status: "online", color: "bg-green-500" };
    if (diffMinutes < 15) return { status: "away", color: "bg-yellow-500" };
    return { status: "offline", color: "bg-gray-500" };
  };

  const displayName = isGodMode ? godModeTarget : user.username;

  return (
    <div className="min-h-screen flex bg-background">
      {/* God Mode Indicator */}
      {isGodMode && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-pink-600 text-white text-center py-2 text-sm font-semibold z-50">
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

      {/* Sidebar - Conversations List */}
      <div className={`w-80 border-r bg-card flex flex-col ${isGodMode ? 'mt-12' : ''}`}>
        {/* Sidebar Header */}
        <header className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8 bg-primary">
              <AvatarFallback>
                <User className="w-4 h-4 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-sm text-card-foreground">{displayName}</h2>
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
            <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)}>
              <Plus className="w-4 h-4" />
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
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {searchQuery.length > 2 && (
              <div className="mt-4 max-h-40 overflow-y-auto space-y-2">
                {searchLoading ? (
                  <div className="text-center text-muted-foreground py-2">Searching...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((searchUser) => {
                    const activity = getActivityStatus(searchUser.lastActivity);
                    return (
                      <div 
                        key={searchUser.id}
                        className="flex items-center space-x-3 p-2 hover:bg-muted rounded cursor-pointer"
                        onClick={() => handleStartConversation(searchUser.id, searchUser.username)}
                      >
                        <Avatar className="w-8 h-8 bg-blue-500">
                          <AvatarFallback className="text-white text-xs">
                            {searchUser.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-card-foreground truncate">{searchUser.name}</p>
                          <p className="text-xs text-muted-foreground">@{searchUser.username}</p>
                        </div>
                        <div className={`w-2 h-2 ${activity.color} rounded-full`}></div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-2 text-sm">No users found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Messages</h3>
          
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">No conversations yet</p>
              <Button size="sm" onClick={() => setShowSearch(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Start Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div 
                  key={conversation.userId}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    currentConversation?.userId === conversation.userId 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectConversation(conversation.userId, conversation.username)}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10 bg-blue-500">
                      <AvatarFallback className="text-white text-sm">
                        {conversation.username.split('.').map(n => n[0].toUpperCase()).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {conversation.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
                        </p>
                        <div className="flex items-center space-x-2">
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(conversation.lastMessage.timestamp!), "HH:mm")}
                            </span>
                          )}
                          {conversation.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs h-5 w-5 rounded-full p-0 flex items-center justify-center">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {conversation.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col ${isGodMode ? 'mt-12' : ''}`}>
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8 bg-primary">
                  <AvatarFallback>
                    {currentConversation.username.split('.').map(n => n[0].toUpperCase()).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold text-sm text-card-foreground">
                    {currentConversation.username.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-muted-foreground">
                      <Lock className="w-3 h-3 inline mr-1" />
                      Auto-destruct in 30s
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <Button variant="ghost" size="sm">
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
                  <span>Messages auto-destruct after viewing</span>
                  <span>•</span>
                  <span>IP: 192.168.xxx.xxx (Masked)</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <ShieldQuestion className="w-3 h-3 inline mr-1" />
                  <span>Private conversation</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">SecureComm Pro</h3>
              <p className="text-sm text-muted-foreground mb-4">Select a conversation to start messaging</p>
              <p className="text-xs text-muted-foreground">
                <ShieldQuestion className="w-3 h-3 inline mr-1" />
                All messages are end-to-end encrypted and auto-destruct after viewing
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}