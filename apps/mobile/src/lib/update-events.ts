import { DeviceEventEmitter } from 'react-native';

/** Event: minta re-check update (dipicu saat notif "update tersedia" di-tap). */
export const UPDATE_CHECK_EVENT = 'serumah:update-check';

export function emitUpdateCheck(): void {
  DeviceEventEmitter.emit(UPDATE_CHECK_EVENT);
}
