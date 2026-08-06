import { apiGetIuran, currentMonth } from '@/features/tagihan/api/tagihan';
import { useQuery } from '@tanstack/react-query';

export interface RumahMember {
  id: string;
  nama: string;
}

/**
 * All rumah members, derived from the iuran list response (one iuran row per
 * member) for the current month. Used by the swap member picker.
 */
export function useIuranMembers(): RumahMember[] {
  const { data } = useQuery({
    queryKey: ['tagihan', 'iuran', currentMonth()],
    queryFn: () => apiGetIuran(currentMonth()),
  });
  const members = new Map<string, RumahMember>();
  for (const item of data?.iuranList ?? []) {
    members.set(item.anggota.id, item.anggota);
  }
  return [...members.values()];
}