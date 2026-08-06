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
import { formatCurrency, formatShortDate } from '@/lib/format';
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

  return (
    <View style={styles.weekendCard}>
      <Text style={styles.weekendKicker}>MINGGU INI</Text>
      <Text style={styles.weekendTitle}>Lo di kos atau pulang?</Text>
      <View style={styles.weekendDays}>
        <DayToggle
          label="Sabtu"
          value={data.weekend.saturday}
          frozen={data.weekend.frozen}
          onPress={() => toggle('sabtu')}
        />
        <DayToggle
          label="Minggu"
          value={data.weekend.sunday}
          frozen={data.weekend.frozen}
          onPress={() => toggle('minggu')}
        />
      </View>
    </View>
  );
}

function DayToggle({
  label,
  value,
  frozen,
  onPress,
}: {
  label: string;
  value: WeekendChoice | null;
  frozen: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.dayCol}>
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.toggleTrack}>
        <Pressable
          onPress={onPress}
          style={[styles.seg, value === 'di_kos' && styles.segActive]}>
          <Text style={[styles.segText, value === 'di_kos' && styles.segActiveText]}>
            Di kos
          </Text>
        </Pressable>
        <Pressable
          onPress={onPress}
          style={[styles.seg, value === 'pulang' && styles.segActive]}>
          <Text style={[styles.segText, value === 'pulang' && styles.segActiveText]}>
            Pulang
          </Text>
        </Pressable>
      </View>
      {frozen && <Text style={styles.frozenNote}>terkunci</Text>}
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
      <View style={styles.scheduleList}>
        {data.scheduleWeek.map((row) => (
          <ScheduleRowItem key={row.tanggal} row={row} />
        ))}
      </View>
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
    gap: 4,
  },
  weekendKicker: { ...type.kicker, color: colors.paper },
  weekendTitle: { fontFamily: fontFamilies.display[600], fontSize: 17, lineHeight: 22, color: colors.paper },
  weekendDays: { flexDirection: 'row', gap: 10, marginTop: 10 },
  dayCol: { flex: 1, gap: 6 },
  dayLabel: { ...type.kicker, fontSize: 9.5, color: colors.paper },
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: colors.paperDeep,
    borderRadius: 13,
    padding: 3,
    gap: 4,
  },
  seg: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.ink },
  segText: { fontFamily: fontFamilies.body[600], fontSize: 11.5, color: colors.inkSoft },
  segActiveText: { color: colors.paper },
  frozenNote: { ...type.body, fontSize: 9.5, color: colors.paper, textAlign: 'center' },
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