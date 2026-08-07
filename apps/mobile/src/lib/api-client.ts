import { default as axios } from 'axios';

import { useAuthStore } from '@/stores/auth-store';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL,
  timeout: 15_000,
});

/**
 * Timeout for upload requests (multipart) — longer than the default since
 * image uploads can be slow; prevents indefinite hangs on a stalled MinIO/API.
 */
export const UPLOAD_TIMEOUT_MS = 45_000;

/**
 * Resolve a storage path (e.g. `/storage/stream/...`) to a full URL against
 * the API origin. Legacy absolute MinIO/S3 URLs are rewritten to the backend
 * stream endpoint so the app never talks to object storage directly.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
): string | undefined {
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

/**
 * Source object untuk `expo-image` yang mengirim Authorization header ke
 * endpoint stream (yang sekarang dilindungi JWT). Memakai memo agar objek
 * source tidak dibuat ulang tiap render (ExpoImage sensitif terhadap
 * referensi source yang berubah).
 */
export function mediaSource(
  url: string | null | undefined,
  token?: string | null,
): { uri: string; headers: Record<string, string> } | null {
  const uri = resolveMediaUrl(url);
  if (!uri) return null;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { uri, headers };
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
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      void useAuthStore.getState().clear();
    }
    const message =
      (error.response?.data?.message as string | undefined) ??
      'Terjadi kesalahan. Coba lagi.';
    return Promise.reject(new Error(message));
  },
);
