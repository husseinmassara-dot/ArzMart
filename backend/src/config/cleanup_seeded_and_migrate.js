const db = require('./db');

async function run() {
  console.log('[Cleanup] Starting database migration and cleanup...');
  
  try {
    // 1. Ensure the active column exists (Migration)
    console.log('[Cleanup] Ensuring "active" column exists in categories table...');
    if (db.isPostgres) {
      try {
        await db.runAsync('ALTER TABLE categories ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1');
        console.log('[Cleanup] PostgreSQL migration successful.');
      } catch (e) {
        console.warn('[Cleanup] PostgreSQL Alter table warning (might already exist):', e.message);
      }
    } else {
      try {
        await db.runAsync('ALTER TABLE categories ADD COLUMN active INTEGER DEFAULT 1');
        console.log('[Cleanup] SQLite migration successful.');
      } catch (e) {
        console.warn('[Cleanup] SQLite Alter table warning (might already exist):', e.message);
      }
    }

    // 2. Identify demo categories to delete
    const demoCategoriesEn = [
      'Phone Accessories', 'Toys & Games', 'Electronics & Electricals',
      'Cosmetics & Beauty', 'Tools & Hardware', 'Stationery & Office',
      'Accessories', 'Clothing', 'Glassware', 'Shoes', 'Watches',
      'Phones', 'Home & Kitchen', 'Pets'
    ];

    console.log('[Cleanup] Deleting demo products in demo categories...');
    // Delete products in demo categories
    const deleteProductsSql = `
      DELETE FROM products 
      WHERE category_id IN (
        SELECT id FROM categories WHERE name_en IN (${demoCategoriesEn.map(() => '?').join(',')})
      )
    `;
    const prodResult = await db.runAsync(deleteProductsSql, demoCategoriesEn);
    console.log(`[Cleanup] Deleted ${prodResult.changes || 0} demo products.`);

    console.log('[Cleanup] Deleting demo categories...');
    // Delete demo categories
    const deleteCategoriesSql = `
      DELETE FROM categories 
      WHERE name_en IN (${demoCategoriesEn.map(() => '?').join(',')})
    `;
    const catResult = await db.runAsync(deleteCategoriesSql, demoCategoriesEn);
    console.log(`[Cleanup] Deleted ${catResult.changes || 0} demo categories.`);

    console.log('[Cleanup] Database migration and cleanup completed successfully!');
  } catch (err) {
    console.error('[Cleanup] Error during database cleanup:', err);
  } finally {
    process.exit(0);
  }
}

// Wait a bit for db connection to initialize
setTimeout(run, 1500);
