import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <CartProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);

const SW_VERSION = 'v3';
if ('serviceWorker' in navigator) {
  const currentSwVersion = localStorage.getItem('sw_version');
  if (currentSwVersion !== SW_VERSION) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        for (let registration of registrations) {
          registration.unregister();
        }
        localStorage.setItem('sw_version', SW_VERSION);
        window.location.reload();
      } else {
        localStorage.setItem('sw_version', SW_VERSION);
      }
    });
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered:', reg))
        .catch(err => console.error('SW Reg Failed:', err));
    });
  }
}

