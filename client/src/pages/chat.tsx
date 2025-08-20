import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Settings, LogOut, User, Lock, ShieldQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { MessageBubble } from "@/components/message-bubble";
import type { Message, User as UserType } from "@shared/schema";

interface ChatProps {
  user: UserType;
  messages: Message[];
  recipientId: string;
  recipientUsername: string;
  onSendMessage: (content: string, recipientId: string) => void;
  onBack: () => void;
  onLogout: () => void;
  isGodMode?: boolean;
  godModeTarget?: string;
  onExitGodMode?: () => void;
  onEditMessage?: (messageId: string, content: string) => void;
}

export default function Chat({ 
  user, 
  messages,
  recipientId,
  recipientUsername,
  onSendMessage, 
  onBack,
  onLogout,
  isGodMode = false,
  godModeTarget,
  onExitGodMode,
  onEditMessage
}: ChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    onSendMessage(newMessage, recipientId);
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

  const displayName = isGodMode ? godModeTarget : recipientUsername;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* God Mode Indicator */}
      {isGodMode && (
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-center py-2 text-sm font-semibold">
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

      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8 bg-primary">
            <AvatarFallback>
              {recipientUsername.split('.').map(n => n[0].toUpperCase()).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm text-card-foreground">
              {recipientUsername.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')}
            </h2>
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
            <span>End-to-end encrypted</span>
            <span>•</span>
            <span>IP: 192.168.xxx.xxx (Masked)</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <ShieldQuestion className="w-3 h-3 inline mr-1" />
            <span>Private conversation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
