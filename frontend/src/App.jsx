import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { useChat } from './context/ChatContext';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductCard from './components/ProductCard';
import ProductDetails from './components/ProductDetails';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import Chat from './components/Chat';
import PwaInstallBanner from './components/PwaInstallBanner';

// Admin panel imports
import AdminDashboard from './components/admin/AdminDashboard';

import { Key, User, FileText, ChevronDown, Check, Star, RefreshCw, Fingerprint, Smartphone, Globe, Settings, Moon, Sun } from 'lucide-react';

export default function App() {
  const { lang, setLang, theme, setTheme, formatPrice, t, apiBase, settings, currency, apiHost } = useApp();
  const { user, login, register, token, logout } = useAuth();
  const { setIsCartOpen, cartItems } = useCart();
  const { isChatOpen, setIsChatOpen } = useChat();

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'store';
  });

  // Catalog states
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null); // Detail modal
  const [showCheckout, setShowCheckout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('checkout') === '1';
  });

  // Search & Filter states
  const [searchVal, setSearchVal] = useState('');
  const [debouncedSearchVal, setDebouncedSearchVal] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('category_id') || '';
  });
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');

  // Dropdown UI toggles
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Auth form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Enhanced security signup states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Biometrics enrollment states
  const [showBiometricEnrollPrompt, setShowBiometricEnrollPrompt] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);
  
  // Registration celebration state
  const [congratsPromo, setCongratsPromo] = useState('');

  // User orders history state
  const [userOrders, setUserOrders] = useState([]);

  // Network and account states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleDeleteAccountClick = async () => {
    const confirm1 = window.confirm(
      lang === 'ar'
        ? '⚠️ تحذير: هل أنت متأكد تماماً من رغبتك في حذف حسابك الشخصي بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح كافة رسائلك وبياناتك الشخصية.'
        : '⚠️ Warning: Are you absolutely sure you want to permanently delete your account? This action cannot be undone and all your messages and personal details will be erased.'
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      lang === 'ar'
        ? 'للتأكيد النهائي: هل ترغب حقاً في إزالة حسابك الآن؟ سيتم تسجيل خروجك فوراً.'
        : 'Final Confirmation: Do you really want to remove your account now? You will be logged out immediately.'
    );
    if (!confirm2) return;

    try {
      const res = await fetch(`${apiBase}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(lang === 'ar' ? data.message_ar : data.message_en);
        localStorage.removeItem('biometric_username');
        localStorage.removeItem('biometric_password');
        logout();
        setCurrentView('store');
      } else {
        alert(data.error_ar || data.error_en || 'Error deleting account');
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'خطأ في الاتصال بالخادم، يرجى التحقق من الإنترنت' : 'Error connecting to server, please check internet');
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      let url = `${apiBase}/products?`;

      if (selectedCategory) {
        // If a parent category is selected, also include products from subcategories
        const selId = Number(selectedCategory);
        const childIds = categories
          .filter(c => c.parent_id && Number(c.parent_id) === selId)
          .map(c => c.id);
        if (childIds.length > 0) {
          // Include parent + all children IDs
          const allIds = [selId, ...childIds].join(',');
          url += `category_ids=${allIds}&`;
        } else {
          url += `category_id=${selectedCategory}&`;
        }
      }

      if (!selectedCategory && !debouncedSearchVal) {
        url += `featured=true&`;
      }
      if (debouncedSearchVal) url += `search=${encodeURIComponent(debouncedSearchVal)}&`;
      const visitorId = localStorage.getItem('arz_mart_visitor_id') || '';
      if (visitorId) url += `visitor_id=${visitorId}&`;
      if (minPrice) url += `min_price=${minPrice}&`;
      if (maxPrice) url += `max_price=${maxPrice}&`;
      if (minRating) url += `min_rating=${minRating}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Fetch products client error:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${apiBase}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Fetch categories client error:', err);
    }
  };

  const fetchUserOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/orders/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserOrders(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Debounce search value updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchVal(searchVal);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  useEffect(() => {
    fetchProducts();

    // Save to local recent searches
    const cleanSearch = debouncedSearchVal.trim();
    if (cleanSearch) {
      try {
        const stored = localStorage.getItem('arz_mart_recent_searches');
        let searches = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(searches)) searches = [];
        
        // Remove duplicate if it exists, and prepend to front
        searches = [cleanSearch, ...searches.filter(s => s !== cleanSearch)].slice(0, 10);
        localStorage.setItem('arz_mart_recent_searches', JSON.stringify(searches));
        
        // Dispatch custom event to notify Header
        window.dispatchEvent(new Event('arz_mart_recent_searches_updated'));
      } catch (err) {
        console.error('Error saving recent search:', err);
      }
    }
  }, [selectedCategory, debouncedSearchVal, minPrice, maxPrice, minRating]);

  // Analytics: Track visitor page views
  useEffect(() => {
    // Generate a unique visitor ID if it doesn't exist yet
    let visitorId = localStorage.getItem('arz_mart_visitor_id');
    if (!visitorId) {
      visitorId = 'vis_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('arz_mart_visitor_id', visitorId);
    }

    // Report page hit to backend
    const trackPageHit = async () => {
      try {
        await fetch(`${apiBase}/analytics/hit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitor_id: visitorId,
            url: window.location.pathname + window.location.search
          })
        });
      } catch (err) {
        console.error('Failed to report analytics hit:', err);
      }
    };

    trackPageHit();
  }, [currentView]);

  useEffect(() => {
    fetchCategories();
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'orders') {
      fetchUserOrders();
    }
  }, [currentView, token]);

  // Sync all navigation states to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // View
    if (currentView === 'store') {
      params.delete('view');
    } else {
      params.set('view', currentView);
    }
    
    // Admin Tab
    if (currentView === 'admin') {
      const tabParam = params.get('tab');
      params.set('tab', tabParam || 'products');
    } else {
      params.delete('tab');
    }
    
    // Category
    if (selectedCategory) {
      params.set('category_id', selectedCategory);
    } else {
      params.delete('category_id');
    }
    
    // Checkout
    if (showCheckout) {
      params.set('checkout', '1');
    } else {
      params.delete('checkout');
    }
    
    // Product
    if (selectedProduct) {
      params.set('product_id', selectedProduct.id);
    } else {
      params.delete('product_id');
    }
    
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) {
      const url = newSearch ? `/?${newSearch}` : '/';
      window.history.pushState(null, '', url);
    }
  }, [currentView, selectedCategory, showCheckout, selectedProduct]);

  // Handle product_id parameter on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product_id');
    if (productId) {
      const fetchSelectedProduct = async () => {
        try {
          const res = await fetch(`${apiBase}/products/${productId}`);
          if (res.ok) {
            const data = await res.json();
            setSelectedProduct(data);
          }
        } catch (err) {
          console.error('Failed to fetch product for URL state:', err);
        }
      };
      fetchSelectedProduct();
    }
  }, [apiBase]);

  // Handle Back/Forward browser navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      
      const view = params.get('view') || 'store';
      setCurrentView(view);
      
      const categoryId = params.get('category_id') || '';
      setSelectedCategory(categoryId);
      
      const checkoutVal = params.get('checkout') === '1';
      setShowCheckout(checkoutVal);
      
      const productId = params.get('product_id');
      if (productId) {
        fetch(`${apiBase}/products/${productId}`)
          .then(res => res.json())
          .then(data => setSelectedProduct(data))
          .catch(err => console.error(err));
      } else {
        setSelectedProduct(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [apiBase]);

  // Register global methods and listeners for Android/admin integration
  useEffect(() => {
    window.goHome = () => {
      setCurrentView('store');
      setSelectedCategory('');
      setSelectedProduct(null);
      setShowCheckout(false);
      window.history.pushState(null, '', '/');
    };
    
    const handleReload = () => {
      fetchCategories();
    };
    window.addEventListener('reload-categories', handleReload);

    return () => {
      delete window.goHome;
      window.removeEventListener('reload-categories', handleReload);
    };
  }, []);

  // Handle Biometric Login authentication
  const handleBiometricLogin = async () => {
    const savedUser = localStorage.getItem('biometric_username');
    const savedPass = localStorage.getItem('biometric_password');
    if (savedUser && savedPass) {
      try {
        setAuthError('');
        await login(savedUser, savedPass);
        setCurrentView('store');
      } catch (err) {
        setAuthError(err.message || (lang === 'ar' ? 'فشلت عملية المصادقة بالبصمة تلقائياً' : 'Biometric login failed automatically'));
      }
    }
  };

  // Setup biometric callbacks injected by native app
  useEffect(() => {
    window.onBiometricSuccess = () => {
      if (window.isEnrollingBiometrics && tempCredentials) {
        localStorage.setItem('biometric_username', tempCredentials.username);
        localStorage.setItem('biometric_password', tempCredentials.password);
        window.isEnrollingBiometrics = false;
        setShowBiometricEnrollPrompt(false);
        setTempCredentials(null);
        alert(lang === 'ar' ? 'تم تفعيل الدخول بالبصمة بنجاح!' : 'Fingerprint login enabled successfully!');
        
        if (window.onBiometricPromptClose) {
          window.onBiometricPromptClose();
        }
      } else {
        handleBiometricLogin();
      }
    };

    window.onBiometricFailed = (msg) => {
      window.isEnrollingBiometrics = false;
      let localizedMsg = msg;
      if (msg === 'device_no_hardware') {
        localizedMsg = lang === 'ar' ? 'الجهاز لا يدعم البصمة' : 'Device does not support fingerprint';
      } else if (msg === 'device_hw_unavailable') {
        localizedMsg = lang === 'ar' ? 'مستشعر البصمة غير متوفر حالياً' : 'Biometric sensor unavailable';
      } else if (msg === 'device_no_biometrics_enrolled') {
        localizedMsg = lang === 'ar' ? 'لا توجد بصمات مسجلة في هذا الجهاز. يرجى إضافتها من إعدادات الهاتف' : 'No fingerprints registered on this device. Please add one in system settings';
      } else if (msg === 'Authentication failed' || msg === 'فشلت المصادقة') {
        localizedMsg = lang === 'ar' ? 'فشلت المصادقة بالبصمة' : 'Biometric authentication failed';
      }
      
      alert(localizedMsg || (lang === 'ar' ? 'فشلت مصادقة البصمة' : 'Biometric authentication failed'));
      setShowBiometricEnrollPrompt(false);
      setTempCredentials(null);
      
      if (window.onBiometricPromptClose) {
        window.onBiometricPromptClose();
      }
    };

    return () => {
      window.onBiometricSuccess = null;
      window.onBiometricFailed = null;
    };
  }, [tempCredentials, lang]);

  // Helper for handling successful manual authentication (login/register)
  const handleAuthSuccess = (userVal, passVal, onNext) => {
    if (window.AndroidApp && !localStorage.getItem('biometric_username')) {
      setTempCredentials({ username: userVal, password: passVal });
      setShowBiometricEnrollPrompt(true);
      window.onBiometricPromptClose = () => {
        onNext();
      };
    } else {
      onNext();
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await login(username, password);
      const onNext = () => {
        setCurrentView('store');
        setUsername('');
        setPassword('');
      };
      handleAuthSuccess(username, password, onNext);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (password !== confirmPassword) {
      setAuthError(lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    try {
      const data = await register(username, password, fullName, phone, email);
      await login(username, password);
      
      const onNext = () => {
        if (data.congrats) {
          setCongratsPromo(data.discount_code);
        }
        setCurrentView('store');
        setUsername('');
        setPassword('');
        setFullName('');
        setPhone('');
        setEmail('');
        setConfirmPassword('');
      };
      handleAuthSuccess(username, password, onNext);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // Safe dropdown toggle
  const toggleFilterDropdown = () => {
    setShowFilterDropdown(!showFilterDropdown);
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
  };

  const isSiteOffline = Number(settings?.site_offline) === 1;
  const isManagementUser = user?.role === 'admin' || user?.role === 'employee';
  const showMaintenance = isSiteOffline && !isManagementUser && currentView !== 'login' && currentView !== 'register';

  if (showMaintenance) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        {/* Minimal Header with Lang & Theme Toggles */}
        <div style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {settings?.logo_url ? (
              <img src={settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:') ? settings.logo_url : `${apiHost}${settings.logo_url}`} alt="Logo" style={{ height: '36px', objectFit: 'contain' }} />
            ) : (
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {settings?.app_name ? settings.app_name[0] : 'A'}
              </div>
            )}
            <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>
              {settings?.app_name || 'Arz-Mart'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
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
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
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
          </div>
        </div>

        {/* Maintenance Box */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{
            maxWidth: '500px',
            padding: '40px 30px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              <Settings size={40} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {lang === 'ar' ? 'الموقع قيد الصيانة مؤقتاً' : 'Website Under Maintenance'}
            </h2>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {lang === 'ar'
                ? 'نحن نقوم ببعض التحديثات والتحسينات لنوفر لكم تجربة تسوق أفضل. سنعود للعمل قريباً جداً، شكراً لتفهمكم وصبركم.'
                : 'We are performing some scheduled updates and improvements to provide you with a better shopping experience. We will be back online shortly. Thank you for your patience.'}
            </p>

            <hr style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border-color)', margin: '10px 0' }} />

            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              {lang === 'ar' ? 'للاستفسارات الطارئة يرجى التواصل عبر البريد الإلكتروني:' : 'For urgent inquiries, please contact us at:'}
              {settings?.contact_email && (
                <div style={{ marginTop: '4px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                  {settings.contact_email}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setCurrentView('login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-light)',
                fontSize: '0.75rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              {lang === 'ar' ? 'تسجيل دخول الإدارة (Admin Login)' : 'Admin Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      <Header 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        searchVal={searchVal} 
        setSearchVal={setSearchVal} 
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        onLogoClick={() => {
          setCurrentView('store');
          setSelectedProduct(null);
          setShowCheckout(false);
          setSelectedCategory('');
          setSearchVal('');
          setMinPrice('');
          setMaxPrice('');
          setMinRating('');
          setIsCartOpen(false);
          window.history.pushState(null, '', '/');
        }}
      />

      {/* Offline Mode Banner */}
      {isOffline && (
        <div style={{
          position: 'sticky',
          top: '70px',
          zIndex: 99,
          background: 'rgba(217, 119, 6, 0.95)',
          color: 'white',
          backdropFilter: 'blur(8px)',
          textAlign: 'center',
          padding: '10px 16px',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Globe size={16} className="animate-pulse" />
          <span>
            {lang === 'ar' 
              ? '⚠️ أنت تتصفح حالياً في وضع عدم الاتصال بالإنترنت. المنتجات والتصنيفات المعروضة هي من التخزين المؤقت.' 
              : '⚠️ You are browsing in Offline Mode. Displayed products and categories are loaded from cache.'}
          </span>
        </div>
      )}

      {/* 2. Congratulatory New User Discount Banner Modal */}
      {congratsPromo && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="animate-scale" style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '30px',
            borderRadius: '16px',
            border: '2px solid var(--accent-red-gold)',
            textAlign: 'center',
            maxWidth: '450px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h2 style={{ color: 'var(--accent-red-gold)', fontWeight: '800' }}>{t('congrats_title')}</h2>
            <p style={{ fontWeight: '500' }}>{t('congrats_desc')}</p>
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '2px dashed var(--accent-blue)',
              padding: '12px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              margin: '10px 0',
              color: 'var(--text-primary)'
            }}>
              {t('congrats_code')}
            </div>
            <button
              onClick={() => setCongratsPromo('')}
              className="input-field"
              style={{ backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              🎉 شكراً لك! (Got it!)
            </button>
          </div>
        </div>
      )}

      {/* Biometric Enrollment Prompt Modal */}
      {showBiometricEnrollPrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="animate-scale" style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '30px',
            borderRadius: '16px',
            border: '2px solid var(--accent-brand)',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-brand-rgba)',
              color: 'var(--accent-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Fingerprint size={36} className="animate-pulse" />
            </div>

            <h3 style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '1.25rem' }}>
              {lang === 'ar' ? 'تفعيل الدخول بالبصمة' : 'Enable Fingerprint Login'}
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {lang === 'ar' 
                ? 'هل ترغب في حفظ بيانات الدخول محلياً على هذا الجهاز وتفعيل تسجيل الدخول ببصمة الإصبع مستقبلاً؟' 
                : 'Would you like to save your credentials locally on this device and enable fingerprint login for future sessions?'}
            </p>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px' }}>
              <button
                onClick={() => {
                  window.isEnrollingBiometrics = true;
                  if (window.AndroidApp) {
                    window.AndroidApp.triggerFingerprintAuth();
                  }
                }}
                className="input-field"
                style={{
                  backgroundColor: 'var(--accent-brand)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                {lang === 'ar' ? 'تفعيل الآن' : 'Enable Now'}
              </button>
              
              <button
                onClick={() => {
                  setShowBiometricEnrollPrompt(false);
                  setTempCredentials(null);
                  if (window.onBiometricPromptClose) {
                    window.onBiometricPromptClose();
                  }
                }}
                className="input-field"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                {lang === 'ar' ? 'ليس الآن' : 'Not Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Views router */}
      {currentView === 'admin' ? (
        <AdminDashboard setCurrentView={setCurrentView} />
      ) : currentView === 'privacy' ? (
        /* PRIVACY POLICY VIEW */
        <div className="container" style={{ flex: '1', padding: '40px 24px', maxWidth: '800px' }}>
          <div className="no-print" style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setCurrentView('store')}
              className="input-field"
              style={{
                width: 'auto',
                padding: '8px 16px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: '700',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {lang === 'ar' ? '← العودة للمتجر' : '← Back to Store'}
            </button>
          </div>

          <div className="animate-fade dashboard-card" style={{
            padding: '30px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            lineHeight: '1.7',
            textAlign: lang === 'ar' ? 'right' : 'left'
          }}>
            <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '6px' }}>
                {lang === 'ar' ? 'آخر تحديث: يونيو ٢٠٢٦' : 'Last Updated: June 2026'}
              </p>
            </div>

            {lang === 'ar' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>١. مقدمة</h3>
                  <p>
                    نحن في <strong>أرز مارت (Arz-Mart)</strong> نلتزم التزاماً تاماً بحماية خصوصيتك وأمان بياناتك الشخصية. توضح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها عند استخدامك لموقعنا الإلكتروني وتطبيق الهاتف المحمول الخاص بنا.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٢. البيانات التي نجمعها</h3>
                  <p>عند استخدامك لمنصتنا، قد نقوم بجمع المعلومات التالية:</p>
                  <ul style={{ listStyleType: 'disc', paddingRight: '20px', marginTop: '6px' }}>
                    <li><strong>بيانات الحساب الأساسية:</strong> اسم المستخدم وكلمات المرور المشفرة لتمكينك من تسجيل الدخول بأمان.</li>
                    <li><strong>معلومات التوصيل:</strong> رقم الهاتف والعنوان بالتفصيل لإيصال الطلبات النقدية (الدفع عند الاستلام - COD) في السوق اللبناني.</li>
                    <li><strong>بيانات الطلبيات:</strong> تفاصيل المنتجات والأسعار والتاريخ لإدارة سوابق المشتريات والتتبع.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٣. المصادقة البيومترية (بصمة الإصبع)</h3>
                  <p>
                    يتيح لك تطبيق الأندرويد خيار تفعيل تسجيل الدخول باستخدام بصمة الإصبع بشكل اختياري بالكامل. يرجى العلم بأن <strong>بيانات بصمتك الحيوية لا يتم جمعها، أو تخزينها، أو رفعها إلى خوادمنا مطلقاً</strong>. يتم إدارة وتشفير البصمة بالكامل محلياً بواسطة نظام التشغيل ومستشعرات الهاتف المدمجة لضمان خصوصية مطلقة وأمان تام.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٤. أذونات التطبيق والوصول</h3>
                  <p>يتطلب تطبيق الأندرويد الوصول إلى:</p>
                  <ul style={{ listStyleType: 'disc', paddingRight: '20px', marginTop: '6px' }}>
                    <li><strong>شبكة الإنترنت:</strong> للاتصال بخوادم أرز مارت وتنزيل المنتجات وتحديث الطلبات والدردشة المباشرة.</li>
                    <li><strong>المستشعرات البيومترية:</strong> للتحقق من هويتك عبر بصمة الإصبع عند تسجيل الدخول السريع (إذا قمت بتفعيلها اختيارياً).</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٥. أمن وحماية البيانات</h3>
                  <p>
                    نحن نطبق معايير أمنية صارمة وتشفير كامل لكلمات المرور وقاعدة البيانات لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفشاء. نحن لا نبيع بياناتك الشخصية للجهات الخارجية ولا نستخدمها لأغراض تسويقية غير مصرح بها.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٦. حذف الحساب والبيانات</h3>
                  <p>
                    يحق لجميع المستخدمين حذف حساباتهم وبياناتهم الشخصية بالكامل في أي وقت. يمكنك القيام بذلك بسهولة من خلال الانتقال إلى صفحة حسابك الشخصي والضغط على زر <strong>"حذف الحساب نهائياً"</strong>.
                  </p>
                  <p style={{ marginTop: '6px' }}>
                    عند تأكيد حذف الحساب:
                  </p>
                  <ul style={{ listStyleType: 'disc', paddingRight: '20px', marginTop: '6px' }}>
                    <li>يتم مسح معلوماتك الشخصية واسم المستخدم وكلمة المرور والبريد الإلكتروني من خوادمنا بشكل نهائي.</li>
                    <li>يتم حذف كافة المحادثات والرسائل والدردشات الخاصة بك مع الإدارة بالكامل.</li>
                    <li>يتم إلغاء ربط طلبياتك السابقة بهويتك الشخصية وجعلها مجهولة الهوية (Anonymized) للاحتفاظ بالتقارير المالية والمبيعات الإجمالية للشركة فقط دون حفظ أي معلومات تدل عليك.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>٧. التغييرات على هذه السياسة</h3>
                  <p>
                    قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر لتواكب التحديثات القانونية أو التقنية. سيتم نشر أي تغييرات في هذه الصفحة مع تحديث تاريخ السريان المذكور في الأعلى.
                  </p>
                </section>

                <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                  <p>إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية، يمكنك التواصل مع إدارة أرز مارت مباشرة عبر المحادثات الحية المدمجة في التطبيق.</p>
                </section>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>1. Introduction</h3>
                  <p>
                    We at <strong>Arz-Mart</strong> are fully committed to protecting your privacy and securing your personal data. This Privacy Policy describes how we collect, use, and safeguard your data when using our website and mobile application.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>2. Data We Collect</h3>
                  <p>When using our platform, we may collect the following information:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '6px' }}>
                    <li><strong>Basic Account Data:</strong> Username and encrypted password to log in securely.</li>
                    <li><strong>Delivery Information:</strong> Phone number and detailed address to process Cash on Delivery (COD) orders in Lebanon.</li>
                    <li><strong>Order Information:</strong> Details of products, prices, and history to manage your orders.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>3. Biometric Authentication (Fingerprint)</h3>
                  <p>
                    The Android app offers you an option to enable fingerprint quick login. Please note that <strong>your biometric fingerprint data is never collected, stored, or uploaded to our servers</strong>. It is processed and encrypted entirely locally by the device hardware and android system to ensure total privacy and security.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>4. App Permissions</h3>
                  <p>The Android app requires access to:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '6px' }}>
                    <li><strong>Internet Access:</strong> To connect to our servers, download products, and use live chat.</li>
                    <li><strong>Biometric Sensors:</strong> To authenticate your identity via fingerprint (only if explicitly enabled).</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>5. Security and Data Protection</h3>
                  <p>
                    We apply strict security measures and database encryption to protect your personal information. We do not sell or share your personal data with third parties.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>6. Account and Data Deletion</h3>
                  <p>
                    All users have the right to delete their accounts and personal data completely at any time. You can do this easily by going to your profile section and clicking the <strong>"Permanently Delete Account"</strong> button.
                  </p>
                  <p style={{ marginTop: '6px' }}>
                    Upon confirming the account deletion:
                  </p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '6px' }}>
                    <li>Your personal information, username, password, and email are permanently erased from our servers.</li>
                    <li>All your chats and message history with the administration are completely deleted.</li>
                    <li>Your previous orders will be decoupled from your identity and anonymized, preserving them solely for financial and sales reports without any identifying information.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontWeight: '700', marginBottom: '8px' }}>7. Changes to This Policy</h3>
                  <p>
                    We may update this Privacy Policy from time to time. Any changes will be published on this page with the updated last modified date shown above.
                  </p>
                </section>

                <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                  <p>If you have any questions or feedback regarding this policy, feel free to contact Arz-Mart administration using the integrated live chat inside the app.</p>
                </section>
              </div>
            )}
          </div>
        </div>
      ) : currentView === 'login' || currentView === 'register' ? (
        
        /* AUTH VIEWS (LOGIN / REGISTER) */
        <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="animate-fade dashboard-card" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '30px',
            gap: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {currentView === 'login' ? t('login') : t('register')}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>
                {currentView === 'login' ? t('welcome_back') : t('create_account')}
              </p>
            </div>

            {authError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                {authError}
              </div>
            )}

            <form onSubmit={currentView === 'login' ? handleLoginSubmit : handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">{t('username')}</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={lang === 'ar' ? 'اسم المستخدم' : 'Username'}
                />
              </div>

              {currentView === 'register' && (
                <>
                  {/* Full Name */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'ar' ? 'الاسم الثلاثي مثلاً' : 'e.g. John Doe'}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                    <input
                      type="tel"
                      required
                      className="input-field"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="03 123 456"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input
                      type="email"
                      required
                      className="input-field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@mail.com"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="input-label">{t('password')}</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                />
              </div>

              {currentView === 'register' && (
                <div>
                  <label className="input-label">{lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                  <input
                    type="password"
                    required
                    className="input-field"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={lang === 'ar' ? 'أعد كتابة كلمة المرور' : 'Re-enter password'}
                  />
                </div>
              )}

              <button
                type="submit"
                className="input-field"
                style={{ backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}
              >
                {currentView === 'login' ? t('login') : t('register')}
              </button>

              {currentView === 'login' && window.AndroidApp && localStorage.getItem('biometric_username') && (
                <button
                  type="button"
                  onClick={() => {
                    window.isEnrollingBiometrics = false;
                    if (window.AndroidApp) {
                      window.AndroidApp.triggerFingerprintAuth();
                    }
                  }}
                  className="input-field animate-pulse"
                  style={{
                    backgroundColor: 'var(--accent-brand-rgba)',
                    color: 'var(--accent-brand)',
                    border: '1px solid var(--accent-brand)',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Fingerprint size={18} />
                  <span>{lang === 'ar' ? 'تسجيل الدخول بالبصمة' : 'Login with Fingerprint'}</span>
                </button>
              )}
            </form>

            <button
              onClick={() => {
                setAuthError('');
                setUsername('');
                setPassword('');
                setFullName('');
                setPhone('');
                setEmail('');
                setConfirmPassword('');
                setCurrentView(currentView === 'login' ? 'register' : 'login');
              }}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--accent-blue)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '700',
                textAlign: 'center',
                marginTop: '10px'
              }}
            >
              {currentView === 'login' ? t('dont_have_account') : t('already_have_account')}
            </button>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              {lang === 'ar' ? (
                <span>
                  بتسجيل الدخول أو التسجيل، أنت توافق على{' '}
                  <a
                    href="/?view=privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontWeight: '600' }}
                  >
                    سياسة الخصوصية
                  </a>{' '}
                  الخاصة بنا.
                </span>
              ) : (
                <span>
                  By logging in or registering, you agree to our{' '}
                  <a
                    href="/?view=privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontWeight: '600' }}
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              )}
            </div>
          </div>
        </div>

      ) : currentView === 'orders' ? (

        /* USER ORDER HISTORY & PROFILE VIEW */
        <div className="container" style={{ flex: '1', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* User Profile Details Card */}
          {user && (
            <div className="animate-fade dashboard-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={20} color="var(--accent-blue)" />
                  <span>{lang === 'ar' ? 'بيانات الملف الشخصي' : 'User Profile Details'}</span>
                </h3>
                {user.role === 'user' && (
                  <button
                    onClick={handleDeleteAccountClick}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#ef4444';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                      e.target.style.color = '#ef4444';
                    }}
                  >
                    {lang === 'ar' ? 'حذف الحساب نهائياً' : 'Permanently Delete Account'}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
                    {lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.full_name || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
                    {lang === 'ar' ? 'اسم المستخدم' : 'Username'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.username}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
                    {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.phone || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
                    {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.email || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
                    {lang === 'ar' ? 'تاريخ الانضمام' : 'Join Date'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '20px' }}>{t('myOrders')}</h2>
            {userOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                ليس لديك أي طلبات سابقة مسجلة. (No order history found.)
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {userOrders.map((o) => (
                  <div key={o.id} className="dashboard-card" style={{ padding: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong>رقم الطلب: #{o.id}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>{o.tracking_number}</div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: o.status === 'pending' ? 'rgba(239,68,68,0.1)' : o.status === 'processing' ? 'rgba(59,130,246,0.1)' : o.status === 'shipped' ? 'rgba(217,119,6,0.1)' : 'var(--accent-brand-rgba)',
                        color: o.status === 'pending' ? '#ef4444' : o.status === 'processing' ? 'var(--accent-blue)' : o.status === 'shipped' ? '#d97706' : 'var(--accent-brand)'
                      }}>
                        {t(o.status)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        {o.items.map((item, idx) => (
                          <div key={idx} style={{ color: 'var(--text-secondary)' }}>
                            {item.quantity}x {lang === 'ar' ? item.name_ar : item.name_en}
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'end' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{lang === 'ar' ? 'إجمالي الطلبية:' : 'Order Total:'}</span>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-red-gold)' }}>
                          {formatPrice(o.total_usd)}
                        </h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      ) : (
        
        /* STOREFRONT CATALOG VIEW */
        <>
          <div className="container" style={{ flex: '1', paddingBottom: '40px' }}>
            
            {/* Hero Banner section */}
            <Hero />

            {/* Dropdown filters and search toggle */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={toggleFilterDropdown}
                  className="input-field"
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-secondary)',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px'
                  }}
                >
                  <span>{t('filters')}</span>
                  <ChevronDown size={14} style={{ transform: showFilterDropdown ? 'rotate(180deg)' : 'none' }} />
                </button>

                {/* Reset filters button if active */}
                {(selectedCategory || minPrice || maxPrice || minRating) && (
                  <button
                    onClick={clearFilters}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    إعادة تعيين (Clear Filters)
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Filters Form Overlay */}
            {showFilterDropdown && (
              <div className="no-print animate-fade" style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {/* Category Dropdown */}
                <div>
                  <label className="input-label">{t('categories')}</label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input-field"
                  >
                    <option value="">{t('all_categories')}</option>
                    {(() => {
                      const parents = categories.filter(c => !c.parent_id && c.active !== 0);
                      const children = categories.filter(c => c.parent_id && c.active !== 0);
                      
                      const list = [];
                      parents.forEach(p => {
                        list.push({ ...p, depth: 0 });
                        const subcats = children.filter(c => c.parent_id === p.id);
                        subcats.forEach(s => {
                          list.push({ ...s, depth: 1 });
                          const subsub = children.filter(c => c.parent_id === s.id);
                          subsub.forEach(ss => {
                            list.push({ ...ss, depth: 2 });
                          });
                        });
                      });
                      
                      categories.filter(c => c.active !== 0).forEach(c => {
                        if (!list.some(item => item.id === c.id)) {
                          list.push({ ...c, depth: 0 });
                        }
                      });
                      
                      return list.map(c => {
                        const indent = '　'.repeat(c.depth) + (c.depth > 0 ? '↳ ' : '');
                        return (
                          <option key={c.id} value={c.id}>
                            {indent}{lang === 'ar' ? c.name_ar : c.name_en}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>

                {/* Min Price Slider/Input */}
                <div>
                  <label className="input-label">{t('min_rating')}</label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    className="input-field"
                  >
                    <option value="">{lang === 'ar' ? 'كل التقييمات' : 'All Ratings'}</option>
                    <option value="4">4 ★ {t('rating_stars')}</option>
                    <option value="3">3 ★ {t('rating_stars')}</option>
                    <option value="2">2 ★ {t('rating_stars')}</option>
                  </select>
                </div>

                {/* Price Slider range */}
                <div>
                  <label className="input-label">{t('price_range')} (USD)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="Min"
                      className="input-field"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="input-field"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conditional Storefront Renderer */}
            {selectedCategory === '' && !searchVal ? (() => {
              const isRtl = lang === 'ar';
              const findCategoryIdByName = (nameEn, nameAr) => {
                const found = categories.find(c => {
                  const cNameEn = (c.name_en || '').toLowerCase();
                  const cNameAr = (c.name_ar || '').toLowerCase();
                  return cNameEn.includes(nameEn.toLowerCase()) || cNameAr.includes(nameAr.toLowerCase());
                });
                return found ? found.id : '';
              };

              const handleCategoryClick = (catNameEn, catNameAr) => {
                const id = findCategoryIdByName(catNameEn, catNameAr);
                if (id) {
                  setSelectedCategory(id);
                  setSearchVal('');
                } else {
                  // Fallback: search for it
                  setSelectedCategory('');
                  setSearchVal(lang === 'ar' ? catNameAr : catNameEn);
                }
              };

              return (
                <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* --- 1. FEATURE BADGES --- */}
                  <div className="feature-badges-container" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    margin: '10px 0 20px 0'
                  }}>
                    {/* 24/7 Support */}
                    <div className="feature-badge-card" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1',
                      minWidth: '220px',
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-brand-rgba)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-brand)',
                        flexShrink: 0
                      }}>
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {lang === 'ar' ? 'دعم 24/7' : '24/7 Support'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '2px' }}>
                          {lang === 'ar' ? 'خدمة عملاء مميزة' : 'Exceptional support'}
                        </div>
                      </div>
                    </div>

                    {/* Fast Delivery */}
                    <div className="feature-badge-card" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1',
                      minWidth: '220px',
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-brand-rgba)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-brand)',
                        flexShrink: 0
                      }}>
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {lang === 'ar' ? 'توصيل سريع' : 'Fast Delivery'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '2px' }}>
                          {lang === 'ar' ? 'خلال 24-48 ساعة' : 'Within 24-48 hours'}
                        </div>
                      </div>
                    </div>

                    {/* Original Products */}
                    <div className="feature-badge-card" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1',
                      minWidth: '220px',
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-brand-rgba)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-brand)',
                        flexShrink: 0
                      }}>
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="m9 11 2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {lang === 'ar' ? 'منتجات أصلية' : 'Original Products'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: '600', marginTop: '2px' }}>
                          {lang === 'ar' ? 'جودة مضمونة 100%' : '100% Guaranteed Quality'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* --- 2. DYNAMIC CATEGORY CARDS --- */}
                  <div className="featured-categories-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    margin: '10px 0'
                  }}>
                    {categories
                      .filter(cat => !cat.parent_id && cat.active !== 0)
                      .map(cat => {
                        const catImg = cat.image_url 
                          ? (cat.image_url.startsWith('http') || cat.image_url.startsWith('data:') ? cat.image_url : `${apiHost}${cat.image_url}`)
                          : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80';
                        const catName = lang === 'ar' ? cat.name_ar : cat.name_en;

                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setSearchVal('');
                            }}
                            className="category-promo-card"
                            style={{
                              height: '300px',
                              position: 'relative',
                              overflow: 'hidden',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              border: '1px solid var(--border-color)',
                              boxShadow: 'var(--shadow-md)',
                              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                              backgroundColor: 'var(--bg-secondary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-6px)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                          >
                            <div style={{
                              width: '100%',
                              height: '100%',
                              backgroundImage: `url(${catImg})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              transition: 'transform 0.5s ease'
                            }} />
                            
                            <div className="category-card-overlay" style={{
                              position: 'absolute',
                              bottom: '0',
                              left: '0',
                              right: '0',
                              padding: '20px',
                              background: 'linear-gradient(to top, var(--bg-secondary) 25%, transparent 100%)',
                              display: 'flex',
                              flexDirection: isRtl ? 'row-reverse' : 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '12px'
                            }}>
                              <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
                                <h3 className="category-card-title" style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                                  {catName}
                                </h3>
                                <span className="category-card-shop-text" style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>
                                  {lang === 'ar' ? 'تسوق الآن' : 'Shop Now'}
                                </span>
                              </div>
                              <div className="category-card-arrow" style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent-brand)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0
                              }}>
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }}>
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                  <polyline points="12 5 19 12 12 19" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                </div>
              );
            })() : (
              /* --- 2. PRODUCT GRID & NAVIGATION VIEW --- */
              (() => {
                // Determine if selected category has children (is a parent/intermediate category)
                const selectedCatIdNum = Number(selectedCategory);
                const hasSubcategories = selectedCategory !== '' && !isNaN(selectedCatIdNum) && categories.some(c => c.parent_id !== null && c.parent_id !== undefined && Number(c.parent_id) === selectedCatIdNum && c.active !== 0);

                return (
                  <div id="products-catalog-section" className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Back button and Category Details Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      borderBottom: '2px solid var(--border-color)',
                      paddingBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {(() => {
                          const currentCat = categories.find(c => Number(c.id) === selectedCatIdNum);
                          if (currentCat && currentCat.parent_id) {
                            return (
                              <button
                                onClick={() => setSelectedCategory(currentCat.parent_id)}
                                className="input-field"
                                style={{
                                  width: 'auto',
                                  padding: '6px 14px',
                                  backgroundColor: 'var(--bg-tertiary)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  fontWeight: '700',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {lang === 'ar' 
                                  ? `← العودة إلى ${currentCat.parent_name_ar || 'السابق'}` 
                                  : `← Back to ${currentCat.parent_name_en || 'Parent'}`}
                              </button>
                            );
                          } else {
                            return (
                              <button
                                onClick={() => {
                                  setSelectedCategory('');
                                  clearFilters();
                                }}
                                className="input-field"
                                style={{
                                  width: 'auto',
                                  padding: '6px 14px',
                                  backgroundColor: 'var(--bg-tertiary)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  fontWeight: '700',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {lang === 'ar' ? '← العودة للأقسام' : '← Back to Categories'}
                              </button>
                            );
                          }
                        })()}
                        
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>
                          {selectedCategory !== '' ? (
                            categories.find(c => Number(c.id) === selectedCatIdNum) ? (
                              lang === 'ar' 
                                ? categories.find(c => Number(c.id) === selectedCatIdNum).name_ar 
                                : categories.find(c => Number(c.id) === selectedCatIdNum).name_en
                            ) : ''
                          ) : (
                            lang === 'ar' ? 'نتائج البحث' : 'Search Results'
                          )}
                        </h2>
                        {selectedCategory !== '' && (() => {
                          const currentCat = categories.find(c => Number(c.id) === selectedCatIdNum);
                          if (currentCat) {
                            let isExcluded = false;
                            let currentId = Number(selectedCatIdNum);
                            const visited = new Set();
                            
                            while (currentId && !visited.has(currentId)) {
                              visited.add(currentId);
                              const cat = categories.find(c => Number(c.id) === currentId);
                              if (!cat) break;
                              
                              const nameAr = cat.name_ar || '';
                              const nameEn = cat.name_en || '';
                              
                              const matchesPhone = (
                                (nameAr.includes('هاتف') || nameAr.includes('هواتف') || nameAr.includes('موبايل') || nameAr.includes('جوال')) &&
                                !(nameAr.includes('إكسسوار') || nameAr.includes('اكسسوار') || nameAr.includes('شاحن') || nameAr.includes('شواحن') || 
                                  nameAr.includes('سماعة') || nameAr.includes('سماعات') || nameAr.includes('كفر') || nameAr.includes('كفرات') || 
                                  nameAr.includes('جراب') || nameAr.includes('جرابات') || nameAr.includes('سلك') || nameAr.includes('أسلاك') || 
                                  nameAr.includes('حماية') || nameAr.includes('لاصق'))
                              ) || (
                                (nameEn.toLowerCase().includes('phone') || nameEn.toLowerCase().includes('mobile') || nameEn.toLowerCase().includes('smartphone')) &&
                                !(nameEn.toLowerCase().includes('access') || nameEn.toLowerCase().includes('case') || nameEn.toLowerCase().includes('cover') || 
                                  nameEn.toLowerCase().includes('charger') || nameEn.toLowerCase().includes('headphone') || nameEn.toLowerCase().includes('earphone') || 
                                  nameEn.toLowerCase().includes('cable') || nameEn.toLowerCase().includes('screen') || nameEn.toLowerCase().includes('glass') || 
                                  nameEn.toLowerCase().includes('holder') || nameEn.toLowerCase().includes('stand') || nameEn.toLowerCase().includes('powerbank') || 
                                  nameEn.toLowerCase().includes('power bank'))
                              );

                              const matchesLaptop = (
                                nameAr.includes('لابتوب') || nameAr.includes('كمبيوتر')
                              ) || (
                                nameEn.toLowerCase().includes('laptop') || nameEn.toLowerCase().includes('computer')
                              );

                              if (matchesPhone || matchesLaptop) {
                                isExcluded = true;
                                break;
                              }
                              
                              currentId = cat.parent_id ? Number(cat.parent_id) : null;
                            }
                            
                            if (isExcluded) {
                              return (
                                <div style={{
                                  marginTop: '8px',
                                  padding: '10px 14px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  borderRadius: '12px',
                                  color: '#ef4444',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <span>⚠️</span>
                                  <span>
                                    {lang === 'ar' 
                                      ? 'تنويه: الخصم الترحيبي بقيمة 10% لا يشمل المنتجات في هذا القسم.' 
                                      : 'Notice: The 10% welcome discount does not apply to products in this category.'}
                                  </span>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Sub-categories cards — shown when current category has children */}
                    {hasSubcategories && (
                      <div style={{ margin: '8px 0 0 0' }} className="animate-fade">
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>
                          {lang === 'ar' ? 'الأقسام الفرعية' : 'Subcategories'}
                        </h3>
                        <div className="categories-grid">
                          {categories.filter(c => c.parent_id !== null && c.parent_id !== undefined && Number(c.parent_id) === selectedCatIdNum).map((sub) => {
                            const subName = lang === 'ar' ? sub.name_ar : sub.name_en;
                            
                            let bgImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80';
                            if (sub.name_en.toLowerCase().includes('soap') || sub.name_en.toLowerCase().includes('care')) {
                              bgImg = 'https://images.unsplash.com/photo-1607006342466-4aa8d8d32be5?auto=format&fit=crop&w=500&q=80';
                            } else if (sub.name_en.toLowerCase().includes('oil')) {
                              bgImg = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80';
                            }

                            const imageUrl = sub.image_url 
                              ? (sub.image_url.startsWith('http') || sub.image_url.startsWith('data:') ? sub.image_url : `${apiHost}${sub.image_url}`)
                              : bgImg;

                            return (
                              <div
                                key={sub.id}
                                onClick={() => setSelectedCategory(sub.id)}
                                className="dashboard-card animate-fade"
                                style={{
                                  height: 'var(--subcategory-card-height, 180px)',
                                  position: 'relative',
                                  overflow: 'hidden',
                                  borderRadius: '16px',
                                  cursor: 'pointer',
                                  padding: '0',
                                  border: '1px solid var(--border-color)',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-6px)';
                                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                              >
                                {/* Background Cover image */}
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  backgroundImage: `linear-gradient(to top, rgba(10, 14, 23, 0.95) 0%, rgba(10, 14, 23, 0.2) 60%, rgba(10, 14, 23, 0) 100%), url(${imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'
                                }} 
                                />

                                {/* Title text overlay */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '0',
                                  left: '0',
                                  right: '0',
                                  padding: 'var(--category-card-padding, 16px)',
                                  color: 'white',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 'var(--card-btn-gap, 4px)',
                                  zIndex: 5
                                }}>
                                  <h4 style={{ fontSize: 'var(--category-card-title-size, 1.15rem)', fontWeight: '800', margin: '0', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                    {subName}
                                  </h4>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    color: 'var(--accent-red-gold)', 
                                    fontWeight: '700',
                                    display: 'var(--category-card-sub-display, block)'
                                  }}>
                                    {lang === 'ar' ? 'تصفح المنتجات ←' : 'Browse products →'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Products Grid */}
                    {(products.length > 0 || !hasSubcategories) && (
                      <div style={{ marginTop: hasSubcategories ? '30px' : '0' }}>
                        {hasSubcategories && products.length > 0 && (
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>
                            {lang === 'ar' ? 'منتجات هذا القسم' : 'Products in this Category'}
                          </h3>
                        )}
                        
                        {products.length > 0 ? (
                          <div className="categories-grid">
                            {products.map((p) => (
                              <ProductCard 
                                key={p.id} 
                                product={p} 
                                onDetailsClick={setSelectedProduct} 
                                setCurrentView={setCurrentView}
                              />
                            ))}
                          </div>
                        ) : (
                          <div style={{
                            textAlign: 'center',
                            padding: '80px 0',
                            color: 'var(--text-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'center'
                          }}>
                            <FileText size={48} strokeWidth={1} />
                            <p style={{ fontWeight: '600' }}>{t('no_products')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}

          </div>
        </>
      )}

      {/* Footer copyright */}
      <footer className="no-print" style={{
        marginTop: 'auto',
        padding: '20px 0',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-light)'
      }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div>
            &copy; {new Date().getFullYear()} {settings?.app_name || 'Arz-Mart'}. All Rights Reserved. Lebanese Market COD Store.
          </div>
          {settings?.contact_email && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span>{lang === 'ar' ? 'للتواصل والدعم الفني:' : 'Contact & Support:'}</span>
              <a href={`mailto:${settings.contact_email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 'bold' }}>
                {settings.contact_email}
              </a>
            </div>
          )}
          <div>
            <button
              onClick={() => {
                setCurrentView('privacy');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--accent-blue)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              {t('privacy_policy')}
            </button>
          </div>
        </div>
      </footer>

      {/* 4. Product Details Modal */}
      {selectedProduct && (
        <ProductDetails 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onRefresh={fetchProducts}
          setCurrentView={setCurrentView}
        />
      )}

      {/* 5. Cart Drawer overlay */}
      <Cart onCheckoutClick={() => {
        if (!token) {
          alert(lang === 'ar' ? 'يرجى تسجيل الدخول أولاً للمتابعة إلى إكمال الطلب والحصول على خصم 10%!' : 'Please log in first to proceed to checkout and get a 10% discount!');
          setCurrentView('login');
        } else {
          setShowCheckout(true);
        }
      }} />

      {/* 6. Checkout Modal dialog */}
      {showCheckout && (
        <Checkout onClose={() => setShowCheckout(false)} categories={categories} />
      )}

      {/* 7. Live Customer Chat Panel */}
      <Chat />

      {/* 8. PWA Install Notification Banner */}
      <PwaInstallBanner />

    </div>
  );
}
