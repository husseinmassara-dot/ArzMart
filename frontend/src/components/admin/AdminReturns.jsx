import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Plus, DollarSign, Calendar } from 'lucide-react';

export default function AdminReturns() {
  const { lang, formatPrice, apiBase, apiHost } = useApp();
  const { token } = useAuth();

  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Form states
  const [productId, setProductId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [stockAction, setStockAction] = useState('restock');
  const [reason, setReason] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchReturns = async () => {
    try {
      const res = await fetch(`${apiBase}/returns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReturns(data);
      }
    } catch (err) {
      console.error('Fetch returns error:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${apiBase}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !quantity || refundAmount === '') return;
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiBase}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: productId,
          order_id: orderId || null,
          quantity: parseInt(quantity),
          refund_amount: parseFloat(refundAmount),
          stock_action: stockAction,
          reason
        })
      });

      if (res.ok) {
        setFormSuccess(lang === 'ar' ? 'تم تسجيل المرتجع وتحديث المخزون بنجاح ✓' : 'Return logged and inventory updated ✓');
        resetForm();
        fetchReturns();
        fetchProducts(); // Refresh product list to see updated stocks
        setTimeout(() => setFormSuccess(''), 4000);
      } else {
        const data = await res.json();
        setFormError(lang === 'ar' ? data.error_ar : data.error_en || 'Failed to submit');
      }
    } catch (err) {
      console.error(err);
      setFormError(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Server connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف سجل المرتجع هذا؟ لن يؤثر ذلك على المخزون الحالي.' : 'Are you sure you want to delete this return record? This will not affect current stock.')) return;
    try {
      const res = await fetch(`${apiBase}/returns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchReturns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setProductId('');
    setOrderId('');
    setQuantity('');
    setRefundAmount('');
    setStockAction('restock');
    setReason('');
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
          {lang === 'ar' ? 'مرتجع المبيعات والتعويضات' : 'Sales Returns & Refunds'}
        </h3>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            backgroundColor: showAddForm ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
            color: showAddForm ? 'var(--text-primary)' : 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: showAddForm ? 'none' : '0 2px 8px rgba(59,130,246,0.3)'
          }}
        >
          <Plus size={16} style={{ transform: showAddForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
          <span>{showAddForm ? (lang === 'ar' ? 'إغلاق' : 'Close') : (lang === 'ar' ? 'تسجيل مرتجع جديد' : 'Log New Return')}</span>
        </button>
      </div>

      {/* Add Return Form */}
      {showAddForm && (
        <div className="dashboard-card animate-scale" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '16px' }}>
            {lang === 'ar' ? 'تفاصيل سجل المرتجع الجديد' : 'New Return Record Details'}
          </h4>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Product selection */}
            <div>
              <label className="input-label">{lang === 'ar' ? 'اختر المنتج *' : 'Select Product *'}</label>
              <select 
                required 
                className="input-field" 
                value={productId} 
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">-- {lang === 'ar' ? 'اختر المنتج من القائمة' : 'Select Product'} --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {lang === 'ar' ? p.name_ar : p.name_en} ({lang === 'ar' ? `المخزون الحالي: ${p.stock}` : `Current Stock: ${p.stock}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Order ID */}
            <div>
              <label className="input-label">{lang === 'ar' ? 'رقم الطلب (Order ID - اختياري)' : 'Order ID (Optional)'}</label>
              <input 
                type="number" 
                className="input-field" 
                placeholder="e.g. 104"
                value={orderId} 
                onChange={(e) => setOrderId(e.target.value)} 
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="input-label">{lang === 'ar' ? 'الكمية المسترجعة *' : 'Quantity Returned *'}</label>
              <input 
                type="number" 
                min="1" 
                required 
                className="input-field" 
                placeholder="e.g. 2"
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
              />
            </div>

            {/* Refund Amount */}
            <div>
              <label className="input-label">{lang === 'ar' ? 'المبلغ المسترد للمشتري (USD) *' : 'Refund Amount (USD) *'}</label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={14} style={{ position: 'absolute', left: lang === 'ar' ? 'auto' : '10px', right: lang === 'ar' ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  required 
                  className="input-field" 
                  style={{ paddingInlineStart: lang === 'ar' ? '12px' : '28px', paddingInlineEnd: lang === 'ar' ? '28px' : '12px' }}
                  placeholder="e.g. 15.50"
                  value={refundAmount} 
                  onChange={(e) => setRefundAmount(e.target.value)} 
                />
              </div>
            </div>

            {/* Stock Action */}
            <div>
              <label className="input-label">{lang === 'ar' ? 'حالة البضاعة في المخزن *' : 'Stock Action *'}</label>
              <select 
                required 
                className="input-field" 
                value={stockAction} 
                onChange={(e) => setStockAction(e.target.value)}
              >
                <option value="restock">{lang === 'ar' ? 'إعادة للمخزن (تحديث تلقائي للمخزون)' : 'Restock Item (Automatically Adds to Inventory)'}</option>
                <option value="damaged">{lang === 'ar' ? 'بضاعة تالفة (لا تضاف للمخزون)' : 'Damaged Goods (Do NOT Add back to Stock)'}</option>
              </select>
            </div>

            {/* Reason */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">{lang === 'ar' ? 'سبب الإرجاع / ملاحظات' : 'Reason for Return / Notes'}</label>
              <textarea 
                className="input-field" 
                rows="2" 
                placeholder={lang === 'ar' ? 'مثال: المنتج به تلف مصنعي أو المشتري غير رأيه...' : 'e.g. Defective item, customer changed mind...'}
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                style={{ padding: '10px' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="input-field"
                style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'تسجيل المرتجع' : 'Log Return')}
              </button>
              
              <button 
                type="button" 
                onClick={resetForm} 
                className="input-field" 
                style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontWeight: '600', cursor: 'pointer' }}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              
              {formError && (
                <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.88rem', padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ⚠️ {formError}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {formSuccess && (
        <div style={{ color: '#10b981', fontWeight: '700', fontSize: '0.9rem', padding: '12px 20px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)', animation: 'scaleUp 0.2s ease-out' }}>
          {formSuccess}
        </div>
      )}

      {/* Returns List Table */}
      <div className="dashboard-card" style={{ overflowX: 'auto', padding: '20px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '16px' }}>
          {lang === 'ar' ? 'سجلات المرتجعات السابقة' : 'Previous Returns History'}
        </h4>

        {returns.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>
            {lang === 'ar' ? 'لا يوجد سجلات مرتجعات مبيعات حتى الآن.' : 'No return records logged yet.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'المبلغ المسترد' : 'Refund'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'إجراء التخزين' : 'Stock Action'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'الطلب المرتبط' : 'Linked Order'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'السبب / الملاحظات' : 'Reason / Notes'}</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>{lang === 'ar' ? 'العمليات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => {
                const imageUrl = r.product_image 
                  ? (r.product_image.startsWith('http') || r.product_image.startsWith('data:') ? r.product_image : `${apiHost}${r.product_image}`)
                  : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=50&q=80';
                
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                    {/* Product Name/Image */}
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={imageUrl} 
                          alt="" 
                          style={{ width: '32px', height: '32px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border-color)' }} 
                        />
                        <span style={{ fontWeight: '600' }}>
                          {lang === 'ar' ? r.product_name_ar : r.product_name_en}
                        </span>
                      </div>
                    </td>
                    
                    {/* Quantity */}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>
                      {r.quantity}
                    </td>

                    {/* Refund Amount */}
                    <td style={{ padding: '10px', fontWeight: '700', color: '#ef4444' }}>
                      {formatPrice(r.refund_amount)}
                    </td>

                    {/* Stock Action */}
                    <td style={{ padding: '10px' }}>
                      {r.stock_action === 'restock' ? (
                        <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: '700' }}>
                          {lang === 'ar' ? 'إعادة للمخزن' : 'Restocked'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '20px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: '700' }}>
                          {lang === 'ar' ? 'بضاعة تالفة' : 'Damaged'}
                        </span>
                      )}
                    </td>

                    {/* Linked Order */}
                    <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                      {r.order_id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--accent-blue)' }}>#{r.order_id}</strong>
                          {r.order_tracking_number && (
                            <span style={{ fontSize: '0.72rem' }}>{r.order_tracking_number}</span>
                          )}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '10px', color: 'var(--text-light)', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td style={{ padding: '10px', color: 'var(--text-light)', fontSize: '0.82rem', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.reason}>
                      {r.reason || '-'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDelete(r.id)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                        title={lang === 'ar' ? 'حذف السجل' : 'Delete Log'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
