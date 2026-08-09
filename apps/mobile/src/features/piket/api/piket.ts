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
  anggota: { id: string; nama: string };
  ruangan: string[];
  isMine: boolean;
}

export interface ExistingSubmission {
  id: string;
  status: string;
  submittedAt: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  proofs: {
    ruanganId: string;
    fotoBefore: string | null;
    fotoAfter: string | null;
    jenisSelesai: string[];
  }[];
}

export interface PiketToday {
  jadwal: TodayJadwal | null;
  ruangan: { id: string; nama: string }[];
  jenisByRuangan: Record<string, JenisPiketItem[]>;
  totalJenis: number;
  existingSubmission: ExistingSubmission | null;
  nominalDenda: number;
}

export interface RuanganProofInput {
  ruanganId: string;
  fotoBeforeUrl: string | null;
  fotoAfterUrl: string | null;
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

export interface SubmissionItem {
  id: string;
  status: string;
  submittedAt: string | null;
  tanggal: string;
  anggota: { id: string; nama: string };
  proofs: {
    ruanganId: string;
    ruanganNama: string;
    fotoBefore: string | null;
    fotoAfter: string | null;
    jenisSelesai: string[];
    jenisList: string[];
  }[];
  isMine: boolean;
  reviewerId: string | null;
  reviewerName: string | null;
  isMyTurn: boolean;
  dendaApprove: number;
  dendaReject: number;
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
  submissions: (status: 'pending' | 'resolved') =>
    ['piket', 'submissions', status] as const,
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: piketKeys.today }),
  });
}

export async function apiGetSubmissions(
  status: 'pending' | 'resolved',
): Promise<SubmissionItem[]> {
  const response = await apiClient.get<SubmissionItem[]>(
    `/piket/submissions?status=${status}`,
  );
  return response.data;
}

export function useSubmissions(status: 'pending' | 'resolved') {
  return useQuery({
    queryKey: piketKeys.submissions(status),
    queryFn: () => apiGetSubmissions(status),
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/piket/submissions/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piket', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: piketKeys.today });
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/piket/submissions/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piket', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: piketKeys.today });
    },
  });
}
