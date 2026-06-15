import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Edit3, Plus, Users } from 'lucide-react';

export default function AdminMerchants() {
  const { lang, apiBase } = useApp();
  const { token } = useAuth();

  const [merchants, setMerchants] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  const fetchMerchants = async () => {
    try {
      const res = await fetch(`${apiBase}/merchants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMerchants(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    const bodyPayload = { name, phone, email, company };

    const url = isEditing 
      ? `${apiBase}/merchants/${editingId}`
      : `${apiBase}/merchants`;

    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(bodyPayload)
      });

      if (res.ok) {
        resetForm();
        fetchMerchants();
      }
    } catch (err) {
      console.error('Submit merchant error:', err);
    }
  };

  const handleEdit = (m) => {
    setIsEditing(true);
    setEditingId(m.id);
    setName(m.name);
    setPhone(m.phone || '');
    setEmail(m.email || '');
    setCompany(m.company || '');
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا التاجر؟' : 'Are you sure you want to delete this merchant?')) return;
    try {
      const res = await fetch(`${apiBase}/merchants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchMerchants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف الموردين المحددين؟' : 'Are you sure you want to delete selected merchants?')) return;
    try {
      await Promise.all(selectedIds.map(id =>
        fetch(`${apiBase}/merchants/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ));
      setSelectedIds([]);
      fetchMerchants();
    } catch (err) {
      console.error('Bulk delete merchants error:', err);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setCompany('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      
      {/* Merchant Form */}
      <div className="dashboard-card" style={{ padding: '20px', height: 'fit-content' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="var(--accent-blue)" />
          <span>{isEditing ? 'تعديل بيانات التاجر' : 'إضافة تاجر/مورد جديد'}</span>
        </h4>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">اسم التاجر / المورد *</label>
            <input type="text" required className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="input-label">الشركة (Company)</label>
            <input type="text" className="input-field" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="input-label">رقم الهاتف (Phone)</label>
            <input type="text" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="input-label">البريد الإلكتروني (Email)</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              {isEditing ? 'حفظ التعديلات' : 'إضافة المورد'}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Merchants List */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>قائمة التجار والموردين الحالية</h4>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              <Trash2 size={14} />
              <span>{lang === 'ar' ? `حذف المحدد (${selectedIds.length})` : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.85rem' }}>
              <th style={{ padding: '10px', width: '40px', textAlign: 'start' }}>
                <input 
                  type="checkbox"
                  checked={merchants.length > 0 && selectedIds.length === merchants.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(merchants.map(m => m.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الاسم</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الشركة</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الهاتف</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '10px' }}>
                  <input 
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(prev => [...prev, m.id]);
                      } else {
                        setSelectedIds(prev => prev.filter(item => item !== m.id));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '10px', fontWeight: '600' }}>
                  {m.name}
                </td>
                <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                  {m.company || '-'}
                </td>
                <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                  {m.phone || '-'}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => handleEdit(m)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {merchants.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                  لا يوجد أي تجار أو موردين مسجلين بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
