import * as Device from 'expo-device';
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
 * No-op on simulator / no permission / not configured.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.log('[notifications] izin notifikasi ditolak');
    return;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    console.log('[notifications] token device:', token.data);
    await apiClient.post('/push/token', { token: token.data });
    console.log('[notifications] token ter-register');
  } catch (e) {
    // FCM/Expo push not configured on this build (mis. google-services.json
    // tidak ter-inject) — log biar diagnosa.
    console.log(
      '[notifications] gagal dapat token:',
      e instanceof Error ? e.message : e,
    );
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
