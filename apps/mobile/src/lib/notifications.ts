import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '@/lib/api-client';

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
  if (current.status === 'undetermined') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return false;
}

/**
 * Register the device push token with the backend. Uses the NATIVE FCM token
 * (`getDevicePushTokenAsync`) so the backend sends directly to Firebase, not
 * through Expo's relay. No-op on simulator / no permission / not configured.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    await apiClient.post('/push/token', { token: token.data });
  } catch {
    // FCM/Expo push not configured on this build — swallow silently.
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
