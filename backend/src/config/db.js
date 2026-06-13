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
initializeDatabase();

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
        online_payment_enabled INTEGER DEFAULT 0
      )
    `);

    // 2. Users Table
    runInit(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '[]',
        discount_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
        FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE SET NULL
      )
    `);

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
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'زيت زيتون لبناني بكر ممتاز ١ ليتر',
                'Extra Virgin Lebanese Olive Oil 1L',
                'زيت زيتون معصور على البارد من حقول الكورة الشمالية، طبيعي ١٠٠٪ وبجودة ممتازة.',
                'Cold-pressed olive oil from the fields of Koura, North Lebanon. 100% natural and high quality.',
                9.50, 6.00, 12.00, ?, 1,
                'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
                25, 18, 4
              )
            `, [oilsId]);
          });

          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('العسل والمربيات البلدية', 'Local Honey & Jams', ?, '')`, [groceriesId], function(err) {
            if (err) return;
            const honeyId = this.lastID;
            
            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'عسل السنديان اللبناني الطبيعي ٥٠٠غ',
                'Natural Lebanese Oak Honey 500g',
                'عسل جبلي أسود طبيعي ١٠٠٪ غني بالفوائد، من مناحل جبال الشوف.',
                '100% natural dark oak mountain honey, harvested from the beehives of Shouf mountains.',
                14.00, 9.50, NULL, ?, 1,
                'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=300&q=80',
                15, 23, 5
              )
            `, [honeyId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'مربى التين اللبناني التقليدي ٦٠0غ',
                'Traditional Lebanese Fig Jam 600g',
                'مربى تين بلدي مصنوع على الطريقة التقليدية بالسمسم وجوز الهند من البقاع.',
                'Homemade traditional Lebanese fig jam made with sesame and walnuts from Bekaa.',
                4.50, 2.80, 5.50, ?, 2,
                'https://images.unsplash.com/photo-1622484211148-716bdf2c4b7e?auto=format&fit=crop&w=300&q=80',
                30, 9, 2
              )
            `, [honeyId]);
          });

          db.run(`INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ('القهوة والبهارات اللبنانية', 'Lebanese Coffee & Spices', ?, '')`, [groceriesId], function(err) {
            if (err) return;
            const spicesId = this.lastID;

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'زعتر بلدي ممتاز محوج ٤50غ',
                'Premium Lebanese Wild Zaatar 450g',
                'خلطة الزعتر البلدي اللبناني مع السمسم المحمص والسماق البلدي النقي.',
                'Traditional Lebanese zaatar blend with toasted sesame seeds and pure sumac.',
                3.80, 2.00, NULL, ?, 2,
                'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&w=300&q=80',
                40, 5, 1
              )
            `, [spicesId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'قهوة لبنانية مطحونة مع هال ٢٥0غ',
                'Lebanese Ground Coffee with Cardamom 250g',
                'بن أشقر برازيلي مطحون ومحمص بنكهة الهال الغنية بخلطة لبنانية مميزة.',
                'Traditional golden roasted and finely ground coffee with rich cardamom flavor.',
                3.20, 1.80, 4.00, ?, 2,
                'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
                50, 10, 2
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
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'صابون غار طرابلسي طبيعي حبة كبيرة',
                'Natural Tripoli Laurel Soap Large Bar',
                'صابون مصنوع يدوياً من زيت الغار وزيت الزيتون النقي، ممتاز للبشرة الحساسة.',
                'Handcrafted traditional soap bar made with pure laurel oil and olive oil, ideal for sensitive skin.',
                2.50, 1.20, NULL, ?, 3,
                'https://images.unsplash.com/photo-1607006342466-4aa8d8d32be5?auto=format&fit=crop&w=300&q=80',
                60, 14, 3
              )
            `, [soapId]);

            db.run(`
              INSERT INTO products (name_ar, name_en, description_ar, description_en, price_usd, cost_price_usd, old_price_usd, category_id, merchant_id, image_url, stock, rating_sum, rating_count)
              VALUES (
                'صابون زيت الزيتون بماء الورد البلدي',
                'Olive Oil Soap with Natural Rose Water',
                'صابون معطر بماء الورد الجوري اللبناني الطبيعي لتنظيف وترطيب البشرة.',
                'Traditional olive oil soap bar infused with organic Lebanese rose water for gentle skin moisturizing.',
                2.20, 1.00, 3.00, ?, 3,
                'https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=300&q=80',
                45, 10, 2
              )
            `, [soapId]);
          });
        });
      }
    });
  });
}

module.exports = db;
