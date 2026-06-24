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
      
      {/* 1. TOP BAR (Dark Gray/Black Theme) */}
      <div style={{
        backgroundColor: '#0a0e17',
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.82rem',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {/* Left Controls (Currency, Lang, Theme) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Currency Select */}
            <button
              onClick={handleCurrencyToggle}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem'
              }}
            >
              <DollarSign size={13} style={{ color: '#10b981' }} />
              <span>{currency === 'USD' ? 'USD $' : 'ل.ل LBP'}</span>
            </button>

            {/* Globe Language Select */}
            <button
              onClick={handleLanguageToggle}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem'
              }}
            >
              <Globe size={13} />
              <span>{isRtl ? 'English' : 'عربي'}</span>
            </button>

            {/* Dark Mode Icon */}
            <button
              onClick={handleThemeToggle}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
            </button>
          </div>

          {/* Center delivery announcement */}
          <div style={{ fontWeight: '700', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🚚</span>
            <span>{isRtl ? 'توصيل سريع لجميع أنحاء لبنان' : 'Fast delivery all over Lebanon'}</span>
          </div>

          {/* Right Track Order */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('orders');
                } else {
                  setCurrentView('login');
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem'
              }}
            >
              <Package size={13} style={{ color: '#f59e0b' }} />
              <span>{isRtl ? 'تتبع الطلب' : 'Track Order'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER (White background, search middle, logo right) */}
      <header style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 0',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 50
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          
          {/* Left Side: Circular White Buttons for Cart and User Account */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
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
                  backgroundColor: '#10b981', // green badge
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
                color: user ? '#10b981' : 'var(--text-primary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <User size={18} />
            </button>

            {/* Profile Dropdown Menu */}
            {showUserDropdown && user && (
              <>
                <div onClick={() => setShowUserDropdown(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                <div className="dashboard-card animate-scale" style={{
                  position: 'absolute',
                  top: '55px',
                  left: isRtl ? '0' : 'auto',
                  right: isRtl ? 'auto' : '0',
                  width: '200px',
                  zIndex: 100,
                  padding: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '12px'
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'block' }}>{isRtl ? 'مرحباً بك' : 'Welcome'}</span>
                    <strong style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>{user.username}</strong>
                  </div>
                  
                  {/* Admin dashboard if has permission */}
                  {(user.role === 'admin' || user.role === 'employee') && (
                    <button
                      onClick={() => {
                        setCurrentView(currentView === 'admin' ? 'store' : 'admin');
                        setShowUserDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'var(--accent-blue)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Shield size={14} />
                      <span>{currentView === 'admin' ? t('go_to_store') : t('dashboard')}</span>
                    </button>
                  )}

                  {/* Orders Page */}
                  <button
                    onClick={() => {
                      setCurrentView('orders');
                      setShowUserDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'start',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Package size={14} />
                    <span>{t('myOrders')}</span>
                  </button>

                  {/* Chat Panel */}
                  <button
                    onClick={() => {
                      setIsChatOpen(true);
                      setShowUserDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'start',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <MessageSquare size={14} />
                    <span>{t('chat_admin')}</span>
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'start',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#ef4444',
                      borderTop: '1px solid var(--border-color)',
                      marginTop: '6px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={14} />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Middle: Search Input (Fully rounded with circular green button) */}
          {currentView === 'store' && (
            <div style={{ flex: '1', maxWidth: '460px', minWidth: '220px', position: 'relative' }}>
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
                    backgroundColor: '#10b981', // green search button
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16,185,129,0.2)'
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

          {/* Right Side: Brand Logo (Red badge with green cedar tree) */}
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
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none' }}
          >
            {/* Logo Badge matching the screenshot */}
            <div style={{
              width: '45px',
              height: '45px',
              borderRadius: '10px',
              backgroundColor: '#c1272d', // Red color
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              boxShadow: '0 2px 8px rgba(193,39,45,0.25)',
              position: 'relative'
            }}>
              {/* White circle containing green cedar tree */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {/* Green cedar tree SVG */}
                <svg viewBox="0 0 100 100" style={{ width: '22px', height: '22px', fill: '#15803d' }}>
                  <path d="M50 10 L68 40 L60 40 L76 65 L64 65 L84 85 L16 85 L36 65 L24 65 L40 40 L32 40 Z" />
                  <rect x="46" y="85" width="8" height="12" fill="#78350f" />
                </svg>
              </div>
              <span style={{ fontSize: '7px', fontWeight: '800', color: 'white', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.2px' }}>Arz Mart</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.1' }}>
                Arz-Mart
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '2px' }}>
                {isRtl ? 'متجرك الأول' : 'Your First Store'}
              </span>
            </div>
          </a>

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
                  backgroundColor: selectedCategory === '' ? '#10b981' : 'var(--bg-primary)',
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
                      backgroundColor: isActive ? '#10b981' : 'var(--bg-primary)',
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
          {/* Overlay backdrop */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 99999
            }}
          />

          {/* Drawer Panel */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              right: isRtl ? 0 : 'auto',
              left: isRtl ? 'auto' : 0,
              width: '300px',
              backgroundColor: 'var(--bg-secondary)',
              boxShadow: isRtl ? '-10px 0 30px rgba(0,0,0,0.15)' : '10px 0 30px rgba(0,0,0,0.15)',
              zIndex: 100000,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              transition: 'transform 0.3s ease-out',
              borderLeft: isRtl ? '1px solid var(--border-color)' : 'none',
              borderRight: isRtl ? 'none' : '1px solid var(--border-color)',
            }}
          >
            {/* Header: Title and Close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                {isRtl ? 'القائمة الرئيسية' : 'Main Menu'}
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
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* Content: List of options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              
              {/* Language Selector Card */}
              <button
                onClick={() => {
                  handleLanguageToggle();
                  setIsDrawerOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: isRtl ? 'right' : 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Globe size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {isRtl ? 'لغة التطبيق' : 'App Language'}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>
                  {isRtl ? 'English' : 'العربية'}
                </span>
              </button>

              {/* Currency Selector Card */}
              <button
                onClick={() => {
                  handleCurrencyToggle();
                  setIsDrawerOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: isRtl ? 'right' : 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <DollarSign size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {isRtl ? 'عملة المتجر' : 'Store Currency'}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>
                  {currency === 'USD' ? 'USD $' : 'LBP ل.ل'}
                </span>
              </button>

              {/* Theme Selector Card */}
              <button
                onClick={() => {
                  handleThemeToggle();
                  setIsDrawerOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: isRtl ? 'right' : 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {theme === 'light' ? <Moon size={18} style={{ color: '#10b981' }} /> : <Sun size={18} style={{ color: '#10b981' }} />}
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {isRtl ? 'مظهر التطبيق' : 'App Theme'}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>
                  {theme === 'light' ? (isRtl ? 'داكن' : 'Dark') : (isRtl ? 'مضيء' : 'Light')}
                </span>
              </button>

              {/* App Download Card */}
              <a
                href="/app.apk"
                download
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {isRtl ? 'تحميل تطبيق الهاتف' : 'Download Mobile App'}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '800' }}>
                  APK
                </span>
              </a>

            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.78rem', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <span>Arz-Mart v1.0.0</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
