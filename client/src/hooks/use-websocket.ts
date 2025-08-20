import { useEffect, useRef, useState } from "react";
import type { Message, User } from "@shared/schema";

type WebSocketMessage = 
  | { type: 'auth_success'; user: User }
  | { type: 'auth_error' }
  | { type: 'new_message'; message: Message }
  | { type: 'message_history'; messages: Message[] }
  | { type: 'conversations_list'; conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }> }
  | { type: 'message_edited'; message: Message }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'user_joined'; username: string }
  | { type: 'user_left'; username: string }
  | { type: 'god_mode_messages'; messages: Message[]; targetUser: User };

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'auth_success':
          setUser(message.user);
          break;
          
        case 'auth_error':
          setUser(null);
          break;
          
        case 'new_message':
          setMessages(prev => [...prev, message.message]);
          break;
          
        case 'message_history':
          setMessages(message.messages);
          break;
          
        case 'conversations_list':
          setConversations(message.conversations);
          break;
          
        case 'message_edited':
          setMessages(prev => prev.map(msg => 
            msg.id === message.message.id ? message.message : msg
          ));
          break;
          
        case 'message_deleted':
          setMessages(prev => prev.filter(msg => msg.id !== message.messageId));
          break;
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const authenticate = (username: string, password: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ 
        type: 'auth', 
        username, 
        password 
      }));
    }
  };

  const sendMessage = (content: string, recipientId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ 
        type: 'send_message', 
        content,
        recipientId 
      }));
    }
  };

  const loadConversation = async (userId1: string, userId2: string) => {
    try {
      // Join conversation to track active user
      await fetch(`/api/conversations/${userId1}/${userId2}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUserId: userId1 })
      });
      
      const response = await fetch(`/api/conversations/${userId1}/${userId2}`);
      const conversationMessages = await response.json();
      setMessages(conversationMessages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const leaveConversation = async (userId1: string, userId2: string) => {
    try {
      await fetch(`/api/conversations/${userId1}/${userId2}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUserId: userId1 })
      });
    } catch (error) {
      console.error('Failed to leave conversation:', error);
    }
  };

  const viewUserAsGod = (targetUsername: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ 
        type: 'god_mode_view', 
        targetUsername 
      }));
    }
  };

  return {
    isConnected,
    messages,
    conversations,
    user,
    authenticate,
    sendMessage,
    loadConversation,
    leaveConversation,
    viewUserAsGod,
  };
}
