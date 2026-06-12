const db = require('../config/db');

exports.getMerchants = async (req, res) => {
  try {
    const merchants = await db.allAsync('SELECT * FROM merchants ORDER BY id DESC');
    res.json(merchants);
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في جلب التجار', error_en: 'Error fetching merchants' });
  }
};

exports.createMerchant = async (req, res) => {
  const { name, phone, email, company } = req.body;

  if (!name) {
    return res.status(400).json({ error_ar: 'الاسم مطلوب', error_en: 'Name is required' });
  }

  try {
    await db.runAsync(
      'INSERT INTO merchants (name, phone, email, company) VALUES (?, ?, ?, ?)',
      [name.trim(), phone || '', email || '', company || '']
    );
    res.status(201).json({ message_ar: 'تم إضافة التاجر بنجاح', message_en: 'Merchant added successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ أثناء إضافة التاجر', error_en: 'Error creating merchant' });
  }
};

exports.updateMerchant = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, company } = req.body;

  if (!name) {
    return res.status(400).json({ error_ar: 'الاسم مطلوب', error_en: 'Name is required' });
  }

  try {
    await db.runAsync(
      'UPDATE merchants SET name = ?, phone = ?, email = ?, company = ? WHERE id = ?',
      [name.trim(), phone || '', email || '', company || '', id]
    );
    res.json({ message_ar: 'تم تحديث بيانات التاجر بنجاح', message_en: 'Merchant details updated successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ أثناء تحديث بيانات التاجر', error_en: 'Error updating merchant' });
  }
};

exports.deleteMerchant = async (req, res) => {
  const { id } = req.params;
  try {
    await db.runAsync('DELETE FROM merchants WHERE id = ?', [id]);
    res.json({ message_ar: 'تم حذف التاجر بنجاح', message_en: 'Merchant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ أثناء حذف التاجر', error_en: 'Error deleting merchant' });
  }
};
