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

  // Funzione per ricaricare le conversazioni
  const refreshConversations = async () => {
    if (!user?.id) return;
    
    try {
      console.log('🔄 Refresh conversazioni per utente:', user.id);
      const response = await fetch(`/api/conversations/${user.id}`);
      const freshConversations = await response.json();
      console.log('📋 Conversazioni aggiornate:', freshConversations.length);
      setConversations(freshConversations);
    } catch (error) {
      console.error('❌ Errore refresh conversazioni:', error);
    }
  };

  // Auto-refresh continuo delle conversazioni - ogni 500ms per aggiornamenti istantanei
  useEffect(() => {
    if (!user?.id) return;
    
    // Refresh immediato quando l'utente si logga
    refreshConversations();
    
    // Refresh molto frequente per vedere subito nuovi messaggi e contatti
    const interval = setInterval(() => {
      refreshConversations();
    }, 500); // Aggiornamento ogni mezzo secondo
    
    return () => clearInterval(interval);
  }, [user?.id]);
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
      console.log('📨 WebSocket messaggio ricevuto:', message.type);
      
      switch (message.type) {
        case 'auth_success':
          setUser(message.user);
          break;
          
        case 'auth_error':
          setUser(null);
          break;
          
        case 'new_message':
          console.log('💬 Nuovo messaggio ricevuto:', message.message);
          setMessages(prev => {
            // Evita duplicati controllando l'ID del messaggio
            const exists = prev.find(m => m.id === message.message.id);
            if (!exists) {
              return [...prev, message.message];
            }
            return prev;
          });
          // Refresh immediato delle conversazioni quando arriva un nuovo messaggio
          setTimeout(() => refreshConversations(), 50);
          break;
          
        case 'message_history':
          console.log('📥 Cronologia messaggi ricevuta:', message.messages.length);
          setMessages(message.messages);
          break;
          
        case 'conversations_list':
        case 'conversations_updated':
          console.log('📋 Lista conversazioni aggiornata:', message.conversations.length);
          setConversations(message.conversations);
          // Forza refresh immediato per garantire sincronizzazione
          setTimeout(() => refreshConversations(), 100);
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
      console.log('🚀 WEBSOCKET - Invio messaggio:', { 
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        recipientId,
        connectionState: 'CONNESSO'
      });
      
      ws.current.send(JSON.stringify({ 
        type: 'send_message', 
        content,
        recipientId 
      }));
      
      console.log('✅ Messaggio inviato al server WebSocket');
      
      // Aggiungi il messaggio immediatamente alla lista locale per visibilità istantanea
      const immediateMessage = {
        id: `temp-${Date.now()}`,
        content,
        userId: user?.id || '',
        recipientId,
        username: user?.username || '',
        timestamp: new Date(),
        isEncrypted: true,
        editedBy: null,
        editedAt: null,
        encryptedContent: null,
        sessionId: null,
        messageKey: null
      };
      
      setMessages(prev => [...prev, immediateMessage]);
      console.log('📱 Messaggio aggiunto localmente per visibilità immediata');
    } else {
      console.error('❌ ERRORE - WebSocket non connesso, stato:', ws.current?.readyState);
      
      // Anche se il WebSocket non è connesso, mostra il messaggio localmente
      const localMessage = {
        id: `local-${Date.now()}`,
        content,
        userId: user?.id || '',
        recipientId,
        username: user?.username || '',
        timestamp: new Date(),
        isEncrypted: true,
        editedBy: null,
        editedAt: null,
        encryptedContent: null,
        sessionId: null,
        messageKey: null
      };
      
      setMessages(prev => [...prev, localMessage]);
      console.log('📱 Messaggio salvato localmente (WebSocket disconnesso)');
    }
  };

  const loadConversation = async (userId1: string, userId2: string) => {
    try {
      console.log('🔗 Caricamento conversazione:', userId1, '<->', userId2);
      
      // Join conversation to track active user
      await fetch(`/api/conversations/${userId1}/${userId2}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUserId: userId1 })
      });
      
      // Carica messaggi esistenti
      const response = await fetch(`/api/conversations/${userId1}/${userId2}`);
      const conversationMessages = await response.json();
      console.log('📥 Messaggi caricati:', conversationMessages.length);
      setMessages(conversationMessages);
      
      // Invia WebSocket join per ricevere messaggi in tempo reale
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.log('📡 Invio join_conversation WebSocket con dati:', {
          type: 'join_conversation',
          otherUserId: userId2,
          userId: userId1
        });
        ws.current.send(JSON.stringify({ 
          type: 'join_conversation', 
          otherUserId: userId2,
          userId: userId1
        }));
      } else {
        console.error('❌ WebSocket non connesso per join_conversation');
      }
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
    refreshConversations,
    viewUserAsGod,
    getUserPresenceStatus,
    sendAudio,
    setAudioReceivedCallback,
  };
}
