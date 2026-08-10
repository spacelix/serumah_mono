import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '@/lib/api-client';

// Show notifications while the app is in the foreground (banner + alert).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Deep link keys we send from the backend: piket, swap, tagihan, beranda.
export function routeForDeepLink(deepLink?: string): string | null {
  if (!deepLink) return null;
  const key = deepLink.replace('/(tabs)/', '').replace(/\//g, '');
  const valid = ['piket', 'swap', 'tagihan', 'beranda', 'index'];
  return valid.includes(key) ? key : null;
}

/** Expo project id — required by getExpoPushTokenAsync. Injected by EAS build
 * (extra.eas.projectId) or fallback to EXPO_PUBLIC_EAS_PROJECT_ID. */
export function expoProjectId(): string {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return fromConfig ?? fromEnv ?? '';
}

/** Ask permission (Android 13+) and return true when notifications allowed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'undetermined' || current.status === 'denied') {
    // 'denied' → re-ask (first denial may be a soft dismiss); Android keeps
    // "don't ask again" only after two denials.
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return false;
}

/**
 * Register the device push token with the backend. Uses the Expo push token
 * (`getExpoPushTokenAsync`) — Expo Push Service relays it to FCM/APNs for us,
 * so the backend only needs to call the Expo Push API (no FCM credentials).
 * No-op on simulator / no permission / no project id.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  const projectId = expoProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn('[notifications] projectId tidak ditemukan (extra.eas.projectId / EXPO_PUBLIC_EAS_PROJECT_ID).');
    }
    return;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (__DEV__) console.log('[notifications] token ter-register');
    await apiClient.post('/push/token', { token: token.data });
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[notifications] gagal dapat token:',
        e instanceof Error ? e.message : e,
      );
    }
  }
}

/** Clear the device token on logout. */
export async function clearPushToken(): Promise<void> {
  try {
    await apiClient.delete('/push/token');
  } catch {
    // Best effort — ignore network/401.
  }
}

/** Android notification channel (SDK 57 style). */
export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('serumah', {
    name: 'Serumah',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3D6B5C',
  });
}

/** Returns a deep-link key for a notification tap, or null. */
export function deepLinkFromResponse(
  response: Notifications.NotificationResponse,
): string | null {
  return routeForDeepLink(
    (response.notification.request.content.data?.deepLink as string) ?? null,
  );
}
