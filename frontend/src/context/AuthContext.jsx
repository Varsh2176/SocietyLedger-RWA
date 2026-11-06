import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { markSessionCleared, markSessionEstablished, registerUnauthorizedHandler } from '../services/api';
import { USER_ROLES, ROUTE_PERMISSIONS } from '../services/apiContract';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Restore session on application load via backend cookie
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser && currentUser.email) {
        setUser(currentUser);
        markSessionEstablished();
        setSessionExpired(false);
      } else {
        setUser(null);
        markSessionCleared();
      }
    } catch (err) {
      // 401 or network error during restoration means no active session
      setUser(null);
      markSessionCleared();
      if (!err.isNetworkError && err.status !== 401) {
        setAuthError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    // Register 401 session expiration handler
    registerUnauthorizedHandler(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, [restoreSession]);

  const login = async (credentials) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await authService.login(credentials);
      setUser(result.user);
      markSessionEstablished();
      setSessionExpired(false);
      return result;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await authService.register(userData);
      // Backend may return a logged-in user or unverified user
      if (result.user) {
        setUser(result.user);
        markSessionEstablished();
        setSessionExpired(false);
      }
      return result;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      markSessionCleared();
      setSessionExpired(false);
      setIsLoading(false);
    }
  };

  const clearSessionExpired = () => {
    setSessionExpired(false);
  };

  /**
   * Helper to verify if the active user possesses an allowed role
   */
  const hasRole = (allowedRoles = []) => {
    if (!user || !user.role) return false;
    if (allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
  };

  /**
   * Checks whether the user can access a specific route section
   */
  const canAccessRoute = (routeKey) => {
    const requiredRoles = ROUTE_PERMISSIONS[routeKey];
    if (!requiredRoles) return true;
    return hasRole(requiredRoles);
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isLoading,
    sessionExpired,
    authError,
    login,
    register,
    logout,
    restoreSession,
    clearSessionExpired,
    hasRole,
    canAccessRoute,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
