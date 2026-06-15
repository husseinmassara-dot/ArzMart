import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Download, X, Share2 } from 'lucide-react';

export default function PwaInstallBanner() {
  const { t, lang } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      return;
    }

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (isDismissed) {
      return;
    }

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIos(ios);

    if (ios) {
      // Show prompt after 4 seconds on iOS
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // Handle beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after 4 seconds on Android
      setTimeout(() => {
        setIsVisible(true);
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const isRtl = lang === 'ar';

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '460px',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      boxShadow: 'var(--shadow-lg)',
      padding: '16px',
      zIndex: 1999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      direction: isRtl ? 'rtl' : 'ltr',
      animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/logo.png" 
            alt="Arz-Mart Logo" 
            style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1px solid var(--border-color)', objectFit: 'cover' }}
          />
          <div>
            <h4 style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
              {t('pwa_install_title') || (isRtl ? 'تثبيت تطبيق أرز مارت' : 'Install Arz-Mart Store')}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('pwa_install_desc') || (isRtl ? 'تسوّق أسرع وتابع طلباتك بكل سهولة من شاشتك الرئيسية!' : 'Shop faster and track your orders easily from your home screen!')}
            </p>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-light)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s',
            alignSelf: 'flex-start'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <X size={18} />
        </button>
      </div>

      {/* Action / Hint */}
      {isIos ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--bg-tertiary)',
          padding: '12px',
          borderRadius: '10px',
          fontSize: '0.85rem',
          color: 'var(--text-primary)',
          fontWeight: '500',
          border: '1px solid var(--border-color)',
          lineHeight: '1.4'
        }}>
          <Share2 size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>
            {t('pwa_install_ios_hint') || (isRtl ? 'اضغط على زر المشاركة 📥 ثم اختر "إضافة إلى الشاشة الرئيسية"' : 'Tap the Share button 📥 then select "Add to Home Screen"')}
          </span>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          style={{
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.2s, transform 0.1s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--accent-blue-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--accent-blue)'}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
        >
          <Download size={16} />
          {t('pwa_install_btn') || (isRtl ? 'تثبيت التطبيق الآن' : 'Install App Now')}
        </button>
      )}
    </div>
  );
}
