import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type WeekendChoice = 'di_kos' | 'pulang';

export interface WeekendInfo {
  status: WeekendChoice | null;
  frozen: boolean;
  anggotaLain: { id: string; nama: string; status: string }[];
}

export interface GalonInfo {
  giliran: { id: string; periodeMulai: string; status: string } | null;
  namaAnggota: string | null;
  isMine: boolean;
}

export interface BillingInfo {
  total: number;
  lunas: number;
  totalUnpaid: number;
  countUnpaid: number;
  bulan: string | null;
}

export type ScheduleTag =
  'Hari ini' | 'Selesai' | 'Terjadwal' | 'Bolong' | 'Free' | 'LIBUR';

export interface ScheduleRow {
  tanggal: string;
  dow: string;
  anggotaList: { id: string; nama: string }[];
  isMine: boolean;
  ruangan: string[];
  statusTag: ScheduleTag;
}

export interface Dashboard {
  weekend: WeekendInfo;
  galon: GalonInfo;
  billing: BillingInfo;
  scheduleWeek: ScheduleRow[];
  scheduleIncomplete: boolean;
  isAdmin: boolean;
  memberName: string;
}

interface ApiScheduleRow {
  tanggal: string;
  dow: string;
  statusTag: ScheduleTag;
  ruangan: string[];
  anggotaList: { id: string; nama: string }[];
  isMine: boolean;
}

interface ApiDashboard {
  weekend: WeekendInfo;
  galon: GalonInfo;
  billing: BillingInfo;
  scheduleWeek: ApiScheduleRow[];
  scheduleIncomplete: boolean;
  isAdmin: boolean;
  memberName: string;
}

export async function apiGetDashboard(): Promise<ApiDashboard> {
  const response = await apiClient.get<ApiDashboard>('/dashboard');
  return response.data;
}

export async function apiSetWeekendStatus(
  status: WeekendChoice,
): Promise<void> {
  await apiClient.put('/schedule/weekend-status', { status });
}

export async function apiConfirmGalon(id: string): Promise<void> {
  await apiClient.post(`/galon/${id}/confirm`);
}

export async function apiNudgeGalon(): Promise<{ ok: boolean }> {
  const response = await apiClient.post<{ ok: boolean }>('/galon/nudge');
  return response.data;
}

export async function apiGenerateRestOfWeek(): Promise<{ count: number }> {
  const response = await apiClient.post<{ count: number }>(
    '/schedule/generate/rest-of-week',
  );
  return response.data;
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: apiGetDashboard,
  });
}

export function useSetWeekendStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: WeekendChoice) => apiSetWeekendStatus(status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}

export function useConfirmGalon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiConfirmGalon(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}

export function useGenerateRestOfWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiGenerateRestOfWeek,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}

export async function apiRefreshFutureRooms(): Promise<{ updated: number }> {
  const response = await apiClient.post<{ updated: number }>(
    '/schedule/refresh-future-rooms',
  );
  return response.data;
}

/** Type-level re-export so screens import one name. */
export type DashboardData = Dashboard;
