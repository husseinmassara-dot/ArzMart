import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useCart, getOptionPrice } from '../context/CartContext';
import { Star, ShoppingCart, X } from 'lucide-react';

function getOptionName(optionString) {
  if (!optionString) return '';
  return optionString.replace(/\s*\(\s*[+-]?\s*\$?\s*[0-9.]+\s*\$?_?\)/g, '').trim();
}

export default function ProductDetails({ product, onClose, onRefresh }) {
  const { lang, formatPrice, t, apiBase, apiHost } = useApp();
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [userRating, setUserRating] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => {
    return (product && product.colors && product.colors.length > 0) ? product.colors[0] : null;
  });
  const [selectedSize, setSelectedSize] = useState(() => {
    return (product && product.sizes && product.sizes.length > 0) ? product.sizes[0] : null;
  });

  if (!product) return null;

  const name = lang === 'ar' ? product.name_ar : product.name_en;
  const desc = lang === 'ar' ? product.description_ar : product.description_en;
  const categoryName = lang === 'ar' ? product.category_name_ar : product.category_name_en;
  
  const rating = product.rating || 0;
  
  const currentPrice = getOptionPrice(selectedSize, product.price_usd);
  let adjustedOldPrice = product.old_price_usd;
  if (product.old_price_usd && selectedSize) {
    const relativeMatch = selectedSize.match(/\(\s*([+-])\s*\$?\s*([0-9.]+)\s*\$?_?\)/);
    if (relativeMatch) {
      const sign = relativeMatch[1];
      const offset = parseFloat(relativeMatch[2]);
      adjustedOldPrice = sign === '-' ? (product.old_price_usd - offset) : (product.old_price_usd + offset);
    } else {
      const priceDifference = currentPrice - product.price_usd;
      adjustedOldPrice = product.old_price_usd + priceDifference;
    }
  }
  const hasDiscount = adjustedOldPrice && adjustedOldPrice > currentPrice;

  const imagesList = product.images && product.images.length > 0
    ? product.images
    : (product.image_url ? [product.image_url] : []);

  const getFullImageUrl = (img) => {
    if (!img) return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80';
    return img.startsWith('http') || img.startsWith('data:') ? img : `${apiHost}${img}`;
  };

  const activeImageUrl = getFullImageUrl(imagesList[activeImageIndex]);

  const handleRatingSubmit = async () => {
    try {
      const res = await fetch(`${apiBase}/products/${product.id}/rate`, {
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
              
              {/* Prev & Next Arrows */}
              {imagesList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex(prev => (prev === 0 ? imagesList.length - 1 : prev - 1))}
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
                    onClick={() => setActiveImageIndex(prev => (prev === imagesList.length - 1 ? 0 : prev + 1))}
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
                    onClick={() => setActiveImageIndex(idx)}
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
                ({product.rating_count || 0} {t('rating_stars')})
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
            {product.colors && product.colors.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <span className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                  {lang === 'ar' ? 'اللون المتاح:' : 'Available Color:'}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {product.colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        border: selectedColor === color ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                        backgroundColor: selectedColor === color ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                        color: selectedColor === color ? 'white' : 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <span className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                  {lang === 'ar' ? 'الخيار المتاح:' : 'Available Option:'}
                </span>
                {product.sizes.length >= 4 ? (
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {product.sizes.map(size => {
                      const optPrice = getOptionPrice(size, product.price_usd);
                      const priceDiff = optPrice - product.price_usd;
                      let priceLabel = '';
                      if (priceDiff > 0) {
                        priceLabel = ` (+${formatPrice(priceDiff)})`;
                      } else if (priceDiff < 0) {
                        priceLabel = ` (-${formatPrice(Math.abs(priceDiff))})`;
                      }
                      return (
                        <option key={size} value={size}>
                          {getOptionName(size)}{priceLabel}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {product.sizes.map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '20px',
                          border: selectedSize === size ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                          backgroundColor: selectedSize === size ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                          color: selectedSize === size ? 'white' : 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {getOptionName(size)}
                      </button>
                    ))}
                  </div>
                )}
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
                    onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                    disabled={qty >= product.stock}
                    className="input-field"
                    style={{ width: '36px', height: '36px', padding: 0, cursor: qty >= product.stock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px', height: '100%' }}>
                <span className="input-label" style={{ margin: 0, opacity: 0 }}>Action</span>
                <button
                  onClick={() => {
                    addToCart(product, qty, selectedColor, selectedSize);
                    onClose();
                  }}
                  disabled={product.stock <= 0}
                  className="input-field"
                  style={{
                    backgroundColor: product.stock > 0 ? 'var(--accent-blue)' : 'var(--border-color)',
                    color: product.stock > 0 ? 'white' : 'var(--text-light)',
                    border: 'none',
                    fontWeight: '700',
                    cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '36px'
                  }}
                >
                  <ShoppingCart size={16} />
                  <span>{t('add_to_cart')}</span>
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
