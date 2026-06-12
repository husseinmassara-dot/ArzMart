const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('./config/db'); // Initialize DB and Seed Admin/Settings

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images static folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
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
