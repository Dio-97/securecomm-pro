import { useState } from "react";
import { Crown, Settings, LogOut, Eye, User as UserIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  messageCount: string;
  location: string;
  avatar?: string | null;
  isAdmin?: boolean;
}

interface AdminProps {
  onLogout: () => void;
  onViewUser: (username: string) => void;
  onMonitorSessions: () => void;
}

export default function Admin({ onLogout, onViewUser, onMonitorSessions }: AdminProps) {
  const { theme, toggleTheme } = useTheme();
  
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
  });

  const getActivityStatus = (lastActivity: string) => {
    const now = new Date();
    const lastSeen = new Date(lastActivity);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 5) {
      return { color: "bg-green-500", text: "Online" };
    } else if (diffInMinutes < 30) {
      return { color: "bg-yellow-500", text: `${diffInMinutes}m ago` };
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return { color: "bg-orange-500", text: `${hours}h ago` };
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return { color: "bg-gray-500", text: `${days}d ago` };
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Crown className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Modalità Solo Visualizzazione</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.hash = '#conversations'}
            className="mr-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Torna alle Conversazioni
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? "☀️" : "🌙"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards - Compatto */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{users.length}</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">Utenti</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{users.filter(u => u.isAdmin).length}</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">Admin</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">{users.filter(u => getActivityStatus(u.lastActivity).color === "bg-green-500").length}</p>
                <p className="text-xs text-green-700 dark:text-green-300">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Users</h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                      <div className="h-3 bg-gray-300 rounded w-16"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => {
              const activity = getActivityStatus(user.lastActivity);
              return (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <Avatar className="w-12 h-12 bg-blue-500">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-white font-semibold">
                            {user.initials}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-card-foreground">{user.name}</h4>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                          {user.isAdmin && (
                            <Crown className={`w-4 h-4 ml-2 ${
                              user.username === "admin23" 
                                ? "text-yellow-300" // Corona oro luminosa per admin principale
                                : "text-yellow-600" // Corona gialla più scura per altri admin
                            }`} />
                          )}
                        </div>
                      </div>
                      <div className={`w-3 h-3 ${activity.color} rounded-full`}></div>
                    </div>
                    
                    <div className="space-y-2 text-xs text-muted-foreground mb-4">
                      <div className="flex justify-between">
                        <span>Last Activity:</span>
                        <span>{activity.text}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Messages Today:</span>
                        <span>{user.messageCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IP Location:</span>
                        <span>{user.location}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewUser(user.username);
                        }}
                        className="text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Visualizza Conversazioni
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Admin Actions - Solo Monitoraggio */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-4 text-card-foreground">Controllo Admin</h4>
            <div className="text-center">
              <Button 
                onClick={onMonitorSessions}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" />
                <span>Monitor All Sessions</span>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Modalità solo visualizzazione - Non è possibile modificare o eliminare utenti
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}