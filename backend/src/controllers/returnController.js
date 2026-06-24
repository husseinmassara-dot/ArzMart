const db = require('../config/db');

exports.createReturn = async (req, res) => {
  const { order_id, product_id, quantity, refund_amount, stock_action, reason } = req.body;

  if (!product_id || !quantity || refund_amount === undefined || !stock_action) {
    return res.status(400).json({
      error_ar: 'الرجاء إدخال الحقول المطلوبة (المنتج، الكمية، مبلغ الاسترجاع، إجراء المخزون)',
      error_en: 'Please enter required fields (product, quantity, refund amount, stock action)'
    });
  }

  const pid = parseInt(product_id);
  const qty = parseInt(quantity);
  const refund = parseFloat(refund_amount);
  const oid = order_id && order_id !== 'null' ? parseInt(order_id) : null;

  try {
    // Start database transaction
    await db.runAsync('BEGIN TRANSACTION');

    // 1. Insert return log
    const result = await db.runAsync(`
      INSERT INTO returns (order_id, product_id, quantity, refund_amount, stock_action, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [oid, pid, qty, refund, stock_action, reason || '']);

    const returnId = result.lastID;

    // 2. Update stock if stock_action is 'restock'
    if (stock_action === 'restock') {
      await db.runAsync(`
        UPDATE products 
        SET stock = stock + ? 
        WHERE id = ?
      `, [qty, pid]);
    }

    await db.runAsync('COMMIT');

    res.status(201).json({
      message_ar: 'تم تسجيل المرتجع بنجاح',
      message_en: 'Return logged successfully',
      returnId
    });
  } catch (err) {
    await db.runAsync('ROLLBACK').catch(() => {});
    console.error('Create return error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء تسجيل المرتجع',
      error_en: 'Error logging return'
    });
  }
};

exports.getReturns = async (req, res) => {
  try {
    let query = `
      SELECT r.*, 
             p.name_ar as product_name_ar, 
             p.name_en as product_name_en, 
             p.image_url as product_image_url,
             o.tracking_number as order_tracking_number,
             o.phone as order_phone
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN orders o ON r.order_id = o.id
      ORDER BY r.created_at DESC
    `;
    const returns = await db.allAsync(query);

    // Format images if stored as JSON array
    const formatted = returns.map(r => {
      let parsedImages = [];
      try {
        if (r.product_image_url && r.product_image_url.startsWith('[')) {
          parsedImages = JSON.parse(r.product_image_url);
        } else if (r.product_image_url) {
          parsedImages = [r.product_image_url];
        }
      } catch (e) {
        parsedImages = r.product_image_url ? [r.product_image_url] : [];
      }
      return {
        ...r,
        product_image: parsedImages[0] || ''
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Get returns error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء جلب المرتجعات',
      error_en: 'Error fetching returns'
    });
  }
};

exports.deleteReturn = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.getAsync('SELECT id FROM returns WHERE id = ?', [id]);
    if (!check) {
      return res.status(404).json({
        error_ar: 'السجل غير موجود',
        error_en: 'Return record not found'
      });
    }

    await db.runAsync('DELETE FROM returns WHERE id = ?', [id]);
    res.json({
      message_ar: 'تم حذف سجل المرتجع بنجاح',
      message_en: 'Return record deleted successfully'
    });
  } catch (err) {
    console.error('Delete return error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء حذف السجل',
      error_en: 'Error deleting return record'
    });
  }
};
