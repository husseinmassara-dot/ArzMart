const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'arz_mart_super_secure_secret_key_12345';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error_ar: 'غير مصرح، الرجاء تسجيل الدخول', error_en: 'Unauthorized, please log in' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error_ar: 'انتهت الصلاحية، الرجاء تسجيل الدخول مجدداً', error_en: 'Session expired, please log in again' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'employee')) {
    next();
  } else {
    res.status(403).json({ error_ar: 'غير مسموح، هذه الصفحة للمدراء فقط', error_en: 'Forbidden, admin privileges required' });
  }
}

function requirePermission(permissionName) {
  return (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return next(); // Admin has all permissions
    }
    if (req.user && req.user.role === 'employee') {
      const permissions = JSON.parse(req.user.permissions || '[]');
      if (permissions.includes(permissionName)) {
        return next();
      }
    }
    res.status(403).json({ error_ar: 'ليس لديك الصلاحية الكافية لإجراء هذه العملية', error_en: 'You do not have permission to perform this action' });
  };
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission,
  JWT_SECRET
};
