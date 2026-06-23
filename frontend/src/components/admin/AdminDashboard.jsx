import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { 
  Package, Folder, ShoppingBag, Users, BarChart3, Settings, Tag, ShieldAlert,
  DollarSign, TrendingUp, AlertTriangle, ArrowRight, MessageSquare, Send, Store,
  ExternalLink, Database, Upload, X, Truck, Menu
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
import AdminDelivery from './AdminDelivery';

export default function AdminDashboard({ setCurrentView }) {
  const { lang, formatPrice, t, apiBase } = useApp();
  const { token, hasPermission, user: currentUser } = useAuth();
  const { chatUsers, activeChatUserId, setActiveChatUserId, messages, sendMessage } = useChat();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [chatInput, setChatInput] = useState('');
  const [showDbModal, setShowDbModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${apiBase}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.summary);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Fetch admin stats error:', err);
    } finally {
      setStatsLoading(false);
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

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreFile) return;

    const confirmMsg = lang === 'ar' 
      ? '⚠️ تنبيه حرج: سيقوم هذا الإجراء بمسح كافة البيانات والمنتجات والطلبيات الحالية واستبدالها بالنسخة الاحتياطية. هل أنت متأكد من رغبتك بالاستمرار؟'
      : '⚠️ CRITICAL WARNING: This action will completely wipe all current data, products, and orders, replacing them with the backup data. Are you sure you want to proceed?';
    
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreError('');
    setRestoreSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          const res = await fetch(`${apiBase}/admin/restore`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(jsonData)
          });

          if (res.ok) {
            const data = await res.json();
            setRestoreSuccess(lang === 'ar' ? data.message_ar : data.message_en);
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            const errData = await res.json().catch(() => ({}));
            setRestoreError(errData.error_ar || errData.error_en || 'Restore failed');
          }
        } catch (parseErr) {
          setRestoreError(lang === 'ar' ? 'ملف النسخة الاحتياطية غير صالح أو ليس بتنسيق JSON صحيح' : 'The backup file is invalid or not in correct JSON format');
        } finally {
          setIsRestoring(false);
        }
      };
      reader.onerror = () => {
        setRestoreError(lang === 'ar' ? 'خطأ في قراءة ملف النسخة الاحتياطية' : 'Error reading the backup file');
        setIsRestoring(false);
      };
      reader.readAsText(restoreFile);
    } catch (err) {
      console.error('Restore error:', err);
      setRestoreError(lang === 'ar' ? 'حدث خطأ غير متوقع أثناء الاستعادة' : 'An unexpected error occurred during restore');
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 30 seconds so counters stay live
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

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
    { id: 'delivery', name: lang === 'ar' ? 'توصيل الطلبيات' : 'Order Deliveries', icon: Truck, perm: 'delivery' },
    { id: 'chats', name: lang === 'ar' ? 'محادثات العملاء' : 'Customer Chats', icon: MessageSquare, perm: 'orders' },
    { id: 'merchants', name: lang === 'ar' ? 'إدارة الموردين والتجار' : 'Merchants & Suppliers', icon: Store, perm: 'merchants' },
    { id: 'users', name: lang === 'ar' ? 'الموظفين والصلاحيات' : 'Employees & Permissions', icon: Users, perm: 'users' },
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
    
    if (isMobile) {
      setIsSidebarOpen(false);
    }
    
    // Update browser URL
    window.history.pushState(null, '', `/?view=admin&tab=${tabId}`);
  };

  const sidebarStyle = isMobile ? {
    width: '240px',
    backgroundColor: 'var(--bg-secondary)',
    borderInlineEnd: '1px solid var(--border-color)',
    padding: '20px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'fixed',
    top: '70px',
    bottom: '0',
    left: lang === 'ar' ? 'auto' : '0',
    right: lang === 'ar' ? '0' : 'auto',
    height: 'calc(100vh - 70px)',
    overflowY: 'auto',
    zIndex: 1100,
    transform: isSidebarOpen ? 'translateX(0)' : (lang === 'ar' ? 'translateX(100%)' : 'translateX(-100%)'),
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isSidebarOpen ? '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)' : 'none'
  } : {
    width: '240px',
    backgroundColor: 'var(--bg-secondary)',
    borderInlineEnd: '1px solid var(--border-color)',
    padding: '20px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'sticky',
    top: '70px',
    height: 'calc(100vh - 70px)',
    overflowY: 'auto'
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Sidebar Panel */}
      <aside className="no-print" style={sidebarStyle}>
        <div style={{ padding: '0 10px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {t('admin_title')}
          </h3>
          <a 
            href="/"
            onClick={(e) => {
              if (e.button === 1 || e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              if (isMobile) {
                setIsSidebarOpen(false);
              }
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

        {(currentUser?.role === 'admin' || hasPermission('settings')) && (
          <>
            <div style={{ flex: 1 }}></div>
            <div style={{ padding: '0 10px', marginTop: 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  if (isMobile) setIsSidebarOpen(false);
                  setShowDbModal(true);
                }}
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
                <span>{lang === 'ar' ? 'نسخ احتياطي واستعادة' : 'Backup & Restore'}</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Backdrop for Mobile Sidebar Drawer */}
      {isMobile && isSidebarOpen && (
        <div 
          className="no-print"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: '70px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 1050,
            animation: 'fadeIn 0.2s ease-out'
          }}
        />
      )}

      {/* Floating Sidebar Trigger Button for Mobile */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'fixed',
            top: '120px',
            [lang === 'ar' ? 'right' : 'left']: isSidebarOpen ? '240px' : '0',
            transform: 'translateY(-50%)',
            zIndex: 1200,
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            outline: 'none',
            width: '42px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            cursor: 'pointer',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
            borderTopRightRadius: lang === 'ar' ? '0' : '8px',
            borderBottomRightRadius: lang === 'ar' ? '0' : '8px',
            borderTopLeftRadius: lang === 'ar' ? '8px' : '0',
            borderBottomLeftRadius: lang === 'ar' ? '8px' : '0',
            padding: 0
          }}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Main Content Area */}
      <main style={{ flex: '1', padding: '24px', backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
        
        {/* Stats Summary Cards */}
        {activeTab !== 'settings' && activeTab !== 'reports' && (
          <section className="no-print dashboard-grid animate-fade">
            {/* Live refresh indicator */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-12px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: statsLoading ? '#f59e0b' : '#10b981',
                  display: 'inline-block',
                  animation: statsLoading ? 'pulse 1s infinite' : 'none'
                }} />
                {statsLoading
                  ? (lang === 'ar' ? 'جاري التحديث...' : 'Refreshing...')
                  : lastUpdated
                    ? (lang === 'ar'
                      ? `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar')}`
                      : `Last updated: ${lastUpdated.toLocaleTimeString()}`)
                    : ''}
              </span>
              <button
                onClick={fetchStats}
                disabled={statsLoading}
                style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0' }}
              >
                {lang === 'ar' ? '↻ تحديث' : '↻ Refresh'}
              </button>
            </div>
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

            {/* Total Employees Card */}
            {(currentUser?.role === 'admin' || hasPermission('users')) && (
              <div 
                className="dashboard-card" 
                style={{ 
                  borderLeft: '4px solid #3b82f6',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => {
                  if (openInNewTab) {
                    window.open('/?view=admin&tab=users', '_blank');
                  } else {
                    setActiveTab('users');
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>
                      {lang === 'ar' ? 'عدد الموظفين' : 'Total Employees'}
                    </span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#3b82f6' }}>
                      {stats.total_employees || 0}
                    </h3>
                  </div>
                  <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '10px', borderRadius: '50%' }}>
                    <Users size={22} color="#3b82f6" />
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
          {activeTab === 'delivery' && hasPermission('delivery') && <AdminDelivery />}
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


      {/* Backup & Restore Modal */}
      {showDbModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="dashboard-card animate-fade" style={{
            maxWidth: '650px',
            width: '100%',
            padding: '24px',
            position: 'relative',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xl)',
            borderRadius: '16px'
          }}>
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDbModal(false);
                setRestoreFile(null);
                setRestoreError('');
                setRestoreSuccess('');
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: lang === 'ar' ? 'auto' : '16px',
                left: lang === 'ar' ? '16px' : 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--text-light)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Database size={22} color="var(--accent-red-gold)" style={{ transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
              <span>{lang === 'ar' ? 'إدارة النسخ الاحتياطي والاستعادة للموقع' : 'Site Backup & Restore Management'}</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '10px' }}>
              
              {/* Left Column: Backup */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={18} color="var(--accent-blue)" />
                    <span>{lang === 'ar' ? 'نسخ احتياطي (Backup)' : 'Create Backup'}</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.4' }}>
                    {lang === 'ar'
                      ? 'قم بتحميل ملف JSON يحتوي على كامل قاعدة بيانات الموقع تشمل المنتجات، التصنيفات، الصور، المستخدمين، الطلبيات والإعدادات لحفظها بأمان.'
                      : 'Download a JSON file containing the complete database: products, categories, base64 images, users, orders, and configuration.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: 'var(--accent-blue)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '700',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}
                >
                  {lang === 'ar' ? 'تحميل النسخة الاحتياطية' : 'Download JSON Backup'}
                </button>
              </div>

              {/* Right Column: Restore */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-red-gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={18} color="var(--accent-red-gold)" />
                    <span>{lang === 'ar' ? 'استعادة قاعدة البيانات (Restore)' : 'Restore Backup'}</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.4' }}>
                    {lang === 'ar'
                      ? 'اختر ملف نسخة احتياطية (JSON) تم تحميله سابقاً لاستعادة كامل محتوى وبيانات المتجر لآخر نقطة حفظ.'
                      : 'Select a previously downloaded backup JSON file to restore the entire store database back to that point.'}
                  </p>
                </div>

                <form onSubmit={handleRestore} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      setRestoreFile(e.target.files[0]);
                      setRestoreError('');
                      setRestoreSuccess('');
                    }}
                    style={{
                      fontSize: '0.75rem',
                      width: '100%',
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!restoreFile || isRestoring}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: 'var(--accent-red-gold, #d97706)',
                      color: 'white',
                      border: 'none',
                      fontWeight: '700',
                      cursor: restoreFile && !isRestoring ? 'pointer' : 'not-allowed',
                      opacity: restoreFile && !isRestoring ? 1 : 0.6,
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}
                  >
                    {isRestoring 
                      ? (lang === 'ar' ? 'جاري الاستعادة...' : 'Restoring...') 
                      : (lang === 'ar' ? 'بدء استعادة البيانات' : 'Restore Backup Now')}
                  </button>
                </form>
              </div>

            </div>

            {/* Error & Success Messages */}
            {restoreError && (
              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: '8px'
              }}>
                ⚠️ {restoreError}
              </div>
            )}

            {restoreSuccess && (
              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: '8px'
              }}>
                ✅ {restoreSuccess}
              </div>
            )}

            {/* General Warning */}
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              backgroundColor: 'rgba(217, 119, 6, 0.05)',
              border: '1px solid rgba(217, 119, 6, 0.2)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-light)',
              lineHeight: '1.4'
            }}>
              <strong>{lang === 'ar' ? '⚠️ تحذير أمني هام:' : '⚠️ Important Security Warning:'}</strong>{' '}
              {lang === 'ar'
                ? 'استعادة نسخة احتياطية ستقوم بحذف جميع البيانات والمنتجات والحسابات والطلبيات الحالية. لا تقم بهذا الإجراء إلا إذا كنت متأكداً تماماً.'
                : 'Restoring a backup will completely delete all current data, products, accounts, and orders. Do not perform this action unless you are absolutely sure.'}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
