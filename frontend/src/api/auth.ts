import { api } from './client';

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: 'super_admin' | 'owner' | 'treasurer' | 'member';
  otpVerified: boolean;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export async function signup(input: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password: string;
  consent: true;
}): Promise<{ userId: string; phone: string }> {
  const { data } = await api.post<{ success: true; data: { userId: string; phone: string } }>(
    '/auth/signup',
    input,
  );
  return data.data;
}

export async function requestOtp(phone: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ success: true; data: { ok: true } }>('/auth/otp/request', { phone });
  return data.data;
}

export async function verifyOtp(phone: string, code: string): Promise<AuthResponse> {
  const { data } = await api.post<{ success: true; data: AuthResponse }>('/auth/otp/verify', {
    phone,
    code,
  });
  return data.data;
}

export async function login(phone: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<{ success: true; data: AuthResponse }>('/auth/login', {
    phone,
    password,
  });
  return data.data;
}

export async function refreshSession(refreshToken: string): Promise<{ accessToken: string }> {
  const { data } = await api.post<{ success: true; data: { accessToken: string } }>('/auth/refresh', {
    refreshToken,
  });
  return data.data;
}

export async function logout(refreshToken: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ success: true; data: { ok: true } }>('/auth/logout', {
    refreshToken,
  });
  return data.data;
}

export async function me(): Promise<PublicUser> {
  const { data } = await api.get<{ success: true; data: PublicUser }>('/auth/me');
  return data.data;
}

export async function requestActivationOtp(phone: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ success: true; data: { ok: true } }>('/auth/activate/request', { phone });
  return data.data;
}

export async function completeActivation(input: {
  phone: string;
  code: string;
  password: string;
  consent: true;
}): Promise<AuthResponse> {
  const { data } = await api.post<{ success: true; data: AuthResponse }>('/auth/activate/complete', input);
  return data.data;
}
