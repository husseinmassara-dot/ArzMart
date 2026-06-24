import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Plus, DollarSign, Calendar, PlusCircle } from 'lucide-react';

export default function AdminInvoices() {
  const { lang, formatPrice, apiBase, apiHost } = useApp();
  const { token } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [products, setProducts] = useState([]);

  // Form states
  const [merchantId, setMerchantId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ product_id: '', quantity: '10', cost_price_usd: '0.00', searchQuery: '', showDropdown: false }]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${apiBase}/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error('Fetch invoices error:', err);
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
      console.error('Fetch merchants error:', err);
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
    fetchInvoices();
    fetchMerchants();
    fetchProducts();
  }, []);

  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', quantity: '10', cost_price_usd: '0.00', searchQuery: '', showDropdown: false }]);
  };

  const handleRemoveItemRow = (index) => {
    const newList = items.filter((_, i) => i !== index);
    setItems(newList.length > 0 ? newList : [{ product_id: '', quantity: '10', cost_price_usd: '0.00', searchQuery: '', showDropdown: false }]);
  };

  const handleItemChange = (index, field, value) => {
    const newList = [...items];
    newList[index][field] = value;
    
    // Automatically set default cost price when product is selected
    if (field === 'product_id' && value) {
      const selectedProd = products.find(p => String(p.id) === String(value));
      if (selectedProd) {
        newList[index]['cost_price_usd'] = String(selectedProd.cost_price_usd || '0.00');
      }
    }
    
    setItems(newList);
  };

  // Compute Grand Total
  const grandTotal = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0;
    const cost = parseFloat(item.cost_price_usd) || 0;
    return sum + (qty * cost);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!merchantId || !invoiceDate) return;

    // Filter out incomplete rows
    const validItems = items.filter(item => item.product_id && parseInt(item.quantity) > 0);
    if (validItems.length === 0) {
      setFormError(lang === 'ar' ? 'الرجاء تحديد منتج واحد على الأقل بكمية صالحة' : 'Please select at least one product with a valid quantity');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiBase}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          items: validItems.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            cost_price_usd: parseFloat(item.cost_price_usd)
          }))
        })
      });

      if (res.ok) {
        setFormSuccess(lang === 'ar' ? 'تم تسجيل فاتورة التوريد وتحديث كميات وأسعار المنتجات بنجاح ✓' : 'Supply invoice logged and inventory updated successfully ✓');
        resetForm();
        fetchInvoices();
        fetchProducts(); // Refresh products to see updated stock/cost prices
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
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف سجل الفاتورة هذا؟ لن يؤثر ذلك على المخزون الحالي.' : 'Are you sure you want to delete this invoice log? This will not affect current stock.')) return;
    try {
      const res = await fetch(`${apiBase}/invoices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setMerchantId('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setItems([{ product_id: '', quantity: '10', cost_price_usd: '0.00', searchQuery: '', showDropdown: false }]);
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
          {lang === 'ar' ? 'إدخال فواتير المشتريات والتوريد' : 'Supplier Supply Invoices'}
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
          <span>{showAddForm ? (lang === 'ar' ? 'إغلاق' : 'Close') : (lang === 'ar' ? 'إدخال فاتورة توريد جديدة' : 'Enter New Supply Invoice')}</span>
        </button>
      </div>

      {/* Add Invoice Form */}
      {showAddForm && (
        <div className="dashboard-card animate-scale" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '16px' }}>
            {lang === 'ar' ? 'تفاصيل فاتورة التوريد الجديدة' : 'New Supply Invoice Details'}
          </h4>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Metadata Fields Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Select Supplier */}
              <div>
                <label className="input-label">{lang === 'ar' ? 'المورد / التاجر *' : 'Supplier / Merchant *'}</label>
                <select 
                  required 
                  className="input-field" 
                  value={merchantId} 
                  onChange={(e) => setMerchantId(e.target.value)}
                >
                  <option value="">-- {lang === 'ar' ? 'اختر المورد' : 'Select Supplier'} --</option>
                  {merchants.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.company ? `(${m.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div>
                <label className="input-label">{lang === 'ar' ? 'رقم الفاتورة (Invoice #)' : 'Invoice #'}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. INV-2026-904"
                  value={invoiceNumber} 
                  onChange={(e) => setInvoiceNumber(e.target.value)} 
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="input-label">{lang === 'ar' ? 'تاريخ الفاتورة *' : 'Invoice Date *'}</label>
                <input 
                  type="date" 
                  required
                  className="input-field" 
                  value={invoiceDate} 
                  onChange={(e) => setInvoiceDate(e.target.value)} 
                />
              </div>
            </div>

            {/* Dynamic Items Section */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: 'var(--bg-secondary)', marginTop: '8px' }}>
              <span className="input-label" style={{ display: 'block', fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-primary)' }}>
                {lang === 'ar' ? 'أصناف الفاتورة والكميات وأسعار التكلفة' : 'Invoice Items, Quantities & Cost Prices'}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    
                    {/* Searchable Product Selection */}
                    <div style={{ flex: '2', minWidth: '180px', position: 'relative' }}>
                      <input
                        type="text"
                        required
                        className="input-field"
                        style={{ margin: 0 }}
                        placeholder={lang === 'ar' ? 'ابحث باسم الصنف أو الموديل...' : 'Search item or model...'}
                        value={item.searchQuery || ''}
                        onFocus={() => {
                          const newList = [...items];
                          newList[index].showDropdown = true;
                          setItems(newList);
                        }}
                        onChange={(e) => {
                          const newList = [...items];
                          newList[index].searchQuery = e.target.value;
                          newList[index].product_id = ''; // reset selection
                          newList[index].showDropdown = true;
                          setItems(newList);
                        }}
                      />
                      
                      {item.showDropdown && (
                        <>
                          <div 
                            onClick={() => {
                              const newList = [...items];
                              newList[index].showDropdown = false;
                              if (!newList[index].product_id) {
                                newList[index].searchQuery = '';
                              } else {
                                const selectedProd = products.find(p => String(p.id) === String(newList[index].product_id));
                                if (selectedProd) {
                                  newList[index].searchQuery = `${lang === 'ar' ? selectedProd.name_ar : selectedProd.name_en}${selectedProd.model_number ? ` (${selectedProd.model_number})` : ''}`;
                                }
                              }
                              setItems(newList);
                            }} 
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} 
                          />
                          
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            marginTop: '4px'
                          }}>
                            {products.filter(p => {
                              const q = (item.searchQuery || '').toLowerCase().trim();
                              if (!q) return true;
                              const nameAr = (p.name_ar || '').toLowerCase();
                              const nameEn = (p.name_en || '').toLowerCase();
                              const model = (p.model_number || '').toLowerCase();
                              return nameAr.includes(q) || nameEn.includes(q) || model.includes(q);
                            }).length === 0 ? (
                              <div style={{ padding: '8px', color: 'var(--text-light)', fontSize: '0.82rem', textAlign: 'center' }}>
                                {lang === 'ar' ? 'لا توجد نتائج' : 'No results'}
                              </div>
                            ) : (
                              products.filter(p => {
                                const q = (item.searchQuery || '').toLowerCase().trim();
                                if (!q) return true;
                                const nameAr = (p.name_ar || '').toLowerCase();
                                const nameEn = (p.name_en || '').toLowerCase();
                                const model = (p.model_number || '').toLowerCase();
                                return nameAr.includes(q) || nameEn.includes(q) || model.includes(q);
                              }).map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    const newList = [...items];
                                    newList[index].product_id = p.id;
                                    newList[index].searchQuery = `${lang === 'ar' ? p.name_ar : p.name_en}${p.model_number ? ` (${p.model_number})` : ''}`;
                                    newList[index].cost_price_usd = String(p.cost_price_usd || '0.00');
                                    newList[index].showDropdown = false;
                                    setItems(newList);
                                  }}
                                  style={{
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background-color 0.2s',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontWeight: '600' }}>
                                      {lang === 'ar' ? p.name_ar : p.name_en}
                                    </span>
                                    {p.model_number && (
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                                        {lang === 'ar' ? `الموديل: ${p.model_number}` : `Model: ${p.model_number}`}
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                    {lang === 'ar' ? `تكلفة: $${p.cost_price_usd}` : `Cost: ${p.cost_price_usd}`}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Quantity */}
                    <div style={{ width: '120px' }}>
                      <input 
                        type="number" 
                        min="1" 
                        required 
                        placeholder={lang === 'ar' ? 'الكمية' : 'Quantity'} 
                        className="input-field" 
                        style={{ margin: 0 }}
                        value={item.quantity} 
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} 
                      />
                    </div>

                    {/* Unit Cost Price */}
                    <div style={{ width: '140px' }}>
                      <div style={{ position: 'relative' }}>
                        <DollarSign size={12} style={{ position: 'absolute', left: lang === 'ar' ? 'auto' : '8px', right: lang === 'ar' ? '8px' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          required 
                          placeholder={lang === 'ar' ? 'سعر التكلفة' : 'Unit Cost ($)'} 
                          className="input-field" 
                          style={{ margin: 0, paddingInlineStart: lang === 'ar' ? '10px' : '22px', paddingInlineEnd: lang === 'ar' ? '22px' : '10px' }}
                          value={item.cost_price_usd} 
                          onChange={(e) => handleItemChange(index, 'cost_price_usd', e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* Line Total display */}
                    <div style={{ width: '110px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', padding: '0 5px' }}>
                      {formatPrice((parseInt(item.quantity) || 0) * (parseFloat(item.cost_price_usd) || 0))}
                    </div>

                    {/* Delete Row button */}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItemRow(index)}
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
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Item row and Total Price row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={handleAddItemRow}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <PlusCircle size={14} />
                  <span>{lang === 'ar' ? 'إضافة صنف آخر للفاتورة' : 'Add Another Item'}</span>
                </button>

                <div style={{ fontSize: '1rem', fontWeight: '800' }}>
                  <span>{lang === 'ar' ? 'إجمالي قيمة الفاتورة: ' : 'Grand Total: '}</span>
                  <span style={{ color: 'var(--accent-blue)', fontSize: '1.2rem' }}>{formatPrice(grandTotal)}</span>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="input-field"
                style={{ width: 'auto', padding: '10px 24px', backgroundColor: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (lang === 'ar' ? 'جاري الحفظ وتحديث المخزن...' : 'Saving & Updating Stock...') : (lang === 'ar' ? 'حفظ الفاتورة وتوريد المخزون' : 'Save Invoice & Restock')}
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

      {/* Invoices List Table */}
      <div className="dashboard-card" style={{ overflowX: 'auto', padding: '20px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '16px' }}>
          {lang === 'ar' ? 'سجلات فواتير التوريد المدخلة' : 'Supply Invoices Registry'}
        </h4>

        {invoices.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>
            {lang === 'ar' ? 'لا يوجد فواتير توريد مدخلة بعد.' : 'No supply invoices registered yet.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'المورد' : 'Supplier'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'تاريخ الفاتورة' : 'Invoice Date'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'القيمة الإجمالية' : 'Grand Total'}</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>{lang === 'ar' ? 'الأصناف الموردة' : 'Supplied Items'}</th>
                <th style={{ padding: '10px', textAlign: 'start' }}>{lang === 'ar' ? 'تاريخ التسجيل' : 'Date Logged'}</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>{lang === 'ar' ? 'العمليات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isExpanded = expandedInvoiceId === inv.id;
                
                return (
                  <React.Fragment key={inv.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      
                      {/* Merchant name */}
                      <td style={{ padding: '10px', fontWeight: '600' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{inv.merchant_name || (lang === 'ar' ? 'مورد غير معروف' : 'Unknown Merchant')}</span>
                          {inv.merchant_company && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{inv.merchant_company}</span>
                          )}
                        </div>
                      </td>

                      {/* Invoice number */}
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {inv.invoice_number || '-'}
                      </td>

                      {/* Invoice Date */}
                      <td style={{ padding: '10px', color: 'var(--text-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          <span>{inv.invoice_date}</span>
                        </div>
                      </td>

                      {/* Total amount */}
                      <td style={{ padding: '10px', fontWeight: '800', color: 'var(--accent-blue)' }}>
                        {formatPrice(inv.total_amount)}
                      </td>

                      {/* Supplied items expander */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--accent-blue)',
                            border: '1px solid var(--border-color)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: '700'
                          }}
                        >
                          {isExpanded 
                            ? (lang === 'ar' ? 'إخفاء التفاصيل' : 'Hide Details') 
                            : (lang === 'ar' ? `عرض الأصناف (${inv.items.length}) ▾` : `View Items (${inv.items.length}) ▾`)}
                        </button>
                      </td>

                      {/* Created At Date */}
                      <td style={{ padding: '10px', color: 'var(--text-light)', fontSize: '0.82rem' }}>
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>

                      {/* Delete Action */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title={lang === 'ar' ? 'حذف سجل الفاتورة' : 'Delete Invoice'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan="7" style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: '800', fontSize: '0.82rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                              {lang === 'ar' ? 'الأصناف والأسعار الواردة بالفاتورة:' : 'Invoice Items & Cost Details:'}
                            </div>
                            <div style={{ padding: '8px 12px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.78rem' }}>
                                    <th style={{ padding: '6px', textAlign: 'start' }}>#</th>
                                    <th style={{ padding: '6px', textAlign: 'start' }}>{lang === 'ar' ? 'اسم الصنف' : 'Item Name'}</th>
                                    <th style={{ padding: '6px', textAlign: 'center' }}>{lang === 'ar' ? 'الكمية الموردة' : 'Qty Supplied'}</th>
                                    <th style={{ padding: '6px', textAlign: 'start' }}>{lang === 'ar' ? 'سعر التكلفة الموحد' : 'Cost Price ($)'}</th>
                                    <th style={{ padding: '6px', textAlign: 'start' }}>{lang === 'ar' ? 'الإجمالي الفرعي' : 'Subtotal'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.items.map((it, idx) => {
                                    const prod = products.find(p => p.id === it.product_id);
                                    const prodName = prod ? (lang === 'ar' ? prod.name_ar : prod.name_en) : (lang === 'ar' ? `صنف غير موجود (معرف #${it.product_id})` : `Deleted Product (ID #${it.product_id})`);
                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px dashed var(--border-color)', fontSize: '0.8rem' }}>
                                        <td style={{ padding: '6px' }}>{idx + 1}</td>
                                        <td style={{ padding: '6px', fontWeight: '600' }}>{prodName}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700' }}>{it.quantity}</td>
                                        <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{formatPrice(it.cost_price_usd)}</td>
                                        <td style={{ padding: '6px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatPrice(it.quantity * it.cost_price_usd)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
