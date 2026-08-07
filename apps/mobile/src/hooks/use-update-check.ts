import { useEffect, useRef, useState } from 'react';

import {
  fetchUpdateManifest,
  getInstalledVersionCode,
  resolveUpdate,
  updateManifestUrl,
  type UpdateDecision,
  type UpdateManifest,
} from '@/lib/update';

export interface UpdateCheckResult {
  decision: UpdateDecision;
  checking: boolean;
  dismissed: boolean;
  dismiss: () => void;
  recheck: () => void;
}

export function useUpdateCheck(): UpdateCheckResult {
  const [decision, setDecision] = useState<UpdateDecision>({
    type: 'uptodate',
  });
  const [checking, setChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);
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

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void check();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return {
    decision,
    checking,
    dismissed,
    dismiss: () => setDismissed(true),
    recheck: () => void check(),
  };
}
