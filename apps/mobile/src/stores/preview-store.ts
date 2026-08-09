import { create } from 'zustand';

interface PreviewState {
  url: string | null;
  open: (url: string) => void;
  close: () => void;
}

/** Preview gambar full-screen (bukti transfer, foto piket, dll). */
export const usePreviewStore = create<PreviewState>((set) => ({
  url: null,
  open: (url) => set({ url }),
  close: () => set({ url: null }),
}));