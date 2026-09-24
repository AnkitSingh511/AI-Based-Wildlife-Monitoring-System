import { createContext, useContext, useState, useEffect } from "react";
import authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => authService.getToken());
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync state on initial load
    const storedToken = authService.getToken();
    const storedUser = authService.getCurrentUser();
    setToken(storedToken);
    setUser(storedUser);
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const result = await authService.login(credentials);
    setToken(result.token);
    setUser(result.user || authService.getCurrentUser());
    return result;
  };

  const register = async (userData) => {
    const result = await authService.register(userData);
    return result;
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
