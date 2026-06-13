import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Printer, Eye, CheckCircle2 } from 'lucide-react';

export default function AdminOrders() {
  const { lang, formatPrice, apiBase, settings } = useApp();
  const { token } = useAuth();

  const [orders, setOrders] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('new'); // 'new' (pending/processing/shipped) or 'delivered'
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

  const filteredOrders = orders.filter(order => {
    if (activeSubTab === 'new') {
      return order.status !== 'delivered';
    } else {
      return order.status === 'delivered';
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub tabs */}
      <div className="no-print" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveSubTab('new')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: activeSubTab === 'new' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: activeSubTab === 'new' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.85rem'
          }}
        >
          الطلبيات الجديدة / النشطة ({orders.filter(o => o.status !== 'delivered').length})
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
                    backgroundColor: o.status === 'pending' ? 'rgba(239,68,68,0.1)' : o.status === 'processing' ? 'rgba(59,130,246,0.1)' : o.status === 'shipped' ? 'rgba(217,119,6,0.1)' : 'rgba(16,185,129,0.1)',
                    color: o.status === 'pending' ? '#ef4444' : o.status === 'processing' ? 'var(--accent-blue)' : o.status === 'shipped' ? '#d97706' : '#10b981'
                  }}>
                    {o.status.toUpperCase()}
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePrint(false)}
                    className="input-field"
                    style={{ width: 'auto', padding: '6px 12px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <Printer size={14} />
                    <span>طباعة الفاتورة</span>
                  </button>
                  <button
                    onClick={() => handlePrint(true)}
                    className="input-field"
                    style={{ width: 'auto', padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <Printer size={14} />
                    <span>طباعة بدون سعر</span>
                  </button>
                </div>

                {selectedOrder.status !== 'delivered' && (
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
                  </select>
                )}
              </div>

              {/* Printable Invoice Container */}
              <div className={`invoice-box ${hidePricesInPrint ? 'hide-price-on-print' : ''}`} style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {/* Printable Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                      {settings?.app_name || 'أرز مارت'}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>فاتورة مبيعات (Sales Invoice)</span>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div style={{ fontWeight: '700' }}>رقم الفاتورة: {selectedOrder.id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>رقم التتبع: {selectedOrder.tracking_number}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      التاريخ: {new Date(selectedOrder.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>المرسل إليه (Bill To):</strong>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', marginTop: '4px' }}>{selectedOrder.user_name}</div>
                    <div style={{ fontSize: '0.85rem' }}>الهاتف: {selectedOrder.phone}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>العنوان: {selectedOrder.address}</div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>طريقة الدفع (Payment):</strong>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', marginTop: '4px' }}>
                      {selectedOrder.payment_method === 'COD' ? 'الدفع عند الاستلام (COD)' : 'دفع إلكتروني (Online)'}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                      <th style={{ padding: '8px 0', textAlign: 'start' }}>المنتج (Item)</th>
                      <th style={{ padding: '8px 0', textAlign: 'center' }}>الكمية (Qty)</th>
                      <th className="price-col" style={{ padding: '8px 0', textAlign: 'end' }}>سعر الوحدة</th>
                      <th className="total-col" style={{ padding: '8px 0', textAlign: 'end' }}>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '8px 0' }}>
                          <div>{lang === 'ar' ? item.name_ar : item.name_en}</div>
                          {hidePricesInPrint && item.merchant_name && (
                            <div style={{ fontSize: '0.75rem', color: 'gray', marginTop: '2px' }}>
                              {lang === 'ar' ? `التاجر: ${item.merchant_name}` : `Merchant: ${item.merchant_name}`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'center' }}>
                          {item.quantity}
                        </td>
                        <td className="price-col" style={{ padding: '8px 0', textAlign: 'end', fontWeight: '600' }}>
                          {formatPrice(item.price_usd)}
                        </td>
                        <td className="total-col" style={{ padding: '8px 0', textAlign: 'end', fontWeight: '700' }}>
                          {formatPrice(item.price_usd * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Calculations */}
                <div className="total-col" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', borderTop: '2px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>التوصيل (Delivery)</span>
                    <strong style={{ fontWeight: '600' }}>
                      {selectedOrder.delivery_fee_usd === 0 ? 'مجاني' : formatPrice(selectedOrder.delivery_fee_usd)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px', fontSize: '1rem', fontWeight: '800', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                    <span>الإجمالي (Total)</span>
                    <span style={{ color: 'var(--accent-red-gold)' }}>
                      {formatPrice(selectedOrder.total_usd)}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="no-print dashboard-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              اختر طلبية من القائمة الجانبية لعرض تفاصيلها وطباعة الفاتورة.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
