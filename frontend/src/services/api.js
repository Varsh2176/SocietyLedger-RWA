import axios from 'axios';

function resolveApiBaseUrl() {
  const env = import.meta.env;
  const configured = env && env.VITE_API_BASE_URL;
  if (configured && typeof configured === 'string' && configured.trim()) {
    const trimmed = configured.trim().replace(/\/$/, '');
    const base = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    if (env.PROD && /localhost|127\.0\.0\.1/.test(base)) {
      throw new Error('VITE_API_BASE_URL must be the deployed API origin for a production build.');
    }
    return base;
  }
  if (!env || env.DEV) return 'http://localhost:5000/api';
  throw new Error('VITE_API_BASE_URL is required for a production build.');
}

const baseURL = resolveApiBaseUrl();

/**
 * Sample ledgers are allowed only for the Node integration runner, which has no
 * Vite environment, and for an explicit demo flag. Production and normal
 * development show an unavailable state instead of sample figures.
 */
export function mockFallbackAllowed(env) {
  if (!env) return true;
  if (env.PROD) return false;
  return env.VITE_ENABLE_MOCK_FALLBACK === 'true';
}

export function shouldUseMockFallback() {
  return mockFallbackAllowed(import.meta.env);
}

/** A missing payload is unavailable. An empty list or zero balance is real data. */
export function readApiData(response) {
  if (response?.data?.data == null) {
    const error = new Error('Financial data is unavailable.');
    error.code = 'UNAVAILABLE';
    throw error;
  }
  return response.data.data;
}

/**
 * In-memory storage for short-lived access token.
 * Sensitive tokens are NEVER written to localStorage.
 */
let inMemoryAccessToken = null;
let sessionEpoch = 0;
let sessionActive = false;

/** A successful login, registration, or session restore starts a new epoch. */
export function markSessionEstablished() {
  sessionEpoch += 1;
  sessionActive = true;
}

/** Logout and failed restoration invalidate in-flight requests from the old epoch. */
export function markSessionCleared() {
  sessionEpoch += 1;
  sessionActive = false;
}

export function stampRequestEpoch() {
  return sessionEpoch;
}

/** A 401 expires the session only when it belongs to the session that is active now. */
export function shouldReportSessionExpiry(requestEpoch) {
  return sessionActive && requestEpoch === sessionEpoch;
}

export function noteSessionRejected() {
  if (!shouldReportSessionExpiry(sessionEpoch)) return false;
  sessionActive = false;
  sessionEpoch += 1;
  return true;
}

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => {
  return inMemoryAccessToken;
};

export const clearAccessToken = () => {
  inMemoryAccessToken = null;
};

/**
 * Centralized Axios instance with secure cookie handling.
 */
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Automatically includes HttpOnly session/refresh cookies
  timeout: 15000,
});

// Listener for session expiration events
let onUnauthorizedCallback = null;

export const registerUnauthorizedHandler = (callback) => {
  onUnauthorizedCallback = callback;
};

// Request Interceptor: injects in-memory token if available
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    config.sessionEpoch = stampRequestEpoch();
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Prefer the API envelope message over Axios's generic status text.
 * Drops messages that look like secrets, tokens, or stack traces.
 */
export function getApiErrorMessage(error) {
  const data = error?.response?.data;
  const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';
  const looksUnsafe =
    !serverMessage ||
    serverMessage.length > 300 ||
    /password|secret|stack trace|mongodb:\/\//i.test(serverMessage) ||
    /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/.test(serverMessage) ||
    /\n\s+at\s+/.test(serverMessage);

  if (!looksUnsafe) return serverMessage;
  if (!error?.response) return 'Cannot reach the server. Check your connection and try again.';
  if (error.response.status >= 500) return 'The server could not complete this request. Please try again.';
  return 'The request could not be completed.';
}

// Response Interceptor: handles 401 Unauthorized and network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error && typeof error === 'object') {
      error.message = getApiErrorMessage(error);
    }

    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response && error.response.status === 401) {
      const requestUrl = originalRequest?.url || '';
      const isAuthExchange = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'].some((path) =>
        requestUrl.includes(path)
      );
      // A 401 from a request issued before login or registration must not
      // clear the session that has just been established.
      if (!isAuthExchange && shouldReportSessionExpiry(originalRequest?.sessionEpoch) && noteSessionRejected()) {
        clearAccessToken();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback({
            message: error.response?.data?.message || 'Your session has expired. Please sign in again.',
          });
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
