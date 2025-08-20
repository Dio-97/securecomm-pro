import { useState, useEffect } from "react";
import { Search, MessageCircle, Plus, Settings, LogOut, User, Lock, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { VPNStatus } from "@/components/vpn-status";
import type { User as UserType, Message } from "@shared/schema";

interface ConversationsProps {
  user: UserType;
  conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>;
  onSelectConversation: (userId: string, username: string) => void;
  onLogout: () => void;
  onUserUpdate?: (updatedUser: Partial<UserType>) => void;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  location: string;
}

export default function Conversations({ user, conversations, onSelectConversation, onLogout, onUserUpdate }: ConversationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleVPNRotate = (newData: { maskedIp: string; vpnServer: string; vpnCountry: string; location: string }) => {
    if (onUserUpdate) {
      onUserUpdate(newData);
    }
  };

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<SearchUser[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length > 2,
  });

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar className="w-8 h-8 bg-primary">
            <AvatarFallback>
              <User className="w-4 h-4 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm text-card-foreground">{user.username}</h2>
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
          
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? "☀️" : "🌙"}
          </Button>
          
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
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

      {/* VPN Status */}
      <div className="border-b p-4">
        <VPNStatus user={user} onVPNRotate={handleVPNRotate} />
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
                  className="cursor-pointer hover:shadow-sm transition-all"
                  onClick={() => onSelectConversation(conversation.userId, conversation.username)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12 bg-blue-500">
                        <AvatarFallback className="text-white font-semibold">
                          {conversation.username.split('.').map(n => n[0].toUpperCase()).join('')}
                        </AvatarFallback>
                      </Avatar>
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
    </div>
  );
}