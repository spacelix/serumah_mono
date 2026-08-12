import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/stores/auth-store';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Realtime (Socket.io) — update status langsung tampil tanpa pull-to-refresh.
 *
 * Client connect dengan JWT (di `auth.token`), server join room `rumah:{id}`.
 * Saat event diterima, React Query meng-invalidate query yang relevan —
 * socket hanya pembawa pesan, React Query tetap sumber kebenaran.
 *
 * Events yang dipakai:
 *   - swap:updated        → invalidate swap list
 *   - piket:updated       → invalidate piket today + submissions
 *   - denda:updated       → invalidate tagihan denda
 *   - iuran:updated       → invalidate tagihan iuran
 *   - galon:updated       → invalidate dashboard (galon widget)
 *   - schedule:updated    → invalidate dashboard (weekend card) + schedule
 */

let socket: Socket | null = null;

function apiOrigin(): string {
  const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  // Base URL mungkin punya prefix /api — socket hanya perlu origin host.
  return base.replace(/\/api$/, '');
}

/** Connect socket dengan token saat ini; aman dipanggil ulang (idempoten). */
export function connectRealtime(): void {
  const token = useAuthStore.getState().token;
  if (!token || socket?.connected) return;
  if (socket) {
    socket.connect();
    return;
  }
  socket = io(apiOrigin(), {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
  });
  socket.on('disconnect', () => {
    // reconnect otomatis ditangani socket.io-client.
  });
}

/** Disconnect (saat logout / token berubah). */
export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}

/** Daftarkan listener event → invalidate query. Panggil sekali di root. */
export function setupRealtimeListeners(queryClient: QueryClient): () => void {
  const listeners: Record<string, () => void> = {
    'swap:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['swap', 'list'] });
    },
    'piket:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['piket'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'denda:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['tagihan', 'denda'] });
    },
    'iuran:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['tagihan', 'iuran'] });
      void queryClient.invalidateQueries({ queryKey: ['tagihan', 'months'] });
    },
    'galon:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'schedule:updated': () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  };

  const handlers: (() => void)[] = [];
  for (const [event, cb] of Object.entries(listeners)) {
    const handler = () => cb();
    socket?.on(event, handler);
    handlers.push(() => socket?.off(event, handler));
  }

  return () => {
    handlers.forEach((off) => off());
  };
}

/** Reconnect dengan token baru (dipanggil setelah login ulang). */
export function reinitRealtime(queryClient: QueryClient): () => void {
  disconnectRealtime();
  connectRealtime();
  return setupRealtimeListeners(queryClient);
}
