import { apiClient } from '@/lib/api-client';

export interface AvatarUploadResult {
  url: string;
  key: string;
}

export interface UpdateProfileInput {
  nama: string;
  fotoProfil?: string;
  kontakDarurat?: string;
  alamat?: string;
}

export interface Anggota {
  id: string;
  nama: string;
  fotoProfil: string | null;
  kontakDarurat: string | null;
  alamat: string | null;
  role: string | null;
  rumahId: string | null;
}

export interface UpdateProfileResponse {
  anggota: Anggota;
}

export interface Rumah {
  id: string;
  nama: string;
  alamat: string;
  inviteCode: string;
}

export interface CreateRumahResponse {
  rumah: Rumah;
  inviteCode: string;
}

export interface JoinRumahResponse {
  rumah: { id: string; nama: string };
}

export interface JoinPreview {
  nama: string;
  alamat: string;
  anggotaCount: number;
}

export async function apiUpdateProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse> {
  const response = await apiClient.put<UpdateProfileResponse>('/anggota/me/profile', input);
  return response.data;
}

export async function apiCreateRumah(input: {
  nama: string;
  alamat: string;
}): Promise<CreateRumahResponse> {
  const response = await apiClient.post<CreateRumahResponse>('/rumah', input);
  return response.data;
}

export async function apiJoinRumah(inviteCode: string): Promise<JoinRumahResponse> {
  const response = await apiClient.post<JoinRumahResponse>('/rumah/join', { inviteCode });
  return response.data;
}

export async function apiPreviewJoin(kode: string): Promise<JoinPreview> {
  const response = await apiClient.get<JoinPreview>('/rumah/join/preview', {
    params: { kode },
  });
  return response.data;
}

export async function uploadAvatar(uri: string): Promise<string> {
  const formData = new FormData();
  const filename = `avatar_${Date.now()}.jpg`;
  formData.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await apiClient.post<{ url: string; key: string }>('/storage/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}