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
        active INTEGER DEFAULT 1,
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `);
    try {
      await pgPool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0");
    } catch (e) {}
    try {
      await pgPool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1");
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
        active INTEGER DEFAULT 1,
        FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
      )
    `, [], () => {
      // Migrate existing databases by adding sort_order column if it doesn't exist
      const alterSortOrder = isPostgres 
        ? "ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0" 
        : "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0";
      db.run(alterSortOrder, [], () => { /* Ignore errors for existing columns */ });
      const alterActive = isPostgres 
        ? "ALTER TABLE categories ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1" 
        : "ALTER TABLE categories ADD COLUMN active INTEGER DEFAULT 1";
      db.run(alterActive, [], () => { /* Ignore errors for existing columns */ });
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

const additionalCategories = [];

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
      'Groceries & Provisions': ['Lebanese Coffee & Spices', 'Traditional Oils & Fats', 'Local Honey & Jams'],
      'Personal Care & Traditional Soaps': ['Olive Oil & Laurel Soaps']
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
      'Groceries & Provisions', 'Personal Care & Traditional Soaps'
    ];
    for (const name of topLevel) {
      await db.runAsync(
        "UPDATE categories SET parent_id = NULL WHERE name_en = ? AND parent_id IS NOT NULL",
        [name]
      );
    }
    console.log('[Database] Category hierarchy enforced successfully.');

    // Perform database migrations to fix products in wrong categories
    console.log('[Database] Running catalog correction migrations...');
    try {
      await db.runAsync("UPDATE products SET category_id = 329 WHERE id = 416 AND (category_id IS NULL OR category_id = 0)");
      await db.runAsync("UPDATE products SET category_id = 331 WHERE id = 115 AND category_id = 285");
      await db.runAsync("UPDATE products SET category_id = 247 WHERE id IN (141, 144, 146) AND category_id = 285");
      await db.runAsync("UPDATE products SET category_id = 326 WHERE id IN (160, 260, 265, 267, 268, 269) AND category_id = 285");
      await db.runAsync("UPDATE products SET category_id = 268 WHERE id IN (140, 142) AND category_id = 269");
      console.log('[Database] Catalog correction migrations completed successfully.');
    } catch (e) {
      console.error('[Database] Failed to run catalog correction migrations:', e.message);
    }

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
      if (false && !hasNewBanners) {
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

