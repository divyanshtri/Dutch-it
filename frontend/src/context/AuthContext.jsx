import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// A custom hook so components use `const { user, login } = useAuth();`
// instead of importing useContext + AuthContext everywhere separately.
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // loading starts true because on first page load, we don't yet know if
  // the user has a valid session cookie or not — we have to ask the
  // server first (GET /me) before we can render either "logged in" or
  // "logged out" UI. Without this, the app would flash a "logged out"
  // state for a split second even for a returning, already-logged-in user.

  // Checks whether a valid session cookie already exists, on first app load.
  async function checkAuth() {
    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include',
        // credentials: 'include' is REQUIRED on every fetch() call that
        // needs to send/receive cookies cross-origin. Without this on
        // EVERY request (not just login), the browser won't attach the
        // httpOnly cookie at all, and the backend will see no token.
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login(identifier, password) {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed.');
    setUser(data.user);
    return data.user;
  }

  async function register(formData) {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed.');
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}