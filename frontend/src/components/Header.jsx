import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useChat } from '../context/ChatContext';
import { ShoppingCart, Moon, Sun, Globe, DollarSign, LogOut, User, Shield, MessageSquare, Fingerprint, Smartphone } from 'lucide-react';

export default function Header({ currentView, setCurrentView, searchVal, setSearchVal, onLogoClick }) {
  const { lang, setLang, theme, setTheme, currency, toggleCurrency, settings, t, apiHost } = useApp();
  const { user, logout } = useAuth();
  const { cartItems, setIsCartOpen } = useCart();
  const { setIsChatOpen, unreadCount } = useChat();

  const [showRecent, setShowRecent] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState([]);

  React.useEffect(() => {
    const loadSearches = () => {
      try {
        const stored = localStorage.getItem('arz_mart_recent_searches');
        setRecentSearches(stored ? JSON.parse(stored) : []);
      } catch (err) {
        console.error(err);
      }
    };
    loadSearches();

    window.addEventListener('arz_mart_recent_searches_updated', loadSearches);
    return () => {
      window.removeEventListener('arz_mart_recent_searches_updated', loadSearches);
    };
  }, []);

  const handleLanguageToggle = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleCurrencyToggle = () => {
    toggleCurrency(currency === 'USD' ? 'LBP' : 'USD');
  };

  return (
    <header className="no-print" style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '14px 0',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand / Logo */}
        <a 
          href="/"
          onClick={(e) => {
            if (e.button === 1 || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            if (onLogoClick) {
              onLogoClick();
            } else {
              setCurrentView('store');
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textDecoration: 'none' }}
        >
          {settings?.logo_url ? (
            <img src={settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:') ? settings.logo_url : `${apiHost}${settings.logo_url}`} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.2rem'
            }}>
              {settings?.app_name ? settings.app_name[0] : 'A'}
            </div>
          )}
          <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {settings?.app_name || t('appName')}
          </span>
        </a>

        {/* Search Bar */}
        {currentView === 'store' && (
          <div style={{ flex: '1', maxWidth: '400px', minWidth: '200px', position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder={t('search_placeholder')}
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => setShowRecent(true)}
              onBlur={() => {
                setTimeout(() => setShowRecent(false), 200);
              }}
              style={{
                borderRadius: '24px',
                padding: '8px 18px',
                borderColor: 'var(--border-color)',
                width: '100%'
              }}
            />
            {showRecent && recentSearches.length > 0 && (
              <div 
                className="dashboard-card animate-fade animate-scale" 
                style={{
                  position: 'absolute',
                  top: '46px',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  padding: '10px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                    {lang === 'ar' ? 'سجل البحث الأخير' : 'Recent Searches'}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        localStorage.removeItem('arz_mart_recent_searches');
                        setRecentSearches([]);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--accent-red-gold)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'ar' ? 'مسح الكل' : 'Clear All'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {recentSearches.map((term, index) => (
                    <div 
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSearchVal(term);
                        setShowRecent(false);
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {term}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          try {
                            const updated = recentSearches.filter(t => t !== term);
                            localStorage.setItem('arz_mart_recent_searches', JSON.stringify(updated));
                            setRecentSearches(updated);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--text-light)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={lang === 'ar' ? 'إزالة' : 'Remove'}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Admin Dashboard Entry Button */}
          {user && (user.role === 'admin' || user.role === 'employee') && (
            <a
              href={currentView === 'admin' ? '/' : '/?view=admin'}
              onClick={(e) => {
                if (e.button === 1 || e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                setCurrentView(currentView === 'admin' ? 'store' : 'admin');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                textDecoration: 'none'
              }}
            >
              <Shield size={16} />
              {currentView === 'admin' ? t('go_to_store') : t('dashboard')}
            </a>
          )}

          {/* Currency Toggle */}
          <button
            onClick={handleCurrencyToggle}
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: '700',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: 'auto',
              backgroundColor: 'var(--bg-primary)'
            }}
            title={t('currency')}
          >
            <DollarSign size={14} />
            <span>{currency === 'USD' ? 'USD' : 'L.L.'}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={handleLanguageToggle}
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: 'auto',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            <Globe size={14} />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={handleThemeToggle}
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: '34px',
              height: '34px',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Download App Button */}
          <a
            href="/app.apk"
            download
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: 'auto',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: '0.85rem'
            }}
            title={lang === 'ar' ? 'تحميل تطبيق الأندرويد' : 'Download Android App'}
          >
            <Smartphone size={14} />
            <span>{lang === 'ar' ? 'التطبيق' : 'App'}</span>
          </a>

          {/* Chat Icon */}
          {user && (
            <button
              onClick={() => setIsChatOpen(true)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                width: '34px',
                height: '34px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
              title={t('chat_admin')}
            >
              <MessageSquare size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Cart Icon */}
          {currentView === 'store' && (
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                width: '34px',
                height: '34px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
            >
              <ShoppingCart size={16} />
              {cartItems.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--accent-red-gold)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              )}
            </button>
          )}

          {/* Auth Button */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href="/?view=orders"
                onClick={(e) => {
                  if (e.button === 1 || e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  setCurrentView('orders');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
                title={t('myOrders')}
              >
                <User size={14} />
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{user.username}</span>
              </a>
              {window.AndroidApp && localStorage.getItem('biometric_username') && (
                <button
                  onClick={() => {
                    if (confirm(lang === 'ar' ? 'هل تريد إلغاء تفعيل تسجيل الدخول بالبصمة؟' : 'Do you want to disable fingerprint login?')) {
                      localStorage.removeItem('biometric_username');
                      localStorage.removeItem('biometric_password');
                      window.location.reload();
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    width: '34px',
                    height: '34px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981'
                  }}
                  title={lang === 'ar' ? 'إلغاء تفعيل البصمة' : 'Disable Fingerprint'}
                >
                  <Fingerprint size={16} />
                </button>
              )}
              <button
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: '#ef4444'
                }}
                title={t('logout')}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('login')}
              style={{
                padding: '6px 14px',
                border: '2px solid var(--accent-blue)',
                color: 'var(--accent-blue)',
                fontWeight: '600',
                borderRadius: '18px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {t('login')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
