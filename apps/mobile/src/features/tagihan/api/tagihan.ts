import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ApiMember {
  id: string;
  nama: string;
}

/* ---------- /auth/me (identity + role) ---------- */
export interface ApiMeResponse {
  user: { id: string; email: string } | null;
  anggota: (ApiMember & { role: string; rumahId: string | null }) | null;
}

async function apiMe(): Promise<ApiMeResponse> {
  const response = await apiClient.get<ApiMeResponse>('/auth/me');
  return response.data;
}

/** Current member + role; meKey = my anggota id (=== user id). */
export function useCurrentMember() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: apiMe,
  });
}

/* ---------- Months (filter options) ---------- */
export interface TagihanMonthsResponse {
  months: string[];
}

export async function apiGetTagihanMonths(): Promise<TagihanMonthsResponse> {
  const response = await apiClient.get<TagihanMonthsResponse>('/tagihan/months');
  return response.data;
}

export function useTagihanMonths() {
  return useQuery({
    queryKey: ['tagihan', 'months'],
    queryFn: apiGetTagihanMonths,
  });
}

/* ---------- Denda ---------- */
export interface DendaDetailRoom {
  ruanganNama: string;
  fotoBefore: string | null;
  fotoAfter: string | null;
  jenisSelesai: string[];
  jenisList: string[];
}

export interface Denda {
  id: string;
  anggota: ApiMember;
  nominal: number;
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas';
  bayarKeAnggotaId: string | null;
  buktiBayar: string | null;
  createdAt: string;
  origin: 'auto' | 'partial' | 'rejected';
  reviewerNama: string | null;
  tanggal: string | null;
  detail: DendaDetailRoom[];
}

export interface DendaListResponse {
  qrisUrl: string | null;
  denda: Denda[];
}

export async function apiGetDenda(bulan: string): Promise<DendaListResponse> {
  const response = await apiClient.get<DendaListResponse>('/denda', {
    params: { bulan },
  });
  return response.data;
}

export async function apiUploadDendaBukti(id: string, buktiUrl: string) {
  const response = await apiClient.post(`/denda/${id}/upload-bukti`, {
    buktiUrl,
  });
  return response.data as { status: string };
}

export async function apiApproveDenda(id: string) {
  const response = await apiClient.post(`/denda/${id}/approve`);
  return response.data as { denda: { id: string } };
}

export async function apiRejectDenda(id: string) {
  const response = await apiClient.post(`/denda/${id}/reject`);
  return response.data as { denda: { id: string } };
}

/* ---------- Iuran ---------- */
export interface IuranItem {
  id: string;
  anggota: ApiMember;
  bulan: string;
  kategori: 'kos' | 'wifi' | 'listrik_wajib';
  label: string;
  nominal: number;
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas';
  buktiBayar: string | null;
}

export interface PelunasanItem {
  id: string;
  bulan: string;
  kategori: string;
  buktiLunas: string | null;
  createdById: string;
}

export interface IuranListResponse {
  iuranList: IuranItem[];
  pelunasan: PelunasanItem[];
  rumah: {
    totalPerBulan: number;
    rekening: {
      bank: string | null;
      nomor: string | null;
      nama: string | null;
    };
  };
}

export async function apiGetIuran(bulan: string): Promise<IuranListResponse> {
  const response = await apiClient.get<IuranListResponse>('/iuran', {
    params: { bulan },
  });
  return response.data;
}

export async function apiEnsureBulan(bulan: string) {
  const response = await apiClient.post('/iuran/ensure-bulan', { bulan });
  return response.data as { created: number; updated: number };
}

export async function apiUploadBuktiTotal(bulan: string, buktiUrl: string) {
  const response = await apiClient.post('/iuran/upload-bukti-total', {
    bulan,
    buktiUrl,
  });
  return response.data as { status: string; count: number };
}

export async function apiConfirmIuranLunas(id: string) {
  const response = await apiClient.post(`/iuran/${id}/confirm-lunas`);
  return response.data as { iuran: { id: string } };
}

export async function apiPelunasan(
  bulan: string,
  kategori: string,
  buktiLunas: string,
) {
  const response = await apiClient.post('/iuran/pelunasan', {
    bulan,
    kategori,
    buktiLunas,
  });
  return response.data as { pelunasan: PelunasanItem };
}

/* ---------- Listrik ---------- */
export interface ListrikRecord {
  id: string;
  anggota: ApiMember;
  nominal: number;
  bulan: string;
  keterangan: string | null;
  buktiBayar: string | null;
  createdAt: string;
  share: number;
}

export interface ListrikListResponse {
  records: ListrikRecord[];
  nameMap: Record<string, string>;
  total: number;
  myBought: number;
  nAnggota: number;
  myCredit: number;
}

export async function apiGetListrik(
  bulan: string,
): Promise<ListrikListResponse> {
  const response = await apiClient.get<ListrikListResponse>('/listrik', {
    params: { bulan },
  });
  return response.data;
}

export async function apiCreateListrik(input: {
  bulan: string;
  nominal: number;
  keterangan?: string;
  buktiUrl: string;
}) {
  const response = await apiClient.post('/listrik', input);
  return response.data as { record: ListrikRecord };
}

export const tagihanKeys = {
  denda: (bulan: string) => ['tagihan', 'denda', bulan] as const,
  iuran: (bulan: string) => ['tagihan', 'iuran', bulan] as const,
  listrik: (bulan: string) => ['tagihan', 'listrik', bulan] as const,
};

export function useTagihanQueries(bulan: string) {
  const denda = useQuery({
    queryKey: tagihanKeys.denda(bulan),
    queryFn: () => apiGetDenda(bulan),
  });
  const iuran = useQuery({
    queryKey: tagihanKeys.iuran(bulan),
    queryFn: () => apiGetIuran(bulan),
  });
  const listrik = useQuery({
    queryKey: tagihanKeys.listrik(bulan),
    queryFn: () => apiGetListrik(bulan),
  });
  return { denda, iuran, listrik };
}

export function useTagihanInvalidate() {
  const queryClient = useQueryClient();
  return (bulan: string) => {
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.denda(bulan) });
    void queryClient.invalidateQueries({ queryKey: tagihanKeys.iuran(bulan) });
    void queryClient.invalidateQueries({
      queryKey: tagihanKeys.listrik(bulan),
    });
  };
}

/* ---------- Month helpers ---------- */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(bulan: string, delta: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
