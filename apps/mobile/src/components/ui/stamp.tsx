import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

const STATUS_STYLE = {
  lunas: {
    bg: colors.pineSoft,
    color: colors.pineDeep,
    border: colors.pineDeep,
  },
  approved: {
    bg: colors.pineSoft,
    color: colors.pineDeep,
    border: colors.pineDeep,
  },
  belum_bayar: {
    bg: colors.brickSoft,
    color: colors.brickDeep,
    border: colors.brickDeep,
  },
  ditolak: {
    bg: colors.brickSoft,
    color: colors.brickDeep,
    border: colors.brickDeep,
  },
  menunggu_konfirmasi: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
  pending: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
  menunggu: {
    bg: colors.mustardSoft,
    color: colors.mustardInk,
    border: colors.mustardInk,
  },
} as const;

type StatusKey = keyof typeof STATUS_STYLE;

function statusKey(status: string): StatusKey {
  if (status in STATUS_STYLE) return status as StatusKey;
  return 'pending';
}

function labelOf(status: string): string {
  switch (status) {
    case 'lunas':
    case 'approved':
      return 'LUNAS';
    case 'belum_bayar':
      return 'BELUM BAYAR';
    case 'menunggu_konfirmasi':
      return 'MENUNGGU KONFIRMASI';
    case 'ditolak':
      return 'DITOLAK';
    default:
      return 'MENUNGGU';
  }
}

export function Stamp({ status }: { status: string }) {
  const key = statusKey(status);
  const s = STATUS_STYLE[key];
  const dashed = status === 'menunggu_konfirmasi' || status === 'menunggu';
  return (
    <View
      style={[
        styles.stamp,
        { backgroundColor: s.bg, borderColor: s.border },
        dashed && styles.dashed,
      ]}
    >
      <Text style={[styles.text, { color: s.color }]}>{labelOf(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  dashed: { borderStyle: 'dashed' },
  text: {
    fontFamily: fontFamilies.display[700],
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
