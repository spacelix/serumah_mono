import { apiClient } from '@/lib/api-client';

/**
 * Upload a proof photo to a storage folder with a deterministic path, returns
 * the permanent public URL to store in the DB.
 *
 * @param folder allowed folder, e.g. 'denda-bukti', 'iuran-bukti', 'listrik'
 * @param uri local image URI
 * @param slug deterministic slug (id / bulan) embedded in the key
 */
export async function uploadProof(
  folder: string,
  uri: string,
  slug: string,
): Promise<string> {
  const ts = Date.now();
  const filename = `${folder.replace(/[^a-z0-9]/g, '_')}_${ts}.jpg`;
  const path = `${folder}/${slug}_${ts}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('folder', folder);
  formData.append('path', path);

  const response = await apiClient.post<{ url: string; key: string }>(
    '/storage/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.url;
}