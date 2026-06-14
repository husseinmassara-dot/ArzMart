import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Printer, Eye, CheckCircle2 } from 'lucide-react';

export default function AdminOrders() {
  const { lang, formatPrice, apiBase, settings, apiHost } = useApp();
  const { token, user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active', 'delivered', 'cancelled'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [hidePricesInPrint, setHidePricesInPrint] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${apiBase}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
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
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (hidePrices = false) => {
    setHidePricesInPrint(hidePrices);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleDeleteOrder = async (id) => {
    const confirmDelete = window.confirm(lang === 'ar' ? 'هل أنت متأكد من نقل هذه الطلبية إلى الأرشيف؟' : 'Are you sure you want to move this order to the archive?');
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${apiBase}/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrders();
        setSelectedOrder(null);
      } else {
        const errData = await res.json();
        alert(lang === 'ar' ? errData.error_ar : errData.error_en);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeSubTab === 'active') {
      return order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'archived';
    } else if (activeSubTab === 'delivered') {
      return order.status === 'delivered';
    } else if (activeSubTab === 'cancelled') {
      return order.status === 'cancelled';
    } else {
      return order.status === 'archived';
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub tabs */}
      <div className="no-print" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('active')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: activeSubTab === 'active' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: activeSubTab === 'active' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.85rem'
          }}
        >
          الطلبيات النشطة ({orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'archived').length})
        </button>
        <button
          onClick={() => setActiveSubTab('delivered')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: activeSubTab === 'delivered' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: activeSubTab === 'delivered' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.85rem'
          }}
        >
          الطلبيات المسلمة ({orders.filter(o => o.status === 'delivered').length})
        </button>
        <button
          onClick={() => setActiveSubTab('cancelled')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: activeSubTab === 'cancelled' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: activeSubTab === 'cancelled' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.85rem'
          }}
        >
          الطلبيات الملغاة ({orders.filter(o => o.status === 'cancelled').length})
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('archive')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: activeSubTab === 'archive' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: activeSubTab === 'archive' ? 'white' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}
          >
            أرشيف الطلبيات ({orders.filter(o => o.status === 'archived').length})
          </button>
        )}
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Left Side: Orders List */}
        <div className="no-print dashboard-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800' }}>قائمة الطلبيات</h4>
          {filteredOrders.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              لا يوجد طلبيات في هذا القسم حالياً.
            </div>
          ) : (
            filteredOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: selectedOrder?.id === o.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{o.user_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>{o.tracking_number}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {new Date(o.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-red-gold)' }}>
                    {formatPrice(o.total_usd)}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: o.status === 'pending' ? 'rgba(239,68,68,0.1)' : o.status === 'processing' ? 'rgba(59,130,246,0.1)' : o.status === 'shipped' ? 'rgba(217,119,6,0.1)' : o.status === 'cancelled' ? 'rgba(107,114,128,0.1)' : 'rgba(16,185,129,0.1)',
                    color: o.status === 'pending' ? '#ef4444' : o.status === 'processing' ? 'var(--accent-blue)' : o.status === 'shipped' ? '#d97706' : o.status === 'cancelled' ? '#6b7280' : '#10b981'
                  }}>
                    {o.status === 'cancelled' ? (lang === 'ar' ? 'ملغاة' : 'CANCELLED') : o.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Order Detail / Invoicing Panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selectedOrder ? (
            <div className="dashboard-card" style={{ padding: '24px', position: 'sticky', top: '90px' }}>
              
              {/* Actions Header */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handlePrint(false)}
                    className="input-field"
                    style={{ width: 'auto', padding: '6px 12px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <Printer size={14} />
                    <span>طباعة تفاصيل الطلب</span>
                  </button>
                  <button
                    onClick={() => handlePrint(true)}
                    className="input-field"
                    style={{ width: 'auto', padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <Printer size={14} />
                    <span>طباعة بدون سعر</span>
                  </button>
                  {user?.role === 'admin' && selectedOrder.status !== 'archived' && (
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="input-field animate-scale"
                      style={{ width: 'auto', padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                    >
                      <span>أرشفة الطلبية</span>
                    </button>
                  )}
                </div>

                {((selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'archived') || 
                  (selectedOrder.status === 'archived' && user?.role === 'admin')) && (
                  <select
                    className="input-field"
                    style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                  >
                    <option value="pending">قيد الانتظار (Pending)</option>
                    <option value="processing">قيد التحضير (Processing)</option>
                    <option value="shipped">تم الشحن (Shipped)</option>
                    <option value="delivered">تم التسليم (Delivered)</option>
                    {user?.role === 'admin' && (
                      <option value="cancelled">ملغاة (Cancelled)</option>
                    )}
                    {user?.role === 'admin' && selectedOrder.status === 'archived' && (
                      <option value="archived">مؤرشفة (Archived)</option>
                    )}
                  </select>
                )}
              </div>

              {/* Printable Invoice Container */}
              {/* Printable Invoice Container */}
              <div className={`invoice-box ${hidePricesInPrint ? 'hide-price-on-print' : ''}`} style={{ 
                padding: '24px', 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color)',
                fontSize: '0.9rem', 
                color: 'var(--text-primary)',
                lineHeight: '1.6'
              }}>
                {/* Printable Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px double var(--border-color)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {settings?.logo_url ? (
                      <img 
                        src={settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:') ? settings.logo_url : `${apiHost}${settings.logo_url}`} 
                        alt="Logo" 
                        style={{ height: '54px', maxWidth: '140px', objectFit: 'contain' }} 
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-blue)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.2rem'
                      }}>
                        {settings?.app_name ? settings.app_name[0] : 'A'}
                      </div>
                    )}
                    <div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                        {settings?.app_name || 'أرز مارت'}
                      </h2>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                        {lang === 'ar' ? 'متجر إلكتروني متكامل' : 'E-Commerce Marketplace'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: lang === 'ar' ? 'left' : 'right', direction: 'ltr' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--accent-blue)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {lang === 'ar' ? 'وصل استلام طلبية' : 'ORDER RECEIPT'}
                    </h1>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', marginTop: '4px', color: 'var(--text-primary)' }}>
                      #{selectedOrder.id}
                    </div>
                  </div>
                </div>

                {/* Info Blocks Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  {/* Left Column: Client Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>
                      {lang === 'ar' ? 'معلومات العميل:' : 'Customer Info:'}
                    </strong>
                    <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {selectedOrder.user_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'الهاتف: ' : 'Phone: '}</span>
                      <span style={{ direction: 'ltr', display: 'inline-block' }}>{selectedOrder.phone}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'العنوان: ' : 'Address: '}</span>
                      {selectedOrder.address}
                    </div>
                  </div>

                  {/* Right Column: Order/Invoice Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: lang === 'ar' ? 'left' : 'right', alignItems: lang === 'ar' ? 'flex-start' : 'flex-end' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px', width: '100%' }}>
                      {lang === 'ar' ? 'تفاصيل الطلبية:' : 'Order Details:'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'التاريخ: ' : 'Date: '}</span>
                      {new Date(selectedOrder.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'طريقة الدفع: ' : 'Payment Method: '}</span>
                      {selectedOrder.payment_method === 'COD' 
                        ? (lang === 'ar' ? 'الدفع عند الاستلام (COD)' : 'Cash on Delivery (COD)') 
                        : (lang === 'ar' ? 'دفع إلكتروني (Online)' : 'Online Payment')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'رقم التتبع: ' : 'Tracking Number: '}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{selectedOrder.tracking_number}</span>
                    </div>
                    {selectedOrder.exchange_rate && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '600' }}>{lang === 'ar' ? 'سعر الصرف المعتمد: ' : 'Exchange Rate: '}</span>
                        {formatPrice(selectedOrder.exchange_rate).replace('$', '')} L.L.
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--text-primary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px' }}>{lang === 'ar' ? 'الصورة' : 'Image'}</th>
                      <th style={{ padding: '10px 8px', textAlign: 'start' }}>{lang === 'ar' ? 'المنتج وصف' : 'Item Description'}</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: '70px' }}>{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th className="price-col" style={{ padding: '10px 8px', textAlign: 'end', width: '100px' }}>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                      <th className="total-col" style={{ padding: '10px 8px', textAlign: 'end', width: '110px' }}>{lang === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, idx) => {
                      const itemImg = item.image_url 
                        ? (item.image_url.startsWith('http') || item.image_url.startsWith('data:') ? item.image_url : `${apiHost}${item.image_url}`)
                        : '';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', verticalAlign: 'middle' }}>
                          {/* Product Image Column */}
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {itemImg ? (
                              <img 
                                src={itemImg} 
                                alt="Item" 
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'block', margin: 'auto' }} 
                              />
                            ) : (
                              <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}></div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                              {lang === 'ar' ? item.name_ar : item.name_en}
                            </div>
                            {(item.selectedColor || item.selectedSize) && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                                {item.selectedColor && (
                                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {lang === 'ar' ? `اللون: ${item.selectedColor}` : `Color: ${item.selectedColor}`}
                                  </span>
                                )}
                                {item.selectedSize && (
                                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {lang === 'ar' ? `القياس: ${item.selectedSize}` : `Size: ${item.selectedSize}`}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.merchant_name && (
                              <div className="merchant-info-print" style={{ fontSize: '0.75rem', color: 'gray', marginTop: '4px' }}>
                                {lang === 'ar' ? `التاجر: ${item.merchant_name}` : `Merchant: ${item.merchant_name}`}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {item.quantity}
                          </td>
                          <td className="price-col" style={{ padding: '8px', textAlign: 'end', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            {formatPrice(item.price_usd)}
                          </td>
                          <td className="total-col" style={{ padding: '8px', textAlign: 'end', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {formatPrice(item.price_usd * item.quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Calculations & Footer Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  {/* Left: Thank you and Note */}
                  <div style={{ flex: 1, minWidth: '220px', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {lang === 'ar' ? 'ملاحظة هامة:' : 'Important Note:'}
                    </div>
                    <div>
                      {lang === 'ar' 
                        ? 'الرجاء الاحتفاظ بهذا الوصل للاستبدال أو المرجوعات خلال مدة أقصاها ٧ أيام من تاريخ التسليم.'
                        : 'Please keep this receipt for exchanges or returns within a maximum of 7 days from delivery.'}
                    </div>
                  </div>

                  {/* Right: Subtotal and Total calculations */}
                  <div className="total-col" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', minWidth: '220px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-light)' }}>{lang === 'ar' ? 'التوصيل:' : 'Delivery:'}</span>
                      <strong style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {selectedOrder.delivery_fee_usd === 0 
                          ? (lang === 'ar' ? 'مجاني' : 'Free') 
                          : formatPrice(selectedOrder.delivery_fee_usd)}
                      </strong>
                    </div>
                    
                    {/* Grand Total USD */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', fontSize: '1.1rem', fontWeight: '900', borderTop: '2px solid var(--text-primary)', paddingTop: '8px', marginTop: '4px' }}>
                      <span>{lang === 'ar' ? 'الإجمالي النهائي (USD):' : 'Grand Total (USD):'}</span>
                      <span style={{ color: 'var(--accent-red-gold)' }}>
                        {formatPrice(selectedOrder.total_usd)}
                      </span>
                    </div>

                    {/* Grand Total LBP (Lebanese Lira) */}
                    {(() => {
                      const rate = selectedOrder.exchange_rate || settings?.exchange_rate || 89500;
                      const totalLbp = selectedOrder.total_usd * rate;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                          <span>{lang === 'ar' ? 'المعادل بالليرة اللبنانية:' : 'Equivalent in LBP:'}</span>
                          <span>
                            {totalLbp.toLocaleString()} ل.ل.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Footer Notes */}
                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '30px', paddingTop: '10px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  <div>{lang === 'ar' ? 'شكرًا لشرائكم وثقتكم بنا!' : 'Thank you for shopping and trusting us!'}</div>
                  {settings?.contact_email && (
                    <div style={{ marginTop: '2px' }}>{settings.contact_email}</div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="no-print dashboard-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              اختر طلبية من القائمة الجانبية لعرض تفاصيلها وطباعتها.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
