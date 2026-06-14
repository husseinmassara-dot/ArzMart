const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');

const isPostgres = process.env.DB_TYPE === 'postgres' || !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

const db = {};

// Helper to convert SQLite SQL placeholders (?) to PostgreSQL ($1, $2...)
function convertSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Helper to adapt SQLite schema queries for PostgreSQL
function adaptSchema(sql) {
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/REAL/gi, 'DOUBLE PRECISION')
    .replace(/PRIMARY KEY AUTOINCREMENT/gi, 'PRIMARY KEY');
}

if (isPostgres) {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/arz_mart';
  console.log(`[Database] Connecting to PostgreSQL: ${connectionString}`);
  pgPool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  // Test connection
  pgPool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('[Database] Failed to connect to PostgreSQL. Fallback warning generated. Ensure server is active and DB exists.', err.message);
    } else {
      console.log('[Database] PostgreSQL connection verified successfully.');
    }
  });
} else {
  const dbPath = path.join(__dirname, '../../database.sqlite');
  console.log(`[Database] Connecting to SQLite: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[Database] SQLite connection error:', err);
    } else {
      console.log('[Database] Connected to SQLite database.');
    }
  });
}

// -------------------------------------------------------------
// Promisified DB wrappers supporting both SQLite and PostgreSQL
// -------------------------------------------------------------

db.runAsync = function(sql, params = []) {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        let querySql = sql;
        const isInsert = querySql.trim().toUpperCase().startsWith('INSERT ');
        if (isInsert && !querySql.toUpperCase().includes(' RETURNING ')) {
          querySql = querySql.trim() + ' RETURNING id';
        }
        const res = await pgPool.query(convertSql(querySql), params);
        const lastID = (isInsert && res.rows[0]) ? res.rows[0].id : null;
        resolve({ lastID, changes: res.rowCount });
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

db.getAsync = function(sql, params = []) {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await pgPool.query(convertSql(sql), params);
        resolve(res.rows[0] || null);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

db.allAsync = function(sql, params = []) {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await pgPool.query(convertSql(sql), params);
        resolve(res.rows);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// -------------------------------------------------------------
// Callback DB wrappers supporting both SQLite and PostgreSQL
// -------------------------------------------------------------

db.run = function(sql, params = [], cb) {
  if (typeof params === 'function') {
    cb = params;
    params = [];
  }
  if (isPostgres) {
    let querySql = sql;
    const isInsert = querySql.trim().toUpperCase().startsWith('INSERT ');
    if (isInsert && !querySql.toUpperCase().includes(' RETURNING ')) {
      querySql = querySql.trim() + ' RETURNING id';
    }
    pgPool.query(convertSql(querySql), params, (err, res) => {
      if (err) {
        if (cb) cb(err);
      } else {
        const lastID = (isInsert && res.rows[0]) ? res.rows[0].id : null;
        if (cb) {
          cb.call({ lastID, changes: res.rowCount }, null);
        }
      }
    });
  } else {
    sqliteDb.run(sql, params, cb);
  }
};

db.get = function(sql, params = [], cb) {
  if (typeof params === 'function') {
    cb = params;
    params = [];
  }
  if (isPostgres) {
    pgPool.query(convertSql(sql), params, (err, res) => {
      if (err) {
        if (cb) cb(err);
      } else {
        if (cb) cb(null, res.rows[0] || null);
      }
    });
  } else {
    sqliteDb.get(sql, params, cb);
  }
};

db.all = function(sql, params = [], cb) {
  if (typeof params === 'function') {
    cb = params;
    params = [];
  }
  if (isPostgres) {
    pgPool.query(convertSql(sql), params, (err, res) => {
      if (err) {
        if (cb) cb(err);
      } else {
        if (cb) cb(null, res.rows);
      }
    });
  } else {
    sqliteDb.all(sql, params, cb);
  }
};

db.serialize = function(cb) {
  if (isPostgres) {
    cb();
  } else {
    sqliteDb.serialize(cb);
  }
};

db.close = function(cb) {
  if (isPostgres) {
    pgPool.end(cb);
  } else {
    sqliteDb.close(cb);
  }
};

// Initialize database schema and seed data
if (isPostgres) {
  initializeDatabasePostgres();
} else {
  initializeDatabase();
}

async function initializeDatabasePostgres() {
  try {
    console.log('[Database] Initializing PostgreSQL schema sequentially...');
    
    // 1. Settings Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        app_name TEXT DEFAULT 'Arz-Mart',
        logo_url TEXT DEFAULT '',
        exchange_rate DOUBLE PRECISION DEFAULT 89500,
        free_delivery_threshold DOUBLE PRECISION DEFAULT 50,
        delivery_fee DOUBLE PRECISION DEFAULT 4,
        hero_banners TEXT DEFAULT '[]',
        online_payment_enabled INTEGER DEFAULT 0,
        contact_email TEXT DEFAULT 'info@arz-mart.com'
      )
    `);
    
    try {
      await pgPool.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'info@arz-mart.com'");
    } catch (e) {}

    // 2. Users Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '[]',
        discount_used INTEGER DEFAULT 0,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        full_name TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''");
      await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''");
      await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT ''");
    } catch (e) {}

    // 3. Categories Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        image_url TEXT DEFAULT '',
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `);

    // 4. Merchants Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        company TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Products Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        description_ar TEXT,
        description_en TEXT,
        price_usd DOUBLE PRECISION NOT NULL,
        cost_price_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        old_price_usd DOUBLE PRECISION DEFAULT NULL,
        category_id INTEGER,
        merchant_id INTEGER DEFAULT NULL,
        image_url TEXT DEFAULT '',
        stock INTEGER DEFAULT 10,
        rating_sum DOUBLE PRECISION DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        colors TEXT DEFAULT '[]',
        sizes TEXT DEFAULT '[]',
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
        FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE SET NULL
      )
    `);

    try {
      await pgPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT DEFAULT '[]'");
    } catch (e) {}
    try {
      await pgPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT '[]'");
    } catch (e) {}

    // 6. Orders Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name TEXT,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        items TEXT NOT NULL,
        total_usd DOUBLE PRECISION NOT NULL,
        total_lbp DOUBLE PRECISION NOT NULL,
        total_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        delivery_fee_usd DOUBLE PRECISION NOT NULL,
        delivery_fee_lbp DOUBLE PRECISION NOT NULL,
        status TEXT DEFAULT 'pending',
        tracking_number TEXT,
        payment_method TEXT DEFAULT 'COD',
        show_price_on_print INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // 7. Chats Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Coupons Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        discount_percent DOUBLE PRECISION NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);

    // 9. Notifications Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        message_ar TEXT NOT NULL,
        message_en TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[Database] PostgreSQL tables created successfully. Checking seeding...');

    // Seed settings
    const settingsCount = await pgPool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCount.rows[0].count) === 0) {
      const defaultBanners = JSON.stringify([
        {
          id: 'banner_init_1',
          image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
          title_ar: 'عروض الصيف الكبرى في أرز مارت',
          title_en: 'Summer Mega Sales at Arz-Mart',
          desc_ar: 'خصومات حصرية تصل إلى ٥٠٪ على كافة السلع الغذائية والمحلية اللبنانية',
          desc_en: 'Exclusive discounts up to 50% on all grocery and local Lebanese goods'
        },
        {
          id: 'banner_init_2',
          image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
          title_ar: 'المنتجات الطازجة والبلدية',
          title_en: 'Fresh & Authentic Local Products',
          desc_ar: 'توصيل سريع وبأسعار مناسبة إلى كافة المناطق اللبنانية',
          desc_en: 'Fast and affordable delivery to all Lebanese regions'
        }
      ]);
      await pgPool.query(`
        INSERT INTO settings (app_name, logo_url, exchange_rate, free_delivery_threshold, delivery_fee, hero_banners, online_payment_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['Arz-Mart', '/uploads/logo.png', 89500, 100, 5, defaultBanners, 0]);
      console.log('[Database] Seeded settings table.');
    }

    // Seed default admin users
    const adminsCount = await pgPool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    if (parseInt(adminsCount.rows[0].count) === 0) {
      const admins = [
        { username: 'husseinmassara', password: '0214786395' },
        { username: 'city-hunter', password: '4786395' }
      ];
      for (const admin of admins) {
        const hashedPassword = bcrypt.hashSync(admin.password, 10);
        const permissions = JSON.stringify(['products', 'categories', 'orders', 'users', 'settings', 'employees', 'reports', 'inventory', 'coupons', 'chat', 'merchants']);
        await pgPool.query(`
          INSERT INTO users (username, password, role, permissions)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (username) DO NOTHING
        `, [admin.username, hashedPassword, 'admin', permissions]);
      }
      console.log('[Database] Seeded admin users.');
    }

    // Seed Merchants
    const merchantsCount = await pgPool.query('SELECT COUNT(*) FROM merchants');
    if (parseInt(merchantsCount.rows[0].count) === 0) {
      const merchants = [
        { name: 'مزارع البقاع الحديثة', phone: '+961 08 543 210', email: 'bekaa-farms@gmail.com', company: 'Bekaa Farms Co.' },
        { name: 'شركة ضيافة للتموين', phone: '+961 01 254 789', email: 'info@diyafa-group.com', company: 'Diyafa Foods' },
        { name: 'معامل صابون طرابلس التقليدي', phone: '+961 06 432 109', email: 'tripoli-soaps@soaps.com', company: 'Tripoli Traditional Soaps' }
      ];
      for (const m of merchants) {
        await pgPool.query('INSERT INTO merchants (name, phone, email, company) VALUES ($1, $2, $3, $4)', [m.name, m.phone, m.email, m.company]);
      }
      console.log('[Database] Seeded merchants.');
    }

    // Seed Categories & Sub-Categories & Products
    const categoriesCount = await pgPool.query('SELECT COUNT(*) FROM categories');
    if (parseInt(categoriesCount.rows[0].count) === 0) {
      // 1. Groceries & Provisions
      const groceriesRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['المواد الغذائية والتموينية', 'Groceries & Provisions', null, '']);
      const groceriesId = groceriesRes.rows[0].id;

      // 1a. Traditional Oils & Fats
      const oilsRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['الزيوت والدهون البلدية', 'Traditional Oils & Fats', groceriesId, '']);
      const oilsId = oilsRes.rows[0].id;

      // Product: Olive oil
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'زيت زيتون لبناني بكر ممتاز ١ ليتر',
        'Extra Virgin Lebanese Olive Oil 1L',
        'زيت زيتون معصور على البارد من حقول الكورة الشمالية، طبيعي ١٠٠٪ وبجودة ممتازة.',
        'Cold-pressed olive oil from the fields of Koura, North Lebanon. 100% natural and high quality.',
        9.50, 6.00, 12.00, oilsId, 1,
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
        25, 18, 4,
        '[]', '["١ ليتر (1L)", "٢ ليتر (2L) (+$8.50)", "٥ ليتر (5L) (+$35.50)"]'
      ]);

      // 1b. Local Honey & Jams
      const honeyRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['العسل والمربيات البلدية', 'Local Honey & Jams', groceriesId, '']);
      const honeyId = honeyRes.rows[0].id;

      // Product: Oak Honey
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'عسل السنديان اللبناني الطبيعي ٥٠٠غ',
        'Natural Lebanese Oak Honey 500g',
        'عسل جبلي أسود طبيعي ١٠٠٪ غني بالفوائد، من مناحل جبال الشوف.',
        '100% natural dark oak mountain honey, harvested from the beehives of Shouf mountains.',
        14.00, 9.50, null, honeyId, 1,
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=300&q=80',
        15, 23, 5,
        '[]', '["٥٠٠غ (500g)", "١كغ (1kg)"]'
      ]);

      // Product: Fig Jam
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'مربى التين اللبناني التقليدي ٦٠0غ',
        'Traditional Lebanese Fig Jam 600g',
        'مربى تين بلدي مصنوع على الطريقة التقليدية بالسمسم وجوز الهند من البقاع.',
        'Homemade traditional Lebanese fig jam made with sesame and walnuts from Bekaa.',
        4.50, 2.80, 5.50, honeyId, 2,
        'https://images.unsplash.com/photo-1622484211148-716bdf2c4b7e?auto=format&fit=crop&w=300&q=80',
        30, 9, 2,
        '[]', '["٣٠٠غ (300g)", "٦٠٠غ (600g)"]'
      ]);

      // 1c. Lebanese Coffee & Spices
      const spicesRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['القهوة والبهارات اللبنانية', 'Lebanese Coffee & Spices', groceriesId, '']);
      const spicesId = spicesRes.rows[0].id;

      // Product: Wild Zaatar
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'زعتر بلدي ممتاز محوج ٤50غ',
        'Premium Lebanese Wild Zaatar 450g',
        'خلطة الزعتر البلدي اللبناني مع السمسم المحمص والسماق البلدي النقي.',
        'Traditional Lebanese zaatar blend with toasted sesame seeds and pure sumac.',
        3.80, 2.00, null, spicesId, 2,
        'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&w=300&q=80',
        40, 5, 1,
        '[]', '["٢٠٠غ (200g)", "٤٥٠غ (450g)"]'
      ]);

      // Product: Ground Coffee
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'قهوة لبنانية مطحونة مع هال ٢٥0غ',
        'Lebanese Ground Coffee with Cardamom 250g',
        'بن أشقر برازيلي مطحون ومحمص بنكهة الهال الغنية بخلطة لبنانية مميزة.',
        'Traditional golden roasted and finely ground coffee with rich cardamom flavor.',
        3.20, 1.80, 4.00, spicesId, 2,
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
        50, 10, 2,
        '[]', '["٢٥٠غ (250g)", "٥٠٠غ (500g)", "١كغ (1kg)"]'
      ]);

      // 2. Personal Care & Traditional Soaps
      const careRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['العناية بالبشرة والصابون البلدي', 'Personal Care & Traditional Soaps', null, '']);
      const careId = careRes.rows[0].id;

      // 2a. Olive Oil & Laurel Soaps
      const soapRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['صابون زيت الزيتون والغار', 'Olive Oil & Laurel Soaps', careId, '']);
      const soapId = soapRes.rows[0].id;

      // Product: Laurel Soap
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'صابون غار طرابلسي طبيعي حبة كبيرة',
        'Natural Tripoli Laurel Soap Large Bar',
        'صابون مصنوع يدوياً من زيت الغار وزيت الزيتون النقي، ممتاز للبشرة الحساسة.',
        'Handcrafted traditional soap bar made with pure laurel oil and olive oil, ideal for sensitive skin.',
        2.50, 1.20, null, soapId, 3,
        'https://images.unsplash.com/photo-1607006342466-4aa8d8d32be5?auto=format&fit=crop&w=300&q=80',
        60, 14, 3,
        '["غار طبيعي (Natural)", "غار أخضر (Green)"]', '["حبة وسط (Medium)", "حبة كبيرة (Large)"]'
      ]);

      // Product: Olive oil soap with rose
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'صابون زيت الزيتون بماء الورد البلدي',
        'Olive Oil Soap with Natural Rose Water',
        'صابون معطر بماء الورد الجوري اللبناني الطبيعي لتنظيف وترطيب البشرة.',
        'Traditional olive oil soap bar infused with organic Lebanese rose water for gentle skin moisturizing.',
        2.20, 1.00, 3.00, soapId, 3,
        'https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=300&q=80',
        45, 10, 2,
        '["وردي (Pink Rose)", "أبيض (White)"]', '["حبة وسط (Medium)", "حبة كبيرة (Large)"]'
      ]);

      // 3. Electronics & Phones
      const electronicsRes = await pgPool.query(`
        INSERT INTO categories (name_ar, name_en, parent_id, image_url) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `, ['الأجهزة الإلكترونية والهواتف', 'Electronics & Phones', null, '']);
      const electronicsId = electronicsRes.rows[0].id;

      // Product: Smartphone
      await pgPool.query(`
        INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'هاتف ذكي متطور',
        'Advanced Smartphone',
        'شاشة مذهلة، كاميرات احترافية، وبطارية تدوم طويلاً.',
        'Stunning display, pro cameras, and all-day battery life.',
        799.00, 500.00, 899.00, electronicsId, 1,
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=300&q=80',
        10, 24, 5,
        '["أسود (Black)", "ذهبي (Gold)"]', '["128GB", "256GB (+$100)", "512GB (+$250)"]'
      ]);

      console.log('[Database] Seeded categories, sub-categories, and products successfully.');
    }
  } catch (err) {
    console.error('[Database] Sequential PostgreSQL initialization failed:', err);
  }
}

function initializeDatabase() {
  db.serialize(() => {
    if (!isPostgres) {
      db.run('PRAGMA foreign_keys = ON');
    }

    const runInit = (sql, params = [], cb) => {
      const query = isPostgres ? adaptSchema(sql) : sql;
      db.run(query, params, cb);
    };

    // 1. Settings Table
    runInit(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT DEFAULT 'Arz-Mart',
        logo_url TEXT DEFAULT '',
        exchange_rate REAL DEFAULT 89500,
        free_delivery_threshold REAL DEFAULT 50,
        delivery_fee REAL DEFAULT 4,
        hero_banners TEXT DEFAULT '[]',
        online_payment_enabled INTEGER DEFAULT 0,
        contact_email TEXT DEFAULT 'info@arz-mart.com'
      )
    `, [], () => {
      const alterQuery = isPostgres 
        ? "ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'info@arz-mart.com'" 
        : "ALTER TABLE settings ADD COLUMN contact_email TEXT DEFAULT 'info@arz-mart.com'";
      db.run(alterQuery, [], (err) => {
        // Ignore errors for SQLite if column already exists
      });
    });

    // 2. Users Table
    runInit(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '[]',
        discount_used INTEGER DEFAULT 0,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        full_name TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, [], () => {
      const alterPhone = isPostgres 
        ? "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''" 
        : "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''";
      const alterEmail = isPostgres 
        ? "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''" 
        : "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''";
      const alterFullName = isPostgres 
        ? "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT ''" 
        : "ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''";

      db.run(alterPhone, [], () => {});
      db.run(alterEmail, [], () => {});
      db.run(alterFullName, [], () => {});
    });

    // 3. Categories Table
    runInit(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        image_url TEXT DEFAULT '',
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `);

    // 4. Merchants Table
    runInit(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        company TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Products Table
    runInit(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        description_ar TEXT,
        description_en TEXT,
        price_usd REAL NOT NULL,
        cost_price_usd REAL NOT NULL DEFAULT 0.0,
        old_price_usd REAL DEFAULT NULL,
        category_id INTEGER,
        merchant_id INTEGER DEFAULT NULL,
        image_url TEXT DEFAULT '',
        stock INTEGER DEFAULT 10,
        rating_sum REAL DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        colors TEXT DEFAULT '[]',
        sizes TEXT DEFAULT '[]',
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
        FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE SET NULL
      )
    `, [], () => {
      const alterColors = isPostgres 
        ? "ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT DEFAULT '[]'" 
        : "ALTER TABLE products ADD COLUMN colors TEXT DEFAULT '[]'";
      db.run(alterColors, [], (err) => {
        // Ignore error
      });
      const alterSizes = isPostgres 
        ? "ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT '[]'" 
        : "ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT '[]'";
      db.run(alterSizes, [], (err) => {
        // Ignore error
      });
    });

    // 6. Orders Table
    runInit(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        items TEXT NOT NULL,
        total_usd REAL NOT NULL,
        total_lbp REAL NOT NULL,
        total_cost_usd REAL NOT NULL DEFAULT 0.0,
        delivery_fee_usd REAL NOT NULL,
        delivery_fee_lbp REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        tracking_number TEXT,
        payment_method TEXT DEFAULT 'COD',
        show_price_on_print INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // 7. Chats Table
    runInit(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Coupons Table
    runInit(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);

    // 9. Notifications Table
    runInit(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        message_ar TEXT NOT NULL,
        message_en TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default settings if empty
    db.get('SELECT COUNT(*) as count FROM settings', [], (err, row) => {
      if (row && parseInt(row.count) === 0) {
        const defaultBanners = JSON.stringify([
          {
            id: 'banner_init_1',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'عروض الصيف الكبرى في أرز مارت',
            title_en: 'Summer Mega Sales at Arz-Mart',
            desc_ar: 'خصومات حصرية تصل إلى ٥٠٪ على كافة السلع الغذائية والمحلية اللبنانية',
            desc_en: 'Exclusive discounts up to 50% on all grocery and local Lebanese goods'
          },
          {
            id: 'banner_init_2',
            image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'المنتجات الطازجة والبلدية',
            title_en: 'Fresh & Authentic Local Products',
            desc_ar: 'توصيل سريع وبأسعار مناسبة إلى كافة المناطق اللبنانية',
            desc_en: 'Fast and affordable delivery to all Lebanese regions'
          }
        ]);
        db.run(`
          INSERT INTO settings (app_name, logo_url, exchange_rate, free_delivery_threshold, delivery_fee, hero_banners, online_payment_enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['Arz-Mart', '/uploads/logo.png', 89500, 100, 5, defaultBanners, 0]);
      }
    });

    // Seed default admin users if empty
    db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'], (err, row) => {
      if (row && parseInt(row.count) === 0) {
        const admins = [
          { username: 'husseinmassara', password: '0214786395' },
          { username: 'city-hunter', password: '4786395' }
        ];

        admins.forEach((admin) => {
          const hashedPassword = bcrypt.hashSync(admin.password, 10);
          const permissions = JSON.stringify(['products', 'categories', 'orders', 'users', 'settings', 'employees', 'reports', 'inventory', 'coupons', 'chat', 'merchants']);
          db.run(`
            INSERT INTO users (username, password, role, permissions)
            VALUES (?, ?, 'admin', ?)
          `, [admin.username, hashedPassword, permissions]);
        });
      }
    });

    // Seed default coupon code WELCOME10 if empty
    db.get('SELECT COUNT(*) as count FROM coupons', [], (err, row) => {
      if (row && parseInt(row.count) === 0) {
        db.run('INSERT INTO coupons (code, discount_percent, active) VALUES (?, ?, ?)', ['WELCOME10', 10, 1]);
      }
    });

    // Seed Merchants if empty
    db.get('SELECT COUNT(*) as count FROM merchants', [], (err, row) => {
      if (row && parseInt(row.count) === 0) {
        const merchants = [
          { name: 'مزارع البقاع الحديثة', phone: '+961 08 543 210', email: 'bekaa-farms@gmail.com', company: 'Bekaa Farms Co.' },
          { name: 'شركة ضيافة للتموين', phone: '+961 01 254 789', email: 'info@diyafa-group.com', company: 'Diyafa Foods' },
          { name: 'معامل صابون طرابلس التقليدي', phone: '+961 06 432 109', email: 'tripoli-soaps@soaps.com', company: 'Tripoli Traditional Soaps' }
        ];

        merchants.forEach((m) => {
          db.run('INSERT INTO merchants (name, phone, email, company) VALUES (?, ?, ?, ?)', [m.name, m.phone, m.email, m.company]);
        });
      }
    });

    // Seed Categories & Sub-Categories & Products if empty
    db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
      if (row && parseInt(row.count) === 0) {
        db.run("INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('المواد الغذائية والتموينية', 'Groceries & Provisions', NULL, '')", function(err) {
          if (err) return;
          const groceriesId = this.lastID;
          
          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('الزيوت والدهون البلدية', 'Traditional Oils & Fats', ?, '')`, [groceriesId], function(err) {
            if (err) return;
            const oilsId = this.lastID;
            
            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'زيت زيتون لبناني بكر ممتاز ١ ليتر',
                'Extra Virgin Lebanese Olive Oil 1L',
                'زيت زيتون معصور على البارد من حقول الكورة الشمالية، طبيعي ١٠٠٪ وبجودة ممتازة.',
                'Cold-pressed olive oil from the fields of Koura, North Lebanon. 100% natural and high quality.',
                9.50, 6.00, 12.00, ?, 1,
                'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
                25, 18, 4,
                '[]', '["١ ليتر (1L)", "٢ ليتر (2L) (+$8.50)", "٥ ليتر (5L) (+$35.50)"]'
              )
            `, [oilsId]);
          });

          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('العسل والمربيات البلدية', 'Local Honey & Jams', ?, '')`, [groceriesId], function(err) {
            if (err) return;
            const honeyId = this.lastID;
            
            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'عسل السنديان اللبناني الطبيعي ٥٠٠غ',
                'Natural Lebanese Oak Honey 500g',
                'عسل جبلي أسود طبيعي ١٠٠٪ غني بالفوائد، من مناحل جبال الشوف.',
                '100% natural dark oak mountain honey, harvested from the beehives of Shouf mountains.',
                14.00, 9.50, NULL, ?, 1,
                'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=300&q=80',
                15, 23, 5,
                '[]', '["٥٠٠غ (500g)", "١كغ (1kg)"]'
              )
            `, [honeyId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'مربى التين اللبناني التقليدي ٦٠0غ',
                'Traditional Lebanese Fig Jam 600g',
                'مربى تين بلدي مصنوع على الطريقة التقليدية بالسمسم وجوز الهند من البقاع.',
                'Homemade traditional Lebanese fig jam made with sesame and walnuts from Bekaa.',
                4.50, 2.80, 5.50, ?, 2,
                'https://images.unsplash.com/photo-1622484211148-716bdf2c4b7e?auto=format&fit=crop&w=300&q=80',
                30, 9, 2,
                '[]', '["٣٠٠غ (300g)", "٦٠٠غ (600g)"]'
              )
            `, [honeyId]);
          });

          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('القهوة والبهارات اللبنانية', 'Lebanese Coffee & Spices', ?, '')`, [groceriesId], function(err) {
            if (err) return;
            const spicesId = this.lastID;

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'زعتر بلدي ممتاز محوج ٤50غ',
                'Premium Lebanese Wild Zaatar 450g',
                'خلطة الزعتر البلدي اللبناني مع السمسم المحمص والسماق البلدي النقي.',
                'Traditional Lebanese zaatar blend with toasted sesame seeds and pure sumac.',
                3.80, 2.00, NULL, ?, 2,
                'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&w=300&q=80',
                40, 5, 1,
                '[]', '["٢٠٠غ (200g)", "٤٥٠غ (450g)"]'
              )
            `, [spicesId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'قهوة لبنانية مطحونة مع هال ٢٥0غ',
                'Lebanese Ground Coffee with Cardamom 250g',
                'بن أشقر برازيلي مطحون ومحمص بنكهة الهال الغنية بخلطة لبنانية مميزة.',
                'Traditional golden roasted and finely ground coffee with rich cardamom flavor.',
                3.20, 1.80, 4.00, ?, 2,
                'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
                50, 10, 2,
                '[]', '["٢٥٠غ (250g)", "٥٠٠غ (500g)", "١كغ (1kg)"]'
              )
            `, [spicesId]);
          });
        });

        db.run("INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('العناية بالبشرة والصابون البلدي', 'Personal Care & Traditional Soaps', NULL, '')", function(err) {
          if (err) return;
          const careId = this.lastID;

          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('صابون زيت الزيتون والغار', 'Olive Oil & Laurel Soaps', ?, '')`, [careId], function(err) {
            if (err) return;
            const soapId = this.lastID;

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'صابون غار طرابلسي طبيعي حبة كبيرة',
                'Natural Tripoli Laurel Soap Large Bar',
                'صابون مصنوع يدوياً من زيت الغار وزيت الزيتون النقي، ممتاز للبشرة الحساسة.',
                'Handcrafted traditional soap bar made with pure laurel oil and olive oil, ideal for sensitive skin.',
                2.50, 1.20, NULL, ?, 3,
                'https://images.unsplash.com/photo-1607006342466-4aa8d8d32be5?auto=format&fit=crop&w=300&q=80',
                60, 14, 3,
                '["غار طبيعي (Natural)", "غار أخضر (Green)"]', '["حبة وسط (Medium)", "حبة كبيرة (Large)"]'
              )
            `, [soapId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
              VALUES (
                'صابون زيت الزيتون بماء الورد البلدي',
                'Olive Oil Soap with Natural Rose Water',
                'صابون معطر بماء الورد الجوري اللبناني الطبيعي لتنظيف وترطيب البشرة.',
                'Traditional olive oil soap bar infused with organic Lebanese rose water for gentle skin moisturizing.',
                2.20, 1.00, 3.00, ?, 3,
                'https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=300&q=80',
                45, 10, 2,
                '["وردي (Pink Rose)", "أبيض (White)"]', '["حبة وسط (Medium)", "حبة كبيرة (Large)"]'
              )
            `, [soapId]);
          });
        });

        db.run("INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('الأجهزة الإلكترونية والهواتف', 'Electronics & Phones', NULL, '')", function(err) {
          if (err) return;
          const electronicsId = this.lastID;
          db.run(`
            INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
            VALUES (
              'هاتف ذكي متطور', 'Advanced Smartphone',
              'شاشة مذهلة، كاميرات احترافية، وبطارية تدوم طويلاً.',
              'Stunning display, pro cameras, and all-day battery life.',
              799.00, 500.00, 899.00, ?, 1,
              'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=300&q=80',
              10, 24, 5,
              '["أسود (Black)", "ذهبي (Gold)"]', '["128GB", "256GB (+$100)", "512GB (+$250)"]'
            )
          `, [electronicsId]);
        });
      }
    });
  });
}

const additionalCategories = [
  { name_ar: 'إكسسوارات هاتف', name_en: 'Phone Accessories', image_url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'ألعاب', name_en: 'Toys & Games', image_url: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'كهربائيات وإلكترونيات', name_en: 'Electronics & Electricals', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'أدوات تجميل', name_en: 'Cosmetics & Beauty', image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'عدة', name_en: 'Tools & Hardware', image_url: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'أدوات مكتبية', name_en: 'Stationery & Office', image_url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'إكسسوارات', name_en: 'Accessories', image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'ملابس', name_en: 'Clothing', image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'زجاج', name_en: 'Glassware', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'أحذية', name_en: 'Shoes', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80' }
];

const additionalProducts = {
  'Phone Accessories': [
    {
      name_ar: 'شاحن لاسلكي سريع بقوة ١٥ واط',
      name_en: 'Fast 15W Wireless Charger',
      description_ar: 'شاحن لاسلكي ذكي متوافق مع جميع الهواتف الذكية الداعمة لتقنية Qi.',
      description_en: 'Smart wireless charger compatible with all Qi-enabled devices.',
      price_usd: 12.99,
      cost_price_usd: 7.50,
      old_price_usd: 18.00,
      image_url: 'https://images.unsplash.com/photo-1622445262465-2481c4574875?auto=format&fit=crop&w=300&q=80',
      stock: 50,
      colors: '["أسود (Black)", "أبيض (White)"]',
      sizes: '[]'
    },
    {
      name_ar: 'بيت حماية شفاف مقاوم للصدمات',
      name_en: 'Shockproof Clear Phone Case',
      description_ar: 'كفر حماية سيليكون مرن ومقاوم للخدوش والصدمات مع حماية للكاميرا.',
      description_en: 'Flexible silicone clear case, scratch and shock resistant with camera protection.',
      price_usd: 4.50,
      cost_price_usd: 2.00,
      old_price_usd: 8.00,
      image_url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=300&q=80',
      stock: 100,
      colors: '[]',
      sizes: '["iPhone 13", "iPhone 14", "iPhone 15", "Samsung S23"]'
    },
    {
      name_ar: 'حامل هاتف مغناطيسي للسيارة',
      name_en: 'Magnetic Car Phone Holder',
      description_ar: 'قاعدة تثبيت مغناطيسية قوية للسيارة تثبت على فتحة التهوية.',
      description_en: 'Strong magnetic car mount holder that clips onto the air vent.',
      price_usd: 6.99,
      cost_price_usd: 3.50,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=300&q=80',
      stock: 40,
      colors: '["أسود (Black)", "فضي (Silver)"]',
      sizes: '[]'
    }
  ],
  'Toys & Games': [
    {
      name_ar: 'سيارة سباق يتم التحكم بها عن بعد',
      name_en: 'Remote Control Racing Car',
      description_ar: 'سيارة سباق سريعة مع بطارية قابلة للشحن وجهاز تحكم لاسلكي ٢.٤ جيجا هرتز.',
      description_en: 'Fast racing car with rechargeable battery and 2.4GHz wireless remote control.',
      price_usd: 19.99,
      cost_price_usd: 11.00,
      old_price_usd: 29.99,
      image_url: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=300&q=80',
      stock: 25,
      colors: '["أحمر (Red)", "أزرق (Blue)"]',
      sizes: '[]'
    },
    {
      name_ar: 'مجموعة مكعبات بناء إبداعية ١٠٠ قطعة',
      name_en: '100-Piece Creative Building Blocks',
      description_ar: 'قطع بناء ملونة لتنمية ذكاء وإبداع الأطفال، مصنوعة من مواد آمنة.',
      description_en: 'Colorful building blocks to develop children\'s creativity and intelligence, safe materials.',
      price_usd: 11.50,
      cost_price_usd: 6.00,
      old_price_usd: 16.00,
      image_url: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=300&q=80',
      stock: 35,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'لعبة لوحية عائلية كلاسيكية',
      name_en: 'Classic Family Board Game',
      description_ar: 'لعبة جماعية ممتعة ومسلية ومناسبة للسهرات العائلية للأعمار فوق ٦ سنوات.',
      description_en: 'A fun and entertaining multiplayer board game suitable for family nights, ages 6+.',
      price_usd: 14.99,
      cost_price_usd: 8.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=300&q=80',
      stock: 20,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Electronics & Electricals': [
    {
      name_ar: 'سماعات رأس لاسلكية إلغاء الضجيج',
      name_en: 'Wireless Noise-Cancelling Headphones',
      description_ar: 'سماعات فوق الأذن بصوت نقي جداً وعزل ضوضاء فعال مع بطارية ٤٠ ساعة.',
      description_en: 'Over-ear headphones with high-fidelity sound and active noise cancellation, 40h battery.',
      price_usd: 45.00,
      cost_price_usd: 28.00,
      old_price_usd: 65.00,
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80',
      stock: 30,
      colors: '["أسود (Black)", "رمادي (Silver)"]',
      sizes: '[]'
    },
    {
      name_ar: 'ساعة رياضية ذكية مقاومة للماء',
      name_en: 'Waterproof Smart Sports Watch',
      description_ar: 'تتبع معدل ضربات القلب، النوم، والأنشطة الرياضية مع شاشة لمس ملونة.',
      description_en: 'Tracks heart rate, sleep, and sports activities with a colorful touchscreen display.',
      price_usd: 29.99,
      cost_price_usd: 15.00,
      old_price_usd: 45.00,
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80',
      stock: 50,
      colors: '["أسود (Black)", "وردي (Pink)", "أزرق (Blue)"]',
      sizes: '[]'
    },
    {
      name_ar: 'غلاية كهربائية ستانلس ستيل ١.٨ ليتر',
      name_en: '1.8L Stainless Steel Electric Kettle',
      description_ar: 'غلاية ماء سريعة التحضير مع ميزة الإغلاق التلقائي للحماية.',
      description_en: 'Fast-boiling water kettle with automatic shut-off safety feature.',
      price_usd: 15.50,
      cost_price_usd: 8.50,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1594213111562-5633dfc27c29?auto=format&fit=crop&w=300&q=80',
      stock: 45,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Cosmetics & Beauty': [
    {
      name_ar: 'مجموعة فرش مكياج احترافية ١٢ قطعة',
      name_en: '12-Piece Professional Makeup Brush Set',
      description_ar: 'فرش مكياج ناعمة وعالية الجودة للاستخدام اليومي والاحترافي مع حقيبة مخملية.',
      description_en: 'Soft, high-quality makeup brushes for daily and professional use with a velvet pouch.',
      price_usd: 8.99,
      cost_price_usd: 4.00,
      old_price_usd: 15.00,
      image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80',
      stock: 40,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'مرطب شفاه طبيعي بنكهة الفراولة',
      name_en: 'Natural Strawberry Lip Balm',
      description_ar: 'مرطب ومغذي للشفاه الجافة بزبدة الشيا والزيوت الطبيعية.',
      description_en: 'Moisturizing lip balm for dry lips with shea butter and natural oils.',
      price_usd: 2.50,
      cost_price_usd: 1.00,
      old_price_usd: 4.00,
      image_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=300&q=80',
      stock: 80,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'سيروم حمض الهيالورونيك للبشرة',
      name_en: 'Hyaluronic Acid Face Serum',
      description_ar: 'سيروم لترطيب البشرة الجافة ومكافحة التجاعيد الدقيقة لتبدو بشرتك نضرة.',
      description_en: 'Hydrating face serum to combat fine wrinkles and give a fresh, glowing skin look.',
      price_usd: 12.00,
      cost_price_usd: 6.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&w=300&q=80',
      stock: 25,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Tools & Hardware': [
    {
      name_ar: 'حقيبة مفكات وبراغي متكاملة ٣٩ قطعة',
      name_en: '39-Piece Multi-purpose Tool Set',
      description_ar: 'حقيبة عدة يدوية أساسية للمنزل والمكتب والصيانة السريعة.',
      description_en: 'Essential hand tools kit for home, office, and quick repairs.',
      price_usd: 18.50,
      cost_price_usd: 10.00,
      old_price_usd: 28.00,
      image_url: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=300&q=80',
      stock: 30,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'جهاز قياس المسافات الرقمي بالليزر',
      name_en: 'Digital Laser Distance Measure',
      description_ar: 'جهاز ليزر دقيق لقياس المسافات والمساحات بلمسة واحدة حتى ٤٠ متراً.',
      description_en: 'Accurate laser measuring tool for distances and areas up to 40 meters.',
      price_usd: 24.99,
      cost_price_usd: 14.00,
      old_price_usd: 35.00,
      image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=300&q=80',
      stock: 15,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'طقم مفاتيح مسدسة (ألن كي) ٩ قطع',
      name_en: '9-Piece Hex Key Allen Wrench Set',
      description_ar: 'طقم مفاتيح سداسية من الكروم فانديوم المتين بأحجام متنوعة.',
      description_en: 'Durable chrome vanadium hex keys in various metric sizes.',
      price_usd: 5.00,
      cost_price_usd: 2.20,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?auto=format&fit=crop&w=300&q=80',
      stock: 50,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Stationery & Office': [
    {
      name_ar: 'دفتر ملاحظات جلدي فاخر A5',
      name_en: 'Premium A5 Leather Notebook',
      description_ar: 'دفتر غلاف جلدي مبطن يحتوي على ورق كريمي عالي الجودة ومناسب للتدوين.',
      description_en: 'Leather cover notebook with premium cream paper, perfect for journaling.',
      price_usd: 4.99,
      cost_price_usd: 2.00,
      old_price_usd: 8.00,
      image_url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=300&q=80',
      stock: 60,
      colors: '["أسود (Black)", "بني (Brown)", "كحلي (Navy)"]',
      sizes: '[]'
    },
    {
      name_ar: 'طقم أقلام حبر جاف ملونة ١٠ قطع',
      name_en: '10-Piece Colorful Ballpoint Pens Set',
      description_ar: 'أقلام حبر جاف ذات خط ناعم وألوان زاهية للدراسة أو تنظيم المهام.',
      description_en: 'Smooth-writing colorful ballpoint pens for studying or journaling.',
      price_usd: 2.50,
      cost_price_usd: 1.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=300&q=80',
      stock: 100,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'منظم مكتب مكتبي معدني',
      name_en: 'Metal Mesh Desk Organizer',
      description_ar: 'حامل للأقلام والملاحظات الورقية والملفات للمحافظة على ترتيب مكتبك.',
      description_en: 'Multi-compartment organizer for pens, sticky notes, and paper files.',
      price_usd: 7.50,
      cost_price_usd: 3.50,
      old_price_usd: 12.00,
      image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=300&q=80',
      stock: 30,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Accessories': [
    {
      name_ar: 'نظارات شمسية كلاسيكية للجنسين',
      name_en: 'Classic Unisex Sunglasses',
      description_ar: 'نظارات شمسية عصرية مع حماية كاملة من الأشعة فوق البنفسجية UV400.',
      description_en: 'Fashionable sunglasses offering full UV400 protection.',
      price_usd: 14.99,
      cost_price_usd: 7.00,
      old_price_usd: 24.99,
      image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=300&q=80',
      stock: 25,
      colors: '["أسود (Black)", "بني (Tortoise)"]',
      sizes: '[]'
    },
    {
      name_ar: 'سوار معصم جلدي للرجال',
      name_en: 'Men\'s Classic Leather Bracelet',
      description_ar: 'سوار من الجلد الطبيعي المجدول مع قفل مغناطيسي من الفولاذ المقاوم للصدأ.',
      description_en: 'Genuine braided leather bracelet with stainless steel magnetic clasp.',
      price_usd: 8.50,
      cost_price_usd: 4.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=300&q=80',
      stock: 40,
      colors: '["أسود (Black)", "بني (Brown)"]',
      sizes: '[]'
    },
    {
      name_ar: 'قلادة ناعمة من الفضة الإسترلينية',
      name_en: '925 Sterling Silver Pendant Necklace',
      description_ar: 'سلسلة فضية ناعمة مع تعليقة كريستالية أنيقة تناسب جميع المناسبات.',
      description_en: 'Delicate silver chain necklace with an elegant crystal pendant.',
      price_usd: 18.00,
      cost_price_usd: 9.00,
      old_price_usd: 29.99,
      image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80',
      stock: 20,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Clothing': [
    {
      name_ar: 'قميص قطني كاجوال للرجال',
      name_en: 'Men\'s Casual Cotton Shirt',
      description_ar: 'قميص قطني ناعم ومريح مناسب للارتداء اليومي في الطقس الحار.',
      description_en: 'Soft and comfortable cotton shirt, perfect for warm weather daily wear.',
      price_usd: 16.00,
      cost_price_usd: 9.00,
      old_price_usd: 25.00,
      image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80',
      stock: 45,
      colors: '["أبيض (White)", "كحلي (Navy)", "أزرق فاتح (Light Blue)"]',
      sizes: '["S", "M", "L", "XL"]'
    },
    {
      name_ar: 'فستان صيفي نسائي منقوش بالزهور',
      name_en: 'Women\'s Floral Summer Dress',
      description_ar: 'فستان صيفي خفيف وأنيق بنقشة زهور مميزة وحزام خصر مطاطي.',
      description_en: 'Lightweight, stylish summer dress with floral patterns and elastic waist.',
      price_usd: 22.50,
      cost_price_usd: 12.00,
      old_price_usd: 35.00,
      image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80',
      stock: 20,
      colors: '["وردي (Pink)", "أصفر (Yellow)"]',
      sizes: '["S", "M", "L"]'
    },
    {
      name_ar: 'سترة هودي شتوية دافئة ومريحة',
      name_en: 'Unisex Warm Winter Hoodie',
      description_ar: 'سترة مبطنة بالصوف الدافئ مع جيب كنغر كبير وقبعة قابلة للتعديل.',
      description_en: 'Warm fleece-lined hoodie featuring a front kangaroo pocket and adjustable hood.',
      price_usd: 19.99,
      cost_price_usd: 10.50,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=300&q=80',
      stock: 30,
      colors: '["أسود (Black)", "رمادي (Grey)", "زيتي (Olive)"]',
      sizes: '["M", "L", "XL", "XXL"]'
    }
  ],
  'Glassware': [
    {
      name_ar: 'طقم كؤوس زجاجية عصير ٦ قطع',
      name_en: '6-Piece Elegant Glass Tumbler Set',
      description_ar: 'كؤوس زجاجية شفافة عالية الجودة بتصميم عصري لتقديم المياه والعصائر.',
      description_en: 'High-quality clear glass tumblers with modern design for juice or water.',
      price_usd: 7.99,
      cost_price_usd: 4.00,
      old_price_usd: 12.00,
      image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80',
      stock: 40,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'وعاء زجاجي بلوري كبير لسلطة الفواكه',
      name_en: 'Large Crystal Glass Salad Bowl',
      description_ar: 'وعاء زجاجي سميك ومزخرف يضفي لمسة فخامة على طاولة الطعام.',
      description_en: 'Thick, textured crystal glass bowl adding luxury to your dining table.',
      price_usd: 11.00,
      cost_price_usd: 6.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=300&q=80',
      stock: 15,
      colors: '[]',
      sizes: '[]'
    },
    {
      name_ar: 'إبريق زجاجي مقاوم للحرارة ١.٥ ليتر',
      name_en: '1.5L Heat-resistant Glass Pitcher',
      description_ar: 'إبريق زجاجي سميك مع غطاء من الفولاذ المقاوم للصدأ للشاي والماء البارد.',
      description_en: 'Thick borosilicate glass pitcher with stainless steel lid for iced tea or water.',
      price_usd: 9.50,
      cost_price_usd: 5.00,
      old_price_usd: 14.50,
      image_url: 'https://images.unsplash.com/photo-1527018601619-a508a2be00cd?auto=format&fit=crop&w=300&q=80',
      stock: 20,
      colors: '[]',
      sizes: '[]'
    }
  ],
  'Shoes': [
    {
      name_ar: 'حذاء رياضي مريح للجري والمشي',
      name_en: 'Comfortable Running Sports Shoes',
      description_ar: 'حذاء رياضي مبطن وخفيف الوزن مع نعل مرن مقاوم للانزلاق.',
      description_en: 'Lightweight, cushioned athletic shoes with flexible non-slip sole.',
      price_usd: 24.99,
      cost_price_usd: 13.00,
      old_price_usd: 39.99,
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80',
      stock: 35,
      colors: '["أحمر (Red)", "أسود (Black)", "أزرق (Blue)"]',
      sizes: '["40", "41", "42", "43", "44"]'
    },
    {
      name_ar: 'حذاء كلاسيكي جلدي للرجال',
      name_en: 'Men\'s Classic Leather Dress Shoes',
      description_ar: 'حذاء جلدي رسمي فاخر ومثالي للمناسبات والاجتماعات والعمل.',
      description_en: 'Premium leather formal dress shoes, perfect for business and special events.',
      price_usd: 32.00,
      cost_price_usd: 18.00,
      old_price_usd: 48.00,
      image_url: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=300&q=80',
      stock: 20,
      colors: '["أسود (Black)", "بني (Brown)"]',
      sizes: '["41", "42", "43", "44"]'
    },
    {
      name_ar: 'حذاء صيفي نسائي مسطح ومريح',
      name_en: 'Women\'s Comfortable Flat Sandals',
      description_ar: 'صندل صيفي خفيف الوزن مع وسادة قدم ناعمة وتصميم عصري.',
      description_en: 'Lightweight summer sandals featuring a soft footbed and trendy design.',
      price_usd: 14.50,
      cost_price_usd: 7.00,
      old_price_usd: null,
      image_url: 'https://images.unsplash.com/photo-1562273138-f46be4ebdf33?auto=format&fit=crop&w=300&q=80',
      stock: 30,
      colors: '["بيج (Beige)", "أسود (Black)"]',
      sizes: '["37", "38", "39", "40"]'
    }
  ]
};

async function seedDemoData() {
  console.log('[Database] Checking additional demo categories and products...');
  try {
    for (const cat of additionalCategories) {
      // Check if category exists
      let category = await db.getAsync('SELECT id FROM categories WHERE name_en = ?', [cat.name_en]);
      let categoryId;
      if (!category) {
        const result = await db.runAsync(
          'INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES (?, ?, NULL, ?)',
          [cat.name_ar, cat.name_en, cat.image_url]
        );
        categoryId = result.lastID;
        console.log(`[Database] Seeded category: ${cat.name_en}`);
      } else {
        categoryId = category.id;
      }

      // Now seed products for this category
      const products = additionalProducts[cat.name_en] || [];
      for (const prod of products) {
        let product = await db.getAsync('SELECT id FROM products WHERE name_en = ?', [prod.name_en]);
        if (!product) {
          await db.runAsync(
            `INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count, colors, sizes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 0, ?, ?)`,
            [
              prod.name_ar,
              prod.name_en,
              prod.description_ar,
              prod.description_en,
              prod.price_usd,
              prod.cost_price_usd,
              prod.old_price_usd,
              categoryId,
              prod.image_url,
              prod.stock,
              prod.colors,
              prod.sizes
            ]
          );
          console.log(`[Database] Seeded product: ${prod.name_en}`);
        }
      }
    }
    console.log('[Database] Additional demo categories and products check/seeding finished.');
  } catch (err) {
    console.error('[Database] Failed to seed additional demo products:', err);
  }
}

// Trigger additional demo seeding 3 seconds after module load
setTimeout(seedDemoData, 3000);

module.exports = db;

