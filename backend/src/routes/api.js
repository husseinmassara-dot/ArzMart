const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');

// Controllers
const authController = require('../controllers/authController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const couponController = require('../controllers/couponController');
const settingsController = require('../controllers/settingsController');
const chatController = require('../controllers/chatController');
const merchantController = require('../controllers/merchantController');

// --- Auth Routes ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', authenticateToken, authController.getProfile);
router.delete('/auth/delete-account', authenticateToken, authController.deleteAccount);

// --- User Management (Admin Only) ---
router.get('/admin/users', authenticateToken, requirePermission('users'), authController.getUsers);
router.put('/admin/users/:id/permissions', authenticateToken, requirePermission('users'), authController.updateUserRoleAndPermissions);
router.delete('/admin/users/:id', authenticateToken, requirePermission('users'), authController.adminDeleteUser);

// --- Category Routes ---
router.get('/categories', categoryController.getCategories);
router.post('/categories', authenticateToken, requirePermission('categories'), upload.single('category_image'), categoryController.createCategory);
router.put('/categories/:id', authenticateToken, requirePermission('categories'), upload.single('category_image'), categoryController.updateCategory);
router.delete('/categories/:id', authenticateToken, requirePermission('categories'), categoryController.deleteCategory);
router.put('/categories-reorder', authenticateToken, requirePermission('categories'), categoryController.reorderCategories);


// --- Product Routes ---
router.get('/products', productController.getProducts);
router.get('/admin/products/export-csv', authenticateToken, requirePermission('products'), productController.exportCSV);
router.post('/admin/products/import-csv', authenticateToken, requirePermission('products'), upload.single('csv_file'), productController.importCSV);
router.get('/products/:id', productController.getProductById);
router.post('/products', authenticateToken, requirePermission('products'), upload.array('product_images', 10), productController.createProduct);
router.put('/products/bulk-update-category', authenticateToken, requirePermission('products'), productController.bulkUpdateCategory);
router.put('/products/:id', authenticateToken, requirePermission('products'), upload.array('product_images', 10), productController.updateProduct);
router.delete('/products/:id', authenticateToken, requirePermission('products'), productController.deleteProduct);
router.post('/products/:id/rate', productController.rateProduct);

// --- Order Routes ---
router.post('/orders', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    authenticateToken(req, res, next);
  } else {
    next();
  }
}, orderController.createOrder);

router.get('/orders', authenticateToken, requirePermission('orders'), orderController.getOrders);
router.get('/orders/history', authenticateToken, orderController.getUserOrders);
router.get('/orders/:id', authenticateToken, orderController.getOrderById);
router.put('/orders/:id/status', authenticateToken, requirePermission('orders'), orderController.updateOrderStatus);
router.delete('/orders/:id', authenticateToken, requireAdmin, orderController.deleteOrder);

// --- Coupon Routes ---
router.get('/coupons', authenticateToken, couponController.getCoupons);
router.post('/coupons', authenticateToken, requirePermission('coupons'), couponController.createCoupon);
router.delete('/coupons/:id', authenticateToken, requirePermission('coupons'), couponController.deleteCoupon);

// --- Settings Routes ---
router.get('/settings', settingsController.getSettings);
router.put('/settings', authenticateToken, requirePermission('settings'), upload.single('logo'), settingsController.updateSettings);
router.put('/settings/banners', authenticateToken, requirePermission('settings'), upload.any(), settingsController.updateBanners);
router.post('/analytics/hit', settingsController.trackHit);
router.get('/analytics/search-history', authenticateToken, requirePermission('reports'), settingsController.getSearchHistory);
router.get('/reports', authenticateToken, requirePermission('reports'), orderController.getReports);
router.get('/admin/backup', authenticateToken, requireAdmin, settingsController.backupDatabase);
router.post('/admin/restore', authenticateToken, requireAdmin, settingsController.restoreDatabase);

// --- Chat Routes ---
router.post('/chat/send', authenticateToken, chatController.sendMessage);
router.get('/chat/history', authenticateToken, chatController.getChatHistory);
router.get('/chat/users', authenticateToken, requirePermission('chat'), chatController.getChatUsers);

// --- Merchant Routes ---
router.get('/merchants', authenticateToken, requirePermission('merchants'), merchantController.getMerchants);
router.post('/merchants', authenticateToken, requirePermission('merchants'), merchantController.createMerchant);
router.put('/merchants/:id', authenticateToken, requirePermission('merchants'), merchantController.updateMerchant);
router.delete('/merchants/:id', authenticateToken, requirePermission('merchants'), merchantController.deleteMerchant);

module.exports = router;
