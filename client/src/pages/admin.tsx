import { useState, useEffect } from "react";
import { Crown, Settings, LogOut, Eye, UserPlus, Ban, Trash2, Shield, Edit3, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  lastActivity: string;
  messageCount: string;
  location: string;
  avatar?: string | null;
}

interface AdminProps {
  onLogout: () => void;
  onViewUser: (username: string) => void;
  onMonitorSessions: () => void;
}

interface CreateUserResponse {
  user: AdminUser;
  credentials: {
    username: string;
    password: string;
  };
}

export default function Admin({ onLogout, onViewUser, onMonitorSessions }: AdminProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCredentialsEdit, setShowCredentialsEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/users/create", {
        invitedBy: "admin"
      });
      return response.json() as Promise<CreateUserResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Account Created Successfully",
        description: `Username: ${data.credentials.username}\nPassword: ${data.credentials.password}`,
        duration: 10000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user account",
        variant: "destructive",
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User account has been permanently deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  });

  const handleDeleteUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to delete user @${username}? This action cannot be undone.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleCreateUser = () => {
    createUserMutation.mutate();
  };

  const updateCredentialsMutation = useMutation({
    mutationFn: async ({ userId, username, password }: { userId: string; username?: string; password?: string }) => {
      const response = await apiRequest("PUT", "/api/admin/update-credentials", {
        userId,
        username,
        password
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCredentialsEdit(false);
      setEditingUser(null);
      setNewUsername("");
      setNewPassword("");
      toast({
        title: "Credenziali aggiornate",
        description: "Le credenziali dell'utente sono state modificate con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare le credenziali",
        variant: "destructive",
      });
    }
  });

  const handleEditCredentials = (user: AdminUser) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewPassword("");
    setShowCredentialsEdit(true);
    
    // Multiple strategies to prevent keyboard opening
    setTimeout(() => {
      // Blur any active element
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
      
      // Remove focus from all inputs in the dialog
      const dialogInputs = document.querySelectorAll('input');
      dialogInputs.forEach(input => {
        input.blur();
        input.setAttribute('readonly', 'true');
        setTimeout(() => {
          input.removeAttribute('readonly');
        }, 300);
      });
    }, 0);
    
    // Additional timeout for stubborn mobile browsers
    setTimeout(() => {
      const inputs = document.querySelectorAll('#new-username, #new-password');
      inputs.forEach(input => {
        if (input instanceof HTMLInputElement) {
          input.blur();
        }
      });
    }, 50);
  };

  const handleSaveCredentials = () => {
    if (!editingUser) return;
    
    const updates: { userId: string; username?: string; password?: string } = {
      userId: editingUser.id
    };
    
    if (newUsername && newUsername !== editingUser.username) {
      updates.username = newUsername;
    }
    if (newPassword) {
      updates.password = newPassword;
    }
    
    if (updates.username || updates.password) {
      updateCredentialsMutation.mutate(updates);
    } else {
      setShowCredentialsEdit(false);
    }
  };

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
                        {user.avatar ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-white font-semibold text-sm">
                            <UserIcon className="w-5 h-5" />
                          </AvatarFallback>
                        )}
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
                    
                    <div className="flex justify-between mt-4 space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewUser(user.username);
                        }}
                        className="text-xs flex-1"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCredentials(user);
                        }}
                        className="text-xs"
                        title="Modifica credenziali"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(user.id, user.username);
                        }}
                        className="text-xs"
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                <Shield className="w-4 h-4" />
                <span>{createUserMutation.isPending ? "Creating..." : "Create Secure Account"}</span>
              </Button>
              <Button 
                onClick={onMonitorSessions}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" />
                <span>Monitor All Sessions</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Edit Dialog */}
      <Dialog open={showCredentialsEdit} onOpenChange={setShowCredentialsEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Credenziali - {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-username">Nuovo Username</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Inserisci nuovo username"
                autoFocus={false}
                autoComplete="off"
                onFocus={(e) => {
                  // Prevent focus if dialog just opened
                  if (showCredentialsEdit) {
                    setTimeout(() => e.target.blur(), 50);
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="new-password">Nuova Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Lascia vuoto per non modificare"
                autoFocus={false}
                autoComplete="off"
                onFocus={(e) => {
                  // Prevent focus if dialog just opened
                  if (showCredentialsEdit) {
                    setTimeout(() => e.target.blur(), 50);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCredentialsEdit(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleSaveCredentials}
              disabled={updateCredentialsMutation.isPending}
            >
              {updateCredentialsMutation.isPending ? "Aggiornamento..." : "Salva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
