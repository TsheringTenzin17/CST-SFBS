import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('cst_token');

    if (!token) {
      localStorage.removeItem('cst_user');
      setIsLoading(false);
      return () => { active = false; };
    }

    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Session expired');
        if (active) {
          setUser(data.user);
          localStorage.setItem('cst_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem('cst_token');
        localStorage.removeItem('cst_user');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, []);

  function login(u, token) {
    setUser(u);
    localStorage.setItem('cst_user', JSON.stringify(u));
    localStorage.setItem('cst_token', token);
  }

  // Keep the header and stored session profile in sync after profile edits.
  function updateUser(updatedFields) {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...updatedFields };
      localStorage.setItem('cst_user', JSON.stringify(updated));
      return updated;
    });
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('cst_user');
    localStorage.removeItem('cst_token');
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}