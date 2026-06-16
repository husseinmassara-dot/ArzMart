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

import { Key, User, FileText, ChevronDown, Check, Star, RefreshCw, Fingerprint, Smartphone, Globe } from 'lucide-react';

export default function App() {
  const { lang, formatPrice, t, apiBase, settings, currency, apiHost } = useApp();
  const { user, login, register, token, logout } = useAuth();
  const { setIsCartOpen, cartItems } = useCart();
  const { isChatOpen, setIsChatOpen } = useChat();

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'store';
  });

  // Catalog states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null); // Detail modal
  const [showCheckout, setShowCheckout] = useState(false);

  // Search & Filter states
  const [searchVal, setSearchVal] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
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
    try {
      let url = `${apiBase}/products?`;
      if (selectedCategory) url += `category_id=${selectedCategory}&`;
      if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;
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

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchVal, minPrice, maxPrice, minRating]);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || 'store';
    const tabParam = params.get('tab');
    
    if (currentView !== viewParam) {
      let url = `/?view=${currentView}`;
      if (currentView === 'admin') {
        const tab = tabParam || 'products';
        url += `&tab=${tab}`;
      }
      window.history.pushState(null, '', url);
    }
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view') || 'store';
      setCurrentView(view);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      <Header 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        searchVal={searchVal} 
        setSearchVal={setSearchVal} 
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
            border: '2px solid #10b981',
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
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
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
                  backgroundColor: '#10b981',
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
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    autocomplete="off" // No usernames hints
                    className="input-field"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingStart: '36px' }}
                  />
                  <User size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                </div>
              </div>

              {currentView === 'register' && (
                <>
                  {/* Full Name */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{ paddingStart: '36px' }}
                        placeholder={lang === 'ar' ? 'الاسم الثلاثي مثلاً' : 'e.g. John Doe'}
                      />
                      <User size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        required
                        className="input-field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        style={{ paddingStart: '36px' }}
                        placeholder="03 123 456"
                      />
                      <Smartphone size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="input-label">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        required
                        className="input-field"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ paddingStart: '36px' }}
                        placeholder="example@mail.com"
                      />
                      <Globe size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="input-label">{t('password')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    autocomplete="new-password" // No username auto-linking
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingStart: '36px' }}
                  />
                  <Key size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                </div>
              </div>

              {currentView === 'register' && (
                <div>
                  <label className="input-label">{lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      required
                      className="input-field"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ paddingStart: '36px' }}
                    />
                    <Key size={16} style={{ position: 'absolute', top: '12px', left: lang === 'ar' ? 'auto' : '12px', right: lang === 'ar' ? '12px' : 'auto', color: 'var(--text-light)' }} />
                  </div>
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
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid #10b981',
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
                        backgroundColor: o.status === 'pending' ? 'rgba(239,68,68,0.1)' : o.status === 'processing' ? 'rgba(59,130,246,0.1)' : o.status === 'shipped' ? 'rgba(217,119,6,0.1)' : 'rgba(16,185,129,0.1)',
                        color: o.status === 'pending' ? '#ef4444' : o.status === 'processing' ? 'var(--accent-blue)' : o.status === 'shipped' ? '#d97706' : '#10b981'
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
                      const parents = categories.filter(c => !c.parent_id);
                      const children = categories.filter(c => c.parent_id);
                      
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
                      
                      categories.forEach(c => {
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
                    <option value="">كل التقييمات</option>
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
            {selectedCategory === '' && !searchVal ? (
              /* --- 1. GRAND CATEGORY CARDS ONLY VIEW (DEFAULT ENTRY POINT) --- */
              <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                  {lang === 'ar' ? 'تصفح أقسام المتجر' : 'Browse Store Categories'}
                </h2>
                
                <div className="categories-grid">
                  {categories.filter(c => !c.parent_id).map((cat) => {
                    const catName = lang === 'ar' ? cat.name_ar : cat.name_en;
                    
                    // Assign realistic category background image
                    let bgImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80'; // Groceries default
                    if (cat.name_en.toLowerCase().includes('soap') || cat.name_en.toLowerCase().includes('care')) {
                      bgImg = 'https://images.unsplash.com/photo-1607006342466-4aa8d8d32be5?auto=format&fit=crop&w=500&q=80'; // Personal Care
                    } else if (cat.name_en.toLowerCase().includes('oil')) {
                      bgImg = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80';
                    }

                    const imageUrl = cat.image_url 
                      ? (cat.image_url.startsWith('http') || cat.image_url.startsWith('data:') ? cat.image_url : `${apiHost}${cat.image_url}`)
                      : bgImg;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="dashboard-card animate-fade"
                        style={{
                          height: '280px', // Grander height
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: '20px', // Extra rounded corners
                          cursor: 'pointer',
                          padding: '0',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-md)',
                          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-8px)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        }}
                      >
                        {/* Background Cover image */}
                        <div style={{
                          width: '100%',
                          height: '100%',
                          backgroundImage: `linear-gradient(to top, rgba(10, 14, 23, 0.95) 0%, rgba(10, 14, 23, 0.3) 60%, rgba(10, 14, 23, 0) 100%), url(${imageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          transition: 'transform 0.5s ease'
                        }} 
                        />

                        {/* Title text overlay */}
                        <div style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          padding: '24px', // Taller padding for luxury look
                          color: 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          zIndex: 5
                        }}>
                          <h3 style={{ fontSize: '1.45rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                            {catName}
                          </h3>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            color: 'var(--accent-red-gold)', 
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {lang === 'ar' ? 'تصفح المنتجات ←' : 'Browse products →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* --- 2. PRODUCT GRID & NAVIGATION VIEW --- */
              <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
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
                      const currentCat = categories.find(c => c.id === parseInt(selectedCategory));
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
                        categories.find(c => c.id === parseInt(selectedCategory)) ? (
                          lang === 'ar' 
                            ? categories.find(c => c.id === parseInt(selectedCategory)).name_ar 
                            : categories.find(c => c.id === parseInt(selectedCategory)).name_en
                        ) : ''
                      ) : (
                        lang === 'ar' ? 'نتائج البحث' : 'Search Results'
                      )}
                    </h2>
                  </div>
                </div>

                  {/* Sub-categories cards if active has children */}
                  {selectedCategory !== '' && categories.filter(c => c.parent_id === parseInt(selectedCategory)).length > 0 && (
                    <div style={{ margin: '24px 0 40px 0' }} className="animate-fade">
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>
                        {lang === 'ar' ? 'الأقسام الفرعية' : 'Subcategories'}
                      </h3>
                      <div className="categories-grid" style={{ marginBottom: '24px' }}>
                        {categories.filter(c => c.parent_id === parseInt(selectedCategory)).map((sub) => {
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
                              className="dashboard-card"
                              style={{
                                height: '180px',
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
                                padding: '16px',
                                color: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                zIndex: 5
                              }}>
                                <h4 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                  {subName}
                                </h4>
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  color: 'var(--accent-red-gold)', 
                                  fontWeight: '700'
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
                <div className="categories-grid">
                  {products.map((p) => (
                    <ProductCard 
                      key={p.id} 
                      product={p} 
                      onDetailsClick={setSelectedProduct} 
                    />
                  ))}
                </div>

                {products.length === 0 && (
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
        />
      )}

      {/* 5. Cart Drawer overlay */}
      <Cart onCheckoutClick={() => setShowCheckout(true)} />

      {/* 6. Checkout Modal dialog */}
      {showCheckout && (
        <Checkout onClose={() => setShowCheckout(false)} />
      )}

      {/* 7. Live Customer Chat Panel */}
      <Chat />

      {/* 8. PWA Install Notification Banner */}
      <PwaInstallBanner />

    </div>
  );
}
