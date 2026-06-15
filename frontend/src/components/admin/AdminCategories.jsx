import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Edit3, Image } from 'lucide-react';

const compressImage = (file, maxWidth = 400, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function AdminCategories() {
  const { lang, apiBase, apiHost } = useApp();
  const { token } = useAuth();

  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [parentId, setParentId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${apiBase}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameAr || !nameEn) return;
    setFormError('');
    setFormSuccess('');

    const formData = new FormData();
    formData.append('name_ar', nameAr);
    formData.append('name_en', nameEn);
    formData.append('parent_id', parentId || 'null');
    if (selectedFile) {
      const compressed = await compressImage(selectedFile, 400, 400, 0.7);
      formData.append('category_image', compressed);
    }

    const url = isEditing 
      ? `${apiBase}/categories/${editingId}`
      : `${apiBase}/categories`;

    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setFormSuccess(isEditing ? 'تم تعديل التصنيف بنجاح ✓' : 'تم إضافة التصنيف بنجاح ✓');
        resetForm();
        fetchCategories();
        setTimeout(() => setFormSuccess(''), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFormError(errData.error_ar || errData.error || `فشل الحفظ (${res.status})`);
      }
    } catch (err) {
      console.error('Submit category error:', err);
      setFormError('خطأ في الاتصال بالخادم');
    }
  };

  const handleEdit = (category) => {
    setIsEditing(true);
    setEditingId(category.id);
    setNameAr(category.name_ar);
    setNameEn(category.name_en);
    setParentId(category.parent_id || '');
    setSelectedFile(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا التصنيف؟ سيؤدي ذلك لحذف المنتجات المرتبطة به.' : 'Are you sure you want to delete this category? Linked products will lose their category.')) return;
    try {
      const res = await fetch(`${apiBase}/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف التصنيفات المحددة؟ سيؤدي ذلك لحذف المنتجات المرتبطة بها.' : 'Are you sure you want to delete selected categories? Linked products will lose their categories.')) return;
    try {
      await Promise.all(selectedIds.map(id =>
        fetch(`${apiBase}/categories/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ));
      setSelectedIds([]);
      fetchCategories();
    } catch (err) {
      console.error('Bulk delete categories error:', err);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setParentId('');
    setSelectedFile(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Category Form */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px' }}>
          {isEditing 
            ? (lang === 'ar' ? 'تعديل بيانات التصنيف' : 'Edit Category Details') 
            : (lang === 'ar' ? 'إضافة تصنيف جديد' : 'Add New Category')}
        </h4>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div>
            <label className="input-label">الاسم (العربية) *</label>
            <input type="text" required className="input-field" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Name (English) *</label>
            <input type="text" required className="input-field" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div>
            <label className="input-label">التصنيف الرئيسي (Parent Category - إن وجد)</label>
            <select className="input-field" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">-- تصنيف رئيسي (Top Level) --</option>
              {(() => {
                const parents = categories.filter(c => !c.parent_id && c.id !== editingId);
                const children = categories.filter(c => c.parent_id && c.id !== editingId);
                
                const list = [];
                parents.forEach(p => {
                  list.push({ ...p, depth: 0 });
                  const subcats = children.filter(c => c.parent_id === p.id);
                  subcats.forEach(s => {
                    list.push({ ...s, depth: 1 });
                    const subsub = children.filter(c => c.parent_id === s.id);
                    subsub.forEach(ss => {
                      list.push({ ...ss, depth: 2 });
                    });
                  });
                });
                
                categories.forEach(c => {
                  if (c.id !== editingId && !list.some(item => item.id === c.id)) {
                    list.push({ ...c, depth: 0 });
                  }
                });
                
                return list.map(c => {
                  const indent = '　'.repeat(c.depth) + (c.depth > 0 ? '↳ ' : '');
                  return (
                    <option key={c.id} value={c.id}>
                      {indent}{lang === 'ar' ? c.name_ar : c.name_en}
                    </option>
                  );
                });
              })()}
            </select>
          </div>
          <div>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Image size={14} />
              <span>أيقونة/صورة التصنيف (Category Image)</span>
            </label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="input-field" style={{ padding: '6px' }} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              {isEditing ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'إضافة التصنيف' : 'Add Category')}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            )}
            {formError && (
              <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.9rem', padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
                ⚠️ {formError}
              </span>
            )}
            {formSuccess && (
              <span style={{ color: '#10b981', fontWeight: '600', fontSize: '0.9rem', padding: '8px 12px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>
                {formSuccess}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Categories List */}
      <div className="dashboard-card" style={{ overflowX: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
            {lang === 'ar' ? 'قائمة التصنيفات الحالية' : 'Current Categories List'}
          </h4>
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
                  checked={categories.length > 0 && selectedIds.length === categories.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(categories.map(c => c.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '10px', textAlign: 'start' }}>أيقونة</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>التصنيف</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>التصنيف الأب</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const imageUrl = c.image_url 
                ? (c.image_url.startsWith('http') || c.image_url.startsWith('data:') ? c.image_url : `${apiHost}${c.image_url}`)
                : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=50&q=80';
              
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '10px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, c.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== c.id));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <img src={imageUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                  </td>
                  <td style={{ padding: '10px', fontWeight: '600' }}>
                    {lang === 'ar' ? c.name_ar : c.name_en}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                    {c.parent_id 
                      ? (lang === 'ar' ? c.parent_name_ar : c.parent_name_en) 
                      : (lang === 'ar' ? 'رئيسي' : 'Top Level')}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleEdit(c)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
