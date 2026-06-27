/**
 * Axios client. baseURL defaults to /api/v1 (proxied to :4000 in dev).
 * Interceptor attaches the access token; on 401, tries /auth/refresh
 * and retries the original request once.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  withCredentials: false,
  timeout: 15_000,
});

let getAccessToken: (() => string | null) | null = null;
let getRefreshToken: (() => string | null) | null = null;
let onRefreshed: ((newAccess: string, newRefresh: string) => void) | null = null;
let onLoggedOut: (() => void) | null = null;

export function configureApi(opts: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onRefreshed: (newAccess: string, newRefresh: string) => void;
  onLoggedOut: () => void;
}) {
  getAccessToken = opts.getAccessToken;
  getRefreshToken = opts.getRefreshToken;
  onRefreshed = opts.onRefreshed;
  onLoggedOut = opts.onLoggedOut;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken?.();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
      original._retried = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) return reject(error);
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const refresh = getRefreshToken?.();
        if (!refresh) {
          onLoggedOut?.();
          return Promise.reject(error);
        }
        const res = await api.post('/auth/refresh', { refreshToken: refresh });
        const newAccess: string = res.data.data.accessToken;
        // backend currently returns the same refresh token
        const newRefresh = refresh;
        onRefreshed?.(newAccess, newRefresh);
        pendingQueue.forEach((cb) => cb(newAccess));
        pendingQueue = [];
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        pendingQueue.forEach((cb) => cb(null));
        pendingQueue = [];
        onLoggedOut?.();
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function isApiError(err: unknown): err is AxiosError<ApiErrorBody> {
  return axios.isAxiosError(err) && !!err.response?.data?.error;
}

export function getErrorCode(err: unknown): string {
  return isApiError(err) ? err.response!.data.error.code : 'UNKNOWN';
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return isApiError(err) ? err.response!.data.error.message : fallback;
}
