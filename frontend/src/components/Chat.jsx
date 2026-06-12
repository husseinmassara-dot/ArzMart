import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { X, Send, MessageSquare } from 'lucide-react';

export default function Chat() {
  const { lang, t } = useApp();
  const { user } = useAuth();
  const { 
    messages, 
    isChatOpen, 
    setIsChatOpen, 
    sendMessage 
  } = useChat();

  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  // Scroll to bottom of message list on updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  if (!isChatOpen) return null;

  return (
    <div className="no-print" style={{
      position: 'fixed',
      bottom: '20px',
      right: lang === 'ar' ? 'auto' : '20px',
      left: lang === 'ar' ? '20px' : 'auto',
      zIndex: 600,
      width: '100%',
      maxWidth: '360px',
      height: '480px',
      backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'var(--accent-blue)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} />
          <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{t('chat_admin')}</span>
        </div>
        <button
          onClick={() => setIsChatOpen(false)}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: 'white',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: '1',
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        {messages.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
            fontSize: '0.85rem',
            textAlign: 'center',
            padding: '20px'
          }}>
            {lang === 'ar' 
              ? 'مرحباً! تواصل معنا هنا لأي استفسار بخصوص طلبيتك.' 
              : 'Hello! Chat with us here for any questions about your order.'}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === 'user';
            
            return (
              <div 
                key={msg.id || msg.created_at} 
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                {/* Bubble */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  lineHeight: '1.4',
                  backgroundColor: isMe ? 'var(--accent-blue)' : 'var(--bg-primary)',
                  color: isMe ? 'white' : 'var(--text-primary)',
                  border: isMe ? 'none' : '1px solid var(--border-color)',
                  borderBottomRightRadius: isMe ? '2px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '2px'
                }}>
                  {msg.message}
                </div>
                
                {/* Time */}
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-light)',
                  textAlign: isMe ? 'right' : 'left'
                }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form 
        onSubmit={handleSend}
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)'
        }}
      >
        <input
          type="text"
          className="input-field"
          placeholder={t('chat_placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            flex: '1',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '0.85rem',
            height: '34px'
          }}
        />
        <button
          type="submit"
          style={{
            border: 'none',
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
