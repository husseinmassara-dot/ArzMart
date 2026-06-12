const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const uploadDirs = [
  path.join(__dirname, '../../uploads'),
  path.join(__dirname, '../../uploads/categories'),
  path.join(__dirname, '../../uploads/products'),
  path.join(__dirname, '../../uploads/banners')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = path.join(__dirname, '../../uploads');
    if (file.fieldname === 'category_image') {
      dest = path.join(__dirname, '../../uploads/categories');
    } else if (file.fieldname === 'product_image') {
      dest = path.join(__dirname, '../../uploads/products');
    } else if (file.fieldname === 'banner_image' || file.fieldname.startsWith('banner_image_')) {
      dest = path.join(__dirname, '../../uploads/banners');
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only real images are allowed (jpg, jpeg, png, webp, gif)'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

module.exports = upload;
