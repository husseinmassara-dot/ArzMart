const db = require('../config/db');
const { fileToBase64 } = require('../utils/fileHelper');

exports.getSettings = async (req, res) => {
  try {
    const settings = await db.getAsync('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (!settings) {
      return res.status(404).json({ error_ar: 'الإعدادات غير متوفرة', error_en: 'Settings not available' });
    }
    res.json({
      ...settings,
      hero_banners: JSON.parse(settings.hero_banners || '[]')
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب الإعدادات', error_en: 'Error fetching settings' });
  }
};

exports.updateSettings = async (req, res) => {
  const { app_name, exchange_rate, free_delivery_threshold, delivery_fee, online_payment_enabled, contact_email, site_offline } = req.body;

  try {
    const settings = await db.getAsync('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    const id = settings ? settings.id : 1;

    let logoUrl = settings ? settings.logo_url : '';
    if (req.file) {
      logoUrl = fileToBase64(req.file) || (settings ? settings.logo_url : '');
    }

    const appName = app_name || (settings ? settings.app_name : 'Arz-Mart');
    const exRate = exchange_rate ? parseFloat(exchange_rate) : (settings ? settings.exchange_rate : 89500);
    const freeThreshold = free_delivery_threshold !== undefined ? parseFloat(free_delivery_threshold) : (settings ? settings.free_delivery_threshold : 50);
    const delFee = delivery_fee !== undefined ? parseFloat(delivery_fee) : (settings ? settings.delivery_fee : 4);
    const payEnabled = online_payment_enabled !== undefined ? parseInt(online_payment_enabled) : (settings ? settings.online_payment_enabled : 0);
    const contactEmail = contact_email !== undefined ? contact_email : (settings ? settings.contact_email : 'info@arz-mart.com');
    const siteOfflineVal = site_offline !== undefined ? parseInt(site_offline) : (settings ? (settings.site_offline || 0) : 0);

    if (settings) {
      await db.runAsync(`
        UPDATE settings 
        SET app_name = ?, logo_url = ?, exchange_rate = ?, free_delivery_threshold = ?, delivery_fee = ?, online_payment_enabled = ?, contact_email = ?, site_offline = ?
        WHERE id = ?
      `, [appName, logoUrl, exRate, freeThreshold, delFee, payEnabled, contactEmail, siteOfflineVal, id]);
    } else {
      await db.runAsync(`
        INSERT INTO settings (app_name, logo_url, exchange_rate, free_delivery_threshold, delivery_fee, online_payment_enabled, contact_email, site_offline, hero_banners)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `, [appName, logoUrl, exRate, freeThreshold, delFee, payEnabled, contactEmail, siteOfflineVal]);
    }

    res.json({
      message_ar: 'تم تحديث الإعدادات بنجاح',
      message_en: 'Settings updated successfully',
      settings: {
        app_name: appName,
        logo_url: logoUrl,
        exchange_rate: exRate,
        free_delivery_threshold: freeThreshold,
        delivery_fee: delFee,
        online_payment_enabled: payEnabled,
        contact_email: contactEmail,
        site_offline: siteOfflineVal
      }
    });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تحديث الإعدادات', error_en: 'Error updating settings' });
  }
};

exports.updateBanners = async (req, res) => {
  const { banners } = req.body; // Expect JSON array of banner configurations

  try {
    const settings = await db.getAsync('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (!settings) {
      return res.status(404).json({ error_ar: 'الإعدادات غير موجودة', error_en: 'Settings not found' });
    }

    let bannerArray = [];
    try {
      bannerArray = typeof banners === 'string' ? JSON.parse(banners) : banners;
    } catch (e) {
      return res.status(400).json({ error_ar: 'صيغة البانرات غير صالحة', error_en: 'Invalid banners format' });
    }

    // If new files are uploaded, map them to respective banner configurations
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        // e.g., fieldname could specify ID or index like banner_image_someid or banner_image_0
        const match = file.fieldname.match(/banner_image_(.+)/);
        if (match) {
          const key = match[1];
          // Try to find by unique banner ID first
          let banner = bannerArray.find(b => b.id === key);
          if (banner) {
            banner.image = fileToBase64(file) || banner.image;
          } else {
            // Fallback: try to match by index if key is numeric
            const index = parseInt(key, 10);
            if (!isNaN(index) && bannerArray[index]) {
              bannerArray[index].image = fileToBase64(file) || bannerArray[index].image;
            } else {
              // Delete unused uploaded files
              fileToBase64(file);
            }
          }
        }
      });
    }

    await db.runAsync(
      'UPDATE settings SET hero_banners = ? WHERE id = ?',
      [JSON.stringify(bannerArray), settings.id]
    );

    res.json({
      message_ar: 'تم تحديث البانرات الإعلانية بنجاح',
      message_en: 'Hero banners updated successfully',
      banners: bannerArray
    });
  } catch (err) {
    console.error('Update banners error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تحديث البانرات الإعلانية', error_en: 'Error updating banners' });
  }
};

exports.trackHit = async (req, res) => {
  const { visitor_id, url } = req.body;
  if (!visitor_id) {
    return res.status(400).json({ error: 'visitor_id is required' });
  }
  try {
    await db.runAsync('INSERT INTO page_views (visitor_id, url) VALUES (?, ?)', [visitor_id, url || '']);
    res.json({ success: true });
  } catch (err) {
    console.error('Error tracking page hit:', err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.backupDatabase = async (req, res) => {
  try {
    const tables = ['settings', 'users', 'categories', 'merchants', 'products', 'orders', 'chats', 'coupons', 'notifications', 'page_views', 'search_history'];
    const backupData = {};
    for (const table of tables) {
      try {
        const rows = await db.allAsync(`SELECT * FROM ${table}`);
        backupData[table] = rows;
      } catch (tableErr) {
        console.error(`Error backing up table ${table}:`, tableErr);
        backupData[table] = [];
      }
    }
    
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=arz_mart_backup_${dateStr}.json`);
    res.json(backupData);
  } catch (err) {
    console.error('Backup database error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء إنشاء نسخة احتياطية للموقع', error_en: 'Error creating site backup' });
  }
};

exports.restoreDatabase = async (req, res) => {
  const backupData = req.body;
  if (!backupData || typeof backupData !== 'object') {
    return res.status(400).json({ 
      error_ar: 'الرجاء إدخال ملف نسخة احتياطية صالح بصيغة JSON', 
      error_en: 'Please provide a valid backup JSON file' 
    });
  }

  const tables = ['settings', 'users', 'categories', 'merchants', 'products', 'orders', 'chats', 'coupons', 'notifications', 'page_views', 'search_history'];
  
  // Verify that at least some key tables are present to check validity
  if (!backupData.settings && !backupData.users && !backupData.products) {
    return res.status(400).json({
      error_ar: 'ملف النسخة الاحتياطية غير صالح أو فارغ',
      error_en: 'Backup file is invalid or empty'
    });
  }

  try {
    // Start transaction
    await db.runAsync('BEGIN TRANSACTION');

    for (const table of tables) {
      if (backupData[table] && Array.isArray(backupData[table])) {
        // Wiping the current table records
        await db.runAsync(`DELETE FROM ${table}`);
        const rows = backupData[table];
        if (rows.length === 0) continue;

        // Construct dynamic insert statement
        const keys = Object.keys(rows[0]);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = keys.map(k => row[k]);
          await db.runAsync(sql, values);
        }
      }
    }

    await db.runAsync('COMMIT');
    res.json({
      message_ar: 'تم استعادة نسخة الموقع الاحتياطية بنجاح!',
      message_en: 'Site backup restored successfully!'
    });
  } catch (err) {
    // Rollback changes on error
    await db.runAsync('ROLLBACK').catch(() => {});
    console.error('Restore database error:', err);
    res.status(500).json({ 
      error_ar: 'خطأ أثناء استعادة النسخة الاحتياطية، تم إلغاء التغييرات لسلامة النظام', 
      error_en: 'Error restoring backup, changes rolled back for safety' 
    });
  }
};

exports.getSearchHistory = async (req, res) => {
  try {
    const history = await db.allAsync(`
      SELECT query, COUNT(*) as count, MAX(created_at) as last_searched
      FROM search_history
      GROUP BY query
      ORDER BY count DESC, last_searched DESC
      LIMIT 100
    `);
    res.json(history);
  } catch (err) {
    console.error('Error fetching search history:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب سجل البحث', error_en: 'Error fetching search history' });
  }
};



