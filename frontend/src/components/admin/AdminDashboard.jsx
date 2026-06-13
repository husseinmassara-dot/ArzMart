import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { 
  Package, Folder, ShoppingBag, Users, BarChart3, Settings, Tag, ShieldAlert,
  DollarSign, TrendingUp, AlertTriangle, ArrowRight, MessageSquare, Send, Store
} from 'lucide-react';

// Sub-components
import AdminProducts from './AdminProducts';
import AdminCategories from './AdminCategories';
import AdminOrders from './AdminOrders';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminSettings from './AdminSettings';
import AdminCoupons from './AdminCoupons';
import AdminMerchants from './AdminMerchants';

export default function AdminDashboard({ setCurrentView }) {
  const { lang, formatPrice, t, apiBase } = useApp();
  const { token, hasPermission } = useAuth();
  const { chatUsers, activeChatUserId, setActiveChatUserId, messages, sendMessage } = useChat();

  const [activeTab, setActiveTab] = useState('products');
  const [stats, setStats] = useState({
    total_orders: 0,
    delivered_revenue_usd: 0,
    delivered_revenue_lbp: 0,
    pending_orders: 0,
    out_of_stock: 0
  });

  const [chatInput, setChatInput] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.summary);
      }
    } catch (err) {
      console.error('Fetch admin stats error:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeTab]);

  const handleSendAdminMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatUserId) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  const menuItems = [
    { id: 'products', name: t('products'), icon: Package, perm: 'products' },
    { id: 'categories', name: t('categories'), icon: Folder, perm: 'categories' },
    { id: 'orders', name: t('orders'), icon: ShoppingBag, perm: 'orders' },
    { id: 'chats', name: lang === 'ar' ? 'محادثات العملاء' : 'Customer Chats', icon: MessageSquare, perm: 'orders' },
    { id: 'merchants', name: lang === 'ar' ? 'إدارة الموردين والتجار' : 'Merchants & Suppliers', icon: Store, perm: 'merchants' },
    { id: 'users', name: t('users'), icon: Users, perm: 'users' },
    { id: 'coupons', name: t('coupons'), icon: Tag, perm: 'coupons' },
    { id: 'reports', name: t('reports'), icon: BarChart3, perm: 'reports' },
    { id: 'settings', name: t('settings'), icon: Settings, perm: 'settings' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Sidebar Panel */}
      <aside className="no-print" style={{
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        borderInlineEnd: '1px solid var(--border-color)',
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ padding: '0 10px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {t('admin_title')}
          </h3>
          <button 
            onClick={() => setCurrentView('store')}
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--accent-blue)',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}
          >
            <span>{t('go_to_store')}</span>
            <ArrowRight size={14} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>

        {/* Menu Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menuItems.map((item) => {
            if (!hasPermission(item.perm)) return null;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setActiveChatUserId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--accent-blue)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'start',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: '1', padding: '24px', backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
        
        {/* Stats Summary Cards */}
        {activeTab !== 'settings' && activeTab !== 'reports' && (
          <section className="no-print dashboard-grid animate-fade">
            
            {/* Earnings USD */}
            <div className="dashboard-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>المبيعات (USD)</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>
                    {formatPrice(stats.delivered_revenue_usd || 0)}
                  </h3>
                </div>
                <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '50%' }}>
                  <TrendingUp size={22} color="#10b981" />
                </div>
              </div>
            </div>

            {/* Pending Orders */}
            <div className="dashboard-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>الطلبات الجديدة</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>
                    {stats.pending_orders || 0}
                  </h3>
                </div>
                <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '10px', borderRadius: '50%' }}>
                  <ShoppingBag size={22} color="var(--accent-blue)" />
                </div>
              </div>
            </div>

            {/* Stock Warning */}
            <div className="dashboard-card" style={{ borderLeft: '4px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>السلع المنتهية</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>
                    {stats.out_of_stock || 0}
                  </h3>
                </div>
                <div style={{ backgroundColor: 'rgba(217,119,6,0.1)', padding: '10px', borderRadius: '50%' }}>
                  <AlertTriangle size={22} color="#d97706" />
                </div>
              </div>
            </div>

          </section>
        )}

        {/* Dynamic Panel Renderer */}
        <div style={{ minHeight: '400px' }}>
          {activeTab === 'products' && hasPermission('products') && <AdminProducts />}
          {activeTab === 'categories' && hasPermission('categories') && <AdminCategories />}
          {activeTab === 'orders' && hasPermission('orders') && <AdminOrders />}
          {activeTab === 'merchants' && hasPermission('merchants') && <AdminMerchants />}
          {activeTab === 'users' && hasPermission('users') && <AdminUsers />}
          {activeTab === 'coupons' && hasPermission('coupons') && <AdminCoupons />}
          {activeTab === 'reports' && hasPermission('reports') && <AdminReports />}
          {activeTab === 'settings' && hasPermission('settings') && <AdminSettings />}

          {/* Customer Chat Panel as a clean Tab */}
          {activeTab === 'chats' && (
            <div style={{ display: 'flex', gap: '20px', height: '620px', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', animation: 'fadeIn 0.3s ease-out' }}>
              {/* Users list for chat selection */}
              <div style={{ width: '280px', borderInlineEnd: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-tertiary)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '800', fontSize: '0.95rem' }}>
                  {lang === 'ar' ? 'محادثات العملاء' : 'Customer Chats'}
                </div>
                <div style={{ flex: '1', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chatUsers.length === 0 ? (
                    <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>
                      {lang === 'ar' ? 'لا يوجد دردشات نشطة حالياً.' : 'No active chats.'}
                    </div>
                  ) : (
                    chatUsers.map((u) => (
                      <div 
                        key={u.id}
                        onClick={() => setActiveChatUserId(u.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: activeChatUserId === u.id ? 'var(--bg-primary)' : 'transparent',
                          border: activeChatUserId === u.id ? '1px solid var(--accent-blue)' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.85rem' }}>{u.username}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                            {new Date(u.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-light)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textTransform: 'ellipsis'
                        }}>
                          {u.last_message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active chat window */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
                {!activeChatUserId ? (
                  <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                    {lang === 'ar' ? 'الرجاء اختيار مستخدم لبدء الدردشة معه' : 'Please select a user to start chatting'}
                  </div>
                ) : (
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {lang === 'ar' ? `الدردشة مع: ${chatUsers.find(cu => cu.id === activeChatUserId)?.username || 'مستخدم'}` : `Chat with: ${chatUsers.find(cu => cu.id === activeChatUserId)?.username || 'User'}`}
                      </span>
                    </div>

                    {/* Messages list */}
                    <div style={{ flex: '1', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {messages.map((msg) => {
                        const isMe = msg.sender === 'admin';
                        return (
                          <div key={msg.id || msg.created_at} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                            <div style={{
                              padding: '6px 12px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              backgroundColor: isMe ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                              color: isMe ? 'white' : 'var(--text-primary)',
                              border: isMe ? 'none' : '1px solid var(--border-color)',
                              borderBottomRightRadius: isMe ? '2px' : '12px',
                              borderBottomLeftRadius: isMe ? '12px' : '2px'
                            }}>
                              {msg.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Message send form */}
                    <form onSubmit={handleSendAdminMessage} style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={lang === 'ar' ? 'اكتب ردك هنا...' : 'Type your reply here...'}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        style={{ padding: '6px 14px', borderRadius: '18px', fontSize: '0.85rem', flex: '1', height: '34px' }}
                      />
                      <button
                        type="submit"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-blue)',
                          color: 'white',
                          border: 'none',
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
                )}
              </div>
            </div>
          )}
        </div>
      </main>


    </div>
  );
}
