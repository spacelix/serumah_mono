import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSheet } from '@/components/ui/animated-sheet';
import {
  currentMonth,
  formatMonthLabel,
  useTagihanMonths,
} from '@/features/tagihan/api/tagihan';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

/**
 * Month filter untuk tab Tagihan. Bar full-width (border 1px line, radius 11)
 * dengan navigasi `‹`/`›` (nonaktif di ujung daftar bulan) dan tombol bulan
 * (label + `▼`) yang membuka bottom sheet "Pilih bulan" hanya berisi
 * bulan-bulan yang punya data.
 */
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (bulan: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useTagihanMonths();
  const months = useMonthOptions(data?.months ?? [], value);

  const index = months.indexOf(value);
  const atStart = index <= 0;
  const atEnd = index >= months.length - 1;

  return (
    <>
      <View style={styles.bar}>
        <Pressable
          onPress={() => onChange(months[index + 1] ?? value)}
          disabled={atEnd}
          style={styles.navBtn}
          hitSlop={4}
        >
          <ChevronLeft
            color={atEnd ? colors.lineDash : colors.inkSoft}
            size={16}
            strokeWidth={2.4}
          />
        </Pressable>
        <Pressable onPress={() => setOpen(true)} style={styles.centerBtn}>
          <Text style={styles.label}>{formatMonthLabel(value)}</Text>
          <Text style={styles.drop}>▼</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(months[index - 1] ?? value)}
          disabled={atStart}
          style={styles.navBtn}
          hitSlop={4}
        >
          <ChevronRight
            color={atStart ? colors.lineDash : colors.inkSoft}
            size={16}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>

      {open && (
        <MonthSheet
          months={months}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Bulan-bulan yang tersedia: data + bulan aktif + bulan berjalan, descending. */
function useMonthOptions(available: string[], value: string): string[] {
  const all = new Set([...available, value, currentMonth()]);
  return [...all].sort().reverse();
}

function MonthSheet({
  months,
  value,
  onChange,
  onClose,
}: {
  months: string[];
  value: string;
  onChange: (bulan: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const today = currentMonth();

  const onSelect = (bulan: string) => {
    onChange(bulan);
    onClose();
  };

  return (
    <AnimatedSheet
      visible
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
    >
      <View style={styles.handle} />
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Pilih bulan</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={6}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.listGroup}>
          {months.map((bulan) => {
            const squad = statusLabel(bulan, today);
            const active = bulan === value;
            return (
              <Pressable
                key={bulan}
                onPress={() => onSelect(bulan)}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text
                  style={[styles.rowLabel, active && styles.rowLabelActive]}
                >
                  {formatMonthLabel(bulan)}
                </Text>
                <Text
                  style={[styles.rowStatus, active && styles.rowStatusActive]}
                >
                  {squad}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AnimatedSheet>
  );
}

function statusLabel(bulan: string, today: string): string {
  if (bulan === today) return 'Bulan ini';
  return bulan < today ? 'Riwayat' : 'Belum jalan';
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 3,
    marginHorizontal: 20,
  },
  navBtn: {
    width: 26,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  label: {
    fontFamily: fontFamilies.body[600],
    fontSize: 12.5,
    color: colors.ink,
  },
  drop: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 8,
    color: colors.inkSoft,
  },
  sheet: {
    width: '100%',
    maxHeight: '50%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.14,
    color: colors.ink,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fontFamilies.body[500],
    fontSize: 15,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  list: { paddingBottom: 0 },
  listScroll: { flexGrow: 0, flexShrink: 1 },
  listGroup: { gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  rowActive: {
    backgroundColor: colors.ink,
  },
  rowLabel: {
    fontFamily: fontFamilies.body[600],
    fontSize: 13,
    color: colors.ink,
  },
  rowLabelActive: { color: colors.paper },
  rowStatus: {
    fontFamily: fontFamilies.mono[500],
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  rowStatusActive: { color: 'rgba(239, 234, 224, 0.6)' },
});