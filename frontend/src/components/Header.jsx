import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useChat } from '../context/ChatContext';
import { ShoppingCart, Moon, Sun, Globe, DollarSign, LogOut, User, Shield, MessageSquare, Fingerprint, Smartphone, Package, Menu, Search, Truck } from 'lucide-react';

export default function Header({ currentView, setCurrentView, searchVal, setSearchVal, onLogoClick, categories = [], selectedCategory, setSelectedCategory }) {
  const { lang, setLang, theme, setTheme, currency, toggleCurrency, settings, t, apiHost, formatPrice } = useApp();
  const { user, logout } = useAuth();
  const { cartItems, setIsCartOpen } = useCart();
  const { setIsChatOpen, unreadCount } = useChat();

  const [showRecent, setShowRecent] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
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

  const isRtl = lang === 'ar';
  const logoSrc = settings?.logo_url 
    ? (settings.logo_url.startsWith('http') ? settings.logo_url : `${apiHost}${settings.logo_url}`)
    : '/logo.png';
  const parentCategories = categories.filter(c => !c.parent_id);

  // Helper to map category names to emojis
  const getCategoryEmoji = (nameEn, nameAr) => {
    const name = (nameEn + ' ' + nameAr).toLowerCase();
    if (name.includes('children') || name.includes('kids') || name.includes('أطفال') || name.includes('طفل')) return '👶';
    if (name.includes('toy') || name.includes('game') || name.includes('ألعاب') || name.includes('لعبة')) return '🎮';
    if (name.includes('accessory') || name.includes('accessories') || name.includes('إكسسوار') || name.includes('اكسسوارات')) return '🎧';
    if (name.includes('home') || name.includes('appliances') || name.includes('منزل') || name.includes('بيت')) return '🏠';
    if (name.includes('soap') || name.includes('care') || name.includes('عناية') || name.includes('صابون') || name.includes('تجميل')) return '🧼';
    if (name.includes('oil') || name.includes('زيت')) return '🫒';
    if (name.includes('food') || name.includes('supermarket') || name.includes('أغذية') || name.includes('طعام')) return '🍎';
    if (name.includes('glasses') || name.includes('نظارات') || name.includes('نظارة')) return '👓';
    if (name.includes('phone') || name.includes('mobile') || name.includes('هواتف') || name.includes('جوال')) return '📱';
    return '📦';
  };

  return (
    <div className="no-print" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      
      {/* 2. MAIN HEADER (White background, search middle, logo right) */}
      <header style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 0',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 50
      }}>
        <div className="container header-main-container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          
          {/* Left Side: Circular White Buttons for Cart and User Account, and Brand Logo */}
          <div className="header-actions-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            
            {/* Brand Logo Link always next to cart */}
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
              className="brand-logo-link"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none' }}
            >
              {/* Restored image logo */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: 'transparent'
              }}>
                <img 
                  src={logoSrc} 
                  alt="Arz Mart Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/logo.png';
                  }}
                />
              </div>

              <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.1' }}>
                  Arz-Mart
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '1px' }}>
                  {isRtl ? 'متجرك الأول' : 'Your First Store'}
                </span>
              </div>
            </a>

            {/* Cart Icon with green badge */}
            {currentView === 'store' && (
              <button
                onClick={() => setIsCartOpen(true)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '45px',
                  height: '45px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <ShoppingCart size={18} />
                <span style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  backgroundColor: 'var(--accent-brand)', // green badge
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '20px',
                  height: '20px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  padding: '0 4px',
                  border: '2px solid var(--bg-secondary)'
                }}>
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              </button>
            )}

            {/* User Profile Icon */}
            <button
              onClick={() => {
                if (user) {
                  setShowUserDropdown(!showUserDropdown);
                } else {
                  setCurrentView('login');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                cursor: 'pointer',
                color: user ? 'var(--accent-brand)' : 'var(--text-primary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <User size={18} />
            </button>

            {/* Profile Drawer Menu Side-aligned */}
            {showUserDropdown && user && (
              <>
                {/* Fixed Backdrop Overlay */}
                <div 
                  onClick={() => setShowUserDropdown(false)} 
                  style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    backgroundColor: 'rgba(0, 0, 0, 0.4)', 
                    backdropFilter: 'blur(5px)',
                    zIndex: 9999
                  }} 
                  className="animate-fade"
                />
                
                {/* Slide-out Drawer Panel */}
                <div 
                  className="dashboard-card" 
                  style={{
                    position: 'fixed',
                    top: 0,
                    right: isRtl ? 0 : 'auto',
                    left: isRtl ? 'auto' : 0,
                    width: '320px',
                    height: '100vh',
                    zIndex: 10000,
                    padding: '24px',
                    boxShadow: 'var(--shadow-xl)',
                    border: 'none',
                    borderLeft: isRtl ? '1px solid var(--border-color)' : 'none',
                    borderRight: isRtl ? 'none' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: isRtl ? 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Drawer Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <User size={20} color="var(--accent-blue)" />
                      <span>{isRtl ? 'حسابي' : 'My Profile'}</span>
                    </h3>
                    <button 
                      onClick={() => setShowUserDropdown(false)}
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ×
                    </button>
                  </div>

                  {/* User Profile Summary Card */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '20px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '24px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-brand-rgba)',
                      color: 'var(--accent-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                      fontWeight: '800',
                      border: '2px solid var(--accent-brand)'
                    }}>
                      {(user.username || 'U').substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', fontWeight: '600' }}>
                        {isRtl ? 'مرحباً بك' : 'Welcome'}
                      </span>
                      <strong style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {user.username}
                      </strong>
                      {user.role && (
                        <span style={{
                          display: 'block',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--accent-blue)',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          marginTop: '6px',
                          textTransform: 'uppercase',
                          width: 'fit-content',
                          margin: '6px auto 0 auto'
                        }}>
                          {user.role === 'admin' ? (isRtl ? 'مدير النظام' : 'Administrator') : user.role === 'employee' ? (isRtl ? 'موظف' : 'Employee') : (isRtl ? 'عميل' : 'Customer')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Drawer Menu List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1' }}>
                    
                    {/* Admin Dashboard Option */}
                    {(user.role === 'admin' || user.role === 'employee') && (
                      <button
                        onClick={() => {
                          setCurrentView(currentView === 'admin' ? 'store' : 'admin');
                          setShowUserDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'start',
                          padding: '12px 16px',
                          border: '1px solid rgba(59, 130, 246, 0.15)',
                          backgroundColor: 'rgba(59, 130, 246, 0.04)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '0.92rem',
                          fontWeight: '700',
                          color: 'var(--accent-blue)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.04)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <Shield size={18} />
                        <span>{currentView === 'admin' ? t('go_to_store') : t('dashboard')}</span>
                      </button>
                    )}

                    {/* Orders Page Option */}
                    <button
                      onClick={() => {
                        setCurrentView('orders');
                        setShowUserDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '12px 16px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Package size={18} color="var(--accent-blue)" />
                      <span>{t('myOrders')}</span>
                    </button>

                    {/* Chat with Admin Option */}
                    <button
                      onClick={() => {
                        setIsChatOpen(true);
                        setShowUserDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '12px 16px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <MessageSquare size={18} color="var(--accent-brand)" />
                      <span>{t('chat_admin')}</span>
                    </button>
                  </div>

                  {/* Drawer Footer / Logout Option */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '12px 16px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: '#ef4444',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <LogOut size={18} />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Middle: Search Input (Fully rounded with circular green button) */}
          {currentView === 'store' && (
            <div className="header-search-wrapper" style={{ flex: '1', maxWidth: '460px', minWidth: '220px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                    borderRadius: '9999px',
                    padding: '10px 18px',
                    paddingInlineEnd: '50px', // leave space for search button
                    borderColor: 'var(--border-color)',
                    width: '100%',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                    fontSize: '0.88rem'
                  }}
                />
                
                {/* Circular green search button inside */}
                <button
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: isRtl ? 'auto' : '6px',
                    left: isRtl ? '6px' : 'auto',
                    transform: 'translateY(-50%)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-brand)', // green search button
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px var(--accent-brand-shadow)'
                  }}
                >
                  <Search size={14} strokeWidth={2.5} />
                </button>
              </div>

              {/* Recent search history list */}
              {showRecent && recentSearches.length > 0 && (
                <div 
                  className="dashboard-card animate-fade animate-scale" 
                  style={{
                    position: 'absolute',
                    top: '52px',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    padding: '12px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                      {isRtl ? 'سجل البحث الأخير' : 'Recent Searches'}
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
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {isRtl ? 'مسح الكل' : 'Clear All'}
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
                          padding: '8px 10px',
                          borderRadius: '8px',
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
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            padding: '0 4px'
                          }}
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

          {/* Logo removed from right side, now always displayed next to the cart */}
          <div style={{ display: 'none' }} />

        </div>
      </header>

      {/* 3. SUB-HEADER CATEGORY BAR (Hamburger menu + Horizontal Category Buttons) */}
      {currentView === 'store' && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 0',
          boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.01)'
        }}>
          <div className="container" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Hamburger Menu Toggle Icon */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
            >
              <Menu size={16} />
            </button>

            {/* Horizontal Scroll categories wrapper */}
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              padding: '2px 0',
              flex: 1,
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none' // IE/Edge
            }} className="no-scrollbar">
              
              {/* Category "All Sections / الأقسام" pill */}
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSearchVal('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: selectedCategory === '' ? 'var(--accent-brand)' : 'var(--bg-primary)',
                  color: selectedCategory === '' ? 'white' : 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  border: selectedCategory === '' ? 'none' : '1px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== '') e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== '') e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <span>🎛️</span>
                <span>{isRtl ? 'الأقسام' : 'Categories'}</span>
              </button>

              {/* Loop parent categories */}
              {parentCategories.map(cat => {
                const isActive = Number(selectedCategory) === Number(cat.id);
                const emoji = getCategoryEmoji(cat.name_en, cat.name_ar);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSearchVal('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      backgroundColor: isActive ? 'var(--accent-brand)' : 'var(--bg-primary)',
                      color: isActive ? 'white' : 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      border: isActive ? 'none' : '1px solid var(--border-color)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{isRtl ? cat.name_ar : cat.name_en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. SIDE DRAWER MENU (Hamburger Menu Details) */}
      {isDrawerOpen && (
        <>
          {/* Overlay backdrop with glass blur */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 99999
            }}
          />

          {/* Drawer Panel with Glassmorphism */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              right: isRtl ? 0 : 'auto',
              left: isRtl ? 'auto' : 0,
              width: '85%',
              maxWidth: '320px',
              backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: isRtl ? '-10px 0 35px rgba(0,0,0,0.2)' : '10px 0 35px rgba(0,0,0,0.2)',
              zIndex: 100000,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              animation: isRtl ? 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              borderLeft: isRtl ? 'none' : '1px solid rgba(255,255,255,0.08)',
              borderRight: isRtl ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}
          >
            {/* Header: Title and Close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                {isRtl ? 'قائمة التحكم' : 'Control Menu'}
              </h3>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  border: 'none',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              >
                ×
              </button>
            </div>

            {/* Profile Greeting Section */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-brand)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '1.05rem',
                  boxShadow: '0 2px 8px var(--accent-brand-shadow-md)'
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '600' }}>
                    {isRtl ? 'مرحباً بك' : 'Welcome'}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {user.username}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-brand-rgba)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-brand)',
                  flexShrink: 0
                }}>
                  <User size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {isRtl ? 'زائر المتجر' : 'Store Guest'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '2px' }}>
                    {isRtl ? 'تصفح كزائر' : 'Browsing as guest'}
                  </span>
                </div>
              </div>
            )}

            {/* Content: Capsule toggles and app card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
              
              {/* Language Selector Capsule Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Globe size={15} style={{ color: 'var(--accent-brand)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {isRtl ? 'لغة التطبيق' : 'Language'}
                  </span>
                </div>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: '10px', padding: '3px' }}>
                  <button
                    onClick={() => { if (lang !== 'ar') { handleLanguageToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: lang === 'ar' ? 'var(--accent-brand)' : 'transparent',
                      color: lang === 'ar' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: lang === 'ar' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    العربية
                  </button>
                  <button
                    onClick={() => { if (lang !== 'en') { handleLanguageToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: lang === 'en' ? 'var(--accent-brand)' : 'transparent',
                      color: lang === 'en' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: lang === 'en' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Currency Selector Capsule Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <DollarSign size={15} style={{ color: 'var(--accent-brand)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {isRtl ? 'العملة المعروضة' : 'Display Currency'}
                  </span>
                </div>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: '10px', padding: '3px' }}>
                  <button
                    onClick={() => { if (currency !== 'USD') { handleCurrencyToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: currency === 'USD' ? 'var(--accent-brand)' : 'transparent',
                      color: currency === 'USD' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: currency === 'USD' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    USD $
                  </button>
                  <button
                    onClick={() => { if (currency !== 'LBP') { handleCurrencyToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: currency === 'LBP' ? 'var(--accent-brand)' : 'transparent',
                      color: currency === 'LBP' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: currency === 'LBP' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    LBP ل.ل
                  </button>
                </div>
              </div>

              {/* Theme Selector Capsule Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {theme === 'light' ? <Moon size={15} style={{ color: 'var(--accent-brand)' }} /> : <Sun size={15} style={{ color: 'var(--accent-brand)' }} />}
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {isRtl ? 'مظهر التطبيق' : 'App Theme'}
                  </span>
                </div>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: '10px', padding: '3px' }}>
                  <button
                    onClick={() => { if (theme !== 'light') { handleThemeToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: theme === 'light' ? 'var(--accent-brand)' : 'transparent',
                      color: theme === 'light' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: theme === 'light' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sun size={12} />
                    <span>{isRtl ? 'مضيء' : 'Light'}</span>
                  </button>
                  <button
                    onClick={() => { if (theme !== 'dark') { handleThemeToggle(); setIsDrawerOpen(false); } }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: theme === 'dark' ? 'var(--accent-brand)' : 'transparent',
                      color: theme === 'dark' ? 'white' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: theme === 'dark' ? '0 2px 6px var(--accent-brand-shadow)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Moon size={12} />
                    <span>{isRtl ? 'داكن' : 'Dark'}</span>
                  </button>
                </div>
              </div>

              {/* App Download Glowing Card */}
              <a
                href="/app.apk"
                download
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, var(--accent-brand) 0%, var(--accent-brand-hover) 100%)',
                  borderRadius: '16px',
                  color: 'white',
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px var(--accent-brand-shadow-md)',
                  transition: 'transform 0.2s, boxShadow 0.2s',
                  marginTop: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 20px var(--accent-brand-shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px var(--accent-brand-shadow-md)';
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Smartphone size={20} style={{ color: 'white' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: isRtl ? 'right' : 'left' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'white', lineHeight: '1.2' }}>
                    {isRtl ? 'تحميل تطبيق الهاتف' : 'Download Mobile App'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: '2px' }}>
                    {isRtl ? 'ثبّت ملف APK مباشرة' : 'Install APK file directly'}
                  </span>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white', transform: 'rotate(-45deg)' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </a>

            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
              <span>Arz-Mart v1.0.0</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
