import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Shield, CheckSquare, Square } from 'lucide-react';

export default function AdminUsers() {
  const { lang, apiBase } = useApp();
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Permissions states
  const [role, setRole] = useState('user');
  const [perms, setPerms] = useState([]);

  const permissionList = [
    { id: 'products', name_ar: 'إدارة المنتجات', name_en: 'Manage Products' },
    { id: 'categories', name_ar: 'إدارة التصنيفات', name_en: 'Manage Categories' },
    { id: 'orders', name_ar: 'إدارة الطلبيات', name_en: 'Manage Orders' },
    { id: 'users', name_ar: 'إدارة الصلاحيات والمستخدمين', name_en: 'Manage Users & Permissions' },
    { id: 'coupons', name_ar: 'إدارة الكوبونات والخصم', name_en: 'Manage Coupons' },
    { id: 'reports', name_ar: 'عرض التقارير والأرباح', name_en: 'View Reports & Profits' },
    { id: 'settings', name_ar: 'تعديل الإعدادات والأسعار', name_en: 'Edit Settings' },
    { id: 'chat', name_ar: 'الرد على دردشات العملاء', name_en: 'Customer Chat support' }
  ];

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiBase}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setRole(user.role);
    setPerms(user.permissions || []);
  };

  const handleTogglePermission = (permId) => {
    setPerms(prev => {
      if (prev.includes(permId)) {
        return prev.filter(p => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch(`${apiBase}/admin/users/${selectedUser.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          permissions: perms
        })
      });

      if (res.ok) {
        fetchUsers();
        setSelectedUser(null);
      } else {
        const errData = await res.json();
        alert(errData.error_ar || errData.error_en || 'Error updating permissions');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      
      {/* Left Column: Users List */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px' }}>قائمة المستخدمين والموظفين</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => {
            const isSuperAdmin = u.username === 'husseinmassara' || u.username === 'city-hunter';
            return (
              <div
                key={u.id}
                onClick={() => !isSuperAdmin && handleSelectUser(u)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: selectedUser?.id === u.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: isSuperAdmin ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: isSuperAdmin ? 0.7 : 1
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{u.username}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                    الدور: {u.role === 'admin' ? 'مدير عام (Super Admin)' : u.role === 'employee' ? 'موظف (Staff)' : 'عميل (Customer)'}
                  </div>
                </div>

                {u.role !== 'user' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-blue)' }}>
                    <Shield size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Edit Permissions Form */}
      <div>
        {selectedUser ? (
          <form onSubmit={handleSubmit} className="dashboard-card" style={{ padding: '20px', gap: '16px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              تعديل صلاحيات المستخدم: <span style={{ color: 'var(--accent-blue)' }}>{selectedUser.username}</span>
            </h4>

            {/* Select Role */}
            <div>
              <label className="input-label">دور المستخدم (Role)</label>
              <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">عميل عادي (Customer)</option>
                <option value="employee">موظف بصلاحيات محددة (Staff)</option>
              </select>
            </div>

            {/* Select Permissions */}
            {role === 'employee' && (
              <div>
                <label className="input-label" style={{ marginBottom: '10px' }}>حدد الصلاحيات المتاحة للموظف:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {permissionList.map((p) => {
                    const isChecked = perms.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleTogglePermission(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="var(--accent-blue)" />
                        ) : (
                          <Square size={16} color="var(--text-light)" />
                        )}
                        <span>{lang === 'ar' ? p.name_ar : p.name_en}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="input-field" style={{ width: 'auto', padding: '8px 20px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
                تحديث الصلاحيات
              </button>
              <button type="button" onClick={() => setSelectedUser(null)} className="input-field" style={{ width: 'auto', padding: '8px 20px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <div className="dashboard-card" style={{ padding: '40px', color: 'var(--text-light)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            حدد مستخدم أو موظف من القائمة الجانبية لتعديل صلاحيات الوصول والتحكم الخاصة به.
          </div>
        )}
      </div>

    </div>
  );
}
