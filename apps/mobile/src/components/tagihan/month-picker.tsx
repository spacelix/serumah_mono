import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMonthLabel } from '@/features/tagihan/api/tagihan';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (bulan: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(shift(value, -1))}
        style={styles.navBtn}
      >
        <ChevronLeft color={colors.ink} size={16} strokeWidth={2.4} />
      </Pressable>
      <Text style={styles.label}>{formatMonthLabel(value)}</Text>
      <Pressable
        onPress={() => onChange(shift(value, 1))}
        style={styles.navBtn}
      >
        <ChevronRight color={colors.ink} size={16} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function shift(bulan: string, delta: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    color: colors.ink,
  },
});
