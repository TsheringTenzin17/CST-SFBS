import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cst_user'));
    } catch {
      return null;
    }
  });

  function login(u) {
    setUser(u);
    localStorage.setItem('cst_user', JSON.stringify(u));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('cst_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}