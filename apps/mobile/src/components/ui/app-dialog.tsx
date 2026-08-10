import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDialogStore } from '@/stores/dialog-store';

/**
 * Host info dialog global. Dirender sekali di root layout; dipanggil via
 * `dialog.alert(title, message)` dari mana saja — menggantikan `Alert.alert`
 * dengan tampilan ConfirmDialog Serumah (single action, tombol "Tutup").
 */
export function AppDialog() {
  const payload = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);

  return (
    <ConfirmDialog
      visible={payload != null}
      title={payload?.title ?? ''}
      message={payload?.message ?? ''}
      confirmText="Tutup"
      single
      onConfirm={close}
      onCancel={close}
    />
  );
}