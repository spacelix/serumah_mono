import { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

import {
  fetchUpdateManifest,
  getInstalledVersionCode,
  resolveUpdate,
  updateManifestUrl,
  type UpdateDecision,
  type UpdateManifest,
} from '@/lib/update';
import { UPDATE_CHECK_EVENT } from '@/lib/update-events';

export interface UpdateCheckResult {
  decision: UpdateDecision;
  checking: boolean;
  recheck: () => void;
}

export function useUpdateCheck(): UpdateCheckResult {
  const [decision, setDecision] = useState<UpdateDecision>({
    type: 'uptodate',
  });
  const [checking, setChecking] = useState(true);
  const inFlight = useRef(false);

  const check = async () => {
    if (inFlight.current) return;
    if (__DEV__ || !updateManifestUrl) {
      setChecking(false);
      return;
    }
    inFlight.current = true;
    try {
      const manifest: UpdateManifest | null = await fetchUpdateManifest();
      if (manifest) {
        setDecision(resolveUpdate(getInstalledVersionCode(), manifest));
      }
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  };

  // Check on mount + re-check every time the app returns to the foreground
  // (e.g. user taps the "update available" push notification → app opens →
  // dialog shows even if the app was already running in background). Juga
  // re-check saat notif "update tersedia" di-tap (emitUpdateCheck) — supaya
  // popup muncul walau app sudah foreground.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void check();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const eventSub = DeviceEventEmitter.addListener(UPDATE_CHECK_EVENT, () => {
      void check();
    });
    return () => {
      cancelAnimationFrame(id);
      appSub.remove();
      eventSub.remove();
    };
  }, []);

  return {
    decision,
    checking,
    recheck: () => void check(),
  };
}
