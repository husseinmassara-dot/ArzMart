import React from 'react';
import { useApp } from '../context/AppContext';
import { useCart, getOptionPrice } from '../context/CartContext';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';

export default function Cart({ onCheckoutClick }) {
  const { lang, formatPrice, settings, t, apiHost } = useApp();
  const { 
    cartItems, 
    isCartOpen, 
    setIsCartOpen, 
    updateQuantity, 
    removeFromCart, 
    subtotal, 
    deliveryFee, 
    total 
  } = useCart();

  if (!isCartOpen) return null;

  const freeThreshold = settings ? settings.free_delivery_threshold : 50;
  const remainingForFreeDelivery = freeThreshold - subtotal;

  return (
    <div className="no-print" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 500,
      display: 'flex',
      justifyContent: lang === 'ar' ? 'flex-start' : 'flex-end'
    }} onClick={() => setIsCartOpen(false)}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          borderInlineStart: '1px solid var(--border-color)',
          animation: lang === 'ar' ? 'slideInLeft 0.3s ease-out' : 'slideInRight 0.3s ease-out'
        }}
      >
        {/* Cart Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="var(--accent-blue)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {t('cart')}
            </h2>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            title={t('close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cart Items List */}
        <div style={{
          flex: '1',
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {cartItems.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: 'var(--text-light)',
              textAlign: 'center'
            }}>
              <ShoppingBag size={48} strokeWidth={1} />
              <p style={{ fontWeight: '500' }}>{t('empty_cart')}</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const name = lang === 'ar' ? item.product.name_ar : item.product.name_en;
              const imageUrl = item.product.image_url
                ? (item.product.image_url.startsWith('http') || item.product.image_url.startsWith('data:') ? item.product.image_url : `${apiHost}${item.product.image_url}`)
                : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=100&q=80';

              return (
                <div key={`${item.product.id}_${item.selectedColor || ''}_${item.selectedSize || ''}`} style={{
                  display: 'flex',
                  gap: '12px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '16px',
                  alignItems: 'center'
                }}>
                  {/* Item Image */}
                  <img
                    src={imageUrl}
                    alt={name}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'contain',
                      backgroundColor: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px'
                    }}
                  />

                  {/* Item Details */}
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      lineHeight: '1.3',
                      maxHeight: '34px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {name}
                    </h4>

                    {/* Selected Color / Size */}
                    {(item.selectedColor || item.selectedSize) && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        {item.selectedColor && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{lang === 'ar' ? 'اللون:' : 'Color:'}</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.selectedColor}</span>
                          </span>
                        )}
                        {item.selectedSize && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{lang === 'ar' ? 'القياس:' : 'Size:'}</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.selectedSize}</span>
                          </span>
                        )}
                      </div>
                    )}

                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-red-gold)' }}>
                      {formatPrice(getOptionPrice(item.selectedSize, item.product.price_usd))}
                    </span>
                    
                    {/* Quantity Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedColor, item.selectedSize)}
                        className="input-field"
                        style={{ width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyCenter: 'center', cursor: 'pointer' }}
                      >
                        <Minus size={10} />
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedColor, item.selectedSize)}
                        disabled={item.quantity >= item.product.stock}
                        className="input-field"
                        style={{ width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyCenter: 'center', cursor: item.quantity >= item.product.stock ? 'not-allowed' : 'pointer' }}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.product.id, item.selectedColor, item.selectedSize)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        {cartItems.length > 0 && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Free Delivery Promo Bar */}
            {remainingForFreeDelivery > 0 ? (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px dashed var(--accent-blue)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--accent-blue)',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                {t('free_delivery_hint')} {formatPrice(freeThreshold)} ({t('subtotal')}: {formatPrice(remainingForFreeDelivery)}+)
              </div>
            ) : (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px dashed #10b981',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#10b981',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                🎉 تم تفعيل التوصيل المجاني! (Free Delivery Unlocked!)
              </div>
            )}

            {/* Calculations */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>{t('subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>{t('delivery')}</span>
              <span>{deliveryFee === 0 ? t('free') : formatPrice(deliveryFee)}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.1rem',
              fontWeight: '800',
              color: 'var(--text-primary)',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px',
              marginTop: '4px'
            }}>
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>

            {/* Checkout CTA */}
            <button
              onClick={() => {
                setIsCartOpen(false);
                onCheckoutClick();
              }}
              className="input-field animate-fade"
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                fontSize: '1rem',
                padding: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: '8px',
                marginTop: '8px'
              }}
            >
              {t('checkout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
