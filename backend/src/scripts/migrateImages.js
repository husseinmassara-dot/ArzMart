const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// Helper to save base64 string to a file
function saveBase64ToFile(base64Str, subFolder) {
  if (!base64Str || !base64Str.startsWith('data:')) return base64Str;
  
  try {
    const match = base64Str.match(/^data:image\/(\w+);base64,/);
    if (!match) return base64Str;
    
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const dataPart = base64Str.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(dataPart, 'base64');
    
    const filename = `migrated-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const uploadDir = path.join(__dirname, '../../uploads', subFolder);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`Saved migrated image to disk: /uploads/${subFolder}/${filename}`);
    return `/uploads/${subFolder}/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 image to file:', err.message);
    return base64Str;
  }
}

async function migrate() {
  console.log('[Migration] Starting base64 images migration...');
  
  try {
    await db.runAsync('BEGIN TRANSACTION');
    
    // 1. Migrate Products
    const products = await db.allAsync('SELECT id, name_en, image_url FROM products');
    let productCount = 0;
    for (const p of products) {
      if (!p.image_url) continue;
      
      let imagesList = [];
      let changed = false;
      try {
        if (p.image_url.startsWith('[')) {
          imagesList = JSON.parse(p.image_url);
        } else {
          imagesList = [p.image_url];
        }
      } catch (e) {
        imagesList = [p.image_url];
      }
      
      const newImagesList = imagesList.map(img => {
        if (img && img.startsWith('data:')) {
          changed = true;
          return saveBase64ToFile(img, 'products');
        }
        return img;
      });
      
      if (changed) {
        const newImageUrlStr = JSON.stringify(newImagesList);
        await db.runAsync('UPDATE products SET image_url = ? WHERE id = ?', [newImageUrlStr, p.id]);
        console.log(`Migrated images for product ID ${p.id} (${p.name_en})`);
        productCount++;
      }
    }
    
    // 2. Migrate Categories
    const categories = await db.allAsync('SELECT id, name_en, image_url FROM categories');
    let categoryCount = 0;
    for (const c of categories) {
      if (c.image_url && c.image_url.startsWith('data:')) {
        const newUrl = saveBase64ToFile(c.image_url, 'categories');
        await db.runAsync('UPDATE categories SET image_url = ? WHERE id = ?', [newUrl, c.id]);
        console.log(`Migrated image for category ID ${c.id} (${c.name_en})`);
        categoryCount++;
      }
    }
    
    // 3. Migrate Settings Logo and Banners
    const settings = await db.getAsync('SELECT id, logo_url, hero_banners FROM settings LIMIT 1');
    let settingsCount = 0;
    if (settings) {
      let logoUrl = settings.logo_url;
      let heroBanners = [];
      let changedLogo = false;
      let changedBanners = false;
      
      if (logoUrl && logoUrl.startsWith('data:')) {
        logoUrl = saveBase64ToFile(logoUrl, 'banners');
        changedLogo = true;
      }
      
      try {
        heroBanners = JSON.parse(settings.hero_banners || '[]');
      } catch (e) {
        heroBanners = [];
      }
      
      const newBanners = heroBanners.map(banner => {
        if (banner.image && banner.image.startsWith('data:')) {
          changedBanners = true;
          const newImg = saveBase64ToFile(banner.image, 'banners');
          return { ...banner, image: newImg };
        }
        return banner;
      });
      
      if (changedLogo || changedBanners) {
        await db.runAsync(
          'UPDATE settings SET logo_url = ?, hero_banners = ? WHERE id = ?',
          [logoUrl, JSON.stringify(newBanners), settings.id]
        );
        console.log('Migrated settings logo and hero banners');
        settingsCount++;
      }
    }
    
    await db.runAsync('COMMIT');
    console.log(`[Migration] Finished successfully. Migrated ${productCount} products, ${categoryCount} categories, ${settingsCount} settings.`);
  } catch (err) {
    await db.runAsync('ROLLBACK').catch(() => {});
    console.error('[Migration] Failed:', err);
  } finally {
    process.exit(0);
  }
}

// Give it a brief delay to connect
setTimeout(migrate, 1000);
