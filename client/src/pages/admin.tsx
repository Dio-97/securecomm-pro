import { useState, useEffect } from "react";
import { Crown, Settings, LogOut, Eye, UserPlus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  messageCount: string;
  location: string;
}

interface AdminProps {
  onLogout: () => void;
  onViewUser: (username: string) => void;
}

export default function Admin({ onLogout, onViewUser }: AdminProps) {
  const { theme, toggleTheme } = useTheme();
  
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
  });

  const getActivityStatus = (lastActivity: string) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diffMinutes = Math.floor((now.getTime() - activity.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return { status: "online", color: "bg-green-500", text: "Active now" };
    if (diffMinutes < 15) return { status: "away", color: "bg-yellow-500", text: `${diffMinutes} min ago` };
    return { status: "offline", color: "bg-gray-500", text: `${diffMinutes} min ago` };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8 bg-red-600">
              <AvatarFallback>
                <Crown className="w-4 h-4 text-white" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-card-foreground">Admin Dashboard</h2>
              <p className="text-xs text-muted-foreground">God Mode Active - Invisible Monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? "☀️" : "🌙"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 text-foreground">Active Users</h3>
          <p className="text-sm text-muted-foreground">Click on any user to view their session invisibly</p>
        </div>
        
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const activity = getActivityStatus(user.lastActivity);
              
              return (
                <Card 
                  key={user.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
                  onClick={() => onViewUser(user.username)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Avatar className="w-10 h-10 bg-blue-500">
                        <AvatarFallback className="text-white font-semibold text-sm">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-card-foreground">{user.name}</h4>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <div className={`w-3 h-3 ${activity.color} rounded-full`}></div>
                    </div>
                    
                    <div className="space-y-2 text-xs text-muted-foreground">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Admin Actions */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-4 text-card-foreground">Admin Actions</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700">
                <Eye className="w-4 h-4" />
                <span>Monitor All</span>
              </Button>
              <Button className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4" />
                <span>Invite User</span>
              </Button>
              <Button className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700">
                <Ban className="w-4 h-4" />
                <span>Manage Access</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
