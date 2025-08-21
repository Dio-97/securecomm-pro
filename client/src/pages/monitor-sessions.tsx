import { useState, useEffect } from "react";
import { ArrowLeft, Crown, MessageCircle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { Message, User } from "@shared/schema";

interface MonitoredMessage {
  id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  recipientUsername: string;
  timestamp: string;
  isEncrypted: boolean;
  senderAvatar?: string;
}

interface MonitorSessionsProps {
  onBack: () => void;
  onLogout: () => void;
}

export default function MonitorSessions({ onBack, onLogout }: MonitorSessionsProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "encrypted" | "unencrypted">("all");

  const { data: allMessages = [], isLoading } = useQuery<MonitoredMessage[]>({
    queryKey: ["/api/admin/monitor/messages"],
    refetchInterval: 2000, // Auto-refresh every 2 seconds
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Create a map for quick user lookup
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, User>);

  // Filter messages based on search and filter type
  const filteredMessages = allMessages.filter(message => {
    const matchesSearch = searchQuery === "" || 
      message.senderUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.recipientUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === "all" || 
      (filterType === "encrypted" && message.isEncrypted) ||
      (filterType === "unencrypted" && !message.isEncrypted);
    
    return matchesSearch && matchesFilter;
  });

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true, 
        locale: it 
      });
    } catch {
      return "Ora sconosciuta";
    }
  };

  const getUserInitials = (username: string) => {
    return username.split('.').map(n => n[0].toUpperCase()).join('');
  };

  return (
    <div className={`min-h-screen bg-background ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-card border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Indietro
            </Button>
            
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8 bg-red-600">
                <AvatarFallback>
                  <Crown className="w-4 h-4 text-white" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-card-foreground">Monitor All Sessions</h2>
                <p className="text-xs text-muted-foreground">Monitoraggio messaggi in tempo reale</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="destructive" className="text-xs">
              <Crown className="w-3 h-3 mr-1" />
              ADMIN MODE
            </Badge>
            
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Filters and Search */}
      <div className="bg-card border-b p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Cerca per utente o contenuto messaggio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              Tutti ({allMessages.length})
            </Button>
            <Button
              variant={filterType === "encrypted" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("encrypted")}
            >
              Crittografati ({allMessages.filter(m => m.isEncrypted).length})
            </Button>
            <Button
              variant={filterType === "unencrypted" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("unencrypted")}
            >
              Non crittografati ({allMessages.filter(m => !m.isEncrypted).length})
            </Button>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg text-card-foreground mb-2">
                {searchQuery || filterType !== "all" ? "Nessun messaggio trovato" : "Nessun messaggio"}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || filterType !== "all" 
                  ? "Prova a cambiare i filtri di ricerca"
                  : "Tutti i messaggi scambiati appariranno qui"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => {
              const sender = userMap[message.senderId];
              const recipient = userMap[message.recipientId];
              
              return (
                <Card key={message.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex space-x-3">
                      <Avatar className="w-10 h-10 bg-blue-500 flex-shrink-0">
                        {sender?.avatar ? (
                          <img src={sender.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-white font-semibold text-sm">
                            {getUserInitials(message.senderUsername)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-card-foreground">
                              {message.senderUsername}
                            </span>
                            <span className="text-muted-foreground text-sm">→</span>
                            <span className="font-medium text-muted-foreground">
                              {message.recipientUsername}
                            </span>
                            {message.isEncrypted && (
                              <Badge variant="secondary" className="text-xs">
                                🔒 Crittografato
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {getTimeAgo(message.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-card-foreground break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}