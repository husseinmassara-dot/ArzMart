import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Settings, Image, Plus, Trash2, Save, Upload } from 'lucide-react';

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
  const [siteOffline, setSiteOffline] = useState(0);

  // Banners states
  const [banners, setBanners] = useState([]);
  const [bannerFiles, setBannerFiles] = useState({}); // key: banner ID, value: file
  const [previewLangs, setPreviewLangs] = useState({}); // key: banner ID, value: 'ar' | 'en'
  const [restoreFile, setRestoreFile] = useState(null);

  const togglePreviewLang = (id) => {
    setPreviewLangs(prev => ({
      ...prev,
      [id]: prev[id] === 'en' ? 'ar' : 'en'
    }));
  };
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');

  useEffect(() => {
    if (settings) {
      setAppName(settings.app_name || '');
      setExchangeRate(settings.exchange_rate || 89500);
      setFreeThreshold(settings.free_delivery_threshold || 50);
      setDeliveryFee(settings.delivery_fee || 4);
      setOnlinePayEnabled(settings.online_payment_enabled || 0);
      setContactEmail(settings.contact_email || 'info@arz-mart.com');
      setSiteOffline(settings.site_offline || 0);
      
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

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreFile) return;

    const confirmMsg = lang === 'ar' 
      ? '⚠️ تنبيه حرج: سيقوم هذا الإجراء بمسح كافة البيانات والمنتجات والطلبيات الحالية واستبدالها بالنسخة الاحتياطية. هل أنت متأكد من رغبتك بالاستمرار؟'
      : '⚠️ CRITICAL WARNING: This action will completely wipe all current data, products, and orders, replacing them with the backup data. Are you sure you want to proceed?';
    
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreError('');
    setRestoreSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          const res = await fetch(`${apiBase}/admin/restore`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(jsonData)
          });

          if (res.ok) {
            const data = await res.json();
            setRestoreSuccess(lang === 'ar' ? data.message_ar : data.message_en);
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            const errData = await res.json().catch(() => ({}));
            setRestoreError(errData.error_ar || errData.error_en || 'Restore failed');
          }
        } catch (parseErr) {
          setRestoreError(lang === 'ar' ? 'ملف النسخة الاحتياطية غير صالح أو ليس بتنسيق JSON صحيح' : 'The backup file is invalid or not in correct JSON format');
        } finally {
          setIsRestoring(false);
        }
      };
      reader.onerror = () => {
        setRestoreError(lang === 'ar' ? 'خطأ في قراءة ملف النسخة الاحتياطية' : 'Error reading the backup file');
        setIsRestoring(false);
      };
      reader.readAsText(restoreFile);
    } catch (err) {
      console.error('Restore error:', err);
      setRestoreError(lang === 'ar' ? 'حدث خطأ غير متوقع أثناء الاستعادة' : 'An unexpected error occurred during restore');
      setIsRestoring(false);
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
    formData.append('site_offline', siteOffline);
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

  const handleMoveBannerUp = (index) => {
    if (index === 0) return;
    setBanners(prev => {
      const newList = [...prev];
      const temp = newList[index];
      newList[index] = newList[index - 1];
      newList[index - 1] = temp;
      return newList;
    });
  };

  const handleMoveBannerDown = (index) => {
    if (index === banners.length - 1) return;
    setBanners(prev => {
      const newList = [...prev];
      const temp = newList[index];
      newList[index] = newList[index + 1];
      newList[index + 1] = temp;
      return newList;
    });
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
            <label className="input-label">{lang === 'ar' ? 'حالة الموقع (Site Status)' : 'Site Status'}</label>
            <button
              type="button"
              onClick={() => setSiteOffline(siteOffline === 1 ? 0 : 1)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: siteOffline === 1 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: siteOffline === 1 ? '#ef4444' : '#10b981',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: siteOffline === 1 ? '#ef4444' : '#10b981',
                display: 'inline-block'
              }}></span>
              <span>
                {siteOffline === 1 
                  ? (lang === 'ar' ? 'مغلق - وضع الصيانة (Offline)' : 'Offline / Maintenance')
                  : (lang === 'ar' ? 'متصل - متاح للجميع (Online)' : 'Online / Active')
                }
              </span>
            </button>
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
            const isPreviewRtl = previewLangs[b.id] !== 'en'; // default to true (ar)
            const titleText = isPreviewRtl ? (b.title_ar || 'العنوان الرئيسي للبنر') : (b.title_en || 'Main Slide Title');
            const descText = isPreviewRtl ? (b.desc_ar || 'تفاصيل العرض الترويجي والخصومات تظهر هنا') : (b.desc_en || 'Promo details and discounts appear here');
            
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                      {lang === 'ar' ? `البانر الإعلاني #${idx + 1}` : `Hero Banner #${idx + 1}`}
                    </span>
                    
                    {/* Reorder Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveBannerUp(idx)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: idx === 0 ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                          color: idx === 0 ? 'var(--text-light)' : 'var(--text-primary)',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === banners.length - 1}
                        onClick={() => handleMoveBannerDown(idx)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: idx === banners.length - 1 ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                          color: idx === banners.length - 1 ? 'var(--text-light)' : 'var(--text-primary)',
                          cursor: idx === banners.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  
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

                  {/* Dynamic Mockup Live Preview Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-light)' }}>
                        {lang === 'ar' ? 'معاينة حية تفاعلية (Live Preview)' : 'Live Interactive Preview'}
                      </span>
                      {/* Language switcher tab */}
                      <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <button
                          type="button"
                          onClick={() => togglePreviewLang(b.id)}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: isPreviewRtl ? 'var(--accent-blue)' : 'transparent',
                            color: isPreviewRtl ? 'white' : 'var(--text-light)',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          AR
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePreviewLang(b.id)}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: !isPreviewRtl ? 'var(--accent-blue)' : 'transparent',
                            color: !isPreviewRtl ? 'white' : 'var(--text-light)',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          EN
                        </button>
                      </div>
                    </div>

                    {/* Scale Mockup of Storefront Banner */}
                    <div style={{
                      position: 'relative',
                      height: '180px',
                      width: '100%',
                      backgroundColor: '#070a13',
                      overflow: 'hidden',
                      borderRadius: '16px',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {/* Slide Image Background with overlay gradient */}
                      {previewUrl ? (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundImage: `linear-gradient(to ${isPreviewRtl ? 'left' : 'right'}, rgba(7, 10, 19, 0.95) 30%, rgba(7, 10, 19, 0.5) 65%, rgba(7, 10, 19, 0.1) 100%), url(${previewUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          zIndex: 1
                        }} />
                      ) : (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: '#0c1222',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.25)',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          zIndex: 1
                        }}>
                          {lang === 'ar' ? 'الرجاء رفع صورة للبنر' : 'Please upload a banner image'}
                        </div>
                      )}

                      {/* Content Overlay inside Mockup */}
                      <div style={{
                        position: 'absolute',
                        top: '0',
                        bottom: '0',
                        left: isPreviewRtl ? 'auto' : '20px',
                        right: isPreviewRtl ? '20px' : 'auto',
                        width: '55%',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        textAlign: isPreviewRtl ? 'right' : 'left',
                        gap: '6px',
                        zIndex: 2,
                        direction: isPreviewRtl ? 'rtl' : 'ltr'
                      }}>
                        <h5 style={{
                          fontSize: '1rem',
                          fontWeight: '900',
                          lineHeight: '1.2',
                          textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                          margin: 0,
                          width: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#ffffff'
                        }}>
                          {titleText}
                        </h5>
                        
                        <p style={{
                          fontSize: '0.7rem',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.8)',
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                          lineHeight: '1.4',
                          margin: 0,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {descText}
                        </p>

                        <button 
                          type="button"
                          style={{
                            backgroundColor: 'var(--accent-brand)',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontWeight: '800',
                            fontSize: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '4px',
                            cursor: 'default',
                            boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.5" fill="none">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                          </svg>
                          <span>{isPreviewRtl ? 'تسوق الآن' : 'Shop Now'}</span>
                        </button>
                      </div>

                      {/* Info Tag at bottom */}
                      <span style={{
                        position: 'absolute',
                        bottom: '6px',
                        left: isPreviewRtl ? '6px' : 'auto',
                        right: isPreviewRtl ? 'auto' : '6px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        zIndex: 3
                      }}>
                        {bannerFiles[b.id] ? (lang === 'ar' ? 'صورة جديدة محملة' : 'New Image Loaded') : (lang === 'ar' ? 'صورة محفوظة' : 'Saved Image')}
                      </span>
                    </div>
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
          <span>{lang === 'ar' ? 'إدارة النسخ الاحتياطي واستعادة الموقع' : 'Site Backup & Restore Management'}</span>
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Backup Panel */}
          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {lang === 'ar' ? 'إنشاء نسخة احتياطية (Create Backup)' : 'Create Backup'}
              </h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.4' }}>
                {lang === 'ar' 
                  ? 'تصدير نسخة احتياطية كاملة من الموقع تشمل كافة الإعدادات، الحسابات، المنتجات، التصنيفات، الطلبيات، والصور المخزنة بصيغة Base64.' 
                  : 'Export a complete website backup file including all settings, accounts, products, categories, orders, and Base64 images.'}
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="input-field"
              style={{
                width: '100%',
                padding: '10px 24px',
                backgroundColor: 'var(--accent-blue)',
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

          {/* Restore Panel */}
          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-red-gold)', marginBottom: '8px' }}>
                {lang === 'ar' ? 'استعادة قاعدة البيانات (Restore Backup)' : 'Restore Backup'}
              </h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.4' }}>
                {lang === 'ar' 
                  ? 'رفع ملف نسخة احتياطية بصيغة JSON تم تحميله سابقاً لاستبدال واستعادة كافة البيانات للمتجر بالكامل لآخر نقطة حفظ.' 
                  : 'Upload a previously saved JSON backup file to overwrite and restore the entire store database back to that state.'}
              </p>
            </div>
            <form onSubmit={handleRestore} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  setRestoreFile(e.target.files[0]);
                  setRestoreError('');
                  setRestoreSuccess('');
                }}
                style={{
                  fontSize: '0.75rem',
                  width: '100%',
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                type="submit"
                disabled={!restoreFile || isRestoring}
                className="input-field"
                style={{
                  width: '100%',
                  padding: '10px 24px',
                  backgroundColor: 'var(--accent-red-gold)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '700',
                  cursor: restoreFile && !isRestoring ? 'pointer' : 'not-allowed',
                  opacity: restoreFile && !isRestoring ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Upload size={16} />
                <span>{isRestoring ? (lang === 'ar' ? 'جاري الاستعادة...' : 'Restoring...') : (lang === 'ar' ? 'بدء استعادة البيانات' : 'Restore Backup')}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Status messages */}
        {restoreError && (
          <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.8rem', fontWeight: '600', borderRadius: '8px' }}>
            ⚠️ {restoreError}
          </div>
        )}
        {restoreSuccess && (
          <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.8rem', fontWeight: '600', borderRadius: '8px' }}>
            ✅ {restoreSuccess}
          </div>
        )}

        <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(217, 119, 6, 0.05)', border: '1px solid rgba(217, 119, 6, 0.2)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: '1.4' }}>
          <strong>{lang === 'ar' ? '⚠️ تحذير هام:' : '⚠️ Critical Warning:'}</strong>{' '}
          {lang === 'ar' 
            ? 'عملية الاستعادة ستقوم بمسح كامل قاعدة البيانات الحالية تماماً. يرجى الحذر الشديد وعدم مقاطعة العملية أثناء تشغيلها.'
            : 'Restoring will completely erase the current database. Please be extremely careful and do not interrupt the process once started.'}
        </div>
      </div>

    </div>
  );
}
