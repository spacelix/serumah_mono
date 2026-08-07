import { apiClient } from '@/lib/api-client';
import type { AuthUser } from '@/stores/auth-store';

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface OnboardingState {
  hasProfile: boolean;
  hasRumah: boolean;
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await apiClient.post<AuthSession>('/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function apiRegister(
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await apiClient.post<AuthSession>('/auth/register', {
    email,
    password,
  });
  return response.data;
}

interface ApiMeResponse {
  user: AuthUser | null;
  anggota: { rumahId: string | null } | null;
}

export async function apiMe(token?: string): Promise<ApiMeResponse> {
  const response = await apiClient.get<ApiMeResponse>('/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data;
}
