const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
require('./config/db'); // Initialize DB and Seed Admin/Settings

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Setup persistent uploads symlink
const persistentDir = '/home/hussein/.gemini/antigravity/worktrees/arz_mart_data';
const persistentUploads = path.join(persistentDir, 'uploads');
const localUploads = path.join(__dirname, '../uploads');

if (!fs.existsSync(persistentDir)) {
  try {
    fs.mkdirSync(persistentDir, { recursive: true });
  } catch (e) {
    console.error('Failed to create persistent dir:', e);
  }
}

if (fs.existsSync(persistentDir)) {
  if (!fs.existsSync(persistentUploads)) {
    try {
      fs.mkdirSync(persistentUploads, { recursive: true });
    } catch (e) {
      console.error('Failed to create persistent uploads dir:', e);
    }
  }

  // Ensure subdirectories exist
  ['categories', 'products', 'banners'].forEach(sub => {
    const subPath = path.join(persistentUploads, sub);
    if (!fs.existsSync(subPath)) {
      try {
        fs.mkdirSync(subPath, { recursive: true });
      } catch (e) {}
    }
  });

  try {
    if (fs.existsSync(localUploads)) {
      const stat = fs.lstatSync(localUploads);
      if (!stat.isSymbolicLink()) {
        fs.rmSync(localUploads, { recursive: true, force: true });
      }
    }
    if (!fs.existsSync(localUploads)) {
      fs.symlinkSync(persistentUploads, localUploads, 'dir');
      console.log('[Uploads] Symlinked local uploads to persistent directory.');
    }
  } catch (err) {
    console.error('[Uploads] Failed to symlink uploads directory:', err);
  }
}

// Serve uploaded images static folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Fallback recovery route for missing static files (Render ephemeral disk recovery)
app.get('/uploads/:folder(categories|products|banners)/:filename', async (req, res) => {
  const { folder, filename } = req.params;
  
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filePath = path.join(__dirname, '../uploads', folder, filename);
  
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  
  try {
    const db = require('./config/db');
    const asset = await db.getAsync('SELECT * FROM media_assets WHERE filename = ?', [filename]);
    if (asset) {
      const buffer = Buffer.from(asset.base64_data, 'base64');
      
      // Ensure local subdirectories exist
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Cache back to disk
      fs.writeFileSync(filePath, buffer);
      console.log(`[Recovery] Restored missing file: /uploads/${folder}/${filename}`);
      
      res.setHeader('Content-Type', asset.mime_type || 'image/jpeg');
      return res.send(buffer);
    }
  } catch (err) {
    console.error('[Recovery Error] Failed to restore asset:', err);
  }
  
  return res.status(404).json({ error: 'File not found' });
});

// Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Server index check / SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const spaPath = path.join(__dirname, '../../frontend/dist/index.html');
  if (fs.existsSync(spaPath)) {
    res.sendFile(spaPath);
  } else {
    res.json({ message: 'Arz-Mart API server running' });
  }
});

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
const clients = new Map(); // key: userId/role, value: socket instance

wss.on('connection', (ws) => {
  let clientKey = null;

  ws.on('message', (messageString) => {
    try {
      const data = JSON.parse(messageString);
      
      // Handle registration connection
      if (data.type === 'register') {
        clientKey = data.userId ? `user_${data.userId}` : 'guest';
        if (data.role === 'admin' || data.role === 'employee') {
          clientKey = 'admin_portal';
        }
        clients.set(clientKey, ws);
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    if (clientKey) {
      clients.delete(clientKey);
    }
  });
});

// Global WebSocket notification helpers
global.broadcastChatMessage = (message) => {
  // message: { id, user_id, sender: 'user'|'admin', message, created_at }
  // Send to user
  const userSocket = clients.get(`user_${message.user_id}`);
  if (userSocket && userSocket.readyState === WebSocket.OPEN) {
    userSocket.send(JSON.stringify({ type: 'chat_message', message }));
  }
  // Send to admin portal
  const adminSocket = clients.get('admin_portal');
  if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
    adminSocket.send(JSON.stringify({ type: 'chat_message', message }));
  }
};

global.notifyAdminOfNewOrder = (orderInfo) => {
  const adminSocket = clients.get('admin_portal');
  if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
    adminSocket.send(JSON.stringify({ type: 'new_order', order: orderInfo }));
  }
};

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
