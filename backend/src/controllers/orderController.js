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
    let discountableSubtotalUsd = 0;
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

      // Resolve size-specific price and cost
      let itemPrice = product.price_usd;
      let itemSingleCostPrice = product.cost_price_usd;
      if (item.selectedSize && product.sizes) {
        try {
          const parsedSizes = JSON.parse(product.sizes || '[]');
          const matchingSizeOption = parsedSizes.find(s => {
            const cleanS = s.replace(/\s+/g, '').toUpperCase();
            const cleanSelected = item.selectedSize.replace(/\s+/g, '').toUpperCase();
            return cleanS.startsWith(cleanSelected) || cleanSelected.startsWith(cleanS);
          });
          if (matchingSizeOption) {
            const stockMatch = matchingSizeOption.match(/\[Stock:\s*([0-9]+)\]/);
            if (stockMatch) {
              const optionStock = parseInt(stockMatch[1], 10);
              if (optionStock < item.quantity) {
                return res.status(400).json({
                  error_ar: `عذراً، الكمية المطلوبة من الخيار ${item.selectedSize} غير متوفرة. المتبقي: ${optionStock}`,
                  error_en: `Sorry, requested quantity for option ${item.selectedSize} is not available. In stock: ${optionStock}`
                });
              }
            }
            const priceRegex = /\(\s*([+-]?\s*\$?\s*[0-9.]+)(?:\/([0-9.]+))?\s*\$?_?\)/;
            const match = matchingSizeOption.match(priceRegex);
            if (match) {
              const priceVal = parseFloat(match[1].replace(/[+\-$]/g, ''));
              const costVal = match[2] ? parseFloat(match[2]) : null;
              
              const hasSlash = matchingSizeOption.includes('/');
              const isRelative = !hasSlash && (matchingSizeOption.includes('+') || matchingSizeOption.includes('-'));
              const isNegative = !hasSlash && matchingSizeOption.includes('-');
              
              if (isRelative) {
                itemPrice = isNegative ? (product.price_usd - priceVal) : (product.price_usd + priceVal);
                if (costVal !== null) {
                  itemSingleCostPrice = isNegative ? (product.cost_price_usd - costVal) : (product.cost_price_usd + costVal);
                }
              } else {
                itemPrice = priceVal;
                if (costVal !== null) {
                  itemSingleCostPrice = costVal;
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing size price/cost offset on backend:', e);
        }
      }

      const itemCost = itemPrice * item.quantity;
      const itemCostPrice = itemSingleCostPrice * item.quantity;

      subtotalUsd += itemCost;
      totalCostUsd += itemCostPrice;

      const category = await db.getAsync('SELECT name_ar, name_en FROM categories WHERE id = ?', [product.category_id]);
      const catAr = category ? (category.name_ar || '') : '';
      const catEn = category ? (category.name_en || '') : '';
      const isPhone = (
        (catAr.includes('هاتف') || catAr.includes('هواتف') || catAr.includes('موبايل') || catAr.includes('جوال')) &&
        !(catAr.includes('إكسسوار') || catAr.includes('اكسسوار') || catAr.includes('شاحن') || catAr.includes('شواحن') || 
          catAr.includes('سماعة') || catAr.includes('سماعات') || catAr.includes('كفر') || catAr.includes('كفرات') || 
          catAr.includes('جراب') || catAr.includes('جرابات') || catAr.includes('سلك') || catAr.includes('أسلاك') || 
          catAr.includes('حماية') || catAr.includes('لاصق'))
      ) || (
        (catEn.toLowerCase().includes('phone') || catEn.toLowerCase().includes('mobile') || catEn.toLowerCase().includes('smartphone')) &&
        !(catEn.toLowerCase().includes('access') || catEn.toLowerCase().includes('case') || catEn.toLowerCase().includes('cover') || 
          catEn.toLowerCase().includes('charger') || catEn.toLowerCase().includes('headphone') || catEn.toLowerCase().includes('earphone') || 
          catEn.toLowerCase().includes('cable') || catEn.toLowerCase().includes('screen') || catEn.toLowerCase().includes('glass') || 
          catEn.toLowerCase().includes('holder') || catEn.toLowerCase().includes('stand') || catEn.toLowerCase().includes('powerbank') || 
          catEn.toLowerCase().includes('power bank'))
      );

      if (!isPhone) {
        discountableSubtotalUsd += itemCost;
      }

      let productImg = product.image_url || '';
      if (productImg && productImg.startsWith('[')) {
        try {
          const parsed = JSON.parse(productImg);
          productImg = parsed[0] || '';
        } catch (e) {
          console.error('Error parsing product image_url for order items:', e);
        }
      }

      orderItemsDetails.push({
        product_id: product.id,
        name_ar: product.name_ar,
        name_en: product.name_en,
        image_url: productImg,
        price_usd: itemPrice,
        cost_price_usd: itemSingleCostPrice,
        quantity: item.quantity,
        merchant_name: product.merchant_name || '',
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null,
        model_number: product.model_number || ''
      });

      // Deduct stock
      await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);

      // Deduct stock of selected option if exists
      if (item.selectedSize && product.sizes) {
        try {
          const parsedSizes = JSON.parse(product.sizes || '[]');
          const updatedSizes = parsedSizes.map(s => {
            const cleanS = s.replace(/\[Stock:\s*[0-9]+\]/g, '').trim().replace(/\s+/g, '').toUpperCase();
            const cleanSelected = item.selectedSize.replace(/\[Stock:\s*[0-9]+\]/g, '').trim().replace(/\s+/g, '').toUpperCase();
            if (cleanS.startsWith(cleanSelected) || cleanSelected.startsWith(cleanS)) {
              const stockMatch = s.match(/\[Stock:\s*([0-9]+)\]/);
              if (stockMatch) {
                const currentStock = parseInt(stockMatch[1], 10);
                const newStock = Math.max(0, currentStock - item.quantity);
                return s.replace(/\[Stock:\s*[0-9]+\]/, `[Stock: ${newStock}]`);
              }
            }
            return s;
          });
          const sizesStr = JSON.stringify(updatedSizes);
          await db.runAsync('UPDATE products SET sizes = ? WHERE id = ?', [sizesStr, product.id]);
        } catch (e) {
          console.error('Error updating sizes stock during checkout:', e);
        }
      }
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

    const discountAmountUsd = discountPercent === 10
      ? discountableSubtotalUsd * 0.1
      : subtotalUsd * (discountPercent / 100);
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
  let query = `
    SELECT o.*, u.full_name as driver_name, u.username as driver_username 
    FROM orders o 
    LEFT JOIN users u ON o.driver_id = u.id 
    WHERE 1=1
  `;
  const params = [];

  const isEmployee = req.user.role === 'employee';
  const permissions = isEmployee ? JSON.parse(req.user.permissions || '[]') : [];
  const isDriverOnly = isEmployee && !permissions.includes('orders') && permissions.includes('delivery');

  if (isDriverOnly) {
    query += ' AND o.driver_id = ?';
    params.push(req.user.id);
  }

  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  query += ' ORDER BY o.id DESC';

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
    const orders = await db.allAsync("SELECT * FROM orders WHERE user_id = ? AND status != 'archived' ORDER BY id DESC", [req.user.id]);
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
    const order = await db.getAsync(`
      SELECT o.*, u.full_name as driver_name, u.username as driver_username 
      FROM orders o 
      LEFT JOIN users u ON o.driver_id = u.id 
      WHERE o.id = ?
    `, [id]);
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
      error_ar: 'عذراً، أرشفة الطلبيات مسموح بها للمدير العام فقط وليس للموظفين', 
      error_en: 'Forbidden, only the general manager can archive orders' 
    });
  }

  try {
    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error_ar: 'الطلبية غير موجودة', error_en: 'Order not found' });
    }

    // Restore stock if archiving from an active state
    if (order.status !== 'cancelled' && order.status !== 'archived') {
      try {
        const items = JSON.parse(order.items || '[]');
        for (const item of items) {
          if (item.product_id && item.quantity) {
            await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
          }
        }
      } catch (e) {
        console.error('Error restoring stock for archived order:', e);
      }
    }

    if (order.status === 'archived') {
      await db.runAsync("DELETE FROM orders WHERE id = ?", [id]);
      return res.json({ message_ar: 'تم حذف الطلبية نهائياً بنجاح', message_en: 'Order permanently deleted successfully' });
    }

    await db.runAsync("UPDATE orders SET status = 'archived' WHERE id = ?", [id]);
    res.json({ message_ar: 'تم نقل الطلبية إلى الأرشيف بنجاح', message_en: 'Order archived successfully' });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في حذف الطلبية', error_en: 'Error deleting order' });
  }
};


exports.getReports = async (req, res) => {
  try {
    // Sales, cost of sales, and true profit summaries
    // pending_orders is calculated as all active/pending orders (not delivered, cancelled, or archived)
    const stats = await db.getAsync(`
      SELECT 
        COUNT(CASE WHEN status != 'archived' THEN 1 END) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN total_usd ELSE 0 END) as delivered_revenue_usd,
        SUM(CASE WHEN status = 'delivered' THEN total_lbp ELSE 0 END) as delivered_revenue_lbp,
        SUM(CASE WHEN status = 'delivered' THEN total_cost_usd ELSE 0 END) as delivered_cost_usd,
        SUM(CASE WHEN status != 'delivered' AND status != 'cancelled' AND status != 'archived' THEN total_usd ELSE 0 END) as pending_revenue_usd,
        COUNT(CASE WHEN status != 'delivered' AND status != 'cancelled' AND status != 'archived' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders
      FROM orders
    `);

    const employeeStats = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'employee' OR role = 'admin'");
    const totalEmployees = employeeStats ? employeeStats.count : 0;

    const exchangeRateRow = await db.getAsync('SELECT exchange_rate FROM settings ORDER BY id DESC LIMIT 1');
    const exchangeRate = exchangeRateRow ? exchangeRateRow.exchange_rate : 89500;

    const deliveredRevenueUsd = stats.delivered_revenue_usd || 0;
    const deliveredCostUsd = stats.delivered_cost_usd || 0;
    
    // Net profit is total selling revenue minus total cost of items sold
    const netProfitUsd = deliveredRevenueUsd - deliveredCostUsd;
    const netProfitLbp = netProfitUsd * exchangeRate;

    let dailySalesQuery;
    let monthlySalesQuery;

    if (db.isPostgres) {
      dailySalesQuery = `
        SELECT CAST(created_at AS DATE) as date, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
        FROM orders
        WHERE status = 'delivered'
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
        LIMIT 30
      `;
      monthlySalesQuery = `
        SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
        FROM orders
        WHERE status = 'delivered'
        GROUP BY to_char(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `;
    } else {
      dailySalesQuery = `
        SELECT DATE(created_at) as date, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
        FROM orders
        WHERE status = 'delivered'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      monthlySalesQuery = `
        SELECT strftime('%Y-%m', created_at) as month, COUNT(id) as count, SUM(total_usd) as revenue_usd, SUM(total_cost_usd) as cost_usd
        FROM orders
        WHERE status = 'delivered'
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month DESC
        LIMIT 12
      `;
    }

    const dailySales = await db.allAsync(dailySalesQuery);
    const monthlySales = await db.allAsync(monthlySalesQuery);

    const inventory = await db.getAsync(`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(stock) as total_stock_items
      FROM products
    `);

    let totalViews = 0;
    let uniqueVisitors = 0;
    try {
      const viewsStats = await db.getAsync(`
        SELECT 
          COUNT(id) as total_views,
          COUNT(DISTINCT visitor_id) as unique_visitors
        FROM page_views
      `);
      if (viewsStats) {
        totalViews = viewsStats.total_views || 0;
        uniqueVisitors = viewsStats.unique_visitors || 0;
      }
    } catch (e) {
      console.error('Error fetching page views stats:', e);
    }

    res.json({
      summary: {
        total_orders: stats.total_orders || 0,
        delivered_revenue_usd: deliveredRevenueUsd,
        delivered_revenue_lbp: stats.delivered_revenue_lbp || 0,
        pending_revenue_usd: stats.pending_revenue_usd || 0,
        pending_orders: stats.pending_orders || 0,
        delivered_orders: stats.delivered_orders || 0,
        estimated_profit_usd: netProfitUsd, // Exact net profit in USD
        estimated_profit_lbp: netProfitLbp,  // Exact net profit in LBP
        total_views: totalViews,
        unique_visitors: uniqueVisitors,
        out_of_stock: inventory.out_of_stock || 0,
        total_employees: totalEmployees
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

exports.bulkAssignOrders = async (req, res) => {
  let { orderIds, driverId } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error_ar: 'الرجاء تحديد الطلبيات', error_en: 'Please select orders' });
  }

  // Parse driverId as null or integer
  const resolvedDriverId = driverId ? parseInt(driverId, 10) : null;

  try {
    if (resolvedDriverId) {
      const driver = await db.getAsync('SELECT * FROM users WHERE id = ?', [resolvedDriverId]);
      if (!driver) {
        return res.status(404).json({ error_ar: 'موظف التوصيل غير موجود', error_en: 'Delivery driver not found' });
      }
    }

    const placeholders = orderIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE orders SET driver_id = ? WHERE id IN (${placeholders})`,
      [resolvedDriverId, ...orderIds]
    );

    res.json({ message_ar: 'تم تعيين موظف التوصيل للطلبيات بنجاح', message_en: 'Delivery driver assigned to orders successfully' });
  } catch (err) {
    console.error('Bulk assign orders error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تعيين موظف التوصيل', error_en: 'Error assigning delivery driver' });
  }
};
