import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  minVersionCode: number;
  apkUrl: string;
  notes: string;
}

export type UpdateDecision =
  | { type: 'uptodate' }
  | { type: 'optional'; manifest: UpdateManifest }
  | { type: 'force'; manifest: UpdateManifest };

const manifestUrl = process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL;

export const updateManifestUrl = manifestUrl ?? null;

export function getInstalledVersionCode(): number {
  const raw = Application.nativeBuildVersion;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchUpdateManifest(): Promise<UpdateManifest | null> {
  if (!manifestUrl) return null;
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) return null;
    return (await response.json()) as UpdateManifest;
  } catch {
    return null;
  }
}

export function resolveUpdate(
  installed: number,
  manifest: UpdateManifest,
): UpdateDecision {
  if (installed >= manifest.versionCode) return { type: 'uptodate' };
  if (manifest.minVersionCode > installed) return { type: 'force', manifest };
  return { type: 'optional', manifest };
}

const downloadDestination = new File(Paths.cache, 'serumah-update.apk');
export const downloadPath = downloadDestination.uri;

export async function downloadUpdate(
  apkUrl: string,
  onProgress?: (bytesWritten: number, totalBytes: number) => void,
): Promise<File> {
  if (downloadDestination.exists) downloadDestination.delete();
  const downloaded = await File.downloadFileAsync(apkUrl, downloadDestination, {
    idempotent: true,
    onProgress: (progress) => {
      onProgress?.(progress.bytesWritten, progress.totalBytes);
    },
  });
  return downloaded;
}

export async function installApk(file: File): Promise<void> {
  await IntentLauncher.startActivityAsync(
    'android.intent.action.VIEW',
    {
      data: file.contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1,
    },
  );
}