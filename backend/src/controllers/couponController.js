const db = require('../config/db');

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await db.allAsync('SELECT * FROM coupons ORDER BY id DESC');
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في جلب الكوبونات', error_en: 'Error fetching coupons' });
  }
};

exports.createCoupon = async (req, res) => {
  const { code, discount_percent } = req.body;

  if (!code || !discount_percent) {
    return res.status(400).json({ error_ar: 'الرمز ونسبة الخصم مطلوبة', error_en: 'Code and discount percent are required' });
  }

  try {
    await db.runAsync(
      'INSERT INTO coupons (code, discount_percent, active) VALUES (?, ?, 1)',
      [code.toUpperCase().trim(), parseFloat(discount_percent)]
    );
    res.status(201).json({ message_ar: 'تم إنشاء الكوبون بنجاح', message_en: 'Coupon created successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ أثناء إنشاء الكوبون. قد يكون مكرراً.', error_en: 'Error creating coupon. It might already exist.' });
  }
};

exports.deleteCoupon = async (req, res) => {
  const { id } = req.params;
  try {
    await db.runAsync('DELETE FROM coupons WHERE id = ?', [id]);
    res.json({ message_ar: 'تم حذف الكوبون بنجاح', message_en: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ أثناء حذف الكوبون', error_en: 'Error deleting coupon' });
  }
};
