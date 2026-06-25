import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Hero() {
  const { settings, lang, apiHost } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);

  const defaultBanners = [
    {
      image: '/toy_jeep_hero_banner.png',
      title_ar: 'عالم المرح للأطفال',
      title_en: 'Kids Fun World',
      desc_ar: 'سيارات تحكم عن بعد، مكعبات بناء، ألعاب تعليمية، منتجات آمنة وممتعة لعائلة سعيدة',
      desc_en: 'Remote control cars, building blocks, educational toys, safe and fun products for a happy family'
    },
    {
      image: '/promo_banner_bg.png',
      title_ar: 'خصومات حصرية تصل إلى ٥٠٪',
      title_en: 'Exclusive 50% Off Discounts',
      desc_ar: 'عروض كبرى على كافة السلع المنزلية والغذائية والمنتجات المحلية اللبنانية',
      desc_en: 'Mega offers on all grocery, household, and local Lebanese products'
    }
  ];

  const slides = settings?.hero_banners && settings.hero_banners.length > 0
    ? settings.hero_banners
    : defaultBanners;

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  if (slides.length === 0) return null;

  const activeSlide = slides[currentSlide];
  const imageSource = activeSlide.image.startsWith('http') || activeSlide.image.startsWith('data:') || activeSlide.image.startsWith('/')
    ? activeSlide.image 
    : `${apiHost}${activeSlide.image}`;

  const isRtl = lang === 'ar';

  return (
    <div 
      className="no-print animate-scale hero-slider-container" 
      onClick={() => {
        if (activeSlide?.link) {
          window.location.href = activeSlide.link;
        }
      }}
      style={{
        position: 'relative',
        height: '420px',
        width: '100%',
        backgroundColor: '#070a13',
        overflow: 'hidden',
        borderRadius: '24px',
        margin: '20px 0',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: activeSlide?.link ? 'pointer' : 'default'
      }}
    >
      {/* Slide Image Background with overlay gradient */}
      <div style={{
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(to ${isRtl ? 'left' : 'right'}, rgba(7, 10, 19, 0.95) 30%, rgba(7, 10, 19, 0.4) 60%, rgba(7, 10, 19, 0.1) 100%), url(${imageSource})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }} />

      {/* Slide Text Content Overlay - positioned on the right for Arabic, left for English */}
      <div style={{
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: isRtl ? 'auto' : '50px',
        right: isRtl ? '50px' : 'auto',
        width: '45%',
        minWidth: '280px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        textAlign: isRtl ? 'right' : 'left',
        gap: '16px',
        zIndex: 5
      }} className="animate-fade hero-slider-content">
        <h1 className="hero-slider-title" style={{
          fontSize: '2.6rem',
          fontWeight: '900',
          lineHeight: '1.25',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {isRtl ? activeSlide.title_ar : activeSlide.title_en}
        </h1>
        
        <p className="hero-slider-desc" style={{
          fontSize: '1.05rem',
          fontWeight: '500',
          color: 'rgba(255, 255, 255, 0.8)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          lineHeight: '1.6',
          margin: 0
        }}>
          {isRtl ? activeSlide.desc_ar : activeSlide.desc_en}
        </p>

        {/* Green "Shop Now" Button with shopping bag icon */}
        <button 
          className="hero-slider-button"
          style={{
            backgroundColor: 'var(--accent-brand)',
            color: 'white',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '12px',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px var(--accent-brand-shadow-lg)',
            transition: 'transform 0.2s, background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-brand-hover)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-brand)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span>{isRtl ? 'تسوق الآن' : 'Shop Now'}</span>
        </button>
      </div>

      {/* Navigation Arrows - Circular White Buttons */}
      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="hero-slider-arrow hero-slider-arrow-prev"
            style={{
              position: 'absolute',
              top: '50%',
              left: '20px',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1)'}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="hero-slider-arrow hero-slider-arrow-next"
            style={{
              position: 'absolute',
              top: '50%',
              right: '20px',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1)'}
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Slide Indicators - bottom dots (active green, inactive white) */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
              style={{
                width: currentSlide === i ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: currentSlide === i ? 'var(--accent-brand)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
