import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Plus, Tag } from 'lucide-react';

export default function AdminCoupons() {
  const { lang, apiBase } = useApp();
  const { token } = useAuth();

  const [coupons, setCoupons] = useState([]);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');

  const fetchCoupons = async () => {
    try {
      const res = await fetch(`${apiBase}/coupons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || !discountPercent) return;

    try {
      const res = await fetch(`${apiBase}/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount_percent: parseFloat(discountPercent)
        })
      });

      if (res.ok) {
        setCode('');
        setDiscountPercent('');
        fetchCoupons();
      } else {
        const data = await res.json();
        alert(data.error_ar || data.error_en || 'Error creating coupon');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الكوبون؟' : 'Are you sure you want to delete this coupon?')) return;
    try {
      const res = await fetch(`${apiBase}/coupons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCoupons();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
      
      {/* Add Coupon Form */}
      <div className="dashboard-card" style={{ padding: '20px', height: 'fit-content' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag size={18} color="var(--accent-blue)" />
          <span>إضافة كوبون خصم جديد</span>
        </h4>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">رمز الكوبون (Coupon Code) *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="مثال: SUMMER20"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">نسبة الخصم (Discount Percent) % *</label>
            <input
              type="number"
              required
              min="1"
              max="100"
              className="input-field"
              placeholder="مثال: 20"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </div>

          <button
            type="submit"
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
            إنشاء الكوبون
          </button>
        </form>
      </div>

      {/* Coupons List */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px' }}>الكوبونات النشطة حالياً</h4>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.85rem' }}>
              <th style={{ padding: '10px', textAlign: 'start' }}>الرمز</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>الخصم %</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--accent-blue)' }}>
                  {c.code}
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>
                  {c.discount_percent}%
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <button onClick={() => handleDelete(c.id)} style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                  لا يوجد أي كوبونات خصم مسجلة حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
