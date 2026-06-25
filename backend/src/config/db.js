const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');

const isPostgres = process.env.DB_TYPE === 'postgres' || !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

const db = {
  isPostgres
};

const newGeneralCategories = [];

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
  const fs = require('fs');
  const os = require('os');
  const persistentDir = path.join(os.homedir(), '.gemini', 'antigravity', 'worktrees', 'arz_mart_data');
  if (!fs.existsSync(persistentDir)) {
    try {
      fs.mkdirSync(persistentDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create persistent dir:', e);
    }
  }
  const dbPath = fs.existsSync(persistentDir)
    ? path.join(persistentDir, 'database.sqlite')
    : path.join(__dirname, '../../database.sqlite');
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
        contact_email TEXT DEFAULT 'info@arz-mart.com',
        site_offline INTEGER DEFAULT 0
      )
    `);
    
    try {
      await pgPool.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'info@arz-mart.com'");
    } catch (e) {}
    try {
      await pgPool.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS site_offline INTEGER DEFAULT 0");
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
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `);
    try {
      await pgPool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0");
    } catch (e) {}

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
        model_number TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
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
    try {
      await pgPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number TEXT DEFAULT ''");
    } catch (e) {}
    try {
      await pgPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0");
    } catch (e) {}
    try {
      await pgPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INTEGER DEFAULT 0");
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
        driver_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    try {
      await pgPool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id INTEGER DEFAULT NULL");
    } catch (e) {}

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

    // 10. Page Views Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Search History Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        visitor_id TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Media Assets Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        mime_type TEXT,
        base64_data TEXT NOT NULL
      )
    `);

    // 13. Returns Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        refund_amount DOUBLE PRECISION NOT NULL,
        stock_action TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
      )
    `);

    // 14. Invoices Table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        merchant_id INTEGER NOT NULL,
        invoice_number TEXT,
        invoice_date TEXT NOT NULL,
        total_amount DOUBLE PRECISION NOT NULL,
        items TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
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

    // Seed Categories — only on FIRST RUN (empty DB), never overwrite user data
    const categoriesCount = await pgPool.query('SELECT COUNT(*) FROM categories');
    const pgCount = parseInt(categoriesCount.rows[0].count);
    if (pgCount === 0 && newGeneralCategories.length > 0) {
      console.log('[Database] First run: seeding initial categories...');
      for (const cat of newGeneralCategories) {
        await pgPool.query(
          'INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES ($1, $2, null, $3)',
          [cat.name_ar, cat.name_en, cat.image_url]
        );
      }
      console.log('[Database] Seeded initial categories.');
    } else {
      console.log(`[Database] Found ${pgCount} existing categories — skipping seed to preserve user data.`);
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
        contact_email TEXT DEFAULT 'info@arz-mart.com',
        site_offline INTEGER DEFAULT 0
      )
    `, [], () => {
      const alterQuery = isPostgres 
        ? "ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'info@arz-mart.com'" 
        : "ALTER TABLE settings ADD COLUMN contact_email TEXT DEFAULT 'info@arz-mart.com'";
      db.run(alterQuery, [], (err) => {
        // Ignore errors
      });
      const alterOffline = isPostgres 
        ? "ALTER TABLE settings ADD COLUMN IF NOT EXISTS site_offline INTEGER DEFAULT 0" 
        : "ALTER TABLE settings ADD COLUMN site_offline INTEGER DEFAULT 0";
      db.run(alterOffline, [], (err) => {
        // Ignore errors
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
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `, [], () => {
      // Migrate existing databases by adding sort_order column if it doesn't exist
      const alterSortOrder = isPostgres 
        ? "ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0" 
        : "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0";
      db.run(alterSortOrder, [], () => { /* Ignore errors for existing columns */ });
    });

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
        model_number TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
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
      const alterModel = isPostgres 
        ? "ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number TEXT DEFAULT ''" 
        : "ALTER TABLE products ADD COLUMN model_number TEXT DEFAULT ''";
      db.run(alterModel, [], (err) => {
        // Ignore error
      });
      const alterSortOrderProd = isPostgres 
        ? "ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0" 
        : "ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0";
      db.run(alterSortOrderProd, [], (err) => {
        // Ignore error
      });
      const alterFeaturedProd = isPostgres 
        ? "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INTEGER DEFAULT 0" 
        : "ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0";
      db.run(alterFeaturedProd, [], (err) => {
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
        driver_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `, [], () => {
      const alterDriverId = isPostgres 
        ? "ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id INTEGER DEFAULT NULL" 
        : "ALTER TABLE orders ADD COLUMN driver_id INTEGER DEFAULT NULL";
      db.run(alterDriverId, [], () => {});
    });

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

    // 10. Page Views Table
    runInit(`
      CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Search History Table
    runInit(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        visitor_id TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Media Assets Table
    runInit(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        mime_type TEXT,
        base64_data TEXT NOT NULL
      )
    `);

    // 13. Returns Table
    runInit(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        refund_amount REAL NOT NULL,
        stock_action TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
      )
    `);

    // 14. Invoices Table
    runInit(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        invoice_number TEXT,
        invoice_date TEXT NOT NULL,
        total_amount REAL NOT NULL,
        items TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
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

    // Seed Categories — only on FIRST RUN (empty DB), never overwrite user data
    db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
      const sqliteCount = row ? parseInt(row.count) : 0;
      if (sqliteCount === 0 && newGeneralCategories.length > 0) {
        console.log('[Database] First run: seeding initial categories...');
        db.serialize(() => {
          newGeneralCategories.forEach(cat => {
            db.run('INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES (?, ?, null, ?)', [cat.name_ar, cat.name_en, cat.image_url]);
          });
          console.log('[Database] SQLite initial categories seeded successfully.');
        });
      } else {
        console.log(`[Database] Found ${sqliteCount} existing categories — skipping seed to preserve user data.`);
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
  { name_ar: 'أحذية', name_en: 'Shoes', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'ساعات', name_en: 'Watches', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'هواتف', name_en: 'Phones', image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'أدوات منزلية', name_en: 'Home & Kitchen', image_url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=300&q=80' },
  { name_ar: 'طعام حيوانات', name_en: 'Pets', image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=300&q=80' }
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
  console.log('[Database] Checking additional demo categories...');
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
    }
    console.log('[Database] Additional demo categories check/seeding finished.');

    // ── Enforce correct parent-child hierarchy ────────────────────────────────
    // This runs every startup to keep subcategory nesting intact.
    const parentMap = {
      // Groceries & Provisions  →  Lebanese Coffee & Spices, Traditional Oils & Fats, Local Honey & Jams
      'Groceries & Provisions': ['Lebanese Coffee & Spices', 'Traditional Oils & Fats', 'Local Honey & Jams'],
      // Personal Care & Traditional Soaps  →  Olive Oil & Laurel Soaps, Cosmetics & Beauty
      'Personal Care & Traditional Soaps': ['Olive Oil & Laurel Soaps', 'Cosmetics & Beauty'],
      // Electronics & Electricals  →  Phones, Phone Accessories, Watches
      'Electronics & Electricals': ['Phones', 'Phone Accessories', 'Watches'],
      // Clothing  →  Shoes, Accessories
      'Clothing': ['Shoes', 'Accessories'],
      // Home & Kitchen  →  Glassware, Tools & Hardware
      'Home & Kitchen': ['Glassware', 'Tools & Hardware'],
    };

    for (const [parentName, childNames] of Object.entries(parentMap)) {
      const parent = await db.getAsync('SELECT id FROM categories WHERE name_en = ?', [parentName]);
      if (!parent) continue;
      for (const childName of childNames) {
        await db.runAsync(
          'UPDATE categories SET parent_id = ? WHERE name_en = ? AND (parent_id IS NULL OR parent_id != ?)',
          [parent.id, childName, parent.id]
        );
      }
    }

    // Ensure the top-level parents themselves have no parent_id
    const topLevel = [
      'Groceries & Provisions', 'Personal Care & Traditional Soaps',
      'Electronics & Electricals', 'Clothing', 'Home & Kitchen',
      'Toys & Games', 'Stationery & Office', 'Pets'
    ];
    for (const name of topLevel) {
      await db.runAsync(
        "UPDATE categories SET parent_id = NULL WHERE name_en = ? AND parent_id IS NOT NULL",
        [name]
      );
    }
    console.log('[Database] Category hierarchy enforced successfully.');

    // Update Settings Hero Banners to include tech/cosmetics/clothing banners
    const settings = await db.getAsync('SELECT id, hero_banners FROM settings LIMIT 1');
    if (settings) {
      let banners = [];
      try {
        banners = JSON.parse(settings.hero_banners || '[]');
      } catch (e) {
        banners = [];
      }

      // Check if our new banners are already added
      const hasNewBanners = banners.some(b => b.id === 'banner_init_8');
      if (!hasNewBanners) {
        const updatedBanners = [
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
          },
          {
            id: 'banner_init_3',
            image: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'عالم الإلكترونيات والأجهزة الذكية',
            title_en: 'Smart Devices & Tech World',
            desc_ar: 'اكتشف أحدث سماعات الرأس، الساعات الذكية، وإكسسوارات الهواتف بأسعار منافسة',
            desc_en: 'Explore the latest headphones, smartwatches, and phone accessories at competitive prices'
          },
          {
            id: 'banner_init_4',
            image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'جمالك والعناية الفائقة بالبشرة',
            title_en: 'Beauty & Premium Face Care',
            desc_ar: 'مجموعة فاخرة من أدوات التجميل، مرطبات الشفاه، والصابون الطبيعي الأصيل',
            desc_en: 'A premium selection of cosmetics, lip balms, and authentic natural soaps'
          },
          {
            id: 'banner_init_5',
            image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'أحدث الموديلات والملابس الراقية',
            title_en: 'Latest Trends & High-End Clothing',
            desc_ar: 'تشكيلة واسعة من الملابس الصيفية، الأحذية الرياضية، والإكسسوارات الأنيقة',
            desc_en: 'A wide range of summer clothing, athletic shoes, and stylish accessories'
          },
          {
            id: 'banner_init_6',
            image: 'https://images.unsplash.com/photo-1532330393533-443990a51d10?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'عالم الألعاب والمرح للأطفال',
            title_en: 'Kids Toys & Fun World',
            desc_ar: 'سيارات تحكم عن بعد، مكعبات بناء إبداعية، وألعاب لوحية ممتعة للعائلة',
            desc_en: 'Remote control cars, creative building blocks, and fun board games for the family'
          },
          {
            id: 'banner_init_7',
            image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'العدة والأدوات المنزلية والمهنية',
            title_en: 'Professional Tools & Hardware',
            desc_ar: 'مفكات، أدوات قياس ليزر، وحقائب عدة متكاملة لمختلف أعمال الصيانة',
            desc_en: 'Screwdrivers, laser measures, and complete toolkits for all maintenance needs'
          },
          {
            id: 'banner_init_8',
            image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80',
            title_ar: 'زجاجيات وأدوات منزلية فاخرة',
            title_en: 'Luxury Glassware & Dining',
            desc_ar: 'طقم كؤوس أنيق، أوعية تقديم كريستال، وأواني زجاجية مقاومة للحرارة',
            desc_en: 'Elegant glass tumblers, crystal bowls, and heat-resistant pitchers for your home'
          }
        ];

        await db.runAsync(
          'UPDATE settings SET hero_banners = ? WHERE id = ?',
          [JSON.stringify(updatedBanners), settings.id]
        );
        console.log('[Database] Updated hero banners successfully.');
      }
    }
  } catch (err) {
    console.error('[Database] Failed to seed additional demo products:', err);
  }
}

// Trigger additional demo seeding 3 seconds after module load
setTimeout(seedDemoData, 3000);

module.exports = db;

