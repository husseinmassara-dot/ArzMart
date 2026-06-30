const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'worktrees', 'arz_mart_data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

db.all(`
  SELECT p.id, p.name_en, p.name_ar, p.category_id, c.name_en as category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  ORDER BY p.id ASC
`, [], (err, rows) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log(`Total products locally: ${rows.length}`);
  // Find products that might be in wrong categories by name matching
  rows.forEach((p) => {
    const name = (p.name_en || '').toLowerCase();
    const cat = (p.category_name || '').toLowerCase();

    // Look for obvious mismatches (e.g. watch in toys, charger in watches, inverter in lamps, vacuum in lamps)
    const isWatch = name.includes('watch') || name.includes('rolex') || name.includes('ساعة');
    const isWatchCat = cat.includes('watch') || cat.includes('ساع');

    const isToy = name.includes('toy') || name.includes('game') || name.includes('puzzle') || name.includes('car') || name.includes('gun') || name.includes('crawler') || name.includes('لعبة');
    const isToyCat = cat.includes('toy') || cat.includes('game') || cat.includes('nintendo') || cat.includes('car') || cat.includes('playstation') || cat.includes('لعب');

    if (isWatch && !isWatchCat) {
      console.log(`Mismatch (Watch not in Watch Category): ID: ${p.id} | Name: "${p.name_en}" | Category: "${p.category_name}" (ID: ${p.category_id})`);
    }

    if (isToy && !isToyCat && !name.includes('charger') && !name.includes('holder') && !name.includes('cable')) {
      console.log(`Mismatch (Toy not in Toy Category): ID: ${p.id} | Name: "${p.name_en}" | Category: "${p.category_name}" (ID: ${p.category_id})`);
    }

    // Check specific items: Inverter, Vacuum, socket, fan under Lamps (331) or Lighting (326)
    if ((name.includes('inverter') || name.includes('vacuum') || name.includes('socket') || name.includes('fan') || name.includes('مكنس') || name.includes('مروحة')) && (p.category_id === 331 || p.category_id === 326)) {
      console.log(`Mismatch (Electrical under Lamps/Lighting): ID: ${p.id} | Name: "${p.name_en}" | Category: "${p.category_name}" (ID: ${p.category_id})`);
    }
  });

  db.close();
});
