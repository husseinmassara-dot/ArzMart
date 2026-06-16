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
    
    const data = fs.readFileSync(file.path);
    const base64 = data.toString('base64');
    
    // Clean up file from local disk to save space
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }

    return `data:${file.mimetype};base64,${base64}`;
  } catch (err) {
    console.error('Error in fileHelper:', err);
    return null;
  }
};

/**
 * Alias for clarity — same as fileToBase64 but named correctly.
 */
exports.fileToUrl = exports.fileToBase64;
