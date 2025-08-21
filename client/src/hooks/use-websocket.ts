import { useEffect, useRef, useState } from "react";
import type { Message, User } from "@shared/schema";

type WebSocketMessage = 
  | { type: 'auth_success'; user: User }
  | { type: 'auth_error' }
  | { type: 'new_message'; message: Message }
  | { type: 'message_history'; messages: Message[] }
  | { type: 'conversations_list'; conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }> }
  | { type: 'conversations_updated'; conversations: Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }> }
  | { type: 'message_edited'; message: Message }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'user_joined'; username: string }
  | { type: 'user_left'; username: string }
  | { type: 'god_mode_messages'; messages: Message[]; targetUser: User }
  | { type: 'presence_update'; userId: string; status: 'online' | 'offline' }
  | { type: 'receive_audio'; audioData: string; senderId: string; senderUsername: string };

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Array<{ userId: string; username: string; lastMessage?: Message; unreadCount: number }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userPresence, setUserPresence] = useState<Map<string, 'online' | 'offline' | 'in-your-chat'>>(new Map());
  const audioReceivedCallback = useRef<((audioData: string, senderId: string, senderUsername: string) => void) | null>(null);

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
          
        case 'conversations_updated':
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
          
        case 'presence_update':
          setUserPresence(prev => {
            const newMap = new Map(prev);
            newMap.set(message.userId, message.status);
            return newMap;
          });
          break;
          
        case 'receive_audio':
          // Trigger audio received callback if set
          if (audioReceivedCallback.current) {
            audioReceivedCallback.current(message.audioData, message.senderId, message.senderUsername);
          }
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
      // Send WebSocket message to leave conversation
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ 
          type: 'leave_conversation', 
          otherUserId: userId2 
        }));
      }
      
      await fetch(`/api/conversations/${userId1}/${userId2}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUserId: userId1 })
      });
    } catch (error) {
      console.error('Failed to leave conversation:', error);
    }
  };

  const joinConversation = (otherUserId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ 
        type: 'join_conversation', 
        otherUserId 
      }));
    }
  };

  const getUserPresenceStatus = (userId: string): 'online' | 'offline' | 'in-your-chat' => {
    return userPresence.get(userId) || 'offline';
  };

  const sendAudio = (audioBlob: Blob, recipientId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        ws.current!.send(JSON.stringify({
          type: 'send_audio',
          audioData: base64,
          recipientId
        }));
      };
      reader.readAsDataURL(audioBlob);
    }
  };

  const setAudioReceivedCallback = (callback: (audioData: string, senderId: string, senderUsername: string) => void) => {
    audioReceivedCallback.current = callback;
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
    userPresence,
    authenticate,
    sendMessage,
    loadConversation,
    leaveConversation,
    joinConversation,
    viewUserAsGod,
    getUserPresenceStatus,
    sendAudio,
    setAudioReceivedCallback,
  };
}
