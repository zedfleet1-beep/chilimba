/**
 * Auth Pinia store. Persists the refresh token in localStorage so sessions
 * survive page reloads. Access tokens stay in memory and are renewed via
 * /auth/refresh on bootstrap and when they expire.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as authApi from '@/api/auth';
import { configureApi } from '@/api/client';
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from '@/lib/session';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<authApi.PublicUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const bootstrapped = ref(false);
  const bootstrapping = ref(false);

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  function setSession(payload: authApi.AuthResponse) {
    user.value = payload.user;
    accessToken.value = payload.accessToken;
    refreshToken.value = payload.refreshToken;
    saveRefreshToken(payload.refreshToken);
  }

  function clearSession() {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    clearRefreshToken();
  }

  configureApi({
    getAccessToken: () => accessToken.value,
    getRefreshToken: () => refreshToken.value,
    onRefreshed: (newAccess, newRefresh) => {
      accessToken.value = newAccess;
      refreshToken.value = newRefresh;
      if (newRefresh) saveRefreshToken(newRefresh);
    },
    onLoggedOut: () => {
      clearSession();
    },
  });

  let restorePromise: Promise<void> | null = null;

  async function restore(): Promise<void> {
    if (bootstrapped.value) return;
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
      bootstrapping.value = true;
      const stored = loadRefreshToken();
      if (!stored) {
        bootstrapped.value = true;
        bootstrapping.value = false;
        return;
      }
      try {
        refreshToken.value = stored;
        const { accessToken: newAccess } = await authApi.refreshSession(stored);
        accessToken.value = newAccess;
        user.value = await authApi.me();
      } catch {
        clearSession();
      } finally {
        bootstrapped.value = true;
        bootstrapping.value = false;
      }
    })();

    return restorePromise;
  }

  async function signup(input: Parameters<typeof authApi.signup>[0]) {
    return authApi.signup(input);
  }

  async function requestOtp(phone: string) {
    return authApi.requestOtp(phone);
  }

  async function verifyOtp(phone: string, code: string) {
    const result = await authApi.verifyOtp(phone, code);
    setSession(result);
    return result;
  }

  async function login(phone: string, password: string) {
    const result = await authApi.login(phone, password);
    setSession(result);
    return result;
  }

  async function logout() {
    if (refreshToken.value) {
      try {
        await authApi.logout(refreshToken.value);
      } catch {
        // ignore
      }
    }
    clearSession();
  }

  async function requestActivationOtp(phone: string) {
    return authApi.requestActivationOtp(phone);
  }

  async function completeActivation(input: Parameters<typeof authApi.completeActivation>[0]) {
    const result = await authApi.completeActivation(input);
    setSession(result);
    return result;
  }

  async function forgotPassword(phone: string) {
    return authApi.forgotPassword(phone);
  }

  async function resetPassword(input: Parameters<typeof authApi.resetPassword>[0]) {
    return authApi.resetPassword(input);
  }

  return {
    user,
    accessToken,
    refreshToken,
    bootstrapped,
    bootstrapping,
    isAuthenticated,
    restore,
    signup,
    requestOtp,
    verifyOtp,
    login,
    logout,
    requestActivationOtp,
    completeActivation,
    forgotPassword,
    resetPassword,
  };
});