import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useCart, getOptionPrice, getOptionName } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Star, ShoppingCart, X, Images } from 'lucide-react';

function getOptionStock(optionString, defaultStock) {
  if (!optionString) return defaultStock;
  const stockMatch = String(optionString).match(/\[Stock:\s*([0-9]+)\]/);
  if (stockMatch) {
    return parseInt(stockMatch[1], 10);
  }
  return defaultStock;
}

export default function ProductDetails({ product, onClose, onRefresh, setCurrentView }) {
  const { lang, formatPrice, t, apiBase, apiHost } = useApp();
  const { addToCart } = useCart();
  const { token } = useAuth();
  const [qty, setQty] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [userRating, setUserRating] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [fullProduct, setFullProduct] = useState(product); // Will be replaced with fresh fetch
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => {
    return (product && product.colors && product.colors.length > 0) ? product.colors[0] : null;
  });
  const [colorImageUrl, setColorImageUrl] = useState(() => {
    const firstColor = (product && product.colors && product.colors.length > 0) ? product.colors[0] : null;
    return (firstColor && typeof firstColor === 'object') ? (firstColor.image || null) : null;
  });
  const [selectedSize, setSelectedSize] = useState(() => {
    let initialSizes = [];
    if (product && product.sizes) {
      if (Array.isArray(product.sizes)) {
        initialSizes = product.sizes;
      } else if (typeof product.sizes === 'string') {
        try {
          initialSizes = JSON.parse(product.sizes);
        } catch (e) {
          initialSizes = [];
        }
      }
    }
    return initialSizes.length > 0 ? initialSizes[0] : null;
  });

  if (!product) return null;

  const displayProduct = fullProduct || product;

  // Fetch full product data (with all images) when modal opens
  useEffect(() => {
    if (!product?.id) return;
    setActiveImageIndex(0);
    setLoadingImages(true);
    fetch(`${apiBase}/products/${product.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setFullProduct(data);
      })
      .catch(() => {/* fallback to passed product */})
      .finally(() => setLoadingImages(false));
  }, [product?.id, apiBase]);

  useEffect(() => {
    if (selectedSize) {
      const optStock = getOptionStock(selectedSize, displayProduct.stock);
      setQty(q => Math.min(q, Math.max(1, optStock)));
    }
  }, [selectedSize, displayProduct.stock]);

  let parsedSizes = [];
  if (displayProduct && displayProduct.sizes) {
    if (Array.isArray(displayProduct.sizes)) {
      parsedSizes = displayProduct.sizes;
    } else if (typeof displayProduct.sizes === 'string') {
      try {
        parsedSizes = JSON.parse(displayProduct.sizes);
      } catch (e) {
        parsedSizes = [];
      }
    }
  }

  const name = lang === 'ar' ? displayProduct.name_ar : displayProduct.name_en;
  const desc = lang === 'ar' ? displayProduct.description_ar : displayProduct.description_en;
  const categoryName = lang === 'ar' ? displayProduct.category_name_ar : displayProduct.category_name_en;
  
  const rating = displayProduct.rating || 0;
  
  const currentPrice = getOptionPrice(selectedSize, displayProduct.price_usd);
  const currentStock = getOptionStock(selectedSize, displayProduct.stock);
  let adjustedOldPrice = displayProduct.old_price_usd;
  if (displayProduct.old_price_usd && selectedSize) {
    const relativeMatch = String(selectedSize).match(/\(\s*([+-])\s*\$?\s*([0-9.]+)\s*\$?_?\)/);
    if (relativeMatch) {
      const sign = relativeMatch[1];
      const offset = parseFloat(relativeMatch[2]);
      adjustedOldPrice = sign === '-' ? (displayProduct.old_price_usd - offset) : (displayProduct.old_price_usd + offset);
    } else {
      const priceDifference = currentPrice - displayProduct.price_usd;
      adjustedOldPrice = displayProduct.old_price_usd + priceDifference;
    }
  }
  const hasDiscount = adjustedOldPrice && adjustedOldPrice > currentPrice;

  // Use displayProduct.images (fresh from API) for gallery — falls back gracefully
  const imagesList = displayProduct.images && displayProduct.images.length > 0
    ? displayProduct.images
    : (displayProduct.image_url ? [displayProduct.image_url] : []);

  const getFullImageUrl = (img) => {
    if (!img) return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80';
    return img.startsWith('http') || img.startsWith('data:') ? img : `${apiHost}${img}`;
  };

  const safeIndex = Math.min(activeImageIndex, Math.max(0, imagesList.length - 1));
  const activeImageUrl = colorImageUrl ? getFullImageUrl(colorImageUrl) : getFullImageUrl(imagesList[safeIndex]);

  const handleRatingSubmit = async () => {
    try {
      const res = await fetch(`${apiBase}/products/${displayProduct.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: userRating })
      });
      if (res.ok) {
        setRatingSubmitted(true);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Submit rating error:', err);
    }
  };


  return (
    <div className="no-print" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }} onClick={onClose}>
      <div 
        className="animate-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          padding: '24px'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: lang === 'ar' ? 'auto' : '16px',
            left: lang === 'ar' ? '16px' : 'auto',
            border: 'none',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          title={t('close')}
        >
          <X size={18} />
        </button>

        {/* Modal Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '16px'
        }}>
          {/* Product Image Gallery */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              minHeight: '260px',
              position: 'relative'
            }}>
              {loadingImages ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-light)' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '0.8rem' }}>{lang === 'ar' ? 'جارٍ تحميل الصور...' : 'Loading images...'}</span>
                </div>
              ) : (
                <>
                  <img 
                    src={activeImageUrl} 
                    alt={name} 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '260px',
                      objectFit: 'contain',
                      transition: 'opacity 0.2s'
                    }}
                  />
                  {/* Transparent overlay to block browser Visual Search button */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, backgroundColor: 'transparent' }} />
                </>
              )}
              {/* Prev & Next Arrows */}
              {imagesList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveImageIndex(prev => (prev === 0 ? imagesList.length - 1 : prev - 1));
                      setColorImageUrl(null);
                    }}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      zIndex: 2
                    }}
                  >
                    ❮
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveImageIndex(prev => (prev === imagesList.length - 1 ? 0 : prev + 1));
                      setColorImageUrl(null);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      zIndex: 2
                    }}
                  >
                    ❯
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails Row */}
            {imagesList.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                overflowX: 'auto',
                padding: '4px 0'
              }}>
                {imagesList.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveImageIndex(idx);
                      setColorImageUrl(null);
                    }}
                    style={{
                      border: activeImageIndex === idx ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '2px',
                      backgroundColor: 'white',
                      width: '50px',
                      height: '50px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img 
                      src={getFullImageUrl(img)} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categoryName && (
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                {categoryName}
              </span>
            )}

            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.3' }}>
              {name}
            </h2>

            {/* Ratings Overview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex' }}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill={i < Math.round(rating) ? '#fbbf24' : 'none'}
                    color={i < Math.round(rating) ? '#fbbf24' : '#d1d5db'}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {rating.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                ({displayProduct.rating_count || 0} {t('rating_stars')})
              </span>
            </div>

            {/* Price section */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' }}>
              {hasDiscount && (
                <span className="old-price" style={{ fontSize: '1rem' }}>
                  {formatPrice(adjustedOldPrice)}
                </span>
              )}
              <span className="new-price" style={{ fontSize: '1.6rem' }}>
                {formatPrice(currentPrice)}
              </span>
            </div>

            {/* Description */}
            <div style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              maxHeight: '150px',
              overflowY: 'auto',
              padding: '8px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              {desc || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>No description available.</span>}
            </div>

            {/* Color Selector */}
            {displayProduct.colors && displayProduct.colors.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <span className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                  {lang === 'ar' ? 'اللون المتاح:' : 'Available Color:'}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {displayProduct.colors.map((color, idx) => {
                    const colorName = typeof color === 'object' && color !== null ? (color.name || '') : String(color);
                    const colorImage = typeof color === 'object' && color !== null ? (color.image || null) : null;
                    const isSelected = selectedColor === color;
                    
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color);
                          if (colorImage) {
                            setColorImageUrl(colorImage);
                          } else {
                            setColorImageUrl(null);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: colorImage ? '4px 12px 4px 6px' : '6px 16px',
                          borderRadius: '20px',
                          border: isSelected ? '2px solid var(--accent-brand)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--accent-brand)' : 'var(--bg-secondary)',
                          color: isSelected ? 'white' : 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {colorImage && (
                          <img 
                            src={colorImage} 
                            alt="" 
                            style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '1px solid white' : '1px solid var(--border-color)', backgroundColor: 'white' }} 
                          />
                        )}
                        <span>{colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {parsedSizes && parsedSizes.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <span className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                  {lang === 'ar' ? 'الخيار المتاح:' : 'Available Option:'}
                </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {parsedSizes.map(size => {
                      const optStock = getOptionStock(size, displayProduct.stock);
                      const isOutOfStock = optStock <= 0;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          disabled={isOutOfStock}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '20px',
                            border: selectedSize === size ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                            backgroundColor: selectedSize === size ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                            color: selectedSize === size ? 'white' : 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            opacity: isOutOfStock ? 0.5 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {getOptionName(size)}{isOutOfStock ? ` (${lang === 'ar' ? 'غير موجود بإشارة من المدير' : 'Not available by order of the manager'})` : ''}
                        </button>
                      );
                    })}
                  </div>
              </div>
            )}

            {/* Quantity Selector & Add to Cart */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="input-label" style={{ margin: 0 }}>{t('quantity')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="input-field"
                    style={{ width: '36px', height: '36px', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: '700', minWidth: '24px', textAlign: 'center' }}>{qty}</span>
                  <button 
                    onClick={() => setQty(q => Math.min(currentStock, q + 1))}
                    disabled={qty >= currentStock}
                    className="input-field"
                    style={{ width: '36px', height: '36px', padding: 0, cursor: qty >= currentStock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px', height: '100%' }}>
                <span className="input-label" style={{ margin: 0, opacity: 0 }}>Action</span>
                <button
                  onClick={() => {
                    if (!token) {
                      alert(lang === 'ar' 
                        ? 'يرجى تسجيل الدخول أو إنشاء حساب أولاً للحصول على خصم 10% وإكمال الطلب!' 
                        : 'Please login or register first to get a 10% discount and complete your order!');
                      setCurrentView('login');
                      onClose();
                    } else {
                      const finalColor = typeof selectedColor === 'object' && selectedColor !== null ? selectedColor.name : selectedColor;
                      addToCart(displayProduct, qty, finalColor, selectedSize);
                      onClose();
                    }
                  }}
                  disabled={currentStock <= 0}
                  className="input-field product-details-add-btn"
                  style={{
                    backgroundColor: currentStock > 0 ? 'var(--accent-brand)' : 'var(--border-color)',
                    color: currentStock > 0 ? 'white' : 'var(--text-light)',
                    border: 'none',
                    fontWeight: '700',
                    cursor: currentStock > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '36px'
                  }}
                >
                  <ShoppingCart size={16} />
                  <span>{currentStock > 0 ? t('add_to_cart') : (lang === 'ar' ? 'غير موجود بإشارة من المدير' : 'Not available by order of the manager')}</span>
                </button>
              </div>
            </div>

            {/* Rating Section */}
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                {t('rate_product')}
              </span>
              {ratingSubmitted ? (
                <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                  {t('submit')}!
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={userRating}
                    onChange={(e) => setUserRating(parseInt(e.target.value))}
                    className="input-field"
                    style={{ width: '80px', padding: '4px 8px' }}
                  >
                    {[5, 4, 3, 2, 1].map(n => (
                      <option key={n} value={n}>{n} ★</option>
                    ))}
                  </select>
                  <button
                    onClick={handleRatingSubmit}
                    className="input-field"
                    style={{
                      width: 'auto',
                      padding: '4px 12px',
                      backgroundColor: 'var(--accent-red-gold)',
                      color: 'white',
                      border: 'none',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {t('submit')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
