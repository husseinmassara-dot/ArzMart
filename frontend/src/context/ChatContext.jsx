import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (frequency, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playNote(659.25, now, 0.25);
    playNote(880.00, now + 0.08, 0.35);
  } catch (e) {
    console.error('AudioContext error:', e);
  }
};

const showDesktopNotification = (title, body) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/logo.png' });
  }
};

const playNewOrderSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (frequency, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playNote(523.25, now, 0.15);
    playNote(659.25, now + 0.10, 0.15);
    playNote(783.99, now + 0.20, 0.15);
    playNote(1046.50, now + 0.30, 0.40);
  } catch (e) {
    console.error('AudioContext error:', e);
  }
};

const showOrderToast = (order, lang) => {
  playNewOrderSound();

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '99999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.backgroundColor = 'var(--bg-secondary, #1e293b)';
  toast.style.color = 'var(--text-primary, #ffffff)';
  toast.style.padding = '16px 20px';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.05)';
  toast.style.borderLeft = '4px solid var(--accent-red-gold, #ef4444)';
  toast.style.width = '320px';
  toast.style.transform = 'translateX(120%)';
  toast.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
  toast.style.display = 'flex';
  toast.style.flexDirection = 'column';
  toast.style.gap = '6px';
  toast.style.direction = lang === 'ar' ? 'rtl' : 'ltr';

  const title = document.createElement('div');
  title.style.fontWeight = '800';
  title.style.fontSize = '0.95rem';
  title.style.color = 'var(--accent-red-gold, #ef4444)';
  title.innerText = lang === 'ar' ? '📦 طلبيّة جديدة واردة!' : '📦 New Order Received!';

  const msg = document.createElement('div');
  msg.style.fontSize = '0.85rem';
  msg.style.fontWeight = '600';
  msg.innerText = lang === 'ar'
    ? `طلب #${order.id} بقيمة $${order.total_usd} من العميل ${order.user_name || 'غير معروف'}`
    : `Order #${order.id} of $${order.total_usd} from customer ${order.user_name || 'unknown'}`;

  const btn = document.createElement('button');
  btn.style.marginTop = '6px';
  btn.style.backgroundColor = 'var(--accent-blue, #3b82f6)';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.padding = '6px 12px';
  btn.style.borderRadius = '6px';
  btn.style.fontSize = '0.75rem';
  btn.style.fontWeight = '700';
  btn.style.cursor = 'pointer';
  btn.innerText = lang === 'ar' ? 'عرض الطلبيات' : 'View Orders';
  btn.onclick = () => {
    window.location.href = '/?view=admin&tab=orders';
    toast.remove();
  };

  toast.appendChild(title);
  toast.appendChild(msg);
  toast.appendChild(btn);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);

  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 6000);
};

export const ChatProvider = ({ children }) => {
  const { apiBase, apiHost, lang } = useApp();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeChatUserId, setActiveChatUserId] = useState(null); // Admin only: user currently selected for chat
  const [chatUsers, setChatUsers] = useState([]); // Admin only: users with active chat history
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);

  // Request notification permissions for admin users
  useEffect(() => {
    if (user && user.role !== 'user' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, [user]);

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

          if (user?.role === 'user') {
            setMessages((prev) => [...prev, message]);
            if (!isChatOpen) {
              setUnreadCount((c) => c + 1);
              playNotificationSound();
              showDesktopNotification(lang === 'ar' ? 'أرز مارت - رسالة جديدة' : 'Arz-Mart - New Message', message.message);
            }
          } else if (user?.role === 'admin' || user?.role === 'employee') {
            fetchChatUsers();
            
            // Play notification if standard customer message arrives and admin is not actively chatting
            if (message.sender !== 'admin') {
              const isCurrentlyChatting = activeChatUserId === message.user_id && document.visibilityState === 'visible';
              if (!isCurrentlyChatting) {
                playNotificationSound();
                showDesktopNotification(
                  lang === 'ar' ? `رسالة جديدة من ${message.username || 'عميل'}` : `New message from ${message.username || 'Customer'}`,
                  message.message
                );
              }
            }

            if (activeChatUserId === message.user_id) {
              setMessages((prev) => [...prev, message]);
            }
          }
        } else if (data.type === 'new_order') {
          // Play notification sound and show toast/desktop alerts
          if (user && user.role !== 'user') {
            showOrderToast(data.order, lang);
            showDesktopNotification(
              lang === 'ar' ? '📦 طلبيّة جديدة واردة!' : '📦 New Order Received!',
              lang === 'ar'
                ? `طلب رقم #${data.order.id} بقيمة $${data.order.total_usd} من العميل ${data.order.user_name || 'غير معروف'}`
                : `Order #${data.order.id} of $${data.order.total_usd} from customer ${data.order.user_name || 'unknown'}`
            );
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
