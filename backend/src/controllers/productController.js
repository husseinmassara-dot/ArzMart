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
    try {
      const subcats = await db.allAsync('SELECT id FROM categories WHERE parent_id = ? OR id = ?', [category_id, category_id]);
      const catIds = subcats.map(s => s.id);
      if (catIds.length > 0) {
        query += ` AND p.category_id IN (${catIds.map(() => '?').join(',')})`;
        catIds.forEach(id => params.push(id));
      } else {
        query += ' AND p.category_id = ?';
        params.push(category_id);
      }
    } catch (err) {
      console.error('Subcategories fetch error:', err);
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }
  }

  if (search) {
    query += ' AND (p.name_ar LIKE ? OR p.name_en LIKE ? OR p.description_ar LIKE ? OR p.description_en LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (min_price) {
    query += ' AND p.price_usd >= ?';
    params.push(parseFloat(min_price));
  }

  if (max_price) {
    query += ' AND p.price_usd <= ?';
    params.push(parseFloat(max_price));
  }

  try {
    const products = await db.allAsync(query, params);
    
    let filteredProducts = products.map(p => {
      const rating = p.rating_count > 0 ? (p.rating_sum / p.rating_count) : 0;
      return { ...p, rating };
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
    res.json({ ...product, rating });
  } catch (err) {
    console.error('Get product by ID error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب تفاصيل المنتج', error_en: 'Error fetching product details' });
  }
};

exports.createProduct = async (req, res) => {
  const { name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, stock } = req.body;
  const imageUrl = req.file ? fileToBase64(req.file) : '';

  if (!name_ar || !name_en || !price_usd) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال الحقول المطلوبة (الاسم والسعر)', error_en: 'Please enter required fields (name and price)' });
  }

  const cid = category_id && category_id !== 'null' ? parseInt(category_id) : null;
  const mid = merchant_id && merchant_id !== 'null' ? parseInt(merchant_id) : null;
  const oldPrice = old_price_usd && old_price_usd !== 'null' ? parseFloat(old_price_usd) : null;
  const costPrice = cost_price_usd ? parseFloat(cost_price_usd) : 0.0;
  const productStock = stock ? parseInt(stock) : 10;

  try {
    const result = await db.runAsync(`
      INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name_ar, name_en, description_ar, description_en, parseFloat(price_usd), costPrice, oldPrice, cid, mid, imageUrl, productStock]);

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
        image_url: imageUrl,
        stock: productStock
      }
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error_ar: 'خطأ في إضافة المنتج', error_en: 'Error adding product' });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, stock } = req.body;

  try {
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error_ar: 'المنتج غير موجود', error_en: 'Product not found' });
    }

    let imageUrl = product.image_url;
    if (req.file) {
      imageUrl = fileToBase64(req.file) || product.image_url;
    }

    const cid = category_id && category_id !== 'null' ? parseInt(category_id) : null;
    const mid = merchant_id && merchant_id !== 'null' ? parseInt(merchant_id) : null;
    const oldPrice = old_price_usd && old_price_usd !== 'null' ? parseFloat(old_price_usd) : null;
    const costPrice = cost_price_usd ? parseFloat(cost_price_usd) : product.cost_price_usd;
    const productStock = stock ? parseInt(stock) : product.stock;

    await db.runAsync(`
      UPDATE products 
      SET name_ar = ?, name_en = ?, description_ar = ?, description_en = ?, price_usd = ?, cost_price_usd = ?, old_price_usd = ?, category_id = ?, merchant_id = ?, image_url = ?, stock = ?
      WHERE id = ?
    `, [name_ar, name_en, description_ar, description_en, parseFloat(price_usd), costPrice, oldPrice, cid, mid, imageUrl, productStock, id]);

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
        image_url: imageUrl,
        stock: productStock
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
