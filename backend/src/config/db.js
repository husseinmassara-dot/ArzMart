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

module.exports = db;
