import React from 'react';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { Star, ShoppingCart, Eye } from 'lucide-react';

export default function ProductCard({ product, onDetailsClick }) {
  const { lang, formatPrice, t, apiHost } = useApp();
  const { addToCart } = useCart();

  const name = lang === 'ar' ? product.name_ar : product.name_en;
  const categoryName = lang === 'ar' ? product.category_name_ar : product.category_name_en;
  
  // Rating calculation
  const rating = product.rating || 0;

  const hasDiscount = product.old_price_usd && product.old_price_usd > product.price_usd;

  const imageUrl = product.image_url 
    ? (product.image_url.startsWith('http') || product.image_url.startsWith('data:') ? product.image_url : `${apiHost}${product.image_url}`)
    : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';

  // Count how many images this product has
  const imageCount = product.images && product.images.length > 1 ? product.images.length : null;

  return (
    <div 
      onClick={() => onDetailsClick(product)}
      className="dashboard-card animate-fade" 
      style={{
        overflow: 'hidden',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer'
      }}
    >
      {/* Product Image Wrapper */}
      <div 
        style={{
          width: '100%',
          height: '200px',
          overflow: 'hidden',
          backgroundColor: 'white',
          position: 'relative'
        }}
      >
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'transform 0.3s ease'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        />
        {/* Discount Badge */}
        {hasDiscount && (
          <span style={{
            position: 'absolute',
            top: '10px',
            right: lang === 'ar' ? 'auto' : '10px',
            left: lang === 'ar' ? '10px' : 'auto',
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '2px 8px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            borderRadius: '4px',
            zIndex: 10
          }}>
            % {Math.round(((product.old_price_usd - product.price_usd) / product.old_price_usd) * 100)} -
          </span>
        )}
        {/* Multi-image badge */}
        {imageCount && (
          <span style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '2px 7px',
            fontSize: '0.7rem',
            fontWeight: '600',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            backdropFilter: 'blur(4px)',
            zIndex: 10
          }}>
            🖼️ {imageCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: '1'
      }}>
        {/* Category Label */}
        {categoryName && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--accent-blue)',
            textTransform: 'uppercase'
          }}>
            {categoryName}
          </span>
        )}

        {/* Title */}
        <h3 
          style={{
            fontSize: '1rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            lineHeight: '1.4',
            height: '42px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {name}
        </h3>

        {/* Rating Stars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={14}
              fill={i < Math.round(rating) ? '#fbbf24' : 'none'}
              color={i < Math.round(rating) ? '#fbbf24' : '#d1d5db'}
            />
          ))}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginInlineStart: '4px' }}>
            ({product.rating_count || 0})
          </span>
        </div>

        {/* Pricing */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 'auto' }}>
          {hasDiscount && (
            <span className="old-price">
              {formatPrice(product.old_price_usd)}
            </span>
          )}
          <span className="new-price" style={{ fontSize: '1.25rem' }}>
            {formatPrice(product.price_usd)}
          </span>
        </div>

        {/* Stock status indicator */}
        {product.stock <= 0 && (
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ef4444', marginTop: '4px' }}>
            {lang === 'ar' ? 'غير موجود بإشارة من المدير' : 'Not available by order of the manager'}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetailsClick(product);
            }}
            className="input-field"
            style={{
              padding: '8px',
              width: '40px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: '8px'
            }}
            title={t('product_details')}
          >
            <Eye size={16} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            disabled={product.stock <= 0}
            className="input-field animate-fade"
            style={{
              padding: '8px 12px',
              flex: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
              border: 'none',
              backgroundColor: product.stock > 0 ? 'var(--accent-blue)' : 'var(--border-color)',
              color: product.stock > 0 ? 'white' : 'var(--text-light)',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
          >
            <ShoppingCart size={14} />
            <span>{t('add_to_cart')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
