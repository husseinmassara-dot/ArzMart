import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Edit3, Image, GripVertical, Save, ArrowUpDown } from 'lucide-react';

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
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [saveOrderMsg, setSaveOrderMsg] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Drag state (refs to avoid re-renders)
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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
        setOrderChanged(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // ─── Drag & Drop handlers ───────────────────────────────────────────────────
  const handleDragStart = (e, index) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // ghost image
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndexRef.current) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newList = [...categories];
    const [removed] = newList.splice(dragIndex, 1);
    newList.splice(dropIndex, 0, removed);

    dragIndexRef.current = null;
    setDragOverIndex(null);
    setCategories(newList);
    setOrderChanged(true);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setSaveOrderMsg('');
    try {
      const order = categories.map((c, idx) => ({ id: c.id, sort_order: idx }));
      const res = await fetch(`${apiBase}/categories-reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order })
      });
      if (res.ok) {
        setSaveOrderMsg('✓ تم حفظ الترتيب بنجاح');
        setOrderChanged(false);
        setTimeout(() => setSaveOrderMsg(''), 3000);
      } else {
        setSaveOrderMsg('⚠️ فشل حفظ الترتيب');
        setTimeout(() => setSaveOrderMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setSaveOrderMsg('⚠️ خطأ في الاتصال');
      setTimeout(() => setSaveOrderMsg(''), 3000);
    } finally {
      setSavingOrder(false);
    }
  };

  // ─── Form handlers ──────────────────────────────────────────────────────────
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
              {lang === 'ar' ? 'قائمة التصنيفات الحالية' : 'Current Categories List'}
            </h4>
            <span style={{
              fontSize: '0.78rem',
              color: 'var(--text-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '4px 10px',
              borderRadius: '20px'
            }}>
              <ArrowUpDown size={12} />
              {lang === 'ar' ? 'اسحب الصفوف لتغيير الترتيب' : 'Drag rows to reorder'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Save order button */}
            {orderChanged && (
              <button
                onClick={handleSaveOrder}
                disabled={savingOrder}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: savingOrder ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: savingOrder ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Save size={14} />
                <span>{savingOrder ? 'جاري الحفظ...' : (lang === 'ar' ? 'حفظ الترتيب' : 'Save Order')}</span>
              </button>
            )}
            {saveOrderMsg && (
              <span style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: saveOrderMsg.startsWith('✓') ? '#10b981' : '#ef4444',
                padding: '6px 12px',
                backgroundColor: saveOrderMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                borderRadius: '6px',
                border: `1px solid ${saveOrderMsg.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                {saveOrderMsg}
              </span>
            )}
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
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <Trash2 size={14} />
                <span>{lang === 'ar' ? `حذف المحدد (${selectedIds.length})` : `Delete Selected (${selectedIds.length})`}</span>
              </button>
            )}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.85rem' }}>
              <th style={{ padding: '10px', width: '36px', textAlign: 'center' }}></th>
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
            {categories.map((c, index) => {
              const imageUrl = c.image_url
                ? (c.image_url.startsWith('http') || c.image_url.startsWith('data:') ? c.image_url : `${apiHost}${c.image_url}`)
                : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=50&q=80';

              const isDragOver = dragOverIndex === index;
              const isDragging = dragIndexRef.current === index;

              return (
                <tr
                  key={c.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    borderBottom: isDragOver
                      ? '2px solid var(--accent-blue)'
                      : '1px solid var(--border-color)',
                    fontSize: '0.9rem',
                    opacity: isDragging ? 0.4 : 1,
                    backgroundColor: isDragOver
                      ? 'rgba(59,130,246,0.06)'
                      : 'transparent',
                    transition: 'background-color 0.15s, opacity 0.15s, border-color 0.15s',
                    cursor: 'grab'
                  }}
                >
                  {/* Drag handle */}
                  <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-light)' }}>
                    <GripVertical size={16} style={{ cursor: 'grab', opacity: 0.6 }} />
                  </td>
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
                    <img 
                      src={imageUrl} 
                      alt="" 
                      onClick={() => setLightboxSrc(imageUrl)}
                      style={{ width: '30px', height: '30px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'zoom-in' }} 
                      title={lang === 'ar' ? 'تكبير الصورة' : 'Enlarge Image'}
                    />
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
                      <button
                        onClick={() => handleEdit(c)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}
                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
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

      {/* Lightbox Modal */}
      {lightboxSrc && (
        <div 
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxSrc} 
              alt="Enlarged" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                borderRadius: '8px', 
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                objectFit: 'contain',
                border: '2px solid rgba(255,255,255,0.1)'
              }} 
            />
            <button 
              onClick={() => setLightboxSrc(null)}
              style={{
                marginTop: '15px',
                padding: '8px 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '20px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
