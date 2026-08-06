import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface JenisPiketItem {
  id: string;
  nama: string;
}

export interface TodayJadwal {
  id: string;
  tanggal: string;
  anggotaId: string;
  anggota: { id: string; nama: string; kamar: string | null };
  ruangan: string[];
  isMine: boolean;
}

export interface ExistingSubmission {
  id: string;
  status: string;
  submittedAt: string | null;
}

export interface PiketToday {
  jadwal: TodayJadwal | null;
  ruangan: { id: string; nama: string }[];
  jenisByRuangan: Record<string, JenisPiketItem[]>;
  existingSubmission: ExistingSubmission | null;
}

export interface RuanganProofInput {
  ruanganId: string;
  fotoBeforeUrl: string;
  fotoAfterUrl: string;
  jenisSelesai: string[];
}

export interface CreateSubmissionInput {
  jadwalId: string;
  proofs: RuanganProofInput[];
}

export interface SubmissionResult {
  submission: ExistingSubmission;
}

export interface UploadPhotoResult {
  url: string;
  key: string;
}

export async function apiGetPiketToday(): Promise<PiketToday> {
  const response = await apiClient.get<PiketToday>('/piket/today');
  return response.data;
}

export async function apiCreateSubmission(
  input: CreateSubmissionInput,
): Promise<SubmissionResult> {
  const response = await apiClient.post<SubmissionResult>(
    '/piket/submissions',
    input,
  );
  return response.data;
}

export async function uploadPiketPhoto(
  uri: string,
  path: string,
): Promise<string> {
  const formData = new FormData();
  const filename = path.split('/').pop() ?? `foto_${Date.now()}.jpg`;
  formData.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('folder', 'piket');
  formData.append('path', path);

  const response = await apiClient.post<UploadPhotoResult>(
    '/storage/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.url;
}

export const piketKeys = {
  today: ['piket', 'today'] as const,
};

export function usePiketToday() {
  return useQuery({
    queryKey: piketKeys.today,
    queryFn: apiGetPiketToday,
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubmissionInput) => apiCreateSubmission(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: piketKeys.today }),
  });
}