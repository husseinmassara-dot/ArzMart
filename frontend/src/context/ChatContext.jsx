import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { apiBase, apiHost } = useApp();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeChatUserId, setActiveChatUserId] = useState(null); // Admin only: user currently selected for chat
  const [chatUsers, setChatUsers] = useState([]); // Admin only: users with active chat history
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
      }
      return;
    }

    const wsUrl = apiHost.replace(/^http/, 'ws');
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      // Register connection with backend
      socket.send(JSON.stringify({
        type: 'register',
        userId: user?.id,
        role: user?.role
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_message') {
          const { message } = data;

          // If current user is standard client and message belongs to them
          // Or if admin, and message belongs to activeChatUserId
          if (user?.role === 'user') {
            setMessages((prev) => [...prev, message]);
            if (!isChatOpen) {
              setUnreadCount((c) => c + 1);
            }
          } else if (user?.role === 'admin' || user?.role === 'employee') {
            // Re-fetch chat list to update sidebar preview
            fetchChatUsers();
            if (activeChatUserId === message.user_id) {
              setMessages((prev) => [...prev, message]);
            }
          }
        } else if (data.type === 'new_order') {
          // Play notification sound or show toast
          if (global.showGlobalNotification) {
            global.showGlobalNotification(data.order);
          }
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    socket.onclose = () => {
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (token) {
          // Reconnect logic
        }
      }, 5000);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token, user, activeChatUserId, isChatOpen]);

  // Fetch chat history for target user
  const fetchChatHistory = async (targetUserId) => {
    if (!token) return;
    try {
      const url = targetUserId 
        ? `${apiBase}/chat/history?user_id=${targetUserId}` 
        : `${apiBase}/chat/history`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    }
  };

  // Admin only: fetch list of chatting users
  const fetchChatUsers = async () => {
    if (!token || user?.role === 'user') return;
    try {
      const res = await fetch(`${apiBase}/chat/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatUsers(data);
      }
    } catch (err) {
      console.error('Fetch chat users error:', err);
    }
  };

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      if (user?.role === 'user') {
        fetchChatHistory();
      }
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (activeChatUserId) {
      fetchChatHistory(activeChatUserId);
    }
  }, [activeChatUserId]);

  useEffect(() => {
    if (token && user && user.role !== 'user') {
      fetchChatUsers();
    }
  }, [token, user]);

  const sendMessage = async (text) => {
    if (!token || !text.trim()) return;

    try {
      const body = { message: text };
      if (user.role !== 'user' && activeChatUserId) {
        body.user_id = activeChatUserId;
      }

      const res = await fetch(`${apiBase}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        if (user.role !== 'user') {
          fetchChatUsers(); // Refresh last message text in sidebar list
        }
      }
    } catch (err) {
      console.error('Send message REST error:', err);
    }
  };

  return (
    <ChatContext.Provider value={{
      messages,
      chatUsers,
      activeChatUserId,
      setActiveChatUserId,
      isChatOpen,
      setIsChatOpen,
      unreadCount,
      sendMessage,
      fetchChatUsers,
      fetchChatHistory
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
export default ChatContext;
