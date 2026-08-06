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