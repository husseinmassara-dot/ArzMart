const fs = require('fs');

/**
 * Converts a multer file object to a base64 Data URL and unlinks the temporary file from disk.
 * @param {Object} file - The file object from req.file or req.files
 * @returns {String|null} The base64 data URL string or null
 */
exports.fileToBase64 = (file) => {
  if (!file) return null;
  try {
    if (!fs.existsSync(file.path)) {
      return null;
    }
    const data = fs.readFileSync(file.path);
    const base64 = data.toString('base64');
    
    // Clean up temporary file from disk
    try {
      fs.unlinkSync(file.path);
    } catch (unlinkErr) {
      console.error('Error deleting temporary file:', unlinkErr);
    }
    
    return `data:${file.mimetype};base64,${base64}`;
  } catch (err) {
    console.error('Error in fileToBase64 conversion:', err);
    return null;
  }
};
