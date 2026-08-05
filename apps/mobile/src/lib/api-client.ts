import { default as axios } from 'axios';

import { useAuthStore } from '@/stores/auth-store';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL });

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