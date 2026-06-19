import React, { createContext, useState, useEffect, useContext } from 'react';
import { useApp } from './AppContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { apiBase } = useApp();
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  // Restore cached user from localStorage so UI shows immediately without waiting for server
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authToken) => {
    try {
      const res = await fetch(`${apiBase}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        // Cache user data so next app open is instant
        localStorage.setItem('cached_user', JSON.stringify(data.user));
      } else if (res.status === 401) {
        // Only logout if server explicitly says token is invalid/expired
        logout();
      }
      // On any other error (500, network issue, etc.) — keep the user logged in
    } catch (err) {
      // Network error or server down — keep user logged in with cached data
      console.warn('Profile fetch failed (offline?), keeping session:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_ar || data.error_en || 'Login failed');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('cached_user', JSON.stringify(data.user));
    return data;
  };

  const register = async (username, password, fullName, phone, email) => {
    const res = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, full_name: fullName, phone, email })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_ar || data.error_en || 'Registration failed');
    }

    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('cached_user');
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin has all permissions
    return user.permissions && user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      loading,
      login,
      register,
      logout,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
