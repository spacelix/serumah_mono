import { create } from 'zustand';

export interface InfoDialogPayload {
  title: string;
  message: string;
}

interface DialogState {
  dialog: InfoDialogPayload | null;
  show: (title: string, message: string) => void;
  close: () => void;
}

/**
 * Info dialog global (single action, tombol "Tutup") — pengganti
 * `Alert.alert`. Dirender lewat `<AppDialog />` yang di-host di root layout
 * dan menampilkan `<ConfirmDialog>` (mode single) agar sesuai desain Serumah.
 */
export const useDialogStore = create<DialogState>((set) => ({
  dialog: null,
  show: (title, message) => set({ dialog: { title, message } }),
  close: () => set({ dialog: null }),
}));

export const dialog = {
  alert: (title: string, message: string) =>
    useDialogStore.getState().show(title, message),
};