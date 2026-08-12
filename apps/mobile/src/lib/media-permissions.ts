import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

/**
 * Media permission helpers (Expo best practice):
 * - check status first, only request when undetermined,
 * - when denied/blocked → open system Settings (no way back otherwise).
 * Returns true when the permission is granted.
 */

export async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const req = await ImagePicker.requestCameraPermissionsAsync();
    if (req.granted) return true;
  }
  await Linking.openSettings();
  return false;
}

export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (req.granted) return true;
  }
  await Linking.openSettings();
  return false;
}
