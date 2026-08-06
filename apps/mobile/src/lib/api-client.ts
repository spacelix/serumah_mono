import { default as axios } from 'axios';

import { useAuthStore } from '@/stores/auth-store';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL });

/**
 * Resolve a storage path (e.g. `/storage/stream/...`) to a full URL against
 * the API origin. Legacy absolute MinIO/S3 URLs are rewritten to the backend
 * stream endpoint so the app never talks to object storage directly.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const origin = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  if (url.startsWith('/')) {
    return `${origin}${url}`;
  }
  if (/^https?:\/\//.test(url)) {
    const match = url.match(/^https?:\/\/[^/]+\/(?:[^/]+\/)?(profiles\/.+)$/);
    if (match) {
      return `${origin}/storage/stream/${encodeURIComponent(match[1])}`;
    }
  }
  return url;
}

export async function apiCheckHealth(timeoutMs = 4000): Promise<boolean> {
  try {
    const response = await apiClient.get<{ status: string }>('/health', {
      timeout: timeoutMs,
    });
    return response.data.status === 'ok';
  } catch {
    return false;
  }
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      void useAuthStore.getState().clear();
    }
    const message =
      (error.response?.data?.message as string | undefined) ??
      'Terjadi kesalahan. Coba lagi.';
    return Promise.reject(new Error(message));
  },
);