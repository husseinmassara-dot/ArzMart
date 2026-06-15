const fs = require('fs');
const path = require('path');

/**
 * Returns the relative URL path for a multer-uploaded file.
 * The file is KEPT on disk (not deleted) and served via /uploads static route.
 * 
 * Example return value: "/uploads/products/1718123456789-123456789.jpg"
 * 
 * @param {Object} file - The file object from req.file or req.files
 * @returns {String|null} The relative URL path, or null if no file
 */
exports.fileToBase64 = (file) => {
  if (!file) return null;
  try {
    if (!fs.existsSync(file.path)) {
      return null;
    }
    // Build a URL path relative to the backend root
    // file.path is absolute, e.g. /home/user/project/backend/uploads/products/xyz.jpg
    // We want: /uploads/products/xyz.jpg
    const uploadsRoot = path.join(__dirname, '../../uploads');
    const relativePath = '/' + path.relative(path.join(__dirname, '../..'), file.path).replace(/\\/g, '/');
    return relativePath;
  } catch (err) {
    console.error('Error in fileHelper:', err);
    return null;
  }
};

/**
 * Alias for clarity — same as fileToBase64 but named correctly.
 * Use this for new code.
 */
exports.fileToUrl = exports.fileToBase64;
