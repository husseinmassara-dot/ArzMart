import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { 
  Package, Folder, ShoppingBag, Users, BarChart3, Settings, Tag, ShieldAlert,
  DollarSign, TrendingUp, AlertTriangle, ArrowRight, MessageSquare, Send, Store,
  ExternalLink, Database
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
  const { token, hasPermission, user: currentUser } = useAuth();
  const { chatUsers, activeChatUserId, setActiveChatUserId, messages, sendMessage } = useChat();

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'products';
  });
  const [openInNewTab, setOpenInNewTab] = useState(() => {
    const saved = localStorage.getItem('admin_open_new_tab');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [filterProductsOutOfStock, setFilterProductsOutOfStock] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('filter') === 'outofstock';
  });
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

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch(`${apiBase}/admin/backup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error_ar || errData.error_en || 'Backup failed');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `arz_mart_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download backup error:', err);
      alert(lang === 'ar' ? `فشل تحميل النسخة الاحتياطية: ${err.message}` : `Failed to download backup: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'products';
      setActiveTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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

  const handleTabClick = (e, tabId) => {
    // Let browser handle middle click, ctrl+click, command+click
    if (e.button === 1 || e.metaKey || e.ctrlKey) {
      return;
    }
    if (openInNewTab) {
      // Allow browser to open the link in a new tab/window
      return;
    }
    e.preventDefault();
    setActiveTab(tabId);
    setActiveChatUserId(null);
    setFilterProductsOutOfStock(false);
    
    // Update browser URL
    window.history.pushState(null, '', `/?view=admin&tab=${tabId}`);
  };

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
          <a 
            href="/"
            onClick={(e) => {
              if (e.button === 1 || e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              setCurrentView('store');
            }}
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
              fontSize: '0.85rem',
              textDecoration: 'none'
            }}
          >
            <span>{t('go_to_store')}</span>
            <ArrowRight size={14} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
          </a>

          {/* Page Opening Behavior Switch */}
          <div style={{
            marginTop: '16px',
            padding: '10px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
              {lang === 'ar' ? 'طريقة فتح الصفحات:' : 'Open Pages In:'}
            </span>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setOpenInNewTab(true);
                  localStorage.setItem('admin_open_new_tab', 'true');
                }}
                style={{
                  flex: 1,
                  padding: '5px 2px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: openInNewTab ? 'var(--accent-blue)' : 'transparent',
                  color: openInNewTab ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {lang === 'ar' ? 'تبويب جديد' : 'New Tab'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenInNewTab(false);
                  localStorage.setItem('admin_open_new_tab', 'false');
                }}
                style={{
                  flex: 1,
                  padding: '5px 2px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: !openInNewTab ? 'var(--accent-blue)' : 'transparent',
                  color: !openInNewTab ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {lang === 'ar' ? 'نفس الصفحة' : 'Same Page'}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menuItems.map((item) => {
            if (!hasPermission(item.perm)) return null;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <a
                key={item.id}
                href={`/?view=admin&tab=${item.id}`}
                onClick={(e) => handleTabClick(e, item.id)}
                target={openInNewTab ? "_blank" : undefined}
                rel={openInNewTab ? "noopener noreferrer" : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'var(--accent-blue)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} />
                  <span>{item.name}</span>
                </div>
                
                {/* External link indicator */}
                {!openInNewTab && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <a
                      href={`/?view=admin&tab=${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-light)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                        borderRadius: '4px',
                        transition: 'color 0.25s, background-color 0.25s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = isActive ? 'white' : 'var(--accent-blue)';
                        e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.1)' : 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-light)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {currentUser?.role === 'admin' && (
          <>
            <div style={{ flex: 1 }}></div>
            <div style={{ padding: '0 10px', marginTop: 'auto' }}>
              <button
                type="button"
                onClick={handleDownloadBackup}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-red-gold, #d97706)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  transition: 'transform 0.15s ease, opacity 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <Database size={16} />
                <span>{lang === 'ar' ? 'نسخ احتياطي للموقع' : 'Download Backup'}</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: '1', padding: '24px', backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
        
        {/* Stats Summary Cards */}
        {activeTab !== 'settings' && activeTab !== 'reports' && (
          <section className="no-print dashboard-grid animate-fade">
            
            {/* Earnings USD */}
            <div 
              className="dashboard-card" 
              style={{ 
                borderLeft: '4px solid #10b981',
                cursor: hasPermission('reports') ? 'pointer' : 'default',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onClick={() => {
                if (hasPermission('reports')) {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=reports', '_blank');
                  } else {
                    setActiveTab('reports');
                  }
                }
              }}
              onMouseEnter={(e) => {
                if (hasPermission('reports')) {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
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
            <div 
              className="dashboard-card" 
              style={{ 
                borderLeft: '4px solid var(--accent-blue)',
                cursor: hasPermission('orders') ? 'pointer' : 'default',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onClick={() => {
                if (hasPermission('orders')) {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=orders', '_blank');
                  } else {
                    setActiveTab('orders');
                  }
                }
              }}
              onMouseEnter={(e) => {
                if (hasPermission('orders')) {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
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
            <div 
              className="dashboard-card" 
              style={{ 
                borderLeft: '4px solid #d97706',
                cursor: hasPermission('products') ? 'pointer' : 'default',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onClick={() => {
                if (hasPermission('products')) {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=products&filter=outofstock', '_blank');
                  } else {
                    setFilterProductsOutOfStock(true);
                    setActiveTab('products');
                  }
                }
              }}
              onMouseEnter={(e) => {
                if (hasPermission('products')) {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
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

            {/* Unique Visitors */}
            {hasPermission('reports') && (
              <div 
                className="dashboard-card" 
                style={{ 
                  borderLeft: '4px solid #8b5cf6',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=reports', '_blank');
                  } else {
                    setActiveTab('reports');
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>الزوار الفريدون (Unique Visitors)</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#8b5cf6' }}>
                      {stats.unique_visitors || 0}
                    </h3>
                  </div>
                  <div style={{ backgroundColor: 'rgba(139,92,246,0.1)', padding: '10px', borderRadius: '50%' }}>
                    <Users size={22} color="#8b5cf6" />
                  </div>
                </div>
              </div>
            )}

            {/* Page Views */}
            {hasPermission('reports') && (
              <div 
                className="dashboard-card" 
                style={{ 
                  borderLeft: '4px solid var(--accent-red-gold)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=reports', '_blank');
                  } else {
                    setActiveTab('reports');
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>مشاهدات الصفحات (Page Views)</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: 'var(--accent-red-gold)' }}>
                      {stats.total_views || 0}
                    </h3>
                  </div>
                  <div style={{ backgroundColor: 'rgba(217,119,6,0.1)', padding: '10px', borderRadius: '50%' }}>
                    <BarChart3 size={22} color="var(--accent-red-gold)" />
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

        {/* Dynamic Panel Renderer */}
        <div style={{ minHeight: '400px' }}>
          {activeTab === 'products' && hasPermission('products') && (
            <AdminProducts 
              filterOutOfStock={filterProductsOutOfStock} 
              onClearFilter={() => setFilterProductsOutOfStock(false)} 
            />
          )}
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
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '800', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{lang === 'ar' ? 'محادثات العملاء' : 'Customer Chats'}</span>
                  <button
                    type="button"
                    onClick={() => window.open('/?view=admin&tab=chats', '_blank')}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--accent-blue)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {lang === 'ar' ? 'فتح في صفحة منفصلة ↗️' : 'Open in separate tab ↗️'}
                  </button>
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
