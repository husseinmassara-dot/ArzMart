import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useCart, getOptionPrice, getOptionName } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle } from 'lucide-react';

export default function Checkout({ onClose }) {
  const { lang, formatPrice, settings, t, apiBase } = useApp();
  const { token, user } = useAuth();
  const { cartItems, subtotal, deliveryFee, total, clearCart } = useCart();

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  
  // Credit card mockup states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Coupon application state
  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');
  const [couponError, setCouponError] = useState('');

  // Order submission states
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [placedOrderInfo, setPlacedOrderInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Auto-apply welcome discount coupon if user hasn't used it yet
  useEffect(() => {
    if (token && user && user.discount_used === 0 && !appliedCode) {
      setDiscountPercent(10);
      setAppliedCode('WELCOME10');
    }
  }, [token, user, appliedCode]);

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      const code = couponCode.toUpperCase().replace(/\s+/g, '');
      
      if (code === 'WELCOME10') {
        if (!token) {
          setCouponError(lang === 'ar' ? 'يجب تسجيل الدخول لاستخدام خصم الترحيب' : 'Please log in to use the welcome discount');
          return;
        }
        
        // Fetch profile to see if used
        const profileRes = await fetch(`${apiBase}/auth/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.user.discount_used === 0) {
            setDiscountPercent(10);
            setAppliedCode(code);
          } else {
            setCouponError(lang === 'ar' ? 'تم استخدام كود الترحيب مسبقاً' : 'Welcome code has already been used');
          }
        } else {
          setCouponError(lang === 'ar' ? 'خطأ في التحقق من الحساب' : 'Error verifying account status');
        }
      } else {
        // Fetch other coupons from database
        const res = await fetch(`${apiBase}/coupons`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const coupons = await res.json();
          const activeCoupon = coupons.find(c => c.code === code && c.active === 1);
          if (activeCoupon) {
            setDiscountPercent(activeCoupon.discount_percent);
            setAppliedCode(code);
          } else {
            setCouponError(lang === 'ar' ? 'الكود غير صحيح أو منتهي الصلاحية' : 'Invalid or expired coupon code');
          }
        } else {
          // If guest, only WELCOME10 can be verified via backend check if they register, or general coupon check requires token
          setCouponError(lang === 'ar' ? 'عذراً، يجب تسجيل الدخول لاستخدام أكواد الخصم' : 'Sorry, you must log in to use coupons');
        }
      }
    } catch (err) {
      console.error(err);
      setCouponError('Error applying coupon');
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    if (!phone || !address) {
      setCheckoutError(lang === 'ar' ? 'الرجاء ملء رقم الهاتف والعنوان بالتفصيل' : 'Please fill in both phone and address fields');
      return;
    }

    setLoading(true);

    const orderPayload = {
      phone,
      address,
      items: cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null
      })),
      coupon_code: appliedCode || null,
      payment_method: paymentMethod
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (res.ok) {
        setTrackingNumber(data.tracking_number);
        setPlacedOrderInfo(data.order);
        setOrderSuccess(true);
        clearCart();
      } else {
        setCheckoutError(data.error_ar || data.error_en || 'Failed to place order');
      }
    } catch (err) {
      console.error(err);
      setCheckoutError('Error submitting order');
    } finally {
      setLoading(false);
    }
  };

  const discountableSubtotal = cartItems.reduce((sum, item) => {
    if (!item || !item.product) return sum;
    const catAr = item.product.category_name_ar || '';
    const catEn = item.product.category_name_en || '';
    const isPhone = (
      (catAr.includes('هاتف') || catAr.includes('هواتف') || catAr.includes('موبايل') || catAr.includes('جوال')) &&
      !(catAr.includes('إكسسوار') || catAr.includes('اكسسوار') || catAr.includes('شاحن') || catAr.includes('شواحن') || 
        catAr.includes('سماعة') || catAr.includes('سماعات') || catAr.includes('كفر') || catAr.includes('كفرات') || 
        catAr.includes('جراب') || catAr.includes('جرابات') || catAr.includes('سلك') || catAr.includes('أسلاك') || 
        catAr.includes('حماية') || catAr.includes('لاصق'))
    ) || (
      (catEn.toLowerCase().includes('phone') || catEn.toLowerCase().includes('mobile') || catEn.toLowerCase().includes('smartphone')) &&
      !(catEn.toLowerCase().includes('access') || catEn.toLowerCase().includes('case') || catEn.toLowerCase().includes('cover') || 
        catEn.toLowerCase().includes('charger') || catEn.toLowerCase().includes('headphone') || catEn.toLowerCase().includes('earphone') || 
        catEn.toLowerCase().includes('cable') || catEn.toLowerCase().includes('screen') || catEn.toLowerCase().includes('glass') || 
        catEn.toLowerCase().includes('holder') || catEn.toLowerCase().includes('stand') || catEn.toLowerCase().includes('powerbank') || 
        catEn.toLowerCase().includes('power bank'))
    );
    
    if (isPhone && discountPercent === 10) {
      return sum;
    }
    const itemPrice = getOptionPrice(item.selectedSize, item.product.price_usd || 0);
    return sum + itemPrice * (item.quantity || 0);
  }, 0);

  const discountAmount = discountPercent === 10 
    ? discountableSubtotal * 0.1 
    : subtotal * (discountPercent / 100);

  const finalSubtotal = subtotal - discountAmount;
  const finalTotal = finalSubtotal + deliveryFee;

  if (orderSuccess) {
    return (
      <div className="no-print" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div className="animate-scale" style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          padding: '30px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <CheckCircle size={64} color="#10b981" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{t('order_success')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {t('tracking_number')}: <br />
            <strong style={{ fontSize: '1.25rem', color: 'var(--accent-blue)', display: 'block', margin: '8px 0' }}>
              {trackingNumber}
            </strong>
          </p>

          {/* Simple step-based tracking diagram without map */}
          <div style={{
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '10px'
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '12px' }}>{t('track_order')}</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>✓</div>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>{t('pending')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--border-color)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>2</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t('processing')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--border-color)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>3</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t('shipped')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--border-color)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>4</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t('delivered')}</span>
              </div>
              {/* Connect line */}
              <div style={{ position: 'absolute', top: '10px', left: '10%', right: '10%', height: '2px', backgroundColor: 'var(--border-color)', zIndex: 1 }} />
            </div>
          </div>

          <button
            onClick={onClose}
            className="input-field"
            style={{
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="no-print" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }} onClick={onClose}>
      <div 
        className="animate-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '650px',
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
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)' }}>
          {t('checkout_title')}
        </h2>

        {checkoutError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '600' }}>
            {checkoutError}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {/* Form Side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="input-label">{t('phone')}</label>
              <input
                type="tel"
                required
                className="input-field"
                placeholder="e.g. +961 70 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">{t('address')}</label>
              <textarea
                required
                rows={3}
                className="input-field"
                placeholder={lang === 'ar' ? 'المحافظة، المدينة، الشارع، البناية، الطابق...' : 'Governorate, City, Street, Building, Floor...'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ resize: 'none' }}
              />
            </div>

            <div>
              <label className="input-label">{t('payment_method')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="payment"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                  />
                  <span>{t('cod')}</span>
                </label>
                {settings?.online_payment_enabled === 1 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment"
                      value="Online"
                      checked={paymentMethod === 'Online'}
                      onChange={() => setPaymentMethod('Online')}
                    />
                    <span>{t('online')}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Online payment card input mockup */}
            {paymentMethod === 'Online' && (
              <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Card Number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="CVC"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Checkout Summary Side */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              {t('cart')} ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} {t('quantity')})
            </h3>

            {/* Cart list preview */}
            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cartItems.map(item => (
                <div key={`${item.product.id}_${item.selectedColor || ''}_${item.selectedSize || ''}`} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {item.quantity}x {lang === 'ar' ? item.product.name_ar : item.product.name_en}
                    </span>
                    <span style={{ fontWeight: '600' }}>
                      {formatPrice(getOptionPrice(item.selectedSize, item.product.price_usd) * item.quantity)}
                    </span>
                  </div>
                  {(item.selectedColor || item.selectedSize) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1px' }}>
                      {item.selectedColor && (
                        <span>{lang === 'ar' ? `اللون: ${item.selectedColor}` : `Color: ${item.selectedColor}`}</span>
                      )}
                      {item.selectedSize && (
                        <span>{lang === 'ar' ? `القياس: ${getOptionName(item.selectedSize)}` : `Size: ${getOptionName(item.selectedSize)}`}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Coupon Code section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span className="input-label" style={{ margin: 0 }}>{t('coupons')}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. WELCOME10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ padding: '6px 10px' }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="input-field"
                  style={{ width: 'auto', padding: '6px 12px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                >
                  {t('submit')}
                </button>
              </div>
              {couponError && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>{couponError}</span>}
              {appliedCode && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>✓ % {discountPercent} خصم مفعّل ({appliedCode})</span>}
            </div>

            {/* Summary calculations */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{t('subtotal')}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                  <span>خصم {discountPercent}%</span>
                  <span>- {formatPrice(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{t('delivery')}</span>
                <span>{deliveryFee === 0 ? t('free') : formatPrice(deliveryFee)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                <span>{t('total')}</span>
                <span>{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="input-field"
              style={{
                backgroundColor: 'var(--accent-red-gold)',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                padding: '10px 0',
                marginTop: '10px'
              }}
            >
              {loading ? '...' : t('place_order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
