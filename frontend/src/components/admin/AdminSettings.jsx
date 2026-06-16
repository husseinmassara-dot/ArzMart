import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Settings, Image, Plus, Trash2, Save } from 'lucide-react';

const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
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

export default function AdminSettings() {
  const { lang, settings, fetchSettings, apiBase } = useApp();
  const { token } = useAuth();

  // Settings states
  const [appName, setAppName] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [freeThreshold, setFreeThreshold] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [onlinePayEnabled, setOnlinePayEnabled] = useState(0);
  const [contactEmail, setContactEmail] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  // Banners states
  const [banners, setBanners] = useState([]);
  const [bannerFiles, setBannerFiles] = useState({}); // key: banner ID, value: file

  useEffect(() => {
    if (settings) {
      setAppName(settings.app_name || '');
      setExchangeRate(settings.exchange_rate || 89500);
      setFreeThreshold(settings.free_delivery_threshold || 50);
      setDeliveryFee(settings.delivery_fee || 4);
      setOnlinePayEnabled(settings.online_payment_enabled || 0);
      setContactEmail(settings.contact_email || 'info@arz-mart.com');
      
      // Ensure all loaded banners have unique IDs for stable editing key
      const bannersWithIds = (settings.hero_banners || []).map((b, idx) => ({
        ...b,
        id: b.id || `banner_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`
      }));
      setBanners(bannersWithIds);
    }
  }, [settings]);

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch(`${apiBase}/admin/backup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error_ar || errData.error_en || 'Backup failed');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `arz_mart_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download backup error:', err);
      alert(lang === 'ar' ? `فشل تحميل النسخة الاحتياطية: ${err.message}` : `Failed to download backup: ${err.message}`);
    }
  };

  const handleLogoChange = (e) => {
    setLogoFile(e.target.files[0]);
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('app_name', appName);
    formData.append('exchange_rate', exchangeRate);
    formData.append('free_delivery_threshold', freeThreshold);
    formData.append('delivery_fee', deliveryFee);
    formData.append('online_payment_enabled', onlinePayEnabled);
    formData.append('contact_email', contactEmail);
    if (logoFile) {
      const compressed = await compressImage(logoFile, 200, 200, 0.7);
      formData.append('logo', compressed);
    }

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchSettings();
        setLogoFile(null);
        alert(lang === 'ar' ? 'تم تحديث الإعدادات بنجاح!' : 'Settings updated successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBannerFileChange = (id, file) => {
    setBannerFiles(prev => ({
      ...prev,
      [id]: file
    }));
  };

  const handleAddBanner = () => {
    const newId = `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setBanners(prev => [
      ...prev,
      {
        id: newId,
        image: '',
        title_ar: '',
        title_en: '',
        desc_ar: '',
        desc_en: ''
      }
    ]);
  };

  const handleDeleteBanner = (id) => {
    setBanners(prev => prev.filter(b => b.id !== id));
    // Clear file queue for this ID
    const updatedFiles = { ...bannerFiles };
    delete updatedFiles[id];
    setBannerFiles(updatedFiles);
  };

  const handleBannerChange = (id, field, value) => {
    setBanners(prev => prev.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  const getBannerPreview = (banner) => {
    if (bannerFiles[banner.id]) {
      return URL.createObjectURL(bannerFiles[banner.id]);
    }
    if (banner.image) {
      return banner.image.startsWith('http') 
        ? banner.image 
        : `${apiBase.replace('/api', '')}${banner.image}`;
    }
    return '';
  };

  const handleBannersSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('banners', JSON.stringify(banners));

    // Compress and append banner images
    for (const id of Object.keys(bannerFiles)) {
      const compressed = await compressImage(bannerFiles[id], 1200, 600, 0.7);
      formData.append(`banner_image_${id}`, compressed);
    }

    try {
      const res = await fetch(`${apiBase}/settings/banners`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchSettings();
        setBannerFiles({});
        alert(lang === 'ar' ? 'تم تحديث البانرات الإعلانية بنجاح!' : 'Hero banners updated successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* General Settings */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} color="var(--accent-blue)" />
          <span>إعدادات المتجر العامة</span>
        </h4>

        <form onSubmit={handleSettingsSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label className="input-label">اسم المتجر (App Name)</label>
            <input type="text" className="input-field" value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
          <div>
            <label className="input-label">سعر الصرف (LBP per 1 USD)</label>
            <input type="number" className="input-field" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
          </div>
          <div>
            <label className="input-label">حد التوصيل المجاني (USD Threshold)</label>
            <input type="number" className="input-field" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
          </div>
          <div>
            <label className="input-label">تكلفة التوصيل الأساسية (Delivery Fee - USD)</label>
            <input type="number" className="input-field" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </div>
          <div>
            <label className="input-label">تفعيل الدفع الإلكتروني (Online Pay Mock)</label>
            <select className="input-field" value={onlinePayEnabled} onChange={(e) => setOnlinePayEnabled(parseInt(e.target.value))}>
              <option value={0}>إيقاف - نقدي فقط (Cash Only)</option>
              <option value={1}>تفعيل خيار الدفع الإلكتروني (Allow Online Payment)</option>
            </select>
          </div>
          <div>
            <label className="input-label">إيميل التواصل (Contact Email)</label>
            <input type="email" className="input-field" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label className="input-label">شعار المتجر (Store Logo)</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} className="input-field" style={{ padding: '6px' }} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" className="input-field" style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </form>
      </div>

      {/* Infinite Banners Slider Settings */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image size={18} color="var(--accent-blue)" />
            <span>{lang === 'ar' ? 'البانرات الإعلانية في الواجهة (Hero Banners)' : 'Homepage Hero Banners'}</span>
          </span>
          <button
            type="button"
            onClick={handleAddBanner}
            className="input-field"
            style={{ width: 'auto', padding: '4px 12px', fontSize: '0.8rem', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} />
            <span>{lang === 'ar' ? 'إضافة بنر جديد' : 'Add New Banner'}</span>
          </button>
        </h4>

        <form onSubmit={handleBannersSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {banners.map((b, idx) => {
            const previewUrl = getBannerPreview(b);
            return (
              <div key={b.id} style={{
                padding: '20px',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '20px',
                position: 'relative',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {/* Header of Banner Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                    {lang === 'ar' ? `البانر الإعلاني #${idx + 1}` : `Hero Banner #${idx + 1}`}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => handleDeleteBanner(b.id)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <Trash2 size={16} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{lang === 'ar' ? 'حذف البنر' : 'Delete'}</span>
                  </button>
                </div>

                {/* Banner Content Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
                  {/* Inputs Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="input-label">{lang === 'ar' ? 'العنوان الرئيسي (عربي)' : 'Main Title (AR)'}</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder={lang === 'ar' ? 'أدخل العنوان الرئيسي...' : 'Enter main title...'}
                          value={b.title_ar || ''}
                          onChange={(e) => handleBannerChange(b.id, 'title_ar', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="input-label">{lang === 'ar' ? 'العنوان الرئيسي (إنجليزي)' : 'Main Title (EN)'}</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder={lang === 'ar' ? 'Enter main title in English...' : 'Enter main title...'}
                          value={b.title_en || ''}
                          onChange={(e) => handleBannerChange(b.id, 'title_en', e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="input-label">{lang === 'ar' ? 'النص الفرعي / الوصف (عربي)' : 'Subtitle / Description (AR)'}</label>
                        <textarea
                          className="input-field"
                          style={{ minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                          placeholder={lang === 'ar' ? 'أدخل الوصف أو النص الفرعي...' : 'Enter description...'}
                          value={b.desc_ar || ''}
                          onChange={(e) => handleBannerChange(b.id, 'desc_ar', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="input-label">{lang === 'ar' ? 'النص الفرعي / الوصف (إنجليزي)' : 'Subtitle / Description (EN)'}</label>
                        <textarea
                          className="input-field"
                          style={{ minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                          placeholder={lang === 'ar' ? 'Enter description in English...' : 'Enter description...'}
                          value={b.desc_en || ''}
                          onChange={(e) => handleBannerChange(b.id, 'desc_en', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">{lang === 'ar' ? 'رفع صورة الخلفية للبنر' : 'Upload Banner Image'}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBannerFileChange(b.id, e.target.files[0])}
                        className="input-field"
                        style={{ padding: '6px' }}
                      />
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px',
                    height: '100%',
                    minHeight: '180px',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {previewUrl ? (
                      <>
                        <img
                          src={previewUrl}
                          alt="Banner Preview"
                          style={{
                            width: '100%',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        />
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-light)',
                          marginTop: '8px',
                          textAlign: 'center',
                          wordBreak: 'break-all',
                          padding: '0 8px'
                        }}>
                          {bannerFiles[b.id] ? (
                            <span style={{ color: 'var(--accent-blue)', fontWeight: '700' }}>
                              {lang === 'ar' ? 'صورة جديدة محددة: ' : 'New image selected: '} {bannerFiles[b.id].name}
                            </span>
                          ) : (
                            `${lang === 'ar' ? 'مسار الصورة الحالي: ' : 'Current image path: '} ${b.image}`
                          )}
                        </span>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-light)' }}>
                        <Image size={32} style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>
                          {lang === 'ar' ? 'لا توجد صورة محددة بعد' : 'No image selected yet'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {banners.length > 0 && (
            <button
              type="submit"
              className="input-field"
              style={{
                backgroundColor: 'var(--accent-red-gold)',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                width: 'auto',
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={16} />
              <span>{lang === 'ar' ? 'حفظ التعديلات للبانرات' : 'Save Banner Changes'}</span>
            </button>
          )}
        </form>
      </div>

      {/* Database Utilities */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} color="var(--accent-red-gold)" />
          <span>{lang === 'ar' ? 'أدوات الصيانة وقاعدة البيانات' : 'Database & Maintenance Utilities'}</span>
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {lang === 'ar' 
            ? 'تصدير نسخة احتياطية كاملة من الموقع. تشمل النسخة كافة الإعدادات، الحسابات، المنتجات، التصنيفات، الطلبيات، والصور المخزنة بصيغة Base64.' 
            : 'Export a complete website backup. The backup file includes all settings, accounts, products, categories, orders, and Base64 images.'}
        </p>
        <button
          onClick={handleDownloadBackup}
          className="input-field"
          style={{
            width: 'auto',
            padding: '10px 24px',
            backgroundColor: 'var(--accent-red-gold)',
            color: 'white',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>{lang === 'ar' ? 'تحميل نسخة احتياطية كاملة (JSON)' : 'Download Full Backup (JSON)'}</span>
        </button>
      </div>

    </div>
  );
}
