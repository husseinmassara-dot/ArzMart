const db = require('../config/db');

exports.createInvoice = async (req, res) => {
  const { merchant_id, invoice_number, invoice_date, items } = req.body;

  if (!merchant_id || !invoice_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error_ar: 'الرجاء إدخال الحقول المطلوبة وتحديد صنف واحد على الأقل في الفاتورة',
      error_en: 'Please enter required fields and select at least one item for the invoice'
    });
  }

  const mid = parseInt(merchant_id);
  const itemsJsonStr = JSON.stringify(items);

  // Calculate total amount
  let totalAmount = 0;
  for (const item of items) {
    const qty = parseInt(item.quantity) || 0;
    const cost = parseFloat(item.cost_price_usd) || 0;
    totalAmount += qty * cost;
  }

  try {
    // Start database transaction
    await db.runAsync('BEGIN TRANSACTION');

    // 1. Insert invoice record
    const result = await db.runAsync(`
      INSERT INTO invoices (merchant_id, invoice_number, invoice_date, total_amount, items)
      VALUES (?, ?, ?, ?, ?)
    `, [mid, invoice_number || '', invoice_date, totalAmount, itemsJsonStr]);

    const invoiceId = result.lastID;

    // 2. Loop through items to update stock and cost price
    for (const item of items) {
      const pid = parseInt(item.product_id);
      const qty = parseInt(item.quantity);
      const cost = parseFloat(item.cost_price_usd);

      // Increment stock, update cost_price_usd, and set merchant_id
      await db.runAsync(`
        UPDATE products 
        SET stock = stock + ?, cost_price_usd = ?, merchant_id = ? 
        WHERE id = ?
      `, [qty, cost, mid, pid]);
    }

    await db.runAsync('COMMIT');

    res.status(201).json({
      message_ar: 'تم تسجيل فاتورة التوريد وتحديث المخزون بنجاح',
      message_en: 'Supply invoice logged and inventory updated successfully',
      invoiceId
    });
  } catch (err) {
    await db.runAsync('ROLLBACK').catch(() => {});
    console.error('Create supply invoice error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء تسجيل الفاتورة وتحديث المخزون',
      error_en: 'Error logging invoice and updating stock'
    });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    let query = `
      SELECT i.*, 
             m.name as merchant_name,
             m.company as merchant_company
      FROM invoices i
      LEFT JOIN merchants m ON i.merchant_id = m.id
      ORDER BY i.created_at DESC
    `;
    const invoices = await db.allAsync(query);

    // Format the items to send parsed JSON back
    const formatted = invoices.map(inv => {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(inv.items || '[]');
      } catch (e) {
        parsedItems = [];
      }
      return {
        ...inv,
        items: parsedItems
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء جلب الفواتير',
      error_en: 'Error fetching invoices'
    });
  }
};

exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.getAsync('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!check) {
      return res.status(404).json({
        error_ar: 'الفاتورة غير موجودة',
        error_en: 'Invoice not found'
      });
    }

    await db.runAsync('DELETE FROM invoices WHERE id = ?', [id]);
    res.json({
      message_ar: 'تم حذف الفاتورة بنجاح',
      message_en: 'Invoice deleted successfully'
    });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء حذف الفاتورة',
      error_en: 'Error deleting invoice'
    });
  }
};
