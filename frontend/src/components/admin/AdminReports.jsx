import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Printer, TrendingUp, TrendingDown, DollarSign, Box, Percent } from 'lucide-react';

export default function AdminReports() {
  const { lang, formatPrice, apiBase } = useApp();
  const { token } = useAuth();

  const [reportData, setReportData] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${apiBase}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSearchHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/analytics/search-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(data || []);
      }
    } catch (err) {
      console.error('Error fetching search history:', err);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchSearchHistory();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!reportData) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>
        تحميل التقارير والتحليلات المالية...
      </div>
    );
  }

  const { summary, dailySales, monthlySales, inventory } = reportData;

  // Calculate margin percent
  const marginPercent = summary.delivered_revenue_usd > 0
    ? (summary.estimated_profit_usd / summary.delivered_revenue_usd) * 100
    : 0;

  // Max value helper for charts scaling
  const maxDailySales = dailySales.length > 0 ? Math.max(...dailySales.map(d => d.revenue_usd)) : 1;
  const maxMonthlySales = monthlySales.length > 0 ? Math.max(...monthlySales.map(m => m.revenue_usd)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Print Controls */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handlePrint}
          className="input-field"
          style={{
            width: 'auto',
            padding: '8px 20px',
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Printer size={16} />
          <span>طباعة تقرير المبيعات والأرباح التفصيلي</span>
        </button>
      </div>

      {/* Financial Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Total revenue delivered */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid #10b981', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>إجمالي المبيعات (Revenue)</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#10b981' }}>
            {formatPrice(summary.delivered_revenue_usd || 0)}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            من إجمالي {summary.delivered_orders || 0} طلبيات مستلمة بنجاح
          </span>
        </div>

        {/* Cost of Goods Sold */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid #3b82f6', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>تكلفة البضاعة المبيعة (COGS)</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#3b82f6' }}>
            {formatPrice(summary.delivered_revenue_usd - summary.estimated_profit_usd)}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            تكلفة شراء وتأمين البضائع من الموردين
          </span>
        </div>

        {/* Real Net Profit */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid var(--accent-red-gold)', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>صافي الأرباح الحقيقية (Net Profit)</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: 'var(--accent-red-gold)' }}>
            {formatPrice(summary.estimated_profit_usd || 0)}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            هامش الربح الفعلي للمتجر: {marginPercent.toFixed(1)}%
          </span>
        </div>

        {/* Pending Sales */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid #d97706', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>المبيعات المعلقة النشطة</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#d97706' }}>
            {formatPrice(summary.pending_revenue_usd || 0)}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            من {summary.pending_orders || 0} طلبيات قيد التحضير/الشحن
          </span>
        </div>

      </div>

      {/* Traffic & Visitors Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Unique Visitors */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>الزوار الفريدون (Unique Visitors)</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: '#8b5cf6' }}>
            {summary.unique_visitors || 0}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            عدد المستخدمين الفريدين الذين فتحوا المتجر
          </span>
        </div>

        {/* Total Page Views */}
        <div className="dashboard-card" style={{ borderLeft: '4px solid var(--accent-red-gold)', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>إجمالي مشاهدات الصفحات (Page Views)</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0', color: 'var(--accent-red-gold)' }}>
            {summary.total_views || 0}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            إجمالي النقرات وتصفح الأقسام على الموقع والتطبيق
          </span>
        </div>

      </div>

      {/* Visual Analytics Section (Bar Charts mockup using CSS) */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Daily Sales Chart */}
        <div className="dashboard-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px' }}>منحنى المبيعات اليومية الأخيرة</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingTop: '20px', borderBottom: '2px solid var(--border-color)' }}>
            {dailySales.slice(0, 7).reverse().map((d, idx) => {
              const heightPct = (d.revenue_usd / maxDailySales) * 100;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>${Math.round(d.revenue_usd)}</span>
                  <div style={{
                    width: '24px',
                    height: `${Math.max(10, heightPct)}px`,
                    backgroundColor: 'var(--accent-blue)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease-out'
                  }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', writingMode: 'vertical-rl', textTransform: 'uppercase' }}>
                    {d.date.split('-').slice(1).join('/')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Sales Chart */}
        <div className="dashboard-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px' }}>منحنى المبيعات الشهرية الأخيرة</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingTop: '20px', borderBottom: '2px solid var(--border-color)' }}>
            {monthlySales.slice(0, 6).reverse().map((m, idx) => {
              const heightPct = (m.revenue_usd / maxMonthlySales) * 100;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>${Math.round(m.revenue_usd)}</span>
                  <div style={{
                    width: '32px',
                    height: `${Math.max(10, heightPct)}px`,
                    backgroundColor: 'var(--accent-red-gold)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease-out'
                  }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: '600' }}>
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Reports Tables Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Daily sales table */}
        <div className="dashboard-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            تقرير حركة المبيعات اليومية التفصيلي
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                <th style={{ padding: '8px 0', textAlign: 'start' }}>التاريخ</th>
                <th style={{ padding: '8px 0', textAlign: 'center' }}>الطلبات</th>
                <th style={{ padding: '8px 0', textAlign: 'end' }}>المبيعات</th>
                <th style={{ padding: '8px 0', textAlign: 'end' }}>الأرباح</th>
              </tr>
            </thead>
            <tbody>
              {dailySales.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '8px 0' }}>{d.date}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center' }}>{d.count}</td>
                  <td style={{ padding: '8px 0', textAlign: 'end', fontWeight: '700' }}>{formatPrice(d.revenue_usd)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'end', fontWeight: '700', color: 'var(--accent-red-gold)' }}>{formatPrice(d.revenue_usd - d.cost_usd)}</td>
                </tr>
              ))}
              {dailySales.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
                    لا يوجد مبيعات يومية مسجلة بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Monthly sales table */}
        <div className="dashboard-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            تقرير حركة المبيعات الشهرية التفصيلي
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                <th style={{ padding: '8px 0', textAlign: 'start' }}>الشهر</th>
                <th style={{ padding: '8px 0', textAlign: 'center' }}>الطلبات</th>
                <th style={{ padding: '8px 0', textAlign: 'end' }}>المبيعات</th>
                <th style={{ padding: '8px 0', textAlign: 'end' }}>الأرباح</th>
              </tr>
            </thead>
            <tbody>
              {monthlySales.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '8px 0' }}>{m.month}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center' }}>{m.count}</td>
                  <td style={{ padding: '8px 0', textAlign: 'end', fontWeight: '700' }}>{formatPrice(m.revenue_usd)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'end', fontWeight: '700', color: 'var(--accent-red-gold)' }}>{formatPrice(m.revenue_usd - m.cost_usd)}</td>
                </tr>
              ))}
              {monthlySales.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
                    لا يوجد مبيعات شهرية مسجلة بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Search Trends Section */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginTop: '10px' }}>
        <div className="dashboard-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            {lang === 'ar' ? 'سجل عبارات البحث الأكثر شعبية بالمتجر' : 'Most Popular Store Search Queries'}
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                <th style={{ padding: '8px 0', textAlign: 'start' }}>{lang === 'ar' ? 'عبارة البحث' : 'Search Query'}</th>
                <th style={{ padding: '8px 0', textAlign: 'center' }}>{lang === 'ar' ? 'مرات البحث' : 'Search Count'}</th>
                <th style={{ padding: '8px 0', textAlign: 'end' }}>{lang === 'ar' ? 'آخر تاريخ بحث' : 'Last Searched'}</th>
              </tr>
            </thead>
            <tbody>
              {searchHistory.slice(0, 15).map((sh, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '8px 0', fontWeight: '700', color: 'var(--accent-blue)' }}>{sh.query}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: '700' }}>{sh.count}</td>
                  <td style={{ padding: '8px 0', textAlign: 'end', color: 'var(--text-light)' }}>
                    {new Date(sh.last_searched).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                  </td>
                </tr>
              ))}
              {searchHistory.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
                    {lang === 'ar' ? 'لا يوجد عمليات بحث مسجلة بعد.' : 'No search queries logged yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
