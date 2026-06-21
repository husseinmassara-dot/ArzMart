const fs = require('fs');
const path = require('path');

/**
 * Returns the Base64 data URI for a multer-uploaded file.
 * The file is read, converted to base64, deleted from disk, and returned.
 * 
 * @param {Object} file - The file object from req.file or req.files
 * @returns {String|null} The Base64 data URI, or null if no file
 */
exports.fileToBase64 = (file) => {
  if (!file) return null;
  try {
    if (!fs.existsSync(file.path)) {
      return null;
    }
    
    // Backup to DB asynchronously (non-blocking)
    try {
      const data = fs.readFileSync(file.path);
      const base64 = data.toString('base64');
      const db = require('../config/db');
      
      const insertQuery = db.isPostgres
        ? 'INSERT INTO media_assets (filename, mime_type, base64_data) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING'
        : 'INSERT OR IGNORE INTO media_assets (filename, mime_type, base64_data) VALUES (?, ?, ?)';
        
      db.runAsync(insertQuery, [file.filename, file.mimetype, base64])
        .then(() => console.log(`[Backup] Successfully backed up ${file.filename} to database.`))
        .catch(err => console.error(`[Backup Error] Failed for ${file.filename}:`, err.message));
    } catch (backupErr) {
      console.error('[Backup Error] Failed to read/queue file backup:', backupErr.message);
    }
    
    // Construct the relative URL path starting from /uploads/
    const uploadsIndex = file.path.lastIndexOf('uploads');
    if (uploadsIndex !== -1) {
      const relativePath = '/' + file.path.substring(uploadsIndex).replace(/\\/g, '/');
      return relativePath;
    }
    
    return `/uploads/${file.filename}`;
  } catch (err) {
    console.error('Error in fileHelper:', err);
    return null;
  }
};

/**
 * Alias for clarity — same as fileToBase64 but named correctly.
 */
exports.fileToUrl = exports.fileToBase64;
