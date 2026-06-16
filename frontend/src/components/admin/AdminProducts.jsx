import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Edit3, Image } from 'lucide-react';

const compressImage = (file, maxWidth = 600, maxHeight = 600, quality = 0.7) => {
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

export default function AdminProducts({ filterOutOfStock = false, onClearFilter = null }) {
  const { lang, formatPrice, apiBase, apiHost } = useApp();
  const { token } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [costPriceUsd, setCostPriceUsd] = useState('');
  const [oldPriceUsd, setOldPriceUsd] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [stock, setStock] = useState('10');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [colorsInput, setColorsInput] = useState('');
  const [sizesList, setSizesList] = useState([{ name: '', price: '', type: 'absolute' }]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${apiBase}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
    fetchProducts();
    fetchCategories();
    fetchMerchants();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameAr || !nameEn || !priceUsd) return;
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('name_ar', nameAr);
    formData.append('name_en', nameEn);
    formData.append('description_ar', descAr);
    formData.append('description_en', descEn);
    formData.append('price_usd', priceUsd);
    formData.append('cost_price_usd', costPriceUsd || '0.0');
    formData.append('old_price_usd', oldPriceUsd || 'null');
    formData.append('category_id', categoryId || 'null');
    formData.append('merchant_id', merchantId || 'null');
    formData.append('stock', stock);

    // Compress and append selected files
    const compressedFiles = await Promise.all(
      selectedFiles.map(file => compressImage(file, 600, 600, 0.7))
    );
    compressedFiles.forEach((file) => {
      formData.append('product_images', file);
    });

    if (isEditing) {
      // When editing: if no new files selected, tell backend to keep existing images.
      // We do NOT re-send the huge base64 strings.
      if (selectedFiles.length === 0) {
        formData.append('keep_existing_images', 'true');
      } else {
        // New files selected — existing images are intentionally replaced
        formData.append('keep_existing_images', 'false');
      }
    } else {
      // For new products, no existing images to worry about
      formData.append('existing_images', JSON.stringify([]));
    }

    const colorsArray = colorsInput ? colorsInput.split(',').map(c => c.trim()).filter(Boolean) : [];
    const sizesArray = sizesList.map(opt => {
      if (!opt.name) return null;
      if (!opt.price) return opt.name;
      if (opt.type === 'relative') return `${opt.name} (+${opt.price})`;
      if (opt.type === 'negative') return `${opt.name} (-${opt.price})`;
      return `${opt.name} ($${opt.price})`;
    }).filter(Boolean);
    formData.append('colors', JSON.stringify(colorsArray));
    formData.append('sizes', JSON.stringify(sizesArray));

    const url = isEditing
      ? `${apiBase}/products/${editingId}`
      : `${apiBase}/products`;

    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setFormSuccess(isEditing ? 'تم حفظ التعديلات بنجاح ✓' : 'تم إضافة المنتج بنجاح ✓');
        resetForm();
        fetchProducts();
        setTimeout(() => setFormSuccess(''), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFormError(errData.error_ar || errData.error || `فشل الحفظ (${res.status})`);
      }
    } catch (err) {
      console.error('Submit product error:', err);
      setFormError('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setIsEditing(true);
    setEditingId(product.id);
    setNameAr(product.name_ar);
    setNameEn(product.name_en);
    setDescAr(product.description_ar || '');
    setDescEn(product.description_en || '');
    setPriceUsd(product.price_usd);
    setCostPriceUsd(product.cost_price_usd || '0.0');
    setOldPriceUsd(product.old_price_usd || '');
    setCategoryId(product.category_id || '');
    setMerchantId(product.merchant_id || '');
    setStock(product.stock);
    setExistingImages(product.images || (product.image_url ? [product.image_url] : []));
    setSelectedFiles([]);
    setColorsInput((product.colors || []).join(', '));
    let parsedSizes = [];
    if (product.sizes && Array.isArray(product.sizes)) {
      parsedSizes = product.sizes.map(s => {
        const priceRegex = /\(\s*([+-]?\s*\$?\s*[0-9.]+)\s*\$?_?\)/;
        const match = s.match(priceRegex);
        if (match) {
          const name = s.replace(/\s*\(\s*[+-]?\s*\$?\s*[0-9.]+\s*\$?_?\)/g, '').trim();
          const priceVal = match[1].replace(/[+\-$]/g, '').trim();
          let type = 'absolute';
          if (s.includes('+')) type = 'relative';
          else if (s.includes('-')) type = 'negative';
          return { name, price: priceVal, type };
        }
        return { name: s, price: '', type: 'absolute' };
      });
    }
    setSizesList(parsedSizes.length > 0 ? parsedSizes : [{ name: '', price: '', type: 'absolute' }]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المنتج؟' : 'Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${apiBase}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف المنتجات المحددة؟' : 'Are you sure you want to delete selected products?')) return;
    try {
      await Promise.all(selectedIds.map(id =>
        fetch(`${apiBase}/products/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ));
      setSelectedIds([]);
      fetchProducts();
    } catch (err) {
      console.error('Bulk delete products error:', err);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setDescAr('');
    setDescEn('');
    setPriceUsd('');
    setCostPriceUsd('');
    setOldPriceUsd('');
    setCategoryId('');
    setMerchantId('');
    setStock('10');
    setSelectedFiles([]);
    setExistingImages([]);
    setColorsInput('');
    setSizesList([{ name: '', price: '', type: 'absolute' }]);
  };

  const displayedProducts = filterOutOfStock
    ? products.filter(p => Number(p.stock) <= 0)
    : products;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Product Form */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px' }}>
          {isEditing 
            ? (lang === 'ar' ? 'تعديل بيانات المنتج' : 'Edit Product Details') 
            : (lang === 'ar' ? 'إضافة منتج جديد' : 'Add New Product')}
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
            <label className="input-label">الوصف (العربية)</label>
            <input type="text" className="input-field" value={descAr} onChange={(e) => setDescAr(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Description (English)</label>
            <input type="text" className="input-field" value={descEn} onChange={(e) => setDescEn(e.target.value)} />
          </div>
          <div>
            <label className="input-label">سعر البيع (Selling Price - USD) *</label>
            <input type="number" step="0.01" required className="input-field" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
          </div>
          <div>
            <label className="input-label">سعر التكلفة (Cost Price - USD) *</label>
            <input type="number" step="0.01" className="input-field" value={costPriceUsd} onChange={(e) => setCostPriceUsd(e.target.value)} />
          </div>
          <div>
            <label className="input-label">السعر القديم المشطوب (USD - إن وجد)</label>
            <input type="number" step="0.01" className="input-field" value={oldPriceUsd} onChange={(e) => setOldPriceUsd(e.target.value)} />
          </div>
          <div>
            <label className="input-label">التصنيف (Category)</label>
            <select className="input-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">-- اختر التصنيف --</option>
              {(() => {
                const parents = categories.filter(c => !c.parent_id);
                const children = categories.filter(c => c.parent_id);
                
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
                  if (!list.some(item => item.id === c.id)) {
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
            <label className="input-label">التاجر / المورد (Supplier Merchant)</label>
            <select className="input-field" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
              <option value="">-- اختر المورد --</option>
              {merchants.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.company ? `(${m.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">المخزون المتوفر (Stock)</label>
            <input type="number" required className="input-field" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div>
            <label className="input-label">{lang === 'ar' ? 'الألوان المتاحة (مفصولة بفاصلة)' : 'Available Colors (comma-separated)'}</label>
            <input type="text" className="input-field" placeholder={lang === 'ar' ? 'مثال: أحمر, أزرق, أسود' : 'e.g. Red, Blue, Black'} value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: 'var(--bg-secondary)', marginTop: '8px' }}>
            <span className="input-label" style={{ display: 'block', fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-primary)' }}>
              {lang === 'ar' ? 'خيارات المنتج وتحديد الأسعار يدوياً (مثل الأحجام أو السعات)' : 'Product Options & Price Details (e.g. Sizes or Storage)'}
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sizesList.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Option Name */}
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <input 
                      type="text" 
                      placeholder={lang === 'ar' ? 'اسم الخيار (مثال: 512GB أو 5L)' : 'Option Name (e.g. 512GB or 5L)'} 
                      className="input-field" 
                      style={{ margin: 0 }}
                      value={item.name} 
                      onChange={(e) => {
                        const newList = [...sizesList];
                        newList[index].name = e.target.value;
                        setSizesList(newList);
                      }} 
                    />
                  </div>

                  {/* Price Type */}
                  <div style={{ width: '160px' }}>
                    <select 
                      className="input-field" 
                      style={{ margin: 0, padding: '8px' }}
                      value={item.type} 
                      onChange={(e) => {
                        const newList = [...sizesList];
                        newList[index].type = e.target.value;
                        setSizesList(newList);
                      }}
                    >
                      <option value="absolute">{lang === 'ar' ? 'سعر يدوي مباشر ($)' : 'Absolute Price ($)'}</option>
                      <option value="relative">{lang === 'ar' ? 'زيادة نسبية (+)' : 'Price Increase (+)'}</option>
                      <option value="negative">{lang === 'ar' ? 'خصم نسبي (-)' : 'Price Decrease (-)'}</option>
                    </select>
                  </div>

                  {/* Price Value */}
                  <div style={{ width: '120px' }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder={lang === 'ar' ? 'السعر/الفارق' : 'Price/Offset'} 
                      className="input-field" 
                      style={{ margin: 0 }}
                      value={item.price} 
                      onChange={(e) => {
                        const newList = [...sizesList];
                        newList[index].price = e.target.value;
                        setSizesList(newList);
                      }} 
                    />
                  </div>

                  {/* Delete Button */}
                  <button 
                    type="button" 
                    onClick={() => {
                      const newList = sizesList.filter((_, i) => i !== index);
                      setSizesList(newList.length > 0 ? newList : [{ name: '', price: '', type: 'absolute' }]);
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: '#fee2e2',
                      color: '#ef4444',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'ar' ? 'حذف' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>

            {/* Add Option Button */}
            <button 
              type="button" 
              onClick={() => setSizesList([...sizesList, { name: '', price: '', type: 'absolute' }])}
              style={{
                marginTop: '12px',
                padding: '6px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {lang === 'ar' ? '+ إضافة خيار جديد' : '+ Add New Option'}
            </button>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="input-label" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
              {lang === 'ar' ? 'صور المنتج (Product Images) - يمكنك اختيار أكثر من صورة' : 'Product Images - You can select multiple images'}
            </label>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange} 
              className="input-field" 
              style={{ padding: '8px' }} 
            />
            
            {/* Image Previews Container */}
            {(existingImages.length > 0 || selectedFiles.length > 0) && (
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                flexWrap: 'wrap', 
                marginTop: '12px',
                padding: '12px',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                {/* Existing Images */}
                {existingImages.map((imgUrl, index) => {
                  const fullUrl = imgUrl.startsWith('http') || imgUrl.startsWith('data:') 
                    ? imgUrl 
                    : `${apiHost}${imgUrl}`;
                  return (
                    <div key={`existing-${index}`} style={{ position: 'relative', width: '80px', height: '80px' }}>
                      <img 
                        src={fullUrl} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white', borderRadius: '6px', border: '1px solid var(--border-color)' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== index))}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                {/* Newly Selected Files */}
                {selectedFiles.map((file, index) => {
                  const objectUrl = URL.createObjectURL(file);
                  return (
                    <div key={`new-${index}`} style={{ position: 'relative', width: '80px', height: '80px' }}>
                      <img 
                        src={objectUrl} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white', borderRadius: '6px', border: '1px solid var(--border-color)', opacity: 0.8 }} 
                      />
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {lang === 'ar' ? 'جديد' : 'New'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="input-field"
              style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'جاري الحفظ...' : (isEditing ? 'حفظ التعديلات' : 'إضافة المنتج')}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                إلغاء
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

      {filterOutOfStock && (
        <div className="animate-scale" style={{
          backgroundColor: 'rgba(217,119,6,0.1)',
          border: '1px solid #d97706',
          padding: '12px 20px',
          borderRadius: '12px',
          color: '#d97706',
          fontWeight: '700',
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{lang === 'ar' ? 'عرض السلع المنتهية من المخزون فقط' : 'Showing out of stock items only'}</span>
          </div>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              style={{
                backgroundColor: '#d97706',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.8rem',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              {lang === 'ar' ? 'عرض جميع المنتجات' : 'Show All Products'}
            </button>
          )}
        </div>
      )}

      {/* Products Table */}
      <div className="dashboard-card" style={{ overflowX: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
            {lang === 'ar' ? 'قائمة المنتجات الحالية' : 'Current Products List'}
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
                  checked={displayedProducts.length > 0 && selectedIds.length === displayedProducts.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(displayedProducts.map(p => p.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الصورة</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الاسم</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>التصنيف</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>المورد</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>الألوان</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>القياسات</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>سعر البيع</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>سعر التكلفة</th>
              <th style={{ padding: '10px', textAlign: 'start' }}>المخزون</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.map((p) => {
              const imageUrl = p.image_url 
                ? (p.image_url.startsWith('http') || p.image_url.startsWith('data:') ? p.image_url : `${apiHost}${p.image_url}`)
                : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=50&q=80';
              
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '10px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, p.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(item => item !== p.id));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <img src={imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                  </td>
                  <td style={{ padding: '10px', fontWeight: '600' }}>
                    {lang === 'ar' ? p.name_ar : p.name_en}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                    {lang === 'ar' ? p.category_name_ar : p.category_name_en}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                    {p.merchant_name || '-'}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                    {p.colors && p.colors.length > 0 ? p.colors.join(', ') : '-'}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                    {p.sizes && p.sizes.length > 0 ? p.sizes.join(', ') : '-'}
                  </td>
                  <td style={{ padding: '10px', fontWeight: '700', color: 'var(--accent-blue)' }}>
                    {formatPrice(p.price_usd)}
                  </td>
                  <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    {formatPrice(p.cost_price_usd || 0)}
                  </td>
                  <td style={{ padding: '10px', color: p.stock > 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                    {p.stock}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleEdit(p)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
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
