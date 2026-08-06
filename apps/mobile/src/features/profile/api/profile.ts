import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AnggotaDetail {
  id: string;
  nama: string;
  fotoProfil: string | null;
  kamar: string | null;
  kontakDarurat: string | null;
  alamat: string | null;
  role: string;
  rumahId: string | null;
}

export interface RumahInfo {
  id: string;
  nama: string;
  alamat: string;
  inviteCode: string;
}

export interface ProfileResponse {
  anggota: AnggotaDetail | null;
  rumah: RumahInfo | null;
}

export async function apiGetProfile(): Promise<ProfileResponse> {
  const response = await apiClient.get<ProfileResponse>('/anggota/me');
  return response.data;
}

export interface UpdateProfileInput {
  nama?: string;
  fotoProfil?: string;
  kontakDarurat?: string;
  alamat?: string;
}

export async function apiUpdateProfile(input: UpdateProfileInput) {
  const response = await apiClient.patch('/anggota/me/profile', input);
  return response.data as { anggota: AnggotaDetail };
}

export async function apiUploadAvatar(uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: `avatar_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
  const response = await apiClient.post('/storage/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url as string;
}

/* ---------- Rumah Management ---------- */
export interface RumahManageMember {
  id: string;
  nama: string;
  fotoProfil: string | null;
  kamar: string | null;
  role: string;
}

export interface RumahDetail {
  id: string;
  nama: string;
  alamat: string;
  biayaKos: number;
  biayaWifi: number;
  biayaListrikWajib: number;
  nominalDenda: number;
  rekeningBank: string | null;
  rekeningNomor: string | null;
  rekeningNama: string | null;
  qrisUrl: string | null;
  inviteCode: string;
}

export interface RumahMeResponse {
  rumah: RumahDetail | null;
  anggotaList: RumahManageMember[];
  currentRole: string | null;
}

export async function apiGetRumahMe(): Promise<RumahMeResponse> {
  const response = await apiClient.get<RumahMeResponse>('/rumah/me');
  return response.data;
}

export interface UpdateRumahInput {
  biayaKos?: number;
  biayaWifi?: number;
  biayaListrikWajib?: number;
  nominalDenda?: number;
  rekeningBank?: string;
  rekeningNomor?: string;
  rekeningNama?: string;
}

export async function apiUpdateRumah(input: UpdateRumahInput) {
  const response = await apiClient.patch('/rumah/me', input);
  return response.data as { rumah: RumahDetail };
}

export async function apiResetInvite() {
  const response = await apiClient.post('/rumah/reset-invite');
  return response.data as { inviteCode: string };
}

export async function apiSetQris(qrisUrl: string) {
  const response = await apiClient.put('/rumah/qris', { qrisUrl });
  return response.data as { rumah: RumahDetail };
}

export async function apiRemoveAnggota(anggotaId: string) {
  const response = await apiClient.delete(`/rumah/anggota/${anggotaId}`);
  return response.data as { success: boolean };
}

export const profileKeys = {
  me: ['profile', 'me'] as const,
  rumah: ['profile', 'rumah'] as const,
};

export function useProfile() {
  return useQuery({ queryKey: profileKeys.me, queryFn: apiGetProfile });
}

export function useRumahMe() {
  return useQuery({ queryKey: profileKeys.rumah, queryFn: apiGetRumahMe });
}

export function useProfileInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    void queryClient.invalidateQueries({ queryKey: profileKeys.rumah });
  };
}

/* ---------- Ruangan & Jenis Piket (inline in Kelola Kos) ---------- */
export interface JenisPiket {
  id: string;
  ruanganId: string;
  nama: string;
  isActive: boolean;
}

export interface Ruangan {
  id: string;
  rumahId: string;
  nama: string;
  urutan: number;
  jenisPiket: JenisPiket[];
}

export async function apiGetRuangan(): Promise<Ruangan[]> {
  const response = await apiClient.get<Ruangan[]>('/ruangan');
  return response.data;
}

export async function apiCreateRuangan(nama: string): Promise<Ruangan> {
  const response = await apiClient.post<Ruangan>('/ruangan', { nama });
  return response.data;
}

export async function apiUpdateRuangan(id: string, nama: string): Promise<Ruangan> {
  const response = await apiClient.patch<Ruangan>(`/ruangan/${id}`, { nama });
  return response.data;
}

export async function apiDeleteRuangan(id: string) {
  const response = await apiClient.delete(`/ruangan/${id}`);
  return response.data as { ok: boolean };
}

export async function apiReorderRuangan(urutan: string[]) {
  const response = await apiClient.put('/ruangan/reorder', { urutan });
  return response.data as { ok: boolean };
}

export async function apiCreateJenisPiket(
  ruanganId: string,
  nama: string,
): Promise<JenisPiket> {
  const response = await apiClient.post<JenisPiket>(`/ruangan/${ruanganId}/jenis`, { nama });
  return response.data;
}

export async function apiUpdateJenisPiket(id: string, input: { nama?: string; isActive?: boolean }) {
  const response = await apiClient.patch(`/ruangan/jenis/${id}`, input);
  return response.data as JenisPiket;
}

export async function apiDeleteJenisPiket(id: string) {
  const response = await apiClient.delete(`/ruangan/jenis/${id}`);
  return response.data as { ok: boolean };
}

export const ruanganKeys = {
  list: ['ruangan', 'list'] as const,
};

export function useRuangan() {
  return useQuery({ queryKey: ruanganKeys.list, queryFn: apiGetRuangan });
}