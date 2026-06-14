const db = require('../config/db');

exports.createOrder = async (req, res) => {
  const { phone, address, items, coupon_code, payment_method } = req.body;
  const userId = req.user ? req.user.id : null;
  const userName = req.user ? req.user.username : 'Guest';

  if (!phone || !address || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال رقم الهاتف، العنوان والمنتجات', error_en: 'Please provide phone, address, and items' });
  }

  try {
    const settings = await db.getAsync('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    const exchangeRate = settings ? settings.exchange_rate : 89500;
    const baseDeliveryFee = settings ? settings.delivery_fee : 4;
    const freeDeliveryThreshold = settings ? settings.free_delivery_threshold : 50;

    let subtotalUsd = 0;
    let totalCostUsd = 0; // Cumulative cost price for the order
    const orderItemsDetails = [];

    for (const item of items) {
      const product = await db.getAsync(`
        SELECT p.*, m.name as merchant_name 
        FROM products p 
        LEFT JOIN merchants m ON p.merchant_id = m.id 
        WHERE p.id = ?
      `, [item.product_id]);
      if (!product) {
        return res.status(400).json({ error_ar: `المنتج غير موجود`, error_en: `Product not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error_ar: `عذراً، الكمية المطلوبة من ${product.name_ar} غير متوفرة. المتبقي: ${product.stock}`,
          error_en: `Sorry, requested quantity for ${product.name_en} is not available. In stock: ${product.stock}`
        });
      }

      // Resolve size-specific price
      let itemPrice = product.price_usd;
      if (item.selectedSize && product.sizes) {
        try {
          const parsedSizes = JSON.parse(product.sizes || '[]');
          const matchingSizeOption = parsedSizes.find(s => {
            const cleanS = s.replace(/\s+/g, '').toUpperCase();
            const cleanSelected = item.selectedSize.replace(/\s+/g, '').toUpperCase();
            return cleanS.startsWith(cleanSelected) || cleanSelected.startsWith(cleanS);
          });
          if (matchingSizeOption) {
            const priceRegex = /\(\s*[+-]?\s*\$?\s*([0-9.]+)\s*\$?_?\)/;
            const match = matchingSizeOption.match(priceRegex);
            if (match) {
              const val = parseFloat(match[1]);
              const isRelative = matchingSizeOption.includes('+') || matchingSizeOption.includes('-');
              if (isRelative) {
                const isNegative = matchingSizeOption.includes('-');
                itemPrice = isNegative ? (product.price_usd - val) : (product.price_usd + val);
              } else {
                itemPrice = val;
              }
            }
          }
        } catch (e) {
          console.error('Error parsing size price offset on backend:', e);
        }
      }

      const itemCost = itemPrice * item.quantity;
      const itemCostPrice = product.cost_price_usd * item.quantity;

      subtotalUsd += itemCost;
      totalCostUsd += itemCostPrice;

      orderItemsDetails.push({
        product_id: product.id,
        name_ar: product.name_ar,
        name_en: product.name_en,
        image_url: product.image_url,
        price_usd: itemPrice,
        cost_price_usd: product.cost_price_usd,
        quantity: item.quantity,
        merchant_name: product.merchant_name || '',
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null
      });

      // Deduct stock
      await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
    }

    // Handle discounts
    let discountPercent = 0;
    let welcomeDiscountUsed = false;

    if (coupon_code) {
      const code = coupon_code.toUpperCase().trim();
      if (code === 'WELCOME10' && userId) {
        const user = await db.getAsync('SELECT discount_used FROM users WHERE id = ?', [userId]);
        if (user && user.discount_used === 0) {
          discountPercent = 10;
          welcomeDiscountUsed = true;
        } else {
          return res.status(400).json({ error_ar: 'تم استخدام كود ترحيب ١٠٪ مسبقاً', error_en: 'Welcome 10% discount already used' });
        }
      } else {
        const coupon = await db.getAsync('SELECT * FROM coupons WHERE code = ? AND active = 1', [code]);
        if (coupon) {
          discountPercent = coupon.discount_percent;
        } else {
          return res.status(400).json({ error_ar: 'كوبون الخصم غير صحيح أو منتهي الصلاحية', error_en: 'Invalid or expired coupon code' });
        }
      }
    }

    const discountAmountUsd = subtotalUsd * (discountPercent / 100);
    const subtotalAfterDiscountUsd = subtotalUsd - discountAmountUsd;

    const deliveryFeeUsd = subtotalAfterDiscountUsd >= freeDeliveryThreshold ? 0 : baseDeliveryFee;

    const totalUsd = subtotalAfterDiscountUsd + deliveryFeeUsd;
    const totalLbp = totalUsd * exchangeRate;
    const deliveryFeeLbp = deliveryFeeUsd * exchangeRate;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `ARZ-${dateStr}-${randomSuffix}`;

    const result = await db.runAsync(`
      INSERT INTO orders (user_id, user_name, phone, address, items, total_usd, total_lbp, total_cost_usd, delivery_fee_usd, delivery_fee_lbp, status, tracking_number, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [
      userId,
      userName,
      phone,
      address,
      JSON.stringify(orderItemsDetails),
      totalUsd,
      totalLbp,
      totalCostUsd,
      deliveryFeeUsd,
      deliveryFeeLbp,
      trackingNumber,
      payment_method || 'COD'
    ]);

    if (welcomeDiscountUsed && userId) {
      await db.runAsync('UPDATE users SET discount_used = 1 WHERE id = ?', [userId]);
    }

    res.status(201).json({
      message_ar: 'تم تسجيل طلبيتك بنجاح!',
      message_en: 'Your order was successfully registered!',
      tracking_number: trackingNumber,
      order: {
        id: result.lastID,
        total_usd: totalUsd,
        total_lbp: totalLbp,
        delivery_fee_usd: deliveryFeeUsd,
        tracking_number: trackingNumber
      }
    });

    if (global.notifyAdminOfNewOrder) {
      global.notifyAdminOfNewOrder({
        id: result.lastID,
        user_name: userName,
        total_usd: totalUsd,
        tracking_number: trackingNumber,
        created_at: new Date()
      });
    }

  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تسجيل الطلبية', error_en: 'Error placing order' });
  }
};

exports.getOrders = async (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY id DESC';

  try {
    const orders = await db.allAsync(query, params);
    const formattedOrders = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items)
    }));
    res.json(formattedOrders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب الطلبيات', error_en: 'Error fetching orders' });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await db.allAsync('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    const formattedOrders = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items)
    }));
    res.json(formattedOrders);
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب طلبياتك السابقة', error_en: 'Error fetching order history' });
  }
};

exports.getOrderById = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error_ar: 'الطلبية غير موجودة', error_en: 'Order not found' });
    }
    res.json({
      ...order,
      items: JSON.parse(order.items)
    });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في جلب الطلبية', error_en: 'Error fetching order' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error_ar: 'حالة الطلب غير صالحة', error_en: 'Invalid order status' });
  }

  // Cancelled status is restricted to general manager/admin only
  if (status === 'cancelled' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error_ar: 'عذراً، إلغاء الطلبيات مسموح به للمدير العام فقط وليس للموظفين', 
      error_en: 'Forbidden, only the general manager can cancel orders' 
    });
  }

  try {
    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error_ar: 'الطلبية غير موجودة', error_en: 'Order not found' });
    }

    // Restore stock if status changes to cancelled
    if (status === 'cancelled' && order.status !== 'cancelled') {
      try {
        const items = JSON.parse(order.items || '[]');
        for (const item of items) {
          if (item.product_id && item.quantity) {
            await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
          }
        }
      } catch (e) {
        console.error('Error restoring stock for cancelled order:', e);
      }
    }

    await db.runAsync('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ message_ar: 'تم تحديث حالة الطلبية بنجاح', message_en: 'Order status updated successfully' });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error_ar: 'خطأ في تعديل حالة الطلبية', error_en: 'Error updating order status' });
  }
};

exports.deleteOrder = async (req, res) => {
  const { id } = req.params;

  // Restrict order deletion to general manager/admin only
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error_ar: 'عذراً، حذف الطلبيات مسموح به للمدير العام فقط وليس للموظفين', 
      error_en: 'Forbidden, only the general manager can delete orders' 
    });
  }

  try {
    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error_ar: 'الطلبية غير موجودة', error_en: 'Order not found' });
    }
    await db.runAsync('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ message_ar: 'تم حذف الطلبية بنجاح', message_en: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في حذف الطلبية', error_en: 'Error deleting order' });
  }
};


exports.getReports = async (req, res) => {
  try {
    // Sales, cost of sales, and true profit summaries
    const stats = await db.getAsync(`
      SELECT 
        COUNT(id) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN total_usd ELSE 0 END) as delivered_revenue_usd,
        SUM(CASE WHEN status = 'delivered' THEN total_lbp ELSE 0 END) as delivered_revenue_lbp,
        SUM(CASE WHEN status = 'delivered' THEN total_cost_usd ELSE 0 END) as delivered_cost_usd,
        SUM(CASE WHEN status != 'delivered' THEN total_usd ELSE 0 END) as pending_revenue_usd,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders
      FROM orders
    `);

    const exchangeRateRow = await db.getAsync('SELECT exchange_rate FROM settings ORDER BY id DESC LIMIT 1');
    const exchangeRate = exchangeRateRow ? exchangeRateRow.exchange_rate : 89500;

    const deliveredRevenueUsd = stats.delivered_revenue_usd || 0;
    const deliveredCostUsd = stats.delivered_cost_usd || 0;
    
    // Net profit is total selling revenue minus total cost of items sold
    const netProfitUsd = deliveredRevenueUsd - deliveredCostUsd;
    const netProfitLbp = netProfitUsd * exchangeRate;

    const dailySales = await db.allAsync(`
      SELECT DATE(created_at) as date, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
      FROM orders
      WHERE status = 'delivered'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    const monthlySales = await db.allAsync(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
      FROM orders
      WHERE status = 'delivered'
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
      LIMIT 12
    `);

    const inventory = await db.getAsync(`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(stock) as total_stock_items
      FROM products
    `);

    res.json({
      summary: {
        total_orders: stats.total_orders || 0,
        delivered_revenue_usd: deliveredRevenueUsd,
        delivered_revenue_lbp: stats.delivered_revenue_lbp || 0,
        pending_revenue_usd: stats.pending_revenue_usd || 0,
        pending_orders: stats.pending_orders || 0,
        delivered_orders: stats.delivered_orders || 0,
        estimated_profit_usd: netProfitUsd, // Exact net profit in USD
        estimated_profit_lbp: netProfitLbp  // Exact net profit in LBP
      },
      dailySales,
      monthlySales,
      inventory: {
        total_products: inventory.total_products || 0,
        out_of_stock: inventory.out_of_stock || 0,
        total_stock_items: inventory.total_stock_items || 0
      }
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error_ar: 'خطأ في حساب التقارير والأرباح', error_en: 'Error calculating reports and earnings' });
  }
};
