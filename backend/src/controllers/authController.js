const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

exports.register = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال اسم المستخدم وكلمة المرور', error_en: 'Please enter username and password' });
  }

  try {
    const existingUser = await db.getAsync('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (existingUser) {
      return res.status(400).json({ error_ar: 'اسم المستخدم مسجل مسبقاً', error_en: 'Username is already taken' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await db.runAsync(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, "user", "[]")',
      [username.trim(), hashedPassword]
    );

    // Return success + one-time 10% discount promo code
    res.status(201).json({
      message_ar: 'تم إنشاء الحساب بنجاح! تهانينا، لقد حصلت على خصم ١٠٪ على طلبيتك الأولى.',
      message_en: 'Account created successfully! Congratulations, you have received a 10% discount on your first order.',
      congrats: true,
      discount_code: 'WELCOME10',
      user: {
        id: result.lastID,
        username: username.trim(),
        role: 'user'
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error_ar: 'خطأ في الخادم أثناء التسجيل', error_en: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال اسم المستخدم وكلمة المرور', error_en: 'Please enter username and password' });
  }

  try {
    const user = await db.getAsync('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(400).json({ error_ar: 'اسم المستخدم أو كلمة المرور غير صحيحة', error_en: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error_ar: 'اسم المستخدم أو كلمة المرور غير صحيحة', error_en: 'Invalid username or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, permissions: user.permissions },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message_ar: `مرحباً بك مجدداً، ${user.username}!`,
      message_en: `Welcome back, ${user.username}!`,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error_ar: 'خطأ في الخادم أثناء تسجيل الدخول', error_en: 'Server error during login' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await db.getAsync('SELECT id, username, role, permissions, discount_used, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error_ar: 'المستخدم غير موجود', error_en: 'User not found' });
    }
    res.json({
      user: {
        ...user,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في الخادم', error_en: 'Server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await db.allAsync('SELECT id, username, role, permissions, discount_used, created_at FROM users ORDER BY id DESC');
    const formattedUsers = users.map(u => ({
      ...u,
      permissions: JSON.parse(u.permissions || '[]')
    }));
    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ error_ar: 'خطأ في تحميل قائمة المستخدمين', error_en: 'Error fetching users' });
  }
};

exports.updateUserRoleAndPermissions = async (req, res) => {
  const { id } = req.params;
  const { role, permissions } = req.body; // role: 'user' or 'employee', permissions: array of strings

  if (!role || !permissions) {
    return res.status(400).json({ error_ar: 'المعطيات غير كاملة', error_en: 'Role and permissions are required' });
  }

  try {
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error_ar: 'المستخدم غير موجود', error_en: 'User not found' });
    }

    if (user.role === 'admin' && req.user.username !== 'husseinmassara' && req.user.username !== 'city-hunter') {
      return res.status(403).json({ error_ar: 'لا يمكن تعديل صلاحيات المدير العام إلا من قبله', error_en: 'Only the super admin can modify super admin permissions' });
    }

    await db.runAsync(
      'UPDATE users SET role = ?, permissions = ? WHERE id = ?',
      [role, JSON.stringify(permissions), id]
    );

    res.json({ message_ar: 'تم تحديث صلاحيات المستخدم بنجاح', message_en: 'User permissions updated successfully' });
  } catch (err) {
    console.error('Update user permissions error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء تحديث الصلاحيات', error_en: 'Error updating user permissions' });
  }
};
