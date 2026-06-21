import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Truck, CheckCircle2, XCircle, Eye, Phone, MapPin, DollarSign, Calendar, Clock } from 'lucide-react';
import { getOptionName } from '../../context/CartContext';

export default function AdminDelivery() {
  const { lang, formatPrice, apiBase, apiHost } = useApp();
  const { token } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemsOrder, setSelectedItemsOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching delivery orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    const confirmMsg = newStatus === 'delivered'
      ? (lang === 'ar' ? 'هل تم تسليم هذه الطلبية بنجاح وتحصيل المبلغ؟' : 'Has this order been successfully delivered and payment collected?')
      : (lang === 'ar' ? 'هل تريد إلغاء الطلبية وتثبيت فشل التوصيل؟' : 'Do you want to cancel the order and mark delivery as failed?');

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${apiBase}/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders();
      } else {
        alert(lang === 'ar' ? 'خطأ في تحديث الحالة' : 'Error updating order status');
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  // Filter orders for delivery employee: only show processing or shipped orders
  const deliveryOrders = orders.filter(o => o.status === 'processing' || o.status === 'shipped');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            {lang === 'ar' ? 'قسم توصيل الطلبيات' : 'Order Deliveries Control'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '4px 0 0 0' }}>
            {lang === 'ar' ? 'عرض وإدارة شحنات التوصيل النشطة للعملاء' : 'View and manage active delivery shipments for customers'}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="input-field animate-scale"
          style={{
            width: 'auto',
            padding: '8px 16px',
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          {loading ? (lang === 'ar' ? 'جاري التحميل...' : 'Loading...') : (lang === 'ar' ? '↻ تحديث القائمة' : '↻ Refresh List')}
        </button>
      </div>

      {/* Orders List / Grid */}
      {deliveryOrders.length === 0 ? (
        <div className="dashboard-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
          <Truck size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            {lang === 'ar' ? 'لا توجد شحنات توصيل حالياً' : 'No pending deliveries at the moment'}
          </h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {lang === 'ar' ? 'تظهر هنا الطلبيات التي تم تأكيدها وطباعة فواتيرها لتوصيلها.' : 'Orders confirmed and ready to deliver will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {deliveryOrders.map(o => {
            const totalLbp = o.total_usd * (o.exchange_rate || 89500);
            return (
              <div
                key={o.id}
                className="dashboard-card animate-fade"
                style={{
                  padding: '20px',
                  borderInlineStart: o.status === 'shipped' ? '4px solid #d97706' : '4px solid var(--accent-blue)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'transform 0.2s ease',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '12px'
                }}
              >
                {/* Card Top: Order ID & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 'bold' }}>#{o.id}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontFamily: 'monospace', marginInlineStart: '8px' }}>({o.tracking_number})</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: o.status === 'shipped' ? 'rgba(217,119,6,0.1)' : 'rgba(59,130,246,0.1)',
                    color: o.status === 'shipped' ? '#d97706' : 'var(--accent-blue)'
                  }}>
                    {o.status === 'shipped' ? (lang === 'ar' ? 'خارج للتوصيل' : 'OUT FOR DELIVERY') : (lang === 'ar' ? 'قيد التحضير' : 'PROCESSING')}
                  </span>
                </div>

                {/* Customer Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {o.user_name}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Phone size={14} color="var(--text-light)" />
                    <a href={`tel:${o.phone}`} style={{ textDecoration: 'none', color: 'var(--accent-blue)', fontWeight: '700', direction: 'ltr' }}>
                      {o.phone}
                    </a>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-secondary)' }}>
                    <MapPin size={14} color="var(--text-light)" style={{ marginTop: '3px', flexShrink: 0 }} />
                    <span>{o.address}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                    <Calendar size={13} />
                    <span>{new Date(o.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Prices & Calculations */}
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>{lang === 'ar' ? 'المبلغ المطلوب تحصيله:' : 'Amount to Collect:'}</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-red-gold)', fontWeight: '900' }}>
                      {formatPrice(o.total_usd)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                    {totalLbp.toLocaleString()} ل.ل.
                  </div>
                </div>

                {/* Actions Grid */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {/* View items button */}
                  <button
                    onClick={() => setSelectedItemsOrder(o)}
                    className="input-field animate-scale"
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={14} />
                    <span>{lang === 'ar' ? 'عرض السلع' : 'Items'}</span>
                  </button>

                  {/* Mark as Shipped button (Out for delivery) */}
                  {o.status === 'processing' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'shipped')}
                      className="input-field animate-scale"
                      style={{
                        flex: 2,
                        padding: '8px 0',
                        backgroundColor: '#d97706',
                        color: 'white',
                        border: 'none',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Truck size={14} />
                      <span>{lang === 'ar' ? 'تحميل للشحن' : 'Ship Order'}</span>
                    </button>
                  )}

                  {/* Mark as Delivered / Cancelled */}
                  {o.status === 'shipped' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(o.id, 'delivered')}
                        className="input-field animate-scale"
                        style={{
                          flex: 2,
                          padding: '8px 0',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>{lang === 'ar' ? 'تم التسليم' : 'Delivered'}</span>
                      </button>

                      <button
                        onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                        className="input-field animate-scale"
                        style={{
                          width: '38px',
                          padding: '8px 0',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={lang === 'ar' ? 'فشل التوصيل / إلغاء' : 'Failed / Cancel'}
                      >
                        <XCircle size={15} />
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Items Viewer Modal */}
      {selectedItemsOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setSelectedItemsOrder(null)}
        >
          <div
            className="animate-scale"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {lang === 'ar' ? `تفاصيل سلع الطلبية #${selectedItemsOrder.id}` : `Items details for Order #${selectedItemsOrder.id}`}
              </h4>
              <button
                onClick={() => setSelectedItemsOrder(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedItemsOrder.items.map((item, idx) => {
                let resolvedImg = item.image_url || '';
                if (resolvedImg && resolvedImg.startsWith('[')) {
                  try {
                    const parsed = JSON.parse(resolvedImg);
                    resolvedImg = parsed[0] || '';
                  } catch (e) {}
                }
                const itemImg = resolvedImg 
                  ? (resolvedImg.startsWith('http') || resolvedImg.startsWith('data:') ? resolvedImg : `${apiHost}${resolvedImg}`)
                  : '';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      borderBottom: idx === selectedItemsOrder.items.length - 1 ? 'none' : '1px dashed var(--border-color)',
                      paddingBottom: '10px'
                    }}
                  >
                    {itemImg ? (
                      <img
                        src={itemImg}
                        alt="Product"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}></div>
                    )}
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                        {lang === 'ar' ? item.name_ar : item.name_en}
                      </strong>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        <span>{lang === 'ar' ? `الكمية: ${item.quantity}` : `Qty: ${item.quantity}`}</span>
                        {item.selectedColor && (
                          <span>{lang === 'ar' ? `اللون: ${item.selectedColor}` : `Color: ${item.selectedColor}`}</span>
                        )}
                        {item.selectedSize && (
                          <span>{lang === 'ar' ? `القياس: ${getOptionName(item.selectedSize)}` : `Size: ${getOptionName(item.selectedSize)}`}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedItemsOrder(null)}
              className="input-field"
              style={{
                width: '100%',
                padding: '10px 0',
                backgroundColor: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
