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

  const isRtl = lang === 'ar';

  const getGlowColor = (slide, index) => {
    const text = ((slide.title_ar || '') + (slide.title_en || '')).toLowerCase();
    if (text.includes('kids') || text.includes('أطفال') || text.includes('مرح') || text.includes('fun')) {
      return 'rgba(16, 185, 129, 0.22)'; // Emerald green glow
    }
    if (text.includes('discount') || text.includes('خصم') || text.includes('offer') || text.includes('عروض')) {
      return 'rgba(239, 68, 68, 0.22)'; // Coral red/amber glow
    }
    const presets = [
      'rgba(59, 130, 246, 0.22)',  // Blue
      'rgba(168, 85, 247, 0.22)', // Purple
      'rgba(236, 72, 153, 0.22)'  // Pink
    ];
    return presets[index % presets.length];
  };

  return (
    <div 
      className="no-print animate-scale hero-slider-container" 
      style={{
        position: 'relative',
        height: '420px',
        width: '100%',
        backgroundColor: '#070a13',
        overflow: 'hidden',
        borderRadius: '24px',
        margin: '20px 0',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      {slides.map((slide, index) => {
        const isActive = index === currentSlide;
        const slideImageSource = slide.image.startsWith('http') || slide.image.startsWith('data:') || slide.image.startsWith('/')
          ? slide.image 
          : `${apiHost}${slide.image}`;
        
        const glowColor = getGlowColor(slide, index);
          
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: isActive ? 1 : 0,
              visibility: isActive ? 'visible' : 'hidden',
              transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1), visibility 1.2s',
              zIndex: isActive ? 1 : 0
            }}
          >
            {/* Background Image with Parallax Slide-Scale effect */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `linear-gradient(to ${isRtl ? 'left' : 'right'}, rgba(7, 10, 19, 0.8) 25%, rgba(7, 10, 19, 0.3) 60%, rgba(7, 10, 19, 0.1) 100%), url(${slideImageSource})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transform: isActive 
                  ? 'scale(1.03) translate(0, 0)' 
                  : `scale(1.1) translate(${isRtl ? '-25px' : '25px'}, 0)`,
                transition: 'transform 1.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 1.4s'
              }} 
            />

            {/* Dynamic Ambient Glow Behind Card */}
            <div style={{
              position: 'absolute',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(50px)',
              top: '50%',
              left: isRtl ? 'auto' : '80px',
              right: isRtl ? '80px' : 'auto',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 2,
              opacity: isActive ? 1 : 0,
              transition: 'opacity 1.2s ease-in-out'
            }} />

            {/* Floating Glassmorphic Text Card */}
            <div 
              onClick={() => {
                if (slide?.link) {
                  window.location.href = slide.link;
                }
              }}
              style={{
                position: 'absolute',
                top: '50%',
                left: isRtl ? 'auto' : '60px',
                right: isRtl ? '60px' : 'auto',
                transform: isActive ? 'translateY(-50%) scale(1)' : 'translateY(-40%) scale(0.92)',
                width: '45%',
                minWidth: '320px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRtl ? 'right' : 'left',
                gap: '20px',
                zIndex: 5,
                padding: '36px',
                borderRadius: '24px',
                backgroundColor: 'rgba(10, 15, 30, 0.55)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
                cursor: slide?.link ? 'pointer' : 'default',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s, transform 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s'
              }} 
              className="hero-slider-content-card"
            >
              <h1 className="hero-slider-title" style={{
                fontSize: '2.5rem',
                fontWeight: '900',
                lineHeight: '1.25',
                textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: 0
              }}>
                {isRtl ? slide.title_ar : slide.title_en}
              </h1>
              
              <p className="hero-slider-desc" style={{
                fontSize: '1.02rem',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.82)',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                lineHeight: '1.6',
                margin: 0
              }}>
                {isRtl ? slide.desc_ar : slide.desc_en}
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
                  transition: 'transform 0.2s, background-color 0.2s',
                  alignSelf: 'flex-start'
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
          </div>
        );
      })}

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
              transition: 'transform 0.2s, background-color 0.2s',
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
              transition: 'transform 0.2s, background-color 0.2s',
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
