import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Hero() {
  const { settings, lang, apiHost } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);

  const defaultBanners = [
    {
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
      title_ar: 'عروض الصيف الكبرى في أرز مارت',
      title_en: 'Summer Mega Sales at Arz-Mart',
      desc_ar: 'خصومات حصرية تصل إلى ٥٠٪ على كافة السلع الغذائية والمحلية اللبنانية',
      desc_en: 'Exclusive discounts up to 50% on all grocery and local Lebanese goods'
    },
    {
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
      title_ar: 'توصيل سريع وبأسعار مناسبة',
      title_en: 'Fast & Affordable Delivery',
      desc_ar: 'خدمة توصيل ممتازة إلى كافة المناطق اللبنانية مع إمكانية التوصيل المجاني',
      desc_en: 'Excellent delivery service to all Lebanese regions with free delivery option'
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
  const imageSource = activeSlide.image.startsWith('http') 
    ? activeSlide.image 
    : `${apiHost}${activeSlide.image}`;

  return (
    <div className="no-print" style={{
      position: 'relative',
      height: '420px',
      width: '100%',
      backgroundColor: '#0f172a',
      overflow: 'hidden',
      borderRadius: '16px',
      margin: '20px 0',
      boxShadow: 'var(--shadow-md)'
    }}>
      {/* Slide Image Background */}
      <div style={{
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(to top, rgba(10, 14, 23, 0.85), rgba(10, 14, 23, 0.4)), url(${imageSource})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 0.5s ease-in-out'
      }} />

      {/* Slide Text Content Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '40px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 5
      }} className="animate-fade">
        <h1 style={{
          fontSize: '2.4rem',
          fontWeight: '800',
          textShadow: '0 2px 4px rgba(0,0,0,0.6)',
          lineHeight: '1.2'
        }}>
          {lang === 'ar' ? activeSlide.title_ar : activeSlide.title_en}
        </h1>
        <p style={{
          fontSize: '1.1rem',
          fontWeight: '500',
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '650px',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)'
        }}>
          {lang === 'ar' ? activeSlide.desc_ar : activeSlide.desc_en}
        </p>
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            style={{
              position: 'absolute',
              top: '50%',
              left: '20px',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.8)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.5)'}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={handleNext}
            style={{
              position: 'absolute',
              top: '50%',
              right: '20px',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.8)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.5)'}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Slide Indicators */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: currentSlide === i ? 'var(--accent-blue)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
