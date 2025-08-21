import { useState } from "react";
import { Crown, Settings, LogOut, Eye, User as UserIcon, ArrowLeft, X, Edit2, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
  currentUser?: { username: string; id: string };
}

export default function Admin({ onLogout, onViewUser, onMonitorSessions, currentUser }: AdminProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'username' | 'password' | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  
  const { data: allUsers = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
  });

  // Filtra gli utenti per escludere l'utente corrente e quelli nascosti
  const users = allUsers.filter(user => 
    (currentUser ? user.username !== currentUser.username : true) &&
    !hiddenUsers.has(user.id)
  );

  const handleStartEdit = (userId: string, field: 'username' | 'password', currentValue: string) => {
    setEditingUser(userId);
    setEditingField(field);
    setEditValue(field === 'password' ? '' : currentValue);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditingField(null);
    setEditValue("");
  };

  const handleSaveEdit = async (userId: string) => {
    if (!editingField || !editValue.trim()) return;

    try {
      const endpoint = editingField === 'username' ? 'username' : 'password';
      const response = await fetch(`/api/users/${userId}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: editValue.trim() })
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        toast({
          title: "✅ Aggiornamento completato",
          description: `${editingField === 'username' ? 'Username' : 'Password'} aggiornato con successo`,
          duration: 1000,
        });
        handleCancelEdit();
      } else {
        toast({
          title: "❌ Errore",
          description: editingField === 'username' ? "Username già esistente o non valido" : "Impossibile aggiornare la password",
          variant: "destructive",
          duration: 1000,
        });
      }
    } catch (error) {
      toast({
        title: "❌ Errore di rete",
        description: "Verifica la connessione",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeletingUser(userId);
    
    // Nascondi l'utente dopo l'animazione
    setTimeout(() => {
      setHiddenUsers(prev => new Set(prev).add(userId));
    }, 1500);
    
    // Animazione con setTimeout per assicurare che sia unidirezionale
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Aggiorna i dati nel backend
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          toast({
            title: "✅ Utente eliminato",
            description: `${userName} è stato eliminato con successo`,
            duration: 1000,
          });
          setDeletingUser(null);
          setShowDeleteConfirm(null);
        } else {
          // Se fallisce, rimuovi dalle liste e mostra errore
          setHiddenUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
          toast({
            title: "❌ Errore", 
            description: "Impossibile eliminare l'utente",
            variant: "destructive",
            duration: 1000,
          });
          setDeletingUser(null);
          setShowDeleteConfirm(null);
        }
      } catch (error) {
        // Se fallisce, rimuovi dalle liste e mostra errore
        setHiddenUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        toast({
          title: "❌ Errore di rete",
          description: "Verifica la connessione",
          variant: "destructive",
          duration: 1000,
        });
        setDeletingUser(null);
        setShowDeleteConfirm(null);
      }
    }, 100);
  };

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
            className="mr-2 px-2.5 py-2.5 h-auto scale-75"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            <span className="text-xs">Torna alle Conversazioni</span>
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
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {users.map((user, index) => {
                const activity = getActivityStatus(user.lastActivity);
                const isDeleting = deletingUser === user.id;
                
                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={!isDeleting ? {
                      opacity: 1,
                      scale: 1,
                      y: 0
                    } : {}}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.1,
                      ease: "easeOut"
                    }}
                    whileHover={!isDeleting ? { scale: 1.02 } : {}}
                    whileTap={!isDeleting ? { scale: 0.98 } : {}}
                    className={isDeleting ? "delete-animation" : ""}
                    style={{
                      pointerEvents: isDeleting ? "none" : "auto"
                    }}
                  >
                    <Card className="hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-6 flex flex-col h-full">
                        <motion.div 
                          className="flex items-center space-x-4 mb-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 + 0.2 }}
                        >
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
                                <motion.div
                                  initial={{ opacity: 0, rotate: -180 }}
                                  animate={{ opacity: 1, rotate: 0 }}
                                  transition={{ delay: index * 0.1 + 0.3 }}
                                >
                                  <Crown className={`w-4 h-4 ml-2 ${
                                    user.username === "admin23" 
                                      ? "text-yellow-300" // Corona oro luminosa per admin principale
                                      : "text-yellow-600" // Corona gialla più scura per altri admin
                                  }`} />
                                </motion.div>
                              )}
                            </div>
                          </div>
                          <motion.div 
                            className={`w-3 h-3 ${activity.color} rounded-full`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: index * 0.1 + 0.4 }}
                          ></motion.div>
                        </motion.div>
                        
                        <motion.div 
                          className="space-y-2 text-xs text-muted-foreground mb-4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 + 0.3 }}
                        >
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
                        </motion.div>
                        
                        {/* Sezione Username e Password - Centrata */}
                        {user.username !== "admin23" && (
                          <motion.div 
                            className="flex justify-center my-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 + 0.4 }}
                          >
                            <div className="space-y-2 w-full max-w-xs">
                              {/* Edit Username */}
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-muted-foreground w-16">Username:</span>
                                {editingUser === user.id && editingField === 'username' ? (
                                  <div className="flex gap-1 flex-1">
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(user.id);
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      className="text-xs h-7"
                                      autoFocus
                                    />
                                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(user.id)} className="h-7 w-7 p-0">
                                      <Check className="w-3 h-3 text-green-600" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                                      <XCircle className="w-3 h-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 items-center flex-1">
                                    <span className="text-xs flex-1">@{user.username}</span>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => handleStartEdit(user.id, 'username', user.username)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              
                              {/* Edit Password */}
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-muted-foreground w-16">Password:</span>
                                {editingUser === user.id && editingField === 'password' ? (
                                  <div className="flex gap-1 flex-1">
                                    <Input
                                      type="password"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(user.id);
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      placeholder="Nuova password"
                                      className="text-xs h-7"
                                      autoFocus
                                    />
                                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(user.id)} className="h-7 w-7 p-0">
                                      <Check className="w-3 h-3 text-green-600" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                                      <XCircle className="w-3 h-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 items-center flex-1">
                                    <span className="text-xs flex-1">••••••••</span>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => handleStartEdit(user.id, 'password', '')}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                        
                        {/* Controlli Admin - Pulsanti in basso */}
                        <motion.div 
                          className="flex gap-2 justify-center mt-auto"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 + 0.5 }}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewUser(user.username);
                            }}
                            className="text-xs px-4 py-2 h-9 min-w-[120px]"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Visualizza
                          </Button>
                          
                          {user.username !== "admin23" && (
                            <>
                              {showDeleteConfirm === user.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteUser(user.id, user.name);
                                    }}
                                    className="text-xs px-2 h-7"
                                    disabled={isDeleting}
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowDeleteConfirm(null);
                                    }}
                                    className="text-xs px-2 h-7"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(user.id);
                                  }}
                                  className="text-xs px-3 py-2 h-9"
                                  disabled={isDeleting}
                                >
                                  <X className={`w-3 h-3 ${isDeleting ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await fetch(`/api/users/${user.id}/admin`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ isAdmin: !user.isAdmin })
                                    });
                                    
                                    if (response.ok) {
                                      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                                      toast({
                                        title: user.isAdmin ? "❌ Admin rimosso" : "✅ Admin aggiunto",
                                        description: `${user.name} ${user.isAdmin ? 'non è più' : 'è ora'} un admin`,
                                      });
                                    } else {
                                      toast({
                                        title: "❌ Errore",
                                        description: "Impossibile modificare lo status admin",
                                        variant: "destructive",
                                      });
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "❌ Errore di rete",
                                      description: "Verifica la connessione",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="text-xs px-4 py-2 h-9 min-w-[120px] bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                              >
                                <Crown className="w-3 h-3 mr-1" />
                                {user.isAdmin ? 'Rimuovi' : 'Rendi'} Admin
                              </Button>
                            </>
                          )}
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        
        {/* Admin Actions - Solo Monitoraggio */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-4 text-card-foreground">Controllo Admin</h4>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                onClick={onMonitorSessions}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" />
                <span>Monitor All Sessions</span>
              </Button>
              
              <Button 
                onClick={async () => {
                  setIsCreatingUser(true);
                  try {
                    const response = await fetch('/api/users/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ invitedBy: "admin23" })
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      
                      // Aggiorna la cache di React Query senza ricaricare la pagina
                      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                      
                      toast({
                        title: "✅ Utente creato con successo!",
                        description: `Username: ${result.credentials.username}\nPassword: ${result.credentials.password}`,
                        duration: 8000,
                      });
                    } else {
                      toast({
                        title: "❌ Errore",
                        description: "Impossibile creare l'utente",
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    console.error('Error creating random user:', error);
                    toast({
                      title: "❌ Errore di rete",
                      description: "Verifica la connessione e riprova",
                      variant: "destructive",
                    });
                  } finally {
                    setIsCreatingUser(false);
                  }
                }}
                disabled={isCreatingUser}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <UserIcon className={`w-4 h-4 ${isCreatingUser ? 'animate-spin' : ''}`} />
                <span>{isCreatingUser ? 'Creando...' : 'Crea Utente'}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
                Admin23 ha controllo completo - Può modificare utenti, password e privilegi admin
              </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}