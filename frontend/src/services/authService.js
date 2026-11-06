import api, { setAccessToken, clearAccessToken } from './api';
import { AUTH_ENDPOINTS } from './apiContract';

export const authService = {
  /**
   * Authenticate with email & password against backend contract
   */
  async login({ email, password }) {
    try {
      const response = await api.post(AUTH_ENDPOINTS.LOGIN, {
        email: email.trim().toLowerCase(),
        password,
      });

      const data = response.data;
      // If backend returns an in-memory accessToken alongside HttpOnly cookie:
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      return {
        user: data.user || data.data?.user,
        message: data.message || 'Login successful',
      };
    } catch (error) {
      throw extractAuthError(error);
    }
  },

  /**
   * Register a new member account with resident verification fields
   */
  async register({
    name,
    email,
    phone,
    apartmentNumber,
    societyCode,
    password,
  }) {
    try {
      const response = await api.post(AUTH_ENDPOINTS.REGISTER, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        apartmentNumber: apartmentNumber.trim().toUpperCase(),
        societyCode: societyCode?.trim(),
        password,
      });

      const data = response.data;
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      return {
        user: data.user || data.data?.user,
        message: data.message || 'Registration successful. You are signed in, and resident verification is still pending.',
      };
    } catch (error) {
      throw extractAuthError(error);
    }
  },

  /**
   * Terminate active session and invalidate cookies on backend
   */
  async logout() {
    try {
      await api.post(AUTH_ENDPOINTS.LOGOUT);
    } catch (err) {
      // Log error but proceed with frontend session cleanup
      console.warn('Backend logout encountered error, clearing local session:', err.message);
    } finally {
      clearAccessToken();
    }
  },

  /**
   * Restore session from backend using HttpOnly cookie or active credentials
   */
  async getCurrentUser() {
    try {
      const response = await api.get(AUTH_ENDPOINTS.ME);
      const data = response.data;
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
      return data.user || data.data?.user || data;
    } catch (error) {
      clearAccessToken();
      throw extractAuthError(error);
    }
  },

  /**
   * Refresh session credentials
   */
  async refreshToken() {
    try {
      const response = await api.post(AUTH_ENDPOINTS.REFRESH);
      const data = response.data;
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
      return data;
    } catch (error) {
      clearAccessToken();
      throw extractAuthError(error);
    }
  },
};

/**
 * Normalizes backend error responses into human-readable messages
 */
function extractAuthError(error) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    let message = data?.message || data?.error || 'Authentication request failed.';
    if (status === 401) {
      message = data?.message || 'Invalid email or password.';
    } else if (status === 403) {
      message = data?.message || 'Account access is restricted or unverified.';
    } else if (status === 404) {
      message = data?.message || 'Authentication endpoint not found on backend server.';
    } else if (status === 409) {
      message = data?.message || 'An account with this email address already exists.';
    } else if (status >= 500) {
      message = 'Backend server error. Please try again later.';
    }

    const err = new Error(message);
    err.status = status;
    err.details = data?.errors || null;
    return err;
  }

  if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
    const err = new Error('Cannot connect to authentication server. Please check backend status at ' + api.defaults.baseURL);
    err.status = 0;
    err.isNetworkError = true;
    return err;
  }

  return error;
}
