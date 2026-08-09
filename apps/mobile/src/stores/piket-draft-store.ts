import { create } from 'zustand';

export interface RoomDraft {
  ruanganId: string;
  fotoBefore: string | null;
  fotoAfter: string | null;
  jenisSelesai: string[];
  uploading: boolean;
}

interface PiketDraftState {
  drafts: Record<string, RoomDraft>;
  setPhoto: (ruanganId: string, slot: 'before' | 'after', uri: string) => void;
  clearPhoto: (ruanganId: string, slot: 'before' | 'after') => void;
  toggleJenis: (ruanganId: string, jenisId: string) => void;
  setUploading: (ruanganId: string, uploading: boolean) => void;
  reset: () => void;
}

export const usePiketDraft = create<PiketDraftState>((set) => ({
  drafts: {},
  setPhoto: (ruanganId, slot, uri) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [ruanganId]: {
          ...(s.drafts[ruanganId] ?? {
            ruanganId,
            fotoBefore: null,
            fotoAfter: null,
            jenisSelesai: [],
            uploading: false,
          }),
          [slot === 'before' ? 'fotoBefore' : 'fotoAfter']: uri,
        },
      },
    })),
  clearPhoto: (ruanganId, slot) =>
    set((s) => {
      const draft = s.drafts[ruanganId];
      if (!draft) return {};
      return {
        drafts: {
          ...s.drafts,
          [ruanganId]: {
            ...draft,
            [slot === 'before' ? 'fotoBefore' : 'fotoAfter']: null,
          },
        },
      };
    }),
  toggleJenis: (ruanganId, jenisId) =>
    set((s) => {
      const draft = s.drafts[ruanganId] ?? {
        ruanganId,
        fotoBefore: null,
        fotoAfter: null,
        jenisSelesai: [],
        uploading: false,
      };
      const has = draft.jenisSelesai.includes(jenisId);
      return {
        drafts: {
          ...s.drafts,
          [ruanganId]: {
            ...draft,
            jenisSelesai: has
              ? draft.jenisSelesai.filter((j) => j !== jenisId)
              : [...draft.jenisSelesai, jenisId],
          },
        },
      };
    }),
  setUploading: (ruanganId, uploading) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [ruanganId]: {
          ...(s.drafts[ruanganId] ?? {
            ruanganId,
            fotoBefore: null,
            fotoAfter: null,
            jenisSelesai: [],
            uploading: false,
          }),
          uploading,
        },
      },
    })),
  reset: () => set({ drafts: {} }),
}));
