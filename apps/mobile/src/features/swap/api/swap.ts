import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SwapMember {
  id: string;
  nama: string;
}

export interface SwapRequest {
  id: string;
  tanggal: string;
  status: 'diajukan' | 'diterima' | 'ditolak';
  dari: SwapMember;
  ke: SwapMember;
  createdAt: string;
}

export interface SwapListResponse {
  incoming: SwapRequest[];
  mine: SwapRequest[];
}

export async function apiGetSwaps(): Promise<SwapListResponse> {
  const response = await apiClient.get<SwapListResponse>('/swap');
  return response.data;
}

export async function apiGetSwapAvailableDays(): Promise<string[]> {
  const response = await apiClient.get<string[]>('/swap/available-days');
  return response.data;
}

export async function apiCreateSwap(
  tanggal: string,
  keAnggotaId: string,
): Promise<{ swapRequest: SwapRequest }> {
  const response = await apiClient.post('/swap', { tanggal, keAnggotaId });
  return response.data;
}

export async function apiAcceptSwap(
  id: string,
): Promise<{ swapRequest: SwapRequest }> {
  const response = await apiClient.post(`/swap/${id}/accept`);
  return response.data;
}

export async function apiRejectSwap(
  id: string,
): Promise<{ swapRequest: SwapRequest }> {
  const response = await apiClient.post(`/swap/${id}/reject`);
  return response.data;
}

export const swapKeys = {
  list: ['swap', 'list'] as const,
  available: ['swap', 'available-days'] as const,
};

export function useSwaps() {
  return useQuery({
    queryKey: swapKeys.list,
    queryFn: apiGetSwaps,
  });
}

export function useSwapAvailableDays() {
  return useQuery({
    queryKey: swapKeys.available,
    queryFn: apiGetSwapAvailableDays,
  });
}

export function useSwapMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: swapKeys.list });
  };
  const create = useMutation({
    mutationFn: ({
      tanggal,
      keAnggotaId,
    }: {
      tanggal: string;
      keAnggotaId: string;
    }) => apiCreateSwap(tanggal, keAnggotaId),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: swapKeys.available });
    },
  });
  const accept = useMutation({
    mutationFn: (id: string) => apiAcceptSwap(id),
    onSuccess: () => invalidate(),
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiRejectSwap(id),
    onSuccess: () => invalidate(),
  });
  return { create, accept, reject };
}

export function swapMembersFromSwaps(
  swaps: SwapRequest[],
  excludeId: string | null,
): SwapMember[] {
  const map = new Map<string, SwapMember>();
  for (const s of swaps) {
    if (s.ke.id !== excludeId) map.set(s.ke.id, s.ke);
    if (s.dari.id !== excludeId) map.set(s.dari.id, s.dari);
  }
  return [...map.values()];
}
