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
