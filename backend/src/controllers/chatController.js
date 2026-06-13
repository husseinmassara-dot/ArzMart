const db = require('../config/db');

exports.sendMessage = async (req, res) => {
  const { message, user_id } = req.body;
  const isUser = req.user.role === 'user';
  
  const targetUserId = isUser ? req.user.id : parseInt(user_id);
  const senderType = isUser ? 'user' : 'admin';

  if (!message || !message.trim()) {
    return res.status(400).json({ error_ar: 'الرسالة فارغة', error_en: 'Message cannot be empty' });
  }

  if (!targetUserId) {
    return res.status(400).json({ error_ar: 'معرف المستخدم مطلوب', error_en: 'User ID is required' });
  }

  try {
    const result = await db.runAsync(
      'INSERT INTO chats (user_id, sender, message) VALUES (?, ?, ?)',
      [targetUserId, senderType, message.trim()]
    );

    const newMessage = {
      id: result.lastID,
      user_id: targetUserId,
      sender: senderType,
      message: message.trim(),
      created_at: new Date()
    };

    // Emit live WebSocket notification if globally available
    if (global.broadcastChatMessage) {
      global.broadcastChatMessage(newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error_ar: 'خطأ أثناء إرسال الرسالة', error_en: 'Error sending message' });
  }
};

exports.getChatHistory = async (req, res) => {
  const isUser = req.user.role === 'user';
  const targetUserId = isUser ? req.user.id : parseInt(req.query.user_id);

  if (!targetUserId) {
    return res.status(400).json({ error_ar: 'معرف المستخدم مطلوب', error_en: 'User ID is required' });
  }

  try {
    const chatHistory = await db.allAsync(
      'SELECT * FROM chats WHERE user_id = ? ORDER BY id ASC',
      [targetUserId]
    );
    res.json(chatHistory);
  } catch (err) {
    console.error('Get chat history error:', err);
    res.status(500).json({ error_ar: 'خطأ في تحميل المحادثة', error_en: 'Error fetching chat history' });
  }
};

exports.getChatUsers = async (req, res) => {
  try {
    // Fetch unique users who have chat messages, sorted by latest message
    const users = await db.allAsync(`
      SELECT DISTINCT u.id, u.username, 
        (SELECT message FROM chats WHERE user_id = u.id ORDER BY id DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chats WHERE user_id = u.id ORDER BY id DESC LIMIT 1) as last_message_time
      FROM users u
      JOIN chats c ON u.id = c.user_id
      ORDER BY last_message_time DESC
    `);
    res.json(users);
  } catch (err) {
    console.error('Get chat users error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب قائمة الدردشات', error_en: 'Error fetching chat users' });
  }
};
