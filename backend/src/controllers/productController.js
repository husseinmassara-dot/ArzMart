const db = require('../config/db');
const { fileToBase64 } = require('../utils/fileHelper');

exports.getProducts = async (req, res) => {
  const { category_id, search, min_price, max_price, min_rating } = req.query;
  
  let query = `
    SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en, m.name as merchant_name 
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN merchants m ON p.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (category_id) {
    query += ' AND p.category_id = ?';
    params.push(Number(category_id));
  }

  if (search) {
    const isPostgres = process.env.DB_TYPE === 'postgres' || !!process.env.DATABASE_URL;
    const likeOperator = isPostgres ? 'ILIKE' : 'LIKE';
    query += ` AND (p.name_ar ${likeOperator} ? OR p.name_en ${likeOperator} ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam);

    // Log the search query in database asynchronously
    const cleanSearch = String(search).trim();
    if (cleanSearch) {
      const visitorId = req.query.visitor_id || req.headers['x-visitor-id'] || '';
      db.runAsync('INSERT INTO search_history (query, visitor_id) VALUES (?, ?)', [cleanSearch, visitorId])
        .catch(err => console.error('[Search History] Failed to save search query:', err.message));
    }
  }

  if (min_price) {
    query += ' AND p.price_usd >= ?';
    params.push(parseFloat(min_price));
  }

  if (max_price) {
    query += ' AND p.price_usd <= ?';
    params.push(parseFloat(max_price));
  }

  query += ' ORDER BY p.sort_order ASC, p.id ASC';

  try {
    const products = await db.allAsync(query, params);
    
    let filteredProducts = products.map(p => {
      const rating = p.rating_count > 0 ? (p.rating_sum / p.rating_count) : 0;
      let parsedColors = [];
      let parsedSizes = [];
      let parsedImages = [];
      try { parsedColors = JSON.parse(p.colors || '[]'); } catch (e) { parsedColors = []; }
      try { parsedSizes = JSON.parse(p.sizes || '[]'); } catch (e) { parsedSizes = []; }
      try {
        if (p.image_url && p.image_url.startsWith('[')) {
          parsedImages = JSON.parse(p.image_url);
        } else if (p.image_url) {
          parsedImages = [p.image_url];
        }
      } catch (e) {
        parsedImages = p.image_url ? [p.image_url] : [];
      }
      return { 
        ...p, 
        rating, 
        colors: parsedColors, 
        sizes: parsedSizes,
        images: parsedImages,
        image_url: parsedImages[0] || ''
      };
    });

    if (min_rating) {
      const minRate = parseFloat(min_rating);
      filteredProducts = filteredProducts.filter(p => p.rating >= minRate);
    }

    res.json(filteredProducts);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب المنتجات', error_en: 'Error fetching products' });
  }
};

exports.getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.getAsync(`
      SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en, m.name as merchant_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN merchants m ON p.merchant_id = m.id
      WHERE p.id = ?
    `, [id]);

    if (!product) {
      return res.status(404).json({ error_ar: 'المنتج غير موجود', error_en: 'Product not found' });
    }

    const rating = product.rating_count > 0 ? (product.rating_sum / product.rating_count) : 0;
    let parsedColors = [];
    let parsedSizes = [];
    let parsedImages = [];
    try { parsedColors = JSON.parse(product.colors || '[]'); } catch (e) { parsedColors = []; }
    try { parsedSizes = JSON.parse(product.sizes || '[]'); } catch (e) { parsedSizes = []; }
    try {
      if (product.image_url && product.image_url.startsWith('[')) {
        parsedImages = JSON.parse(product.image_url);
      } else if (product.image_url) {
        parsedImages = [product.image_url];
      }
    } catch (e) {
      parsedImages = product.image_url ? [product.image_url] : [];
    }
    res.json({ 
      ...product, 
      rating, 
      colors: parsedColors, 
      sizes: parsedSizes,
      images: parsedImages,
      image_url: parsedImages[0] || ''
    });
  } catch (err) {
    console.error('Get product by ID error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب تفاصيل المنتج', error_en: 'Error fetching product details' });
  }
};

exports.createProduct = async (req, res) => {
  const { name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, stock, colors, sizes, model_number } = req.body;
  
  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map(file => fileToBase64(file)).filter(Boolean);
  }
  const imageUrl = JSON.stringify(imageUrls);

  if (!name_ar || !name_en || !price_usd) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال الحقول المطلوبة (الاسم والسعر)', error_en: 'Please enter required fields (name and price)' });
  }

  const cid = category_id && category_id !== 'null' ? parseInt(category_id) : null;
  const mid = merchant_id && merchant_id !== 'null' ? parseInt(merchant_id) : null;
  const oldPrice = old_price_usd && old_price_usd !== 'null' ? parseFloat(old_price_usd) : null;
  const costPrice = cost_price_usd ? parseFloat(cost_price_usd) : 0.0;
  const productStock = stock ? parseInt(stock) : 10;
  const colorsStr = typeof colors === 'string' ? colors : JSON.stringify(colors || []);
  const sizesStr = typeof sizes === 'string' ? sizes : JSON.stringify(sizes || []);

  try {
    const result = await db.runAsync(`
      INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, colors, sizes, model_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name_ar, name_en, description_ar, description_en, parseFloat(price_usd), costPrice, oldPrice, cid, mid, imageUrl, productStock, colorsStr, sizesStr, model_number || '']);

    res.status(201).json({
      message_ar: 'تم إضافة المنتج بنجاح',
      message_en: 'Product added successfully',
      product: {
        id: result.lastID,
        name_ar,
        name_en,
        description_ar,
        description_en,
        price_usd: parseFloat(price_usd),
        cost_price_usd: costPrice,
        old_price_usd: oldPrice,
        category_id: cid,
        merchant_id: mid,
        image_url: imageUrls[0] || '',
        images: imageUrls,
        stock: productStock,
        colors: JSON.parse(colorsStr),
        sizes: JSON.parse(sizesStr),
        model_number: model_number || ''
      }
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error_ar: 'خطأ في إضافة المنتج', error_en: 'Error adding product' });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, stock, colors, sizes, existing_images, keep_existing_images, model_number } = req.body;

  try {
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error_ar: 'المنتج غير موجود', error_en: 'Product not found' });
    }

    let imageUrls = [];

    if (keep_existing_images === 'true') {
      // Frontend says: no new images uploaded, keep current images as-is
      try {
        if (product.image_url && product.image_url.startsWith('[')) {
          imageUrls = JSON.parse(product.image_url);
        } else if (product.image_url) {
          imageUrls = [product.image_url];
        }
      } catch (e) {
        imageUrls = product.image_url ? [product.image_url] : [];
      }
    } else if (keep_existing_images === 'false') {
      // Frontend says: new images uploaded, replace existing with new ones only
      if (req.files && req.files.length > 0) {
        imageUrls = req.files.map(file => fileToBase64(file)).filter(Boolean);
      }
    } else {
      // Legacy path: existing_images field provided in body
      const hasExistingField = req.body.hasOwnProperty('existing_images');
      if (hasExistingField) {
        try {
          imageUrls = typeof existing_images === 'string'
            ? JSON.parse(existing_images)
            : (existing_images || []);
        } catch (e) {
          imageUrls = [];
        }
      }

      if (req.files && req.files.length > 0) {
        const newUrls = req.files.map(file => fileToBase64(file)).filter(Boolean);
        imageUrls = [...imageUrls, ...newUrls];
      }

      if (!hasExistingField && (!req.files || req.files.length === 0)) {
        try {
          if (product.image_url && product.image_url.startsWith('[')) {
            imageUrls = JSON.parse(product.image_url);
          } else if (product.image_url) {
            imageUrls = [product.image_url];
          }
        } catch (e) {
          imageUrls = product.image_url ? [product.image_url] : [];
        }
      }
    }

    const imageUrl = JSON.stringify(imageUrls);

    const cid = category_id && category_id !== 'null' ? parseInt(category_id) : null;
    const mid = merchant_id && merchant_id !== 'null' ? parseInt(merchant_id) : null;
    const oldPrice = old_price_usd && old_price_usd !== 'null' ? parseFloat(old_price_usd) : null;
    const costPrice = cost_price_usd ? parseFloat(cost_price_usd) : product.cost_price_usd;
    const productStock = stock ? parseInt(stock) : product.stock;
    const colorsStr = typeof colors === 'string' ? colors : JSON.stringify(colors || []);
    const sizesStr = typeof sizes === 'string' ? sizes : JSON.stringify(sizes || []);

    await db.runAsync(`
      UPDATE products 
      SET name_ar = ?, name_en = ?, description_ar = ?, description_en = ?, price_usd = ?, cost_price_usd = ?, old_price_usd = ?, category_id = ?, merchant_id = ?, image_url = ?, stock = ?, colors = ?, sizes = ?, model_number = ?
      WHERE id = ?
    `, [name_ar, name_en, description_ar, description_en, parseFloat(price_usd), costPrice, oldPrice, cid, mid, imageUrl, productStock, colorsStr, sizesStr, model_number || '', id]);

    res.json({
      message_ar: 'تم تحديث المنتج بنجاح',
      message_en: 'Product updated successfully',
      product: {
        id: parseInt(id),
        name_ar,
        name_en,
        description_ar,
        description_en,
        price_usd: parseFloat(price_usd),
        cost_price_usd: costPrice,
        old_price_usd: oldPrice,
        category_id: cid,
        merchant_id: mid,
        image_url: imageUrls[0] || '',
        images: imageUrls,
        stock: productStock,
        colors: JSON.parse(colorsStr),
        sizes: JSON.parse(sizesStr),
        model_number: model_number || ''
      }
    });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error_ar: 'خطأ في تعديل المنتج', error_en: 'Error updating product' });
  }
};


exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error_ar: 'المنتج غير موجود', error_en: 'Product not found' });
    }

    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message_ar: 'تم حذف المنتج بنجاح', message_en: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error_ar: 'خطأ في حذف المنتج', error_en: 'Error deleting product' });
  }
};

exports.rateProduct = async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error_ar: 'التقييم يجب أن يكون بين ١ و ٥ نجوم', error_en: 'Rating must be between 1 and 5 stars' });
  }

  try {
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error_ar: 'المنتج غير موجود', error_en: 'Product not found' });
    }

    await db.runAsync(`
      UPDATE products 
      SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 
      WHERE id = ?
    `, [parseFloat(rating), id]);

    res.json({ message_ar: 'شكراً لتقييمك!', message_en: 'Thank you for your rating!' });
  } catch (err) {
    console.error('Rate product error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تقييم المنتج', error_en: 'Error rating product' });
  }
};

exports.bulkUpdateCategory = async (req, res) => {
  const { productIds, categoryId } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({
      error_ar: 'الرجاء تحديد منتج واحد على الأقل',
      error_en: 'Please select at least one product'
    });
  }

  const cid = categoryId && categoryId !== 'null' ? parseInt(categoryId) : null;

  try {
    const placeholders = productIds.map(() => '?').join(',');
    const query = `UPDATE products SET category_id = ? WHERE id IN (${placeholders})`;
    await db.runAsync(query, [cid, ...productIds]);

    res.json({
      message_ar: 'تم نقل المنتجات بنجاح',
      message_en: 'Products moved successfully'
    });
  } catch (err) {
    console.error('Bulk update category error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء نقل المنتجات',
      error_en: 'Error moving products'
    });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const products = await db.allAsync(`
      SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id ASC
    `);

    const escapeCSVValue = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    };

    const headers = ['id', 'name_ar', 'name_en', 'category_id', 'category_name_en', 'price_usd', 'old_price_usd', 'cost_price_usd', 'stock', 'sku'];
    
    let csvContent = headers.join(',') + '\r\n';
    
    for (const p of products) {
      const row = [
        p.id,
        escapeCSVValue(p.name_ar),
        escapeCSVValue(p.name_en),
        p.category_id || '',
        escapeCSVValue(p.category_name_en),
        p.price_usd || 0,
        p.old_price_usd || '',
        p.cost_price_usd || '',
        p.stock || 0,
        escapeCSVValue(p.sku || '')
      ];
      csvContent += row.join(',') + '\r\n';
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=arz_mart_products_${dateStr}.csv`);
    // Prepend UTF-8 BOM so Excel opens Arabic letters correctly!
    res.write('\ufeff');
    res.end(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء تصدير المنتجات',
      error_en: 'Error exporting products'
    });
  }
};

exports.importCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error_ar: 'الرجاء تحميل ملف CSV صالح',
      error_en: 'Please upload a valid CSV file'
    });
  }

  try {
    const fs = require('fs');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // Delete temp file after reading
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temp CSV file:', err);
    });

    // Simple custom CSV parser supporting quotes
    const parseCSV = (text) => {
      const lines = [];
      const rawLines = text.split(/\r?\n/);
      
      for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i].trim();
        // Remove BOM if present on the first line
        if (i === 0 && line.startsWith('\ufeff')) {
          line = line.substring(1);
        }
        if (!line) continue;
        
        const row = [];
        let col = '';
        let inQuotes = false;
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            row.push(col.trim());
            col = '';
          } else {
            col += char;
          }
        }
        row.push(col.trim());
        lines.push(row);
      }
      return lines;
    };

    const csvData = parseCSV(fileContent);
    if (csvData.length < 2) {
      return res.status(400).json({
        error_ar: 'ملف CSV فارغ أو غير صالح',
        error_en: 'CSV file is empty or invalid'
      });
    }

    const headers = csvData[0].map(h => h.toLowerCase());
    
    // Find index of essential columns
    const idIdx = headers.indexOf('id');
    const priceIdx = headers.indexOf('price_usd');
    const oldPriceIdx = headers.indexOf('old_price_usd');
    const costPriceIdx = headers.indexOf('cost_price_usd');
    const stockIdx = headers.indexOf('stock');
    
    // We also support updating names and SKU if they exist in CSV
    const nameArIdx = headers.indexOf('name_ar');
    const nameEnIdx = headers.indexOf('name_en');
    const catIdIdx = headers.indexOf('category_id');
    const skuIdx = headers.indexOf('sku');

    if (idIdx === -1) {
      return res.status(400).json({
        error_ar: 'ملف CSV غير صالح: يجب أن يحتوي على عمود المعرّف (id)',
        error_en: 'Invalid CSV: Must contain "id" column'
      });
    }

    let updatedCount = 0;
    let createdCount = 0;

    await db.runAsync('BEGIN TRANSACTION');

    for (let i = 1; i < csvData.length; i++) {
      const row = csvData[i];
      if (row.length < headers.length) continue; // skip incomplete rows

      const idVal = row[idIdx];
      const priceVal = priceIdx !== -1 ? parseFloat(row[priceIdx]) : null;
      const oldPriceVal = oldPriceIdx !== -1 && row[oldPriceIdx] !== '' ? parseFloat(row[oldPriceIdx]) : null;
      const costPriceVal = costPriceIdx !== -1 && row[costPriceIdx] !== '' ? parseFloat(row[costPriceIdx]) : null;
      const stockVal = stockIdx !== -1 ? parseInt(row[stockIdx], 10) : 0;
      
      const nameArVal = nameArIdx !== -1 ? row[nameArIdx] : '';
      const nameEnVal = nameEnIdx !== -1 ? row[nameEnIdx] : '';
      const catIdVal = catIdIdx !== -1 && row[catIdIdx] !== '' ? parseInt(row[catIdIdx], 10) : null;
      const skuVal = skuIdx !== -1 ? row[skuIdx] : '';

      // Check if product exists
      let productExists = false;
      if (idVal) {
        const check = await db.getAsync('SELECT id FROM products WHERE id = ?', [idVal]);
        if (check) {
          productExists = true;
        }
      }

      if (productExists) {
        // Construct dynamic update values
        const updateFields = [];
        const params = [];
        
        if (priceIdx !== -1) { updateFields.push('price_usd = ?'); params.push(priceVal); }
        if (oldPriceIdx !== -1) { updateFields.push('old_price_usd = ?'); params.push(oldPriceVal); }
        if (costPriceIdx !== -1) { updateFields.push('cost_price_usd = ?'); params.push(costPriceVal); }
        if (stockIdx !== -1) { updateFields.push('stock = ?'); params.push(stockVal); }
        if (nameArIdx !== -1 && nameArVal) { updateFields.push('name_ar = ?'); params.push(nameArVal); }
        if (nameEnIdx !== -1 && nameEnVal) { updateFields.push('name_en = ?'); params.push(nameEnVal); }
        if (catIdIdx !== -1) { updateFields.push('category_id = ?'); params.push(catIdVal); }
        if (skuIdx !== -1) { updateFields.push('sku = ?'); params.push(skuVal); }

        if (updateFields.length > 0) {
          const sql = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
          params.push(idVal);
          await db.runAsync(sql, params);
          updatedCount++;
        }
      } else {
        // If product doesn't exist, we can insert it if we have at least Arabic and English names!
        if (nameArIdx !== -1 && nameArVal && nameEnIdx !== -1 && nameEnVal) {
          const sql = `
            INSERT INTO products (name_ar, name_en, category_id, price_usd, old_price_usd, cost_price_usd, stock, sku)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await db.runAsync(sql, [
            nameArVal, 
            nameEnVal, 
            catIdVal, 
            priceVal || 0, 
            oldPriceVal, 
            costPriceVal, 
            stockVal || 0, 
            skuVal
          ]);
          createdCount++;
        }
      }
    }

    await db.runAsync('COMMIT');

    res.json({
      message_ar: `تم استيراد البيانات بنجاح: تحديث ${updatedCount} منتج، وإنشاء ${createdCount} منتج جديد.`,
      message_en: `CSV imported successfully: Updated ${updatedCount} products, Created ${createdCount} new products.`
    });
  } catch (err) {
    await db.runAsync('ROLLBACK').catch(() => {});
    console.error('Import CSV error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء استيراد ملف CSV، تم إلغاء التغييرات لسلامة البيانات',
      error_en: 'Error importing CSV, changes rolled back for safety'
    });
  }
};

exports.reorderProducts = async (req, res) => {
  const { order } = req.body; // array of { id, sort_order }

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ error_ar: 'الترتيب غير صالح', error_en: 'Invalid order data' });
  }

  try {
    await Promise.all(order.map(({ id, sort_order }) =>
      db.runAsync('UPDATE products SET sort_order = ? WHERE id = ?', [sort_order, id])
    ));
    res.json({ message_ar: 'تم حفظ ترتيب المنتجات بنجاح', message_en: 'Products reordered successfully' });
  } catch (err) {
    console.error('Reorder products error:', err);
    res.status(500).json({ error_ar: 'فشل حفظ ترتيب المنتجات', error_en: 'Failed to reorder products' });
  }
};

