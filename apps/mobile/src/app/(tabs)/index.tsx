import { Droplets, ReceiptText, TriangleAlert } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import {
  useConfirmGalon,
  useDashboard,
  useSetWeekendStatus,
  type DashboardData,
  type ScheduleRow,
  type WeekendChoice,
  type WeekDayKey,
} from '@/features/dashboard/api/dashboard';
import { formatCurrency, formatShortDate, formatWeekdayDate } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { fontFamilies, type } from '@/theme/typography';

export default function BerandaScreen() {
  const { data, isLoading } = useDashboard();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Beranda" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {isLoading || data == null ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Memuat…</Text>
          </View>
        ) : (
          <>
            <ScheduleReminderBanner data={data} />
            <WeekendCard data={data} />
            <GalonWidget data={data} />
            <BillingSummary data={data} />
            <ScheduleList data={data} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScheduleReminderBanner({ data }: { data: DashboardData }) {
  const router = useRouter();

  if (!data.isAdmin || !data.scheduleIncomplete) return null;

  return (
    <Pressable
      onPress={() => router.push('/rumah/manage?scrollTo=generate')}
      style={({ pressed }) => [styles.reminderBanner, pressed && styles.reminderBannerPressed]}>
      <View style={styles.reminderIcon}>
        <TriangleAlert color={colors.brickDeep} size={16} strokeWidth={2.2} />
      </View>
      <View style={styles.reminderText}>
        <Text style={styles.reminderTitle}>Jadwal piket pekan ini belum dibuat</Text>
        <Text style={styles.reminderSub}>
          Klik buat generate sisa pekan ini — pekan depannya otomatis.
        </Text>
      </View>
      <Text style={styles.reminderCta}>Kelola</Text>
    </Pressable>
  );
}

function WeekendCard({ data }: { data: DashboardData }) {
  const setStatus = useSetWeekendStatus();

  const set = (hari: WeekDayKey, status: WeekendChoice) => {
    if (data.weekend.frozen) {
      Alert.alert('Status dibekukan', 'Status akhir pekan sudah dibekukan (Jumat 20:00).');
      return;
    }
    setStatus.mutate({ hari, status });
  };

  const toggle = (day: WeekDayKey) => {
    const current = day === 'sabtu' ? data.weekend.saturday : data.weekend.sunday;
    set(day, current === 'di_kos' ? 'pulang' : 'di_kos');
  };

  const sabtuDate = weekendDate(5);
  const mingguDate = weekendDate(6);

  return (
    <View style={styles.weekendCard}>
      <View style={styles.weekendHead}>
        <Text style={styles.weekendTitle}>Weekend ini lo di kos?</Text>
        <View style={styles.weekendDeadline}>
          <Text style={styles.weekendDeadlineText}>Deadline Jum 20:00</Text>
        </View>
      </View>
      <Text style={styles.weekendSub}>
        Kalau lo di kos dan piket di Sabtu/Minggu, lo bebas piket Senin–Jumat minggu itu.
      </Text>
      <View style={styles.weekendDays}>
        <WeekendDayRow
          label={formatWeekdayDate(sabtuDate)}
          value={data.weekend.saturday}
          frozen={data.weekend.frozen}
          onPick={(status) => set('sabtu', status)}
        />
        <WeekendDayRow
          label={formatWeekdayDate(mingguDate)}
          value={data.weekend.sunday}
          frozen={data.weekend.frozen}
          onPick={(status) => set('minggu', status)}
        />
      </View>
      {data.weekend.anggotaLain.length > 0 && (
        <View style={styles.weekendOthers}>
          <Text style={styles.weekendOthersLabel}>ANGGOTA LAIN</Text>
          <View style={styles.weekendOthersList}>
            {data.weekend.anggotaLain.map((m) => (
              <Text
                key={m.id}
                style={[
                  styles.weekendOtherItem,
                  m.status === 'Pulang' && styles.weekendOtherItemMuted,
                ]}>
                {m.nama} · {m.status}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function weekendDate(dowOffset: number): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dowOffset);
  return target.toISOString();
}

function WeekendDayRow({
  label,
  value,
  frozen,
  onPick,
}: {
  label: string;
  value: WeekendChoice | null;
  frozen: boolean;
  onPick: (status: WeekendChoice) => void;
}) {
  const pick = (status: WeekendChoice) => {
    if (frozen) {
      Alert.alert('Status dibekukan', 'Status akhir pekan sudah dibekukan (Jumat 20:00).');
      return;
    }
    onPick(status);
  };

  return (
    <View style={styles.weekendDayRow}>
      <Text style={styles.weekendDayLabel}>{label}</Text>
      <View style={styles.weekendDayBtns}>
        <Pressable
          onPress={() => pick('di_kos')}
          style={[styles.weekendDayBtn, value === 'di_kos' && styles.weekendDayBtnActive]}>
          <Text
            style={[
              styles.weekendDayBtnText,
              value === 'di_kos' && styles.weekendDayBtnTextActive,
            ]}>
            Di kos
          </Text>
        </Pressable>
        <Pressable
          onPress={() => pick('pulang')}
          style={[styles.weekendDayBtn, value === 'pulang' && styles.weekendDayBtnActive]}>
          <Text
            style={[
              styles.weekendDayBtnText,
              value === 'pulang' && styles.weekendDayBtnTextActive,
            ]}>
            Pulang
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GalonWidget({ data }: { data: DashboardData }) {
  const confirm = useConfirmGalon();
  const giliran = data.galon;

  const onBuy = () => {
    if (giliran.giliran == null) return;
    confirm.mutate(giliran.giliran.id, {
      onError: (error) =>
        Alert.alert('Gagal', error instanceof Error ? error.message : 'Terjadi kesalahan.'),
    });
  };

  return (
    <View style={styles.galonCard}>
      <View style={styles.galonBody}>
        <View style={styles.galonIcon}>
          <Droplets color={colors.mustard} size={18} strokeWidth={2.2} />
        </View>
        <View style={styles.galonText}>
          <Text style={styles.galonKicker}>GILIRAN GALON</Text>
          <Text style={styles.galonName}>{giliran.namaAnggota ?? 'Belum ada giliran'}</Text>
        </View>
      </View>
      <Pressable
        onPress={onBuy}
        disabled={giliran.giliran == null || confirm.isPending}
        style={({ pressed }) => [styles.galonBtn, pressed && styles.galonBtnPressed]}>
        <Text style={styles.galonBtnText}>
          {confirm.isPending ? 'Memproses…' : 'Sudah Beli'}
        </Text>
      </Pressable>
    </View>
  );
}

function BillingSummary({ data }: { data: DashboardData }) {
  const { countUnpaid, totalUnpaid } = data.billing;
  return (
    <View style={styles.billingCard}>
      <View style={styles.billingLeft}>
        <View style={styles.billingIcon}>
          <ReceiptText color={colors.ink} size={16} strokeWidth={2} />
        </View>
        <View style={styles.billingText}>
          <Text style={styles.billingKicker}>TAGIHAN BULAN INI</Text>
          <Text style={styles.billingCount}>{countUnpaid} tagihan belum lunas</Text>
        </View>
      </View>
      <Text style={[styles.billingAmount, totalUnpaid === 0 && styles.billingPaid]}>
        {totalUnpaid === 0 ? 'Lunas' : formatCurrency(totalUnpaid)}
      </Text>
    </View>
  );
}

function ScheduleList({ data }: { data: DashboardData }) {
  return (
    <View style={styles.scheduleBlock}>
      <Text style={styles.sectionKicker}>JADWAL PIKET · PEKAN INI</Text>
      {data.scheduleWeek.length === 0 ? (
        <View style={styles.scheduleEmpty}>
          <Text style={styles.scheduleEmptyTitle}>Belum ada jadwal pekan ini</Text>
          <Text style={styles.scheduleEmptySub}>
            {data.isAdmin
              ? 'Klik banner di atas buat generate jadwal.'
              : 'Tunggu PJ Kos membuat jadwal piket pekan ini.'}
          </Text>
        </View>
      ) : (
        <View style={styles.scheduleList}>
          {data.scheduleWeek.map((row) => (
            <ScheduleRowItem key={row.tanggal} row={row} />
          ))}
        </View>
      )}
    </View>
  );
}

function ScheduleRowItem({ row }: { row: ScheduleRow }) {
  const today = isToday(row.tanggal);
  const isFree = row.statusTag === 'Free';
  const isLibur = row.statusTag === 'LIBUR';

  return (
    <View style={[styles.scheduleRow, isFree && styles.scheduleRowFree]}>
      <View
        style={[
          styles.dateChip,
          today && styles.dateChipToday,
          isFree && styles.dateChipFree,
        ]}>
        <Text style={[styles.dow, today && styles.dowToday, isFree && styles.textMuted]}>
          {row.dow}
        </Text>
        <Text
          style={[styles.dateNum, today && styles.dateNumToday, isFree && styles.textMuted]}>
          {formatShortDate(row.tanggal)}
        </Text>
      </View>
      <View style={styles.scheduleBody}>
        <Text style={[styles.memberName, (isLibur || isFree) && styles.textMuted]} numberOfLines={1}>
          {isLibur || isFree ? 'Libur' : row.anggota?.nama ?? 'Belum ada jadwal'}
        </Text>
        <Text style={[styles.rooms, (isLibur || isFree) && styles.textMuted]} numberOfLines={1}>
          {isLibur || isFree ? '' : row.ruangan.join(' · ')}
        </Text>
      </View>
      <StatusPill tag={row.statusTag} today={today} />
    </View>
  );
}

function StatusPill({ tag, today }: { tag: string; today: boolean }) {
  const isLibur = tag === 'LIBUR';
  const isFree = tag === 'Free';
  const done = tag === 'Selesai';
  return (
    <View
      style={[
        styles.tagPill,
        today && styles.tagToday,
        (isLibur || isFree) && styles.tagFree,
        done && styles.tagDone,
      ]}>
      <Text
        style={[
          styles.tagText,
          today && styles.tagTextToday,
          (isLibur || isFree) && styles.textMuted,
          done && styles.tagTextDone,
        ]}>
        {tag}
      </Text>
    </View>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 108, gap: 12 },
  loading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { ...type.body, color: colors.inkSoft },
  reminderBanner: {
    backgroundColor: colors.brickSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.brickSoft,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderBannerPressed: { backgroundColor: colors.paperDeep },
  reminderIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { fontFamily: fontFamilies.body[600], fontSize: 12, color: colors.brickDeep },
  reminderSub: { fontFamily: fontFamilies.body[400], fontSize: 10, lineHeight: 14, color: colors.brickDeep },
  reminderCta: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.brickDeep, textDecorationLine: 'underline' },
  weekendCard: {
    backgroundColor: colors.pine,
    borderRadius: radius['3xl'],
    padding: 16,
    paddingBottom: 14,
    gap: 6,
  },
  weekendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekendTitle: {
    fontFamily: fontFamilies.display[600],
    fontSize: 14.5,
    letterSpacing: -0.01,
    color: colors.paper,
    flexShrink: 1,
  },
  weekendDeadline: {
    borderWidth: 1,
    borderColor: 'rgba(239, 234, 224, 0.4)',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  weekendDeadlineText: {
    ...type.kicker,
    fontSize: 9.5,
    color: colors.paper,
  },
  weekendSub: {
    fontFamily: fontFamilies.body[400],
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(239, 234, 224, 0.72)',
    marginBottom: 6,
  },
  weekendDays: { flexDirection: 'column', gap: 8 },
  weekendDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(239, 234, 224, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  weekendDayLabel: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.paper },
  weekendDayBtns: { flexDirection: 'row', gap: 5 },
  weekendDayBtn: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 234, 224, 0.14)',
  },
  weekendDayBtnActive: { backgroundColor: colors.paper },
  weekendDayBtnText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: 'rgba(239, 234, 224, 0.8)' },
  weekendDayBtnTextActive: { color: colors.pineDeep },
  weekendOthers: { marginTop: 11, gap: 7 },
  weekendOthersLabel: {
    ...type.kicker,
    fontSize: 9.5,
    color: 'rgba(239, 234, 224, 0.5)',
  },
  weekendOthersList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekendOtherItem: {
    fontFamily: fontFamilies.body[500],
    fontSize: 10.5,
    color: colors.paper,
    marginRight: 5,
  },
  weekendOtherItemMuted: { color: 'rgba(239, 234, 224, 0.55)' },
  galonCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    paddingLeft: 13,
    borderLeftWidth: 4,
    borderLeftColor: colors.mustard,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  galonBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  galonIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.mustardSoft, alignItems: 'center', justifyContent: 'center' },
  galonText: { flex: 1 },
  galonKicker: { ...type.kicker, fontSize: 9, color: colors.inkSoft },
  galonName: { fontFamily: fontFamilies.body[600], fontSize: 14.5, color: colors.ink },
  galonBtn: { backgroundColor: colors.pine, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  galonBtnPressed: { backgroundColor: colors.pineDeep },
  galonBtnText: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.paper },
  billingCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['2xl'],
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  billingIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' },
  billingText: { gap: 2 },
  billingKicker: { ...type.kicker, fontSize: 9, color: colors.inkSoft },
  billingCount: { fontFamily: fontFamilies.body[400], fontSize: 11, color: colors.inkSoft },
  billingAmount: { fontFamily: fontFamilies.mono[700], fontSize: 20, letterSpacing: -0.4, color: colors.brick },
  billingPaid: { color: colors.inkSoft },
  scheduleBlock: { gap: 8 },
  sectionKicker: { ...type.kicker, fontSize: 9.5, color: colors.inkMuted },
  scheduleEmpty: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    padding: 18,
    alignItems: 'center',
    gap: 5,
  },
  scheduleEmptyTitle: { fontFamily: fontFamilies.body[600], fontSize: 13, color: colors.ink },
  scheduleEmptySub: { fontFamily: fontFamilies.body[400], fontSize: 11, lineHeight: 16, color: colors.inkSoft, textAlign: 'center' },
  scheduleList: { gap: 8 },
  scheduleRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleRowFree: { backgroundColor: colors.paperDeep },
  dateChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipToday: { backgroundColor: colors.mustard },
  dateChipFree: { backgroundColor: 'transparent' },
  dow: { fontFamily: fontFamilies.mono[500], fontSize: 8.5, letterSpacing: 0.6, color: colors.ink },
  dowToday: { color: colors.mustardInkStrong },
  dateNum: { fontFamily: fontFamilies.mono[700], fontSize: 12, color: colors.ink },
  dateNumToday: { color: colors.mustardInkStrong },
  textMuted: { color: colors.inkMuted },
  scheduleBody: { flex: 1, gap: 1 },
  memberName: { fontFamily: fontFamilies.body[600], fontSize: 12.5, color: colors.ink },
  rooms: { fontFamily: fontFamilies.body[400], fontSize: 10, color: colors.inkSoft },
  tagPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  tagToday: { backgroundColor: colors.mustardSoft, borderColor: colors.mustardBorder },
  tagFree: { borderStyle: 'dashed', borderColor: colors.lineDash },
  tagDone: { backgroundColor: colors.pineSoft, borderColor: 'transparent' },
  tagText: { fontFamily: fontFamilies.body[600], fontSize: 9.5, color: colors.inkSoft },
  tagTextToday: { color: colors.mustardInk },
  tagTextDone: { color: colors.pineDeep },
});